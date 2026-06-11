import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'

const WsCtx = createContext(null)

export function WebSocketProvider({ children }) {
  const ws = useRef(null)
  const [connected, setConnected] = useState(false)
  const handlers = useRef({})
  const reconnectTimer = useRef(null)

  const connect = useCallback(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const socket = new WebSocket(`${proto}://${location.host}/ws`)
    ws.current = socket

    socket.onopen = () => setConnected(true)

    socket.onclose = () => {
      setConnected(false)
      reconnectTimer.current = setTimeout(connect, 2000)
    }

    socket.onmessage = (e) => {
      let msg
      try { msg = JSON.parse(e.data) } catch { return }

      const store = useGameStore.getState()

      if (msg.type === 'state') store.applyState(msg)
      if (msg.type === 'joined') { store.setMyId(msg.id); store.setMyColor(msg.color) }
      if (msg.type === 'full_reset') store.fullReset()

      handlers.current[msg.type]?.(msg)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      ws.current?.close()
    }
  }, [connect])

  const send = useCallback((type, payload = {}) => {
    if (ws.current?.readyState === 1) {
      ws.current.send(JSON.stringify({ type, ...payload }))
    }
  }, [])

  const onMessage = useCallback((type, handler) => {
    handlers.current[type] = handler
    return () => { delete handlers.current[type] }
  }, [])

  return (
    <WsCtx.Provider value={{ connected, send, onMessage }}>
      {children}
    </WsCtx.Provider>
  )
}

export const useWs = () => useContext(WsCtx)
