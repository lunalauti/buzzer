import styles from './WinnerBanner.module.css'

export default function WinnerBanner({ winner, winnerColor }) {
  return (
    <div className={styles.banner} style={{ background: winnerColor }}>
      <div className={styles.trophy}>🏆</div>
      <div className={styles.info}>
        <div className={styles.label}>¡Primer buzzer!</div>
        <div className={styles.name}>{winner}</div>
        <div className={styles.sub}>pulsó primero</div>
      </div>
    </div>
  )
}
