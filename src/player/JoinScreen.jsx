import { useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { useWs } from '../contexts/WebSocketContext'
import styles from './JoinScreen.module.css'

export default function JoinScreen() {
  const players = useGameStore(s => s.players)
  const { send } = useWs()
  const nameRef = useRef()

  const join = () => {
    const name = nameRef.current.value.trim() || 'Jugador'
    send('join', { name })
  }

  return (
    <div className={styles.screen}>
      <div className={styles.logo}>BUZZ!</div>
      <div className={styles.tagline}>¿Quién pulsa primero?</div>
      <div className={styles.inputWrap}>
        <input
          ref={nameRef}
          className={styles.input}
          type="text"
          placeholder="Tu nombre"
          maxLength={20}
          autoComplete="off"
          spellCheck={false}
          onKeyDown={e => e.key === 'Enter' && join()}
        />
        <button className={styles.joinBtn} onClick={join}>UNIRSE</button>
      </div>
      <div className={styles.playersPreview}>
        {players.map(p => (
          <div
            key={p.id}
            className={styles.chip}
            style={{ background: p.color }}
          >
            {p.name}
          </div>
        ))}
      </div>
    </div>
  )
}
