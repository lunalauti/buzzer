import { useState } from 'react'
import { useSpotifyStore } from '../store/spotifyStore'
import styles from './SettingsModal.module.css'

export default function SettingsModal({ onClose }) {
  const playDuration = useSpotifyStore(s => s.playDuration)
  const setPlayDuration = useSpotifyStore(s => s.setPlayDuration)
  const [localVal, setLocalVal] = useState(Math.round(playDuration / 1000))

  const save = () => {
    setPlayDuration(localVal * 1000)
    onClose()
  }

  return (
    <div className={styles.backdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.card}>
        <div className={styles.title}>⚙ CONFIGURACIÓN</div>
        <div>
          <span className={styles.label}>Duración del fragmento</span>
          <div className={styles.display}>
            <span>{localVal}</span> <span className={styles.unit}>seg</span>
          </div>
          <input
            type="range"
            className={styles.slider}
            min={1}
            max={30}
            step={1}
            value={localVal}
            onChange={e => setLocalVal(parseInt(e.target.value))}
          />
        </div>
        <button className={styles.saveBtn} onClick={save}>GUARDAR</button>
      </div>
    </div>
  )
}
