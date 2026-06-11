# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

**Development (hot reload):**
```bash
npm run dev
```
Vite serves the React frontend at `http://localhost:3000`; Express + WebSocket run at port 3001. Vite proxies `/api`, `/auth`, `/callback`, and `/ws` to the backend.

**Production:**
```bash
npm run build   # outputs to dist/
npm start       # serves dist/ on port 3000
```

Or double-click `Buzzer.command` (Mac) — builds and opens the host view automatically.

- Player view: `http://localhost:3000`
- Host view: `http://localhost:3000/host`
- On the same WiFi, replace `localhost` with the machine's local IP (shown on startup or via `/api/server-info`).

## Environment

Create a `.env` file with:
```
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SPOTIFY_PLAYLIST_ID=...   # optional default playlist
PORT=3000                 # optional (production only; dev uses 3001)
```

The Spotify redirect URI is hardcoded to `http://127.0.0.1:3000/callback` — register this in your Spotify app dashboard.

## Architecture

### Backend (`server.js`)
Single Express + WebSocket server (ESM):
- `GET /api/config` — exposes `SPOTIFY_CLIENT_ID` to the frontend
- `GET /api/server-info` — returns local IP for LAN display
- `GET /api/random-track` — server-side client-credentials Spotify call to fetch a preview URL from a playlist
- `GET /auth/login` → `GET /callback` → `GET /auth/refresh` — Spotify Authorization Code flow; tokens are passed back as query params to `/host` and stored in `localStorage` on the client
- WebSocket at `/ws`: all clients share one mutable `gameState` object; every incoming message triggers `broadcastState()` to all connected clients

### Frontend (`src/`)
React 19 + Vite SPA with two routes:

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `PlayerApp` | Buzzer for players joining the game |
| `/host` | `HostApp` | Host control panel with Spotify controls |

Both routes wrap their component in `<WebSocketProvider>`.

**State management (Zustand):**
- `src/store/gameStore.js` — shared game state: `players`, `winner`, `buzzOrder`, `locked`, `currentTrack`, `myId`, `myColor`. Updated from WebSocket messages via `applyState()`.
- `src/store/spotifyStore.js` — host-only Spotify state: `spotifyMode`, `currentTrackData`, `deviceId`, `playDuration`, `devices`. `playDuration` persists to `localStorage` as `buzzer_duration`.

**WebSocket (`src/contexts/WebSocketContext.jsx`):**
- `useWs()` hook provides `{ connected, send, onMessage }` to any component
- Auto-reconnects every 2s on disconnect
- Core message types handled centrally: `state` → `applyState`, `joined` → sets `myId`/`myColor`, `full_reset` → `fullReset`
- Component-specific messages (e.g. `round_reset`, `reveal_track`) are subscribed via `onMessage(type, handler)` and return a cleanup function for use in `useEffect`

**Spotify (host only):**
- `src/hooks/useSpotifyAuth.js` — manages OAuth token lifecycle (read from `localStorage`, auto-refresh via `/auth/refresh`)
- `src/hooks/useSpotifyPlayback.js` — playback controls: `playRandom`, `replayTrack`, `stopPlayback`, `addTime`, `scheduleAutoPlay`; uses `spFetch` (authenticated fetch) from the auth hook

**Player view state machine** (driven entirely by `gameStore`):
- `!myId` → `JoinScreen`
- `myId` set → `BuzzerScreen` (always rendered after join)
- `isWinner` → `WinnerOverlay` rendered on top
- `hasBuzzed && !isWinner` → `PositionOverlay` rendered on top

## WebSocket Message Protocol

**Server → all clients:**
- `state` — full game snapshot (`players`, `winner`, `locked`, `buzzOrder`, `currentTrack`)
- `joined` — sent only to the joining client (`id`, `color`)
- `round_reset` — triggers auto-play on host
- `reveal_track` — winner revealed; host shows `NowPlayingCard`
- `full_reset` — wipes all state, clients return to join screen

**Client → server:**
- `join { name }` — register player
- `buzz` — player pressed the button
- `reset` — winner triggers new round (clears `buzzOrder`)
- `partial_reset` — replay same track (keeps `buzzOrder`, clears winner)
- `game_reset` — host picks next track (clears `buzzOrder`, no broadcast event)
- `full_reset` — host global reset
- `play_track { track }` — host broadcasts currently playing track metadata
- `clear_track` — clears track from state
- `reveal_track` — winner reveals the answer

## Key Behaviors

- `buzzOrder` records all buzz timestamps in order; first entry wins
- `partial_reset` keeps `buzzOrder` (allows re-buzzing same track); `reset` clears it (new round)
- `game_reset` is silent (no client event); `full_reset` broadcasts to all clients resetting them to join screen
- Spotify playback uses the host's OAuth user token (stored in `localStorage`), not the server's client-credentials token
- After a `round_reset` event, the host auto-plays the next track via `scheduleAutoPlay`
- Track preview snippets use Spotify's 30-second preview URLs (server-side); actual playback uses the Web Playback SDK / Transfer Playback API (host-side)
