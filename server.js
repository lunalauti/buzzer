require('dotenv').config();
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));

// ── UTILS ──────────────────────────────────────────────────────────────────

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

app.get('/api/config', (req, res) => {
  res.json({ spotifyClientId: process.env.SPOTIFY_CLIENT_ID });
});

const crypto = require('crypto');
const oauthStates = new Set();

app.get('/auth/login', (req, res) => {
  const { SPOTIFY_CLIENT_ID } = process.env;
  const state  = crypto.randomBytes(16).toString('hex');
  oauthStates.add(state);
  const scopes = 'streaming user-read-email user-read-private user-read-playback-state user-read-currently-playing user-modify-playback-state playlist-read-private playlist-read-collaborative';
  res.redirect('https://accounts.spotify.com/authorize?' + new URLSearchParams({
    response_type: 'code',
    client_id:     SPOTIFY_CLIENT_ID,
    scope:         scopes,
    redirect_uri:  'http://127.0.0.1:3000/callback',
    state,
  }));
});

app.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error || !oauthStates.has(state)) return res.redirect('/host.html?auth_error=1');
  oauthStates.delete(state);

  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
  const creds = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: 'http://127.0.0.1:3000/callback' }),
  });
  const data = await tokenRes.json();
  if (!data.access_token) return res.redirect('/host.html?auth_error=1');

  const expiry = Date.now() + data.expires_in * 1000;
  res.redirect(`/host.html?sp_token=${data.access_token}&sp_expiry=${expiry}&sp_refresh=${data.refresh_token}`);
});

app.get('/auth/refresh', async (req, res) => {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
  const creds = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: req.query.token }),
  });
  const data = await tokenRes.json();
  if (!data.access_token) return res.status(400).json({ error: 'refresh failed' });
  res.json({
    access_token:  data.access_token,
    expires_in:    data.expires_in,
    refresh_token: data.refresh_token || req.query.token,
  });
});

app.get('/api/server-info', (req, res) => {
  const ip = getLocalIP();
  const PORT = process.env.PORT || 3000;
  res.json({ ip, port: PORT, url: `http://${ip}:${PORT}` });
});

// ── SPOTIFY ────────────────────────────────────────────────────────────────

let spotifyToken = null;
let tokenExpiry  = 0;

async function getSpotifyToken() {
  if (spotifyToken && Date.now() < tokenExpiry) return spotifyToken;

  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) return null;

  const creds = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`);
  const data = await res.json();
  spotifyToken = data.access_token;
  tokenExpiry  = Date.now() + (data.expires_in - 60) * 1000;
  return spotifyToken;
}

async function getRandomTrack(playlistId) {
  const token = await getSpotifyToken();
  if (!token) throw new Error('No Spotify token');

  // Get total without fields filter (more compatible)
  const infoRes = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=1&offset=0`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!infoRes.ok) {
    const errBody = await infoRes.text();
    console.error('Spotify 403 body:', errBody);
    throw new Error(`Playlist fetch failed: ${infoRes.status} — ${errBody}`);
  }
  const info = await infoRes.json();
  const total = info.total || 0;
  if (total === 0) throw new Error('Playlist vacía o no accesible');

  // Try up to 15 times to find a track with preview_url
  for (let attempt = 0; attempt < 15; attempt++) {
    const offset = Math.floor(Math.random() * total);
    const trackRes = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=1&offset=${offset}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!trackRes.ok) continue;
    const trackData = await trackRes.json();
    const item = trackData.items?.[0]?.track;
    if (item?.preview_url) return item;
  }
  throw new Error('No se encontró ninguna canción con preview disponible en esta playlist');
}

