import { useEffect, useState } from 'react'
import styles from './WakeUpLoader.module.css'

const PHRASES = [
  'Calentando los buzzers...',
  'Despertando al servidor...',
  'Preparando la música...',
  'Activando los pulsadores...',
  'Afinando las canciones...',
  'Cargando las preguntas...',
  'El host está en camino...',
  'Conectando los micrófonos...',
  'Armando la sala de juego...',
  'Casi listo para competir...',
]

export default function WakeUpLoader({ message }) {
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setPhraseIdx(i => (i + 1) % PHRASES.length)
        setVisible(true)
      }, 400)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className={styles.overlay}>
      <div className={styles.inner}>
        <div className={styles.buzzerWrap}>
          <div className={styles.ring} style={{ animationDelay: '0s' }} />
          <div className={styles.ring} style={{ animationDelay: '0.4s' }} />
          <div className={styles.ring} style={{ animationDelay: '0.8s' }} />
          <div className={styles.buzzer}>
            <span className={styles.buzz}>!</span>
          </div>
        </div>

        <div className={styles.logo}>BUZZ!</div>

        <p className={`${styles.phrase} ${visible ? styles.visible : ''}`}>
          {message || PHRASES[phraseIdx]}
        </p>

        <div className={styles.dotsRow}>
          <span className={styles.dot} style={{ animationDelay: '0s' }} />
          <span className={styles.dot} style={{ animationDelay: '0.2s' }} />
          <span className={styles.dot} style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    </div>
  )
}
