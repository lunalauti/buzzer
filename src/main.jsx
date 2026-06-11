import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles/global.css'
import { WebSocketProvider } from './contexts/WebSocketContext'
import PlayerApp from './player/PlayerApp'
import HostApp from './host/HostApp'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <WebSocketProvider>
            <PlayerApp />
          </WebSocketProvider>
        } />
        <Route path="/host" element={
          <WebSocketProvider>
            <HostApp />
          </WebSocketProvider>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
