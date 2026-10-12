import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import styles from './QRPanel.module.css'

export default function QRPanel() {
  const [searchParams] = useSearchParams()
  const roomCode = searchParams.get('room') || ''
  const [baseUrl, setBaseUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/server-info')
      .then(r => r.json())
      .then(d => setBaseUrl(d.url))
      .catch(() => setBaseUrl(location.origin))
  }, [])

  const playerUrl = baseUrl && roomCode
    ? `${baseUrl}/?room=${roomCode}`
    : baseUrl || ''

  const copy = () => {
    navigator.clipboard.writeText(playerUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const qrSrc = playerUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(playerUrl)}&margin=2`
    : ''

  return (
    <div className={styles.panel}>
      <div className={styles.title}>Escaneá para unirte</div>
      {roomCode && (
        <div className={styles.roomCode}>
          Sala: <strong>{roomCode}</strong>
        </div>
      )}
      {qrSrc && (
        <img className={styles.qr} src={qrSrc} width={180} height={180} alt="QR" />
      )}
      <div className={styles.url}>{playerUrl || 'cargando...'}</div>
      <button
        className={`${styles.copyBtn} ${copied ? styles.copied : ''}`}
        onClick={copy}
      >
        {copied ? '✓ COPIADO' : 'COPIAR LINK'}
      </button>
    </div>
  )
}
