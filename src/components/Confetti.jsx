import { useEffect, useRef } from 'react'
import styles from './Confetti.module.css'

export default function Confetti({ baseColor }) {
  const ref = useRef()

  useEffect(() => {
    if (!ref.current || !baseColor) return
    const wrap = ref.current
    wrap.innerHTML = ''
    const colors = [baseColor, '#fff', '#FFE66D', '#f5f5f0', baseColor]
    for (let i = 0; i < 80; i++) {
      const p = document.createElement('div')
      p.className = styles.piece
      p.style.left = Math.random() * 100 + 'vw'
      p.style.background = colors[Math.floor(Math.random() * colors.length)]
      p.style.animationDuration = (1.5 + Math.random() * 2) + 's'
      p.style.animationDelay = (Math.random() * 0.8) + 's'
      p.style.transform = `rotate(${Math.random() * 360}deg)`
      wrap.appendChild(p)
    }
    return () => { wrap.innerHTML = '' }
  }, [baseColor])

  return <div ref={ref} className={styles.wrap} />
}
