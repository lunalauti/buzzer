import styles from './NowPlayingCard.module.css'

export default function NowPlayingCard({ visible, track }) {
  if (!visible || !track) return null

  return (
    <div className={styles.card}>
      {track.cover && (
        <img className={styles.cover} src={track.cover} alt="" />
      )}
      <div className={styles.text}>
        <div className={styles.name}>{track.name}</div>
        <div className={styles.artist}>{track.artist}</div>
      </div>
    </div>
  )
}
