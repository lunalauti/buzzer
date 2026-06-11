import { useWs } from '../contexts/WebSocketContext'
import styles from './ChoiceOverlay.module.css'

export default function ChoiceOverlay() {
  const { send } = useWs()

  return (
    <div className={styles.overlay}>
      <div className={styles.title}>¿Qué hacemos?</div>
      <div className={styles.subtitle}>TODOS SE RINDIERON</div>
      <div className={styles.actions}>
        <button className={styles.btn} onClick={() => send('replay_request')}>↺ REPETIR</button>
        <button className={`${styles.btn} ${styles.btnSkip}`} onClick={() => send('skip')}>⏩ SALTEAR</button>
      </div>
    </div>
  )
}
