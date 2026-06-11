import { useMemo, useRef } from 'react'
import styles from './PlayersGrid.module.css'

const AVATARS = ['🦊', '🐯', '🦁', '🐸', '🦄', '🐙', '🦋', '🐧', '🦖', '🐳', '🦅', '🐺', '🦝', '🐻', '🦩', '🐬']

function useAvatarMap() {
  const avatarMap = useRef({})
  return (id) => {
    if (!avatarMap.current[id]) {
      const used = Object.values(avatarMap.current)
      const free = AVATARS.filter(a => !used.includes(a))
      avatarMap.current[id] = free.length
        ? free[Math.floor(Math.random() * free.length)]
        : AVATARS[Math.floor(Math.random() * AVATARS.length)]
    }
    return avatarMap.current[id]
  }
}

export default function PlayersGrid({ players, winner, buzzOrder, locked, scores = {} }) {
  const getAvatar = useAvatarMap()

  if (players.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>📱</div>
        <div className={styles.emptyText}>Esperando jugadores</div>
      </div>
    )
  }

  return (
    <div className={styles.grid}>
      {players.map(p => {
        const buzzPos = buzzOrder.findIndex(b => b.id === p.id)
        const isWinner = locked && winner && p.name === winner
        const isLoser = buzzPos > 0 || (!isWinner && locked && winner && buzzPos === -1 && buzzOrder.length > 0)
        const position = buzzPos >= 0 ? buzzPos + 1 : null

        let cardClass = styles.card
        if (isWinner) cardClass += ' ' + styles.winner
        else if (buzzPos >= 0 && !isWinner) cardClass += ' ' + styles.loser

        return (
          <div
            key={p.id}
            className={cardClass}
            style={{ '--player-color': p.color }}
          >
            {position && <div className={styles.badge}>#{position}</div>}
            {isWinner && <div className={styles.crown}>👑</div>}
            <div className={styles.avatar} style={{ background: p.color }}>
              {getAvatar(p.id)}
            </div>
            <div className={styles.name}>{p.name}</div>
            <div className={styles.score}>{scores[p.id] ?? 0} pts</div>
          </div>
        )
      })}
    </div>
  )
}
