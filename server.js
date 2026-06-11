import 'dotenv/config'
import express from 'express'
import { WebSocketServer } from 'ws'
import http from 'http'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

const distDir = path.join(__dirname, 'dist')

// ── UTILS ──────────────────────────────────────────────────────────────────

function getLocalIP() {
  const nets = os.networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return 'localhost'
}

app.get('/api/config', (req, res) => {
  res.json({ spotifyClientId: process.env.SPOTIFY_CLIENT_ID })
})

const oauthStates = new Set()

app.get('/auth/login', (req, res) => {
  const { SPOTIFY_CLIENT_ID } = process.env
  const state = crypto.randomBytes(16).toString('hex')
  oauthStates.add(state)
  const scopes = 'streaming user-read-email user-read-private user-read-playback-state user-read-currently-playing user-modify-playback-state playlist-read-private playlist-read-collaborative'
  res.redirect('https://accounts.spotify.com/authorize?' + new URLSearchParams({
    response_type: 'code',
    client_id:     SPOTIFY_CLIENT_ID,
    scope:         scopes,
    redirect_uri:  'http://127.0.0.1:3000/callback',
    state,
  }))
})

app.get('/callback', async (req, res) => {
  const { code, state, error } = req.query
  const FRONTEND = 'http://localhost:3000'
  if (error || !oauthStates.has(state)) return res.redirect(`${FRONTEND}/host?auth_error=1`)
  oauthStates.delete(state)

  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env
  const creds = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: 'http://127.0.0.1:3000/callback' }),
  })
  const data = await tokenRes.json()
  if (!data.access_token) return res.redirect(`${FRONTEND}/host?auth_error=1`)

  const expiry = Date.now() + data.expires_in * 1000
  res.redirect(`${FRONTEND}/host?sp_token=${data.access_token}&sp_expiry=${expiry}&sp_refresh=${data.refresh_token}`)
})

app.get('/auth/refresh', async (req, res) => {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env
  const creds = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: req.query.token }),
  })
  const data = await tokenRes.json()
  if (!data.access_token) return res.status(400).json({ error: 'refresh failed' })
  res.json({
    access_token:  data.access_token,
    expires_in:    data.expires_in,
    refresh_token: data.refresh_token || req.query.token,
  })
})

app.get('/api/server-info', (req, res) => {
  const ip = getLocalIP()
  const serverPort = Number(process.env.PORT) || 3000
  const PORT = serverPort === 3001 ? 3000 : serverPort
  res.json({ ip, port: PORT, url: `http://${ip}:${PORT}` })
})

// ── SPOTIFY (server-side client credentials for preview URLs) ──────────────

let spotifyToken = null
let tokenExpiry  = 0

async function getSpotifyToken() {
  if (spotifyToken && Date.now() < tokenExpiry) return spotifyToken

  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) return null

  const creds = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`)
  const data = await res.json()
  spotifyToken = data.access_token
  tokenExpiry  = Date.now() + (data.expires_in - 60) * 1000
  return spotifyToken
}

async function getRandomTrack(playlistId) {
  const token = await getSpotifyToken()
  if (!token) throw new Error('No Spotify token')

  const infoRes = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=1&offset=0`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!infoRes.ok) {
    const errBody = await infoRes.text()
    throw new Error(`Playlist fetch failed: ${infoRes.status} — ${errBody}`)
  }
  const info = await infoRes.json()
  const total = info.total || 0
  if (total === 0) throw new Error('Playlist vacía o no accesible')

  for (let attempt = 0; attempt < 15; attempt++) {
    const offset = Math.floor(Math.random() * total)
    const trackRes = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=1&offset=${offset}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!trackRes.ok) continue
    const trackData = await trackRes.json()
    const item = trackData.items?.[0]?.track
    if (item?.preview_url) return item
  }
  throw new Error('No se encontró ninguna canción con preview disponible en esta playlist')
}

