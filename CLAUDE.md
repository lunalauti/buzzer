# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

```bash
node server.js
```

Or double-click `Buzzer.command` (Mac) — it starts the server and opens the host view automatically.

- Player view: `http://localhost:3000`
- Host view: `http://localhost:3000/host.html`
- On the same WiFi network, replace `localhost` with the machine's local IP (shown on startup or via `/api/server-info`).

## Environment

Create a `.env` file with:

```
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SPOTIFY_PLAYLIST_ID=...   # optional default playlist
PORT=3000                 # optional
```

The Spotify redirect URI is hardcoded to `http://127.0.0.1:3000/callback` — register this in your Spotify app's dashboard.

## Architecture

**Backend (`server.js`)** — single Express + WebSocket server:
- REST endpoints: `/api/config`, `/api/server-info`, `/api/random-track`, `/auth/login`, `/auth/refresh`, `/callback`
- WebSocket hub: all connected clients share one mutable `gameState` object; any message triggers `broadcastState()` to all clients
- Spotify client-credentials flow (server-side) for `getRandomTrack()` — fetches preview URLs
- Spotify Authorization Code flow (user-facing, host only) for `spFetch()` — controls actual playback via Web API

**Frontend** — two single-file HTML pages (no build step):
- `public/index.html` — player buzzer view; three states (`joinScreen`, `buzzerScreen`, `winnerOverlay`/`positionOverlay`) driven by WebSocket messages
- `public/host.html` — host control panel; manages Spotify auth via `localStorage` (`sp_token`, `sp_expiry`, `sp_refresh`), controls playback, and renders the player grid

## WebSocket Message Protocol

Server-to-clients:
- `state` — full game snapshot (players, winner, locked, buzzOrder, currentTrack)
- `round_reset` — a round was reset (triggers auto-play on host)
- `reveal_track` — winner revealed the track; host shows `nowPlayingCard`
- `full_reset` — wipes all state, players return to join screen

Client-to-server:
- `join { name }` — register player
- `buzz` — player pressed the button
- `reset` — winner triggers new round (clears buzzOrder)
- `partial_reset` — replay same track (keeps buzzOrder, clears winner)
- `game_reset` — host picks next track (clears buzzOrder, no round_reset event)
- `full_reset` — host's global reset button
- `play_track { track }` — host broadcasts currently playing track metadata
- `clear_track` — clears track from state
- `reveal_track` — winner reveals the answer

## Key Behaviors

- `buzzOrder` records all buzz timestamps in order; the first entry wins
- `partial_reset` vs `reset`: `reset` clears `buzzOrder` (new round), `partial_reset` keeps it (replay same track, allow re-buzzing)
- `game_reset` vs `full_reset`: `game_reset` is silent (host picks next track); `full_reset` sends the `full_reset` event that resets all clients to join screen
- Spotify playback uses the host's user token (OAuth), not the server's client-credentials token
- `playDuration` is stored in `localStorage` as `buzzer_duration` (milliseconds, default 2000)
- Track preview snippets use Spotify's 30-second preview URLs (server-side); actual playback uses the Web Playback SDK / Transfer Playback API (host-side)
