import styles from './GameOverScreen.module.css'

const MEDALS = ['🥇', '🥈', '🥉']

export default function GameOverScreen({ players, scores, myId }) {
  const ranked = [...players]
    .map(p => ({ ...p, score: scores[p.id] || 0 }))
    .sort((a, b) => b.score - a.score)

  return (
    <div className={styles.screen}>
      <div className={styles.title}>¡FIN!</div>
      <div className={styles.subtitle}>PODIO FINAL</div>

      <div className={styles.list}>
        {ranked.map((player, i) => (
          <div
            key={player.id}
            className={`${styles.row} ${player.id === myId ? styles.mine : ''}`}
            style={{ '--player-color': player.color }}
          >
            <span className={styles.pos}>
              {i < 3 ? MEDALS[i] : `#${i + 1}`}
            </span>
            <span className={styles.dot} style={{ background: player.color }} />
            <span className={styles.name}>{player.name}</span>
            <span className={styles.score}>{player.score} pts</span>
          </div>
        ))}
      </div>

      <div className={styles.waiting}>Esperando nueva partida...</div>
    </div>
  )
}