app.get('/api/random-track', async (req, res) => {
  const playlistId = req.query.playlist || process.env.SPOTIFY_PLAYLIST_ID;
  if (!playlistId) {
    return res.status(400).json({ error: 'Falta playlist ID' });
  }
  try {
    const track = await getRandomTrack(playlistId);
    res.json({
      id:         track.id,
      name:       track.name,
      artist:     track.artists?.map(a => a.name).join(', '),
      previewUrl: track.preview_url,
      cover:      track.album?.images?.[1]?.url || track.album?.images?.[0]?.url,
    });
  } catch (err) {
    console.error('Spotify error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GAME STATE ─────────────────────────────────────────────────────────────

let gameState = {
  winner: null,
  winnerColor: null,
  winnerId: null,
  locked: false,
  players: {},
  currentTrack: null,
  buzzOrder: [],
};

const PLAYER_COLORS = [
  { bg: '#FF6B6B' }, { bg: '#4ECDC4' }, { bg: '#FFE66D' }, { bg: '#A8E6CF' },
  { bg: '#C9B1FF' }, { bg: '#FF9F43' }, { bg: '#74B9FF' }, { bg: '#FD79A8' },
];
let colorIndex = 0;

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => { if (client.readyState === 1) client.send(msg); });
}

function broadcastState() {
  broadcast({
    type:        'state',
    winner:      gameState.winner,
    winnerId:    gameState.winnerId,
    winnerColor: gameState.winnerColor,
    locked:      gameState.locked,
    players:     Object.values(gameState.players).map(p => ({ id: p.id, name: p.name, color: p.color })),
    currentTrack: gameState.currentTrack,
    buzzOrder:   gameState.buzzOrder,
  });
}

wss.on('connection', (ws) => {
  let playerId = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'join') {
      playerId = Date.now() + Math.random().toString(36).slice(2);
      const color = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
      colorIndex++;
      gameState.players[playerId] = { id: playerId, name: msg.name || 'Jugador', color: color.bg, ws };
      ws.send(JSON.stringify({ type: 'joined', id: playerId, color: color.bg }));
      broadcastState();
    }

    if (msg.type === 'buzz' && playerId) {
      const player = gameState.players[playerId];
      if (!player) return;
      const alreadyBuzzed = gameState.buzzOrder.some(b => b.id === playerId);
      if (!alreadyBuzzed) {
        gameState.buzzOrder.push({ id: player.id, name: player.name, color: player.color });
        if (!gameState.locked) {
          gameState.locked = true;
          gameState.winner = player.name;
          gameState.winnerId = player.id;
          gameState.winnerColor = player.color;
        }
        broadcastState();
      }
    }

    if (msg.type === 'reset') {
      gameState.locked = false;
      gameState.winner = null;
      gameState.winnerId = null;
      gameState.winnerColor = null;
      gameState.buzzOrder = [];
      broadcast({ type: 'round_reset' });
      broadcastState();
    }

    if (msg.type === 'play_track' && msg.track) {
      gameState.currentTrack = msg.track;
      broadcastState();
    }

    if (msg.type === 'clear_track') {
      gameState.currentTrack = null;
      broadcastState();
    }

    if (msg.type === 'reveal_track') {
      broadcast({ type: 'reveal_track' });
    }

    // Keeps buzzOrder intact — only clears winner/locked (for replaying same track)
    if (msg.type === 'partial_reset') {
      gameState.locked = false;
      gameState.winner = null;
      gameState.winnerId = null;
      gameState.winnerColor = null;
      broadcastState();
    }

    // Clears everything including buzzOrder, but no round_reset (host-triggered new track)
    if (msg.type === 'game_reset') {
      gameState.locked = false;
      gameState.winner = null;
      gameState.winnerId = null;
      gameState.winnerColor = null;
      gameState.buzzOrder = [];
      broadcastState();
    }

    if (msg.type === 'full_reset') {
      broadcast({ type: 'full_reset' });
      gameState = { winner: null, winnerId: null, winnerColor: null, locked: false, players: {}, currentTrack: null, buzzOrder: [] };
      colorIndex = 0;
      broadcastState();
    }
  });

  ws.on('close', () => {
    if (playerId && gameState.players[playerId]) {
      delete gameState.players[playerId];
      broadcastState();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎮 Buzzer corriendo en http://localhost:${PORT}`);
  console.log(`   Vista host: http://localhost:${PORT}/host.html\n`);
});
