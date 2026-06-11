import { useGameStore } from '../store/gameStore'
import { useWs } from '../contexts/WebSocketContext'
import styles from './BuzzerScreen.module.css'

export default function BuzzerScreen({ myColor, hasBuzzed, isLocked, winner }) {
  const myId = useGameStore(s => s.myId)
  const players = useGameStore(s => s.players)
  const { send } = useWs()

  const me = players.find(p => p.id === myId)
  const myName = me?.name || ''

  const lockedMsg = isLocked
    ? `🏆 ${winner} fue primero — ¡DALE!`
    : '¡Pulsa cuando puedas!'

  return (
    <div className={styles.screen} style={{ touchAction: 'manipulation', overflow: 'hidden' }}>
      <div className={styles.nameTop}>{myName}</div>
      <button
        className={styles.buzzBtn}
        style={{ '--player-color': myColor }}
        disabled={hasBuzzed}
        onClick={() => send('buzz')}
      />
      <div className={`${styles.lockedInfo} ${isLocked ? styles.alert : ''}`}>
        {lockedMsg}
      </div>
    </div>
  )
}