app.get('/api/random-track', async (req, res) => {
  const playlistId = req.query.playlist || process.env.SPOTIFY_PLAYLIST_ID
  if (!playlistId) return res.status(400).json({ error: 'Falta playlist ID' })
  try {
    const track = await getRandomTrack(playlistId)
    res.json({
      id:         track.id,
      name:       track.name,
      artist:     track.artists?.map(a => a.name).join(', '),
      previewUrl: track.preview_url,
      cover:      track.album?.images?.[1]?.url || track.album?.images?.[0]?.url,
    })
  } catch (err) {
    console.error('Spotify error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GAME STATE ─────────────────────────────────────────────────────────────

let gameState = {
  winner: null, winnerColor: null, winnerId: null,
  locked: false, players: {}, currentTrack: null, buzzOrder: [],
  scores: {}, awaitingChoice: false,
  totalRounds: 0, currentRound: 0, gameOver: false,
}

const PLAYER_COLORS = [
  { bg: '#FF6B6B' }, { bg: '#4ECDC4' }, { bg: '#FFE66D' }, { bg: '#A8E6CF' },
  { bg: '#C9B1FF' }, { bg: '#FF9F43' }, { bg: '#74B9FF' }, { bg: '#FD79A8' },
]
let colorIndex = 0

// token → playerId (persists through disconnects within a session)
const tokenMap = {}
// playerId → { name, color, token } (persists through disconnects)
const playerData = {}

function broadcast(data) {
  const msg = JSON.stringify(data)
  wss.clients.forEach(client => { if (client.readyState === 1) client.send(msg) })
}

function broadcastState() {
  broadcast({
    type:         'state',
    winner:       gameState.winner,
    winnerId:     gameState.winnerId,
    winnerColor:  gameState.winnerColor,
    locked:       gameState.locked,
    players:      Object.values(gameState.players).map(p => ({ id: p.id, name: p.name, color: p.color })),
    currentTrack:   gameState.currentTrack,
    buzzOrder:      gameState.buzzOrder,
    scores:         gameState.scores,
    awaitingChoice: gameState.awaitingChoice,
    totalRounds:    gameState.totalRounds,
    currentRound:   gameState.currentRound,
    gameOver:       gameState.gameOver,
  })
}

function endRound() {
  if (gameState.totalRounds > 0 && gameState.currentRound >= gameState.totalRounds) {
    gameState.gameOver = true
    broadcast({ type: 'game_over' })
    broadcastState()
    return
  }
  broadcast({ type: 'round_reset' })
}

wss.on('connection', (ws) => {
  let playerId = null

  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw) } catch { return }

    if (msg.type === 'join') {
      const { name, token } = msg

      // Reconnect via token if the player was previously registered
      if (token && tokenMap[token] && playerData[tokenMap[token]]) {
        const existingId = tokenMap[token]
        const saved = playerData[existingId]
        playerId = existingId
        gameState.players[playerId] = { id: playerId, name: saved.name, color: saved.color, ws }
        ws.send(JSON.stringify({ type: 'joined', id: playerId, color: saved.color }))
        broadcastState()
        return
      }

      playerId = Date.now() + Math.random().toString(36).slice(2)
      const color = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length]
      colorIndex++
      const playerName = name || 'Jugador'
      playerData[playerId] = { name: playerName, color: color.bg, token: token || null }
      gameState.players[playerId] = { id: playerId, name: playerName, color: color.bg, ws }
      if (token) tokenMap[token] = playerId
      ws.send(JSON.stringify({ type: 'joined', id: playerId, color: color.bg }))
      broadcastState()
    }

    if (msg.type === 'buzz' && playerId) {
      const player = gameState.players[playerId]
      if (!player) return
      const alreadyBuzzed = gameState.buzzOrder.some(b => b.id === playerId)
      if (!alreadyBuzzed) {
        gameState.awaitingChoice = false
        gameState.buzzOrder.push({ id: player.id, name: player.name, color: player.color })
        if (!gameState.locked) {
          gameState.locked = true
          gameState.winner = player.name
          gameState.winnerId = player.id
          gameState.winnerColor = player.color
        }
        broadcastState()
      }
    }

    if (msg.type === 'reset') {
      if (gameState.winnerId) {
        gameState.scores[gameState.winnerId] = (gameState.scores[gameState.winnerId] || 0) + 1
      }
      gameState.locked = false
      gameState.winner = null
      gameState.winnerId = null
      gameState.winnerColor = null
      gameState.buzzOrder = []
      gameState.awaitingChoice = false
      endRound()
      broadcastState()
    }

    if (msg.type === 'play_track' && msg.track) {
      gameState.currentTrack = msg.track
      if (gameState.totalRounds > 0 && !gameState.gameOver) {
        gameState.currentRound = gameState.currentRound === 0 ? 1 : gameState.currentRound + 1
      }
      broadcastState()
    }

    if (msg.type === 'clear_track') {
      gameState.currentTrack = null
      broadcastState()
    }

    if (msg.type === 'reveal_track') {
      broadcast({ type: 'reveal_track' })
    }

    if (msg.type === 'partial_reset') {
      gameState.locked = false
      gameState.winner = null
      gameState.winnerId = null
      gameState.winnerColor = null
      broadcastState()
    }

    if (msg.type === 'surrender') {
      if (!gameState.winner) return
      if (gameState.winnerId) {
        gameState.scores[gameState.winnerId] = (gameState.scores[gameState.winnerId] || 0) - 1
      }
      const nextPlayer = gameState.buzzOrder[1]
      if (nextPlayer) {
        gameState.buzzOrder.shift()
        gameState.winner = nextPlayer.name
        gameState.winnerId = nextPlayer.id
        gameState.winnerColor = nextPlayer.color
        gameState.locked = true
      } else {
        const nonBuzzed = Object.keys(gameState.players).length - gameState.buzzOrder.length
        gameState.locked = false
        gameState.winner = null
        gameState.winnerId = null
        gameState.winnerColor = null
        if (nonBuzzed === 0) {
          gameState.buzzOrder = []
          gameState.awaitingChoice = false
          endRound()
        } else {
          gameState.awaitingChoice = true
        }
      }
      broadcastState()
    }

    if (msg.type === 'skip') {
      gameState.locked = false
      gameState.winner = null
      gameState.winnerId = null
      gameState.winnerColor = null
      gameState.buzzOrder = []
      gameState.awaitingChoice = false
      endRound()
      broadcastState()
    }

    if (msg.type === 'set_rounds') {
      gameState.totalRounds = Math.max(1, Math.min(20, Number(msg.count) || 1))
      gameState.currentRound = 0
      gameState.gameOver = false
      broadcastState()
    }

    if (msg.type === 'replay_request') {
      gameState.awaitingChoice = false
      gameState.locked = false
      gameState.winner = null
      gameState.winnerId = null
      gameState.winnerColor = null
      broadcast({ type: 'round_replay' })
      broadcastState()
    }

    if (msg.type === 'game_reset') {
      gameState.locked = false
      gameState.winner = null
      gameState.winnerId = null
      gameState.winnerColor = null
      gameState.buzzOrder = []
      broadcastState()
    }

    if (msg.type === 'full_reset') {
      broadcast({ type: 'full_reset' })
      gameState = { winner: null, winnerId: null, winnerColor: null, locked: false, players: {}, currentTrack: null, buzzOrder: [], scores: {}, awaitingChoice: false, totalRounds: 0, currentRound: 0, gameOver: false }
      colorIndex = 0
      for (const k of Object.keys(tokenMap)) delete tokenMap[k]
      for (const k of Object.keys(playerData)) delete playerData[k]
      broadcastState()
    }
  })

  ws.on('close', () => {
    if (playerId && gameState.players[playerId]) {
      delete gameState.players[playerId]
      broadcastState()
    }
  })
})

// Serve built frontend (production). Registered last so API routes take priority.
if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.use((req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  const isDev = PORT === 3001
  const frontPort = isDev ? 3000 : PORT
  console.log(`\n🎮 Buzzer corriendo en http://localhost:${frontPort}`)
  console.log(`   Vista host: http://localhost:${frontPort}/host\n`)
  if (isDev) console.log('   (backend en :3001, frontend en :3000 via Vite)\n')
})
