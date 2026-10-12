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

const PLAYER_COLORS = [
  { bg: '#FF6B6B' }, { bg: '#4ECDC4' }, { bg: '#FFE66D' }, { bg: '#A8E6CF' },
  { bg: '#C9B1FF' }, { bg: '#FF9F43' }, { bg: '#74B9FF' }, { bg: '#FD79A8' },
]

function makeGameState() {
  return {
    winner: null, winnerColor: null, winnerId: null,
    locked: false, players: {}, currentTrack: null, buzzOrder: [],
    scores: {}, awaitingChoice: false,
    totalRounds: 0, currentRound: 0, gameOver: false,
  }
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// ── ROOMS ──────────────────────────────────────────────────────────────────

const rooms = new Map()

function getOrCreateRoom(roomCode) {
  if (!rooms.has(roomCode)) {
    const ttlTimer = setTimeout(() => rooms.delete(roomCode), 8 * 60 * 60 * 1000)
    rooms.set(roomCode, {
      gameState: makeGameState(),
      clients: new Set(),
      tokenMap: {},
      playerData: {},
      colorIndex: 0,
      ttlTimer,
    })
  }
  return rooms.get(roomCode)
}

function broadcastToRoom(roomCode, data) {
  const room = rooms.get(roomCode)
  if (!room) return
  const msg = JSON.stringify(data)
  for (const client of room.clients) {
    if (client.readyState === 1) client.send(msg)
  }
}

function broadcastStateToRoom(roomCode) {
  const room = rooms.get(roomCode)
  if (!room) return
  const { gameState: gs } = room
  broadcastToRoom(roomCode, {
    type:         'state',
    winner:       gs.winner,
    winnerId:     gs.winnerId,
    winnerColor:  gs.winnerColor,
    locked:       gs.locked,
    players:      Object.values(gs.players).map(p => ({ id: p.id, name: p.name, color: p.color })),
    currentTrack: gs.currentTrack,
    buzzOrder:    gs.buzzOrder,
    scores:       gs.scores,
    awaitingChoice: gs.awaitingChoice,
    totalRounds:  gs.totalRounds,
    currentRound: gs.currentRound,
    gameOver:     gs.gameOver,
  })
}

function endRound(roomCode) {
  const room = rooms.get(roomCode)
  if (!room) return
  const { gameState: gs } = room
  if (gs.totalRounds > 0 && gs.currentRound >= gs.totalRounds) {
    gs.gameOver = true
    broadcastToRoom(roomCode, { type: 'game_over' })
    broadcastStateToRoom(roomCode)
    return
  }
  broadcastToRoom(roomCode, { type: 'round_reset' })
}

// ── API ────────────────────────────────────────────────────────────────────

app.get('/api/config', (req, res) => {
  res.json({ spotifyClientId: process.env.SPOTIFY_CLIENT_ID })
})

app.post('/api/rooms', (req, res) => {
  let code
  do { code = generateRoomCode() } while (rooms.has(code))
  getOrCreateRoom(code)
  res.json({ roomCode: code })
})

app.get('/api/server-info', (req, res) => {
  const ip = getLocalIP()
  const serverPort = Number(process.env.PORT) || 3000
  const PORT = serverPort === 3001 ? 3000 : serverPort
  res.json({ ip, port: PORT, url: `http://${ip}:${PORT}` })
})

// ── SPOTIFY OAUTH ──────────────────────────────────────────────────────────

const BASE_URL = process.env.APP_URL
  ? process.env.APP_URL.replace(/\/$/, '')
  : 'http://127.0.0.1:3000'

const REDIRECT_URI = BASE_URL + '/callback'

const oauthStates = new Set()

app.get('/auth/login', (req, res) => {
  const { SPOTIFY_CLIENT_ID } = process.env
  const roomCode = (req.query.room || 'LOCAL').toUpperCase()
  const randomPart = crypto.randomBytes(16).toString('hex')
  const state = roomCode + '.' + randomPart
  oauthStates.add(state)
  const scopes = 'streaming user-read-email user-read-private user-read-playback-state user-read-currently-playing user-modify-playback-state playlist-read-private playlist-read-collaborative'
  res.redirect('https://accounts.spotify.com/authorize?' + new URLSearchParams({
    response_type: 'code',
    client_id:     SPOTIFY_CLIENT_ID,
    scope:         scopes,
    redirect_uri:  REDIRECT_URI,
    state,
  }))
})

app.get('/callback', async (req, res) => {
  const { code, state, error } = req.query
  const FRONTEND = BASE_URL === 'http://127.0.0.1:3000' ? 'http://localhost:3000' : BASE_URL

  if (error || !oauthStates.has(state)) return res.redirect(`${FRONTEND}/host?auth_error=1`)
  oauthStates.delete(state)

  const roomCode = state.split('.')[0]

  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env
  const creds = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI }),
  })
  const data = await tokenRes.json()
  if (!data.access_token) return res.redirect(`${FRONTEND}/host?room=${roomCode}&auth_error=1`)

  const expiry = Date.now() + data.expires_in * 1000
  res.redirect(
    `${FRONTEND}/host?room=${roomCode}&sp_token=${data.access_token}&sp_expiry=${expiry}&sp_refresh=${data.refresh_token}`
  )
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

// ── SPOTIFY CLIENT-CREDENTIALS (preview URLs) ──────────────────────────────

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

