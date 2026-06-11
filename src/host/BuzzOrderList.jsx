import styles from './BuzzOrderList.module.css'

export default function BuzzOrderList({ buzzOrder }) {
  const rest = buzzOrder.slice(1)
  if (rest.length === 0) return null

  return (
    <div className={styles.wrap}>
      <div className={styles.label}>Orden de buzzers</div>
      <div className={styles.chips}>
        {rest.map((b, i) => (
          <div key={b.id} className={styles.chip} style={{ animationDelay: `${i * 0.06}s` }}>
            <span className={styles.rank}>#{i + 2}</span>
            <span className={styles.dot} style={{ background: b.color }} />
            <span className={styles.name}>{b.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
