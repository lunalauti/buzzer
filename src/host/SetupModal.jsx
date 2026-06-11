import { useState, useEffect } from 'react'
import { useSpotifyStore } from '../store/spotifyStore'
import styles from './SetupModal.module.css'

const ROUNDS_KEY = 'buzzer_setup_rounds'

export default function SetupModal({ onConfirm, onLogin }) {
  const spotifyMode = useSpotifyStore(s => s.spotifyMode)

  const [rounds, setRounds] = useState(() => {
    const stored = parseInt(localStorage.getItem(ROUNDS_KEY) || '10')
    return Math.min(20, Math.max(1, isNaN(stored) ? 10 : stored))
  })

  useEffect(() => {
    localStorage.setItem(ROUNDS_KEY, rounds)
  }, [rounds])

  const dec = () => setRounds(n => Math.max(1, n - 1))
  const inc = () => setRounds(n => Math.min(20, n + 1))

  let spotifyEl
  if (spotifyMode === 'init') {
    spotifyEl = <span className={styles.spotifyChecking}>VERIFICANDO...</span>
  } else if (spotifyMode === 'login') {
    spotifyEl = (
      <button className={styles.spotifyConnectBtn} onClick={onLogin}>
        CONECTAR
      </button>
    )
  } else {
    spotifyEl = <span className={styles.spotifyConnectedBadge}>Conectado ✓</span>
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.card}>
        <div className={styles.title}>NUEVA PARTIDA</div>

        <div className={styles.section}>
          <span className={styles.label}>Número de rondas</span>
          <div className={styles.picker}>
            <button className={styles.pickerBtn} onClick={dec}>−</button>
            <span className={styles.pickerNum}>{rounds}</span>
            <button className={styles.pickerBtn} onClick={inc}>+</button>
          </div>
        </div>

        <div className={styles.spotifySection}>
          <span className={styles.label}>Spotify</span>
          <div className={styles.spotifyRow}>{spotifyEl}</div>
        </div>

        <button className={styles.comenzarBtn} onClick={() => onConfirm(rounds)}>
          COMENZAR
        </button>
      </div>
    </div>
  )
}
