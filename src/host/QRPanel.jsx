import { useEffect, useState } from 'react'
import styles from './QRPanel.module.css'

export default function QRPanel() {
  const [serverUrl, setServerUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/server-info')
      .then(r => r.json())
      .then(d => setServerUrl(d.url))
      .catch(() => setServerUrl(location.origin))
  }, [])

  const copy = () => {
    navigator.clipboard.writeText(serverUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const qrSrc = serverUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(serverUrl)}&margin=2`
    : ''

  return (
    <div className={styles.panel}>
      <div className={styles.title}>Escaneá para unirte</div>
      {qrSrc && (
        <img className={styles.qr} src={qrSrc} width={180} height={180} alt="QR" />
      )}
      <div className={styles.url}>{serverUrl || 'cargando...'}</div>
      <button
        className={`${styles.copyBtn} ${copied ? styles.copied : ''}`}
        onClick={copy}
      >
        {copied ? '✓ COPIADO' : 'COPIAR LINK'}
      </button>
    </div>
  )
}
