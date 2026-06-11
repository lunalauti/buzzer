import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { useWs } from '../contexts/WebSocketContext'
import styles from './RoundsPanel.module.css'

export default function RoundsPanel() {
  const [localCount, setLocalCount] = useState(5)
  const totalRounds = useGameStore(s => s.totalRounds)
  const currentRound = useGameStore(s => s.currentRound)
  const gameOver = useGameStore(s => s.gameOver)
  const { send } = useWs()

  const confirm = () => send('set_rounds', { count: localCount })

  // Pre-game: no rounds configured yet
  if (totalRounds === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.title}>RONDAS</div>
        <div className={styles.picker}>
          <button className={styles.pickerBtn} onClick={() => setLocalCount(n => Math.max(1, n - 1))}>−</button>
          <span className={styles.pickerNum}>{localCount}</span>
          <button className={styles.pickerBtn} onClick={() => setLocalCount(n => Math.min(20, n + 1))}>+</button>
        </div>
        <button className={styles.confirmBtn} onClick={confirm}>CONFIRMAR</button>
      </div>
    )
  }

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
