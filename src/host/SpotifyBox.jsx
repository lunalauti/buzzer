import { useRef } from 'react'
import { useSpotifyStore } from '../store/spotifyStore'
import styles from './SpotifyBox.module.css'

const MODE_LABELS = {
  init:        ['⏳ INICIANDO...', true],
  login:       ['🔑 CONECTAR SPOTIFY', false],
  sdk_loading: ['⏳ BUSCANDO DISPOSITIVO...', true],
  no_device:   ['↺ REINTENTAR', false],
  ready:       ['▶ REPRODUCIR', false],
  fetching:    ['⏳ CARGANDO...', true],
  playing:     ['▶ REPRODUCIR', false],
  stopped:     ['▶ REPRODUCIR', false],
}

export default function SpotifyBox({
  progressBarRef,
  playlistValue,
  setPlaylistValue,
  onPlay,
  onReplay,
  onStop,
  onAddTime,
  onLoadDevices,
  onLogin,
}) {
  const spotifyMode = useSpotifyStore(s => s.spotifyMode)
  const currentTrackData = useSpotifyStore(s => s.currentTrackData)
  const currentTrackUri = useSpotifyStore(s => s.currentTrackUri)
  const devices = useSpotifyStore(s => s.devices)
  const deviceId = useSpotifyStore(s => s.deviceId)
  const trackRevealed = useSpotifyStore(s => s.trackRevealed)
  const setDeviceId = useSpotifyStore(s => s.setDeviceId)
  const setCurrentPlaylistId = useSpotifyStore(s => s.setCurrentPlaylistId)
  const setTrackRevealed = useSpotifyStore(s => s.setTrackRevealed)

  const [btnLabel, btnDisabled] = MODE_LABELS[spotifyMode] || ['▶ REPRODUCIR', false]
  const showArea = ['playing', 'fetching', 'stopped'].includes(spotifyMode)
  const isStopped = spotifyMode === 'stopped'
  const isFetching = spotifyMode === 'fetching'
  const showPlaylistRow = ['ready', 'fetching', 'playing', 'stopped', 'no_device'].includes(spotifyMode)
  const showDeviceRow = showPlaylistRow

  const handleMainBtn = () => {
    if (spotifyMode === 'login')     { onLogin();       return }
    if (spotifyMode === 'no_device') { onLoadDevices(); return }
    if (spotifyMode === 'ready')     { onPlay();        return }
    if (spotifyMode === 'stopped')   { onPlay();        return }
  }

  const handleDeviceChange = (e) => {
    setDeviceId(e.target.value)
    setCurrentPlaylistId(null)
  }

  return (
    <div className={styles.box}>
      <div className={styles.top}>
        <div className={styles.brand}>
          <span className={styles.logo}>🎵</span>
          <span className={styles.brandLabel}>Spotify</span>
        </div>

        {showPlaylistRow && (
          <div className={styles.playlistRow}>
            <input
              type="text"
              className={styles.playlistInput}
              placeholder="URL o ID de la playlist"
              spellCheck={false}
              autoComplete="off"
              value={playlistValue}
              onChange={e => setPlaylistValue(e.target.value)}
            />
          </div>
        )}

        <button
          className={styles.spotifyBtn}
          disabled={btnDisabled}
          onClick={handleMainBtn}
        >
          {btnLabel}
        </button>
      </div>

      {showDeviceRow && devices.length > 0 && (
        <div className={styles.deviceRow}>
          <span className={styles.deviceLabel}>Dispositivo</span>
          <select
            className={styles.deviceSelect}
            value={deviceId || ''}
            onChange={handleDeviceChange}
          >
            {devices.map(d => (
              <option key={d.id} value={d.id}>
                {d.is_active ? '● ' : ''}{d.name}
              </option>
            ))}
          </select>
          <button className={styles.refreshBtn} onClick={onLoadDevices} title="Actualizar dispositivos">↺</button>
        </div>
      )}

      {showArea && (
        <div className={styles.playingArea}>
          <div className={styles.progressWrap}>
            <div className={styles.progressBar} ref={progressBarRef} />
          </div>

          {trackRevealed && (
            <div className={styles.trackReveal}>
              {currentTrackData ? (
                <>
                  {currentTrackData.cover && (
                    <img className={styles.trackCover} src={currentTrackData.cover} alt="cover" />
                  )}
                  <div className={styles.trackText}>
                    <div className={styles.trackName}>{currentTrackData.name}</div>
                    <div className={styles.trackArtist}>{currentTrackData.artist}</div>
                  </div>
                </>
              ) : (
                <div className={styles.trackText}>
                  <div className={styles.trackArtist}>Cargando...</div>
                </div>
              )}
            </div>
          )}

          <div className={styles.controls}>
            <button
              className={`${styles.spBtn} ${styles.revealBtn}`}
              disabled={isFetching}
              onClick={() => {
                console.log('[REVELAR] botón presionado. currentTrackData:', currentTrackData)
                setTrackRevealed(true)
              }}
            >
              👁 REVELAR
            </button>
            {isStopped && currentTrackUri && (
              <button className={styles.spBtn} onClick={onReplay}>↺ DE NUEVO</button>
            )}
            {!isStopped && (
              <button className={`${styles.spBtn} ${styles.moreTimeBtn}`} disabled={isFetching} onClick={onAddTime}>
                +5s
              </button>
            )}
            <button className={styles.spBtn} disabled={isFetching} onClick={onPlay}>⏭ SIGUIENTE</button>
            {!isStopped && (
              <button className={`${styles.spBtn} ${styles.stopBtn}`} disabled={isFetching} onClick={onStop}>
                ⏹ DETENER
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
