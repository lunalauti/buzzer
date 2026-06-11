import { useCallback, useRef } from 'react'
import { useSpotifyStore } from '../store/spotifyStore'

export function useSpotifyAuth() {
  const setMode = useSpotifyStore(s => s.setMode)
  const tokenRef = useRef(null)

  const clearAuth = useCallback(() => {
    ;['sp_token', 'sp_expiry', 'sp_refresh'].forEach(k => localStorage.removeItem(k))
    tokenRef.current = null
  }, [])

  const refreshToken = useCallback(async () => {
    const refresh = localStorage.getItem('sp_refresh')
    if (!refresh) { clearAuth(); setMode('login'); return false }
    try {
      const res = await fetch('/auth/refresh?token=' + encodeURIComponent(refresh))
      const data = await res.json()
      if (!data.access_token) throw new Error()
      localStorage.setItem('sp_token', data.access_token)
      localStorage.setItem('sp_expiry', Date.now() + data.expires_in * 1000)
      localStorage.setItem('sp_refresh', data.refresh_token)
      tokenRef.current = data.access_token
      return true
    } catch {
      clearAuth(); setMode('login'); return false
    }
  }, [clearAuth, setMode])

  const spFetch = useCallback(async (url, opts = {}) => {
    opts.headers = { ...opts.headers, Authorization: 'Bearer ' + tokenRef.current }
    let res = await fetch(url, opts)
    if (res.status === 401) {
      const ok = await refreshToken()
      if (!ok) return res
      opts.headers.Authorization = 'Bearer ' + tokenRef.current
      res = await fetch(url, opts)
    }
    return res
  }, [refreshToken])

  const init = useCallback((searchParams) => {
    setMode('init')
    const token = searchParams.get('sp_token')
    const expiry = searchParams.get('sp_expiry')

    if (token) {
      localStorage.setItem('sp_token', token)
      localStorage.setItem('sp_expiry', expiry)
      localStorage.setItem('sp_refresh', searchParams.get('sp_refresh') || '')
      tokenRef.current = token
    } else {
      const t = localStorage.getItem('sp_token')
      const e = parseInt(localStorage.getItem('sp_expiry') || '0')
      if (t && Date.now() < e) tokenRef.current = t
    }

    return tokenRef.current
  }, [setMode])

  const login = useCallback(() => { location.href = '/auth/login' }, [])

  return { spFetch, clearAuth, init, login, tokenRef }
}
