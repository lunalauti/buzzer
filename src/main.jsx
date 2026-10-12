import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import './styles/global.css'
import { WebSocketProvider } from './contexts/WebSocketContext'
import PlayerApp from './player/PlayerApp'
import HostApp from './host/HostApp'
import WakeUpLoader from './components/WakeUpLoader'

// Ensures a room exists in the URL before mounting the WebSocket + HostApp.
// On first load, creates a room via POST /api/rooms then updates the URL.
function HostRoute() {
  const [searchParams, setSearchParams] = useSearchParams()
  const roomCode = searchParams.get('room')
  const [ready, setReady] = useState(!!roomCode)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (roomCode) return
    fetch('/api/rooms', { method: 'POST' })
      .then(r => r.json())
      .then(d => {
        setSearchParams({ room: d.roomCode }, { replace: true })
        setReady(true)
      })
      .catch(() => setError(true))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return (
    <WakeUpLoader message="Error al conectar con el servidor. Recargá la página." />
  )
  if (!ready) return <WakeUpLoader />

  return (
    <WebSocketProvider>
      <HostApp />
    </WebSocketProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <WebSocketProvider>
            <PlayerApp />
          </WebSocketProvider>
        } />
        <Route path="/host" element={<HostRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