// ── WEBSOCKET ──────────────────────────────────────────────────────────────

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'ws://localhost')
  ws.roomCode = (url.searchParams.get('room') || 'LOCAL').toUpperCase()

  const room = getOrCreateRoom(ws.roomCode)
  room.clients.add(ws)

  let playerId = null

  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw) } catch { return }

    const room = rooms.get(ws.roomCode)
    if (!room) return
    const gs = room.gameState

    if (msg.type === 'join') {
      const { name, token } = msg

      if (token && room.tokenMap[token] && room.playerData[room.tokenMap[token]]) {
        const existingId = room.tokenMap[token]
        const saved = room.playerData[existingId]
        playerId = existingId
        gs.players[playerId] = { id: playerId, name: saved.name, color: saved.color, ws }
        ws.send(JSON.stringify({ type: 'joined', id: playerId, color: saved.color }))
        broadcastStateToRoom(ws.roomCode)
        return
      }

      playerId = Date.now() + Math.random().toString(36).slice(2)
      const color = PLAYER_COLORS[room.colorIndex % PLAYER_COLORS.length]
      room.colorIndex++
      const playerName = name || 'Jugador'
      room.playerData[playerId] = { name: playerName, color: color.bg, token: token || null }
      gs.players[playerId] = { id: playerId, name: playerName, color: color.bg, ws }
      if (token) room.tokenMap[token] = playerId
      ws.send(JSON.stringify({ type: 'joined', id: playerId, color: color.bg }))
      broadcastStateToRoom(ws.roomCode)
    }

    if (msg.type === 'buzz' && playerId) {
      const player = gs.players[playerId]
      if (!player) return
      const alreadyBuzzed = gs.buzzOrder.some(b => b.id === playerId)
      if (!alreadyBuzzed) {
        gs.awaitingChoice = false
        gs.buzzOrder.push({ id: player.id, name: player.name, color: player.color })
        if (!gs.locked) {
          gs.locked = true
          gs.winner = player.name
          gs.winnerId = player.id
          gs.winnerColor = player.color
        }
        broadcastStateToRoom(ws.roomCode)
      }
    }

    if (msg.type === 'reset') {
      if (gs.winnerId) gs.scores[gs.winnerId] = (gs.scores[gs.winnerId] || 0) + 1
      gs.locked = false
      gs.winner = null
      gs.winnerId = null
      gs.winnerColor = null
      gs.buzzOrder = []
      gs.awaitingChoice = false
      endRound(ws.roomCode)
      broadcastStateToRoom(ws.roomCode)
    }

    if (msg.type === 'play_track' && msg.track) {
      gs.currentTrack = msg.track
      if (gs.totalRounds > 0 && !gs.gameOver) {
        gs.currentRound = gs.currentRound === 0 ? 1 : gs.currentRound + 1
      }
      broadcastStateToRoom(ws.roomCode)
    }

    if (msg.type === 'clear_track') {
      gs.currentTrack = null
      broadcastStateToRoom(ws.roomCode)
    }

    if (msg.type === 'reveal_track') {
      broadcastToRoom(ws.roomCode, { type: 'reveal_track' })
    }

    if (msg.type === 'partial_reset') {
      gs.locked = false
      gs.winner = null
      gs.winnerId = null
      gs.winnerColor = null
      broadcastStateToRoom(ws.roomCode)
    }

    if (msg.type === 'surrender') {
      if (!gs.winner) return
      if (gs.winnerId) gs.scores[gs.winnerId] = (gs.scores[gs.winnerId] || 0) - 1
      const nextPlayer = gs.buzzOrder[1]
      if (nextPlayer) {
        gs.buzzOrder.shift()
        gs.winner = nextPlayer.name
        gs.winnerId = nextPlayer.id
        gs.winnerColor = nextPlayer.color
        gs.locked = true
      } else {
        const nonBuzzed = Object.keys(gs.players).length - gs.buzzOrder.length
        gs.locked = false
        gs.winner = null
        gs.winnerId = null
        gs.winnerColor = null
        if (nonBuzzed === 0) {
          gs.buzzOrder = []
          gs.awaitingChoice = false
          endRound(ws.roomCode)
        } else {
          gs.awaitingChoice = true
        }
      }
      broadcastStateToRoom(ws.roomCode)
    }

    if (msg.type === 'skip') {
      gs.locked = false
      gs.winner = null
      gs.winnerId = null
      gs.winnerColor = null
      gs.buzzOrder = []
      gs.awaitingChoice = false
      endRound(ws.roomCode)
      broadcastStateToRoom(ws.roomCode)
    }

    if (msg.type === 'set_rounds') {
      gs.totalRounds = Math.max(1, Math.min(20, Number(msg.count) || 1))
      gs.currentRound = 0
      gs.gameOver = false
      broadcastStateToRoom(ws.roomCode)
    }

    if (msg.type === 'replay_request') {
      gs.awaitingChoice = false
      gs.locked = false
      gs.winner = null
      gs.winnerId = null
      gs.winnerColor = null
      broadcastToRoom(ws.roomCode, { type: 'round_replay' })
      broadcastStateToRoom(ws.roomCode)
    }

    if (msg.type === 'game_reset') {
      gs.locked = false
      gs.winner = null
      gs.winnerId = null
      gs.winnerColor = null
      gs.buzzOrder = []
      broadcastStateToRoom(ws.roomCode)
    }

    if (msg.type === 'full_reset') {
      broadcastToRoom(ws.roomCode, { type: 'full_reset' })
      room.gameState = makeGameState()
      room.colorIndex = 0
      for (const k of Object.keys(room.tokenMap)) delete room.tokenMap[k]
      for (const k of Object.keys(room.playerData)) delete room.playerData[k]
      broadcastStateToRoom(ws.roomCode)
    }
  })

  ws.on('close', () => {
    const room = rooms.get(ws.roomCode)
    if (!room) return
    room.clients.delete(ws)
    if (playerId && room.gameState.players[playerId]) {
      delete room.gameState.players[playerId]
      broadcastStateToRoom(ws.roomCode)
    }
  })
})

// ── SERVE FRONTEND ─────────────────────────────────────────────────────────

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
