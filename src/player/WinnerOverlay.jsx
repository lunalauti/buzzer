import { useState } from 'react'
import { useWs } from '../contexts/WebSocketContext'
import Confetti from '../components/Confetti'
import styles from './WinnerOverlay.module.css'

export default function WinnerOverlay({ winnerColor, winnerName, currentTrack }) {
  const [revealed, setRevealed] = useState(false)
  const { send } = useWs()

  const reveal = () => {
    setRevealed(true)
    send('reveal_track')
  }

  return (
    <>
      <Confetti baseColor={winnerColor} />
      <div className={styles.overlay} style={{ background: winnerColor }}>
        <div className={styles.trophy}>🏆</div>
        <div className={styles.label}>¡PRIMERO!</div>
        <div className={styles.name}>{winnerName}</div>

        {revealed && currentTrack && (
          <div className={styles.trackReveal}>
            <div className={styles.trackName}>{currentTrack.name}</div>
            <div className={styles.trackArtist}>{currentTrack.artist}</div>
          </div>
        )}

        {!revealed && currentTrack && (
          <button className={styles.revealBtn} onClick={reveal}>👁 REVELAR</button>
        )}

        <div className={styles.actions}>
          <button className={styles.btn} onClick={() => send('surrender')}>RENDIRSE</button>
          <button className={`${styles.btn} ${styles.btnNext}`} onClick={() => send('reset')}>SIGUIENTE ▶</button>
          <button className={`${styles.btn} ${styles.btnSkip}`} onClick={() => send('skip')}>⏩ SALTEAR</button>
        </div>
      </div>
    </>
  )
}
