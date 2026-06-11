import styles from './ConnDot.module.css'

export default function ConnDot({ connected, fixed }) {
  return (
    <div className={`${styles.dot} ${connected ? styles.on : ''} ${fixed ? styles.fixed : ''}`} />
  )
}
