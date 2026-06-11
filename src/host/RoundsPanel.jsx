import { useGameStore } from '../store/gameStore'
import styles from './RoundsPanel.module.css'

export default function RoundsPanel() {
  const totalRounds = useGameStore(s => s.totalRounds)
  const currentRound = useGameStore(s => s.currentRound)
  const gameOver = useGameStore(s => s.gameOver)

  // Game over
  if (gameOver) {
    return (
      <div className={styles.panel}>
        <div className={styles.title}>PARTIDA</div>
        <div className={styles.gameOverLabel}>¡FIN!</div>
        <div className={styles.roundsTotal}>{totalRounds} rondas</div>
      </div>
    )
  }

  // In-game: show current round
  const pct = totalRounds > 0 ? (currentRound / totalRounds) * 100 : 0
  return (
    <div className={styles.panel}>
      <div className={styles.title}>RONDA</div>
      <div className={styles.counter}>
        <span className={styles.current}>{currentRound || '—'}</span>
        <span className={styles.separator}>/</span>
        <span className={styles.total}>{totalRounds}</span>
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
