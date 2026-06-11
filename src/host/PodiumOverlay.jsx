import styles from './PodiumOverlay.module.css'

const MEDALS = ['🥇', '🥈', '🥉']
const HEIGHTS = ['120px', '90px', '70px']

export default function PodiumOverlay({ players, scores, onNewGame }) {
  const ranked = [...players]
    .map(p => ({ ...p, score: scores[p.id] || 0 }))
    .sort((a, b) => b.score - a.score)

  const top3 = ranked.slice(0, 3)
  // Reorder for visual podium: 2nd, 1st, 3rd
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean)
  const podiumHeights = top3[1] ? [HEIGHTS[1], HEIGHTS[0], HEIGHTS[2]] : [HEIGHTS[0], HEIGHTS[2]].filter((_, i) => top3[i] !== undefined)

  return (
    <div className={styles.overlay}>
      <div className={styles.box}>
        <div className={styles.heading}>¡Partida terminada!</div>
        <div className={styles.subheading}>PODIO FINAL</div>

        <div className={styles.podium}>
          {podiumOrder.map((player, i) => {
            const rankIndex = top3.indexOf(player)
            return (
              <div key={player.id} className={styles.podiumSlot}>
                <div className={styles.medal}>{MEDALS[rankIndex]}</div>
                <div className={styles.playerName}>{player.name}</div>
                <div className={styles.playerScore}>{player.score} pts</div>
                <div
                  className={styles.bar}
                  style={{
                    height: HEIGHTS[rankIndex],
                    background: player.color,
                    boxShadow: `0 0 24px ${player.color}66`,
                  }}
                />
              </div>
            )
          })}
        </div>

        {ranked.length > 3 && (
          <div className={styles.rest}>
            {ranked.slice(3).map((p, i) => (
              <div key={p.id} className={styles.restRow}>
                <span className={styles.restPos}>#{i + 4}</span>
                <span className={styles.restDot} style={{ background: p.color }} />
                <span className={styles.restName}>{p.name}</span>
                <span className={styles.restScore}>{p.score} pts</span>
              </div>
            ))}
          </div>
        )}

        <button className={styles.newGameBtn} onClick={onNewGame}>
          NUEVA PARTIDA
        </button>
      </div>
    </div>
  )
}
