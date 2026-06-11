import styles from './PositionOverlay.module.css'

export default function PositionOverlay({ position, myColor, isLocked, winner }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.reached}>LLEGASTE</div>
      <div className={styles.rank} style={{ '--pos-color': myColor }}>
        #{position}
      </div>
      {isLocked && winner && (
        <div className={styles.winnerInfo}>
          🏆 {winner} fue el primero
        </div>
      )}
    </div>
  )
}
