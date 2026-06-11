import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { useSpotifyStore } from '../store/spotifyStore'
import { useWs } from '../contexts/WebSocketContext'
import { useSpotifyAuth } from '../hooks/useSpotifyAuth'
import { useSpotifyPlayback } from '../hooks/useSpotifyPlayback'
import ConnDot from '../components/ConnDot'
import Confetti from '../components/Confetti'
import QRPanel from './QRPanel'
import SpotifyBox from './SpotifyBox'
import WinnerBanner from './WinnerBanner'
import BuzzOrderList from './BuzzOrderList'
import PlayersGrid from './PlayersGrid'
import SettingsModal from './SettingsModal'
import NowPlayingCard from './NowPlayingCard'
import styles from './HostApp.module.css'

export default function HostApp() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [playlistValue, setPlaylistValue] = useState('')

  const players = useGameStore(s => s.players)
  const winner = useGameStore(s => s.winner)
  const winnerColor = useGameStore(s => s.winnerColor)
  const locked = useGameStore(s => s.locked)
  const buzzOrder = useGameStore(s => s.buzzOrder)

  const npCardVisible = useSpotifyStore(s => s.npCardVisible)
  const currentTrackData = useSpotifyStore(s => s.currentTrackData)

  const { connected, send, onMessage } = useWs()
  const { spFetch, clearAuth, init, login } = useSpotifyAuth()

  const {
    progressBarRef,
    loadDevices,
    playRandom,
    replayTrack,
    stopPlayback,
    addTime,
    scheduleAutoPlay,
    clearAutoPlay,
  } = useSpotifyPlayback({ spFetch, clearAuth, send })

  // Init Spotify on mount
  useEffect(() => {
    const hasAuth = !!searchParams.get('sp_token')
    const authError = !!searchParams.get('auth_error')
    const token = init(searchParams)

    if (hasAuth || authError) {
      // Clean URL after reading params
      setSearchParams({}, { replace: true })
    }

    const setMode = useSpotifyStore.getState().setMode
    const setTrackArtistError = null // handled in SpotifyBox

    if (authError) { setMode('login'); return }
    if (token) { loadDevices() } else { setMode('login') }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle round_reset → auto-play next track
  useEffect(() => {
    return onMessage('round_reset', () => {
      clearAutoPlay()
      scheduleAutoPlay(playlistValue)
    })
  }, [onMessage, clearAutoPlay, scheduleAutoPlay, playlistValue])

  // Handle reveal_track → show now playing card
  useEffect(() => {
    return onMessage('reveal_track', () => {
      useSpotifyStore.getState().setNpCardVisible(true)
    })
  }, [onMessage])

  // Update npCard data when track and winner are available
  useEffect(() => {
    if (locked && winner && currentTrackData) {
      useSpotifyStore.getState().setNpCardVisible(false)
    }
    if (!locked) {
      useSpotifyStore.getState().setNpCardVisible(false)
      useSpotifyStore.getState().setCurrentTrackData(null)
    }
  }, [locked, winner, currentTrackData])

  const handleReset = async () => {
    clearAutoPlay()
    const { spotifyMode } = useSpotifyStore.getState()
    if (spotifyMode === 'playing') {
      await spFetch('https://api.spotify.com/v1/me/player/pause', { method: 'PUT' }).catch(() => {})
    }
    clearAuth()
    useSpotifyStore.getState().setMode('login')
    useSpotifyStore.getState().resetTrack()
    useSpotifyStore.getState().setNpCardVisible(false)
    send('full_reset')
  }

  return (
    <>
      {locked && winnerColor && <Confetti baseColor={winnerColor} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      <header className={styles.header}>
        <div className={styles.logoWrap}>
          <div className={styles.logo}>BUZZ!</div>
          <div className={styles.hostBadge}>HOST VIEW</div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.playerCount}>
            <span>{players.length}</span> jugadores
          </div>
          <button className={styles.btnSettings} onClick={() => setSettingsOpen(true)}>⚙</button>
          <button className={styles.btnReset} onClick={handleReset}>⟳ REINICIAR</button>
          <ConnDot connected={connected} />
        </div>
      </header>

      <main className={styles.main}>
        <QRPanel />

        <SpotifyBox
          progressBarRef={progressBarRef}
          playlistValue={playlistValue}
          setPlaylistValue={setPlaylistValue}
          onPlay={() => playRandom(playlistValue)}
          onReplay={replayTrack}
          onStop={stopPlayback}
          onAddTime={() => addTime(5000)}
          onLoadDevices={loadDevices}
          onLogin={login}
        />

        <NowPlayingCard visible={npCardVisible} track={currentTrackData} />

        {locked && winner && (
          <WinnerBanner winner={winner} winnerColor={winnerColor} buzzOrder={buzzOrder} />
        )}

        {buzzOrder.length > 1 && (
          <BuzzOrderList buzzOrder={buzzOrder} />
        )}

        <div className={styles.sectionTitle}>Jugadores conectados</div>
        <PlayersGrid players={players} winner={winner} buzzOrder={buzzOrder} locked={locked} />
      </main>
    </>
  )
}
