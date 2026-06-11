import { useCallback, useRef } from 'react'
import { useSpotifyStore } from '../store/spotifyStore'

export function useSpotifyPlayback({ spFetch, clearAuth, send }) {
  const {
    setMode, setCurrentTrackData, setCurrentTrackUri, setDeviceId,
    setCurrentPlaylistId, setDevices, setPlayEndTime, setTrackRevealed,
  } = useSpotifyStore.getState()

  const progressTimer = useRef(null)
  const autoPlayTimer = useRef(null)
  const progressBarRef = useRef(null)

  const clearProgress = useCallback(() => {
    clearInterval(progressTimer.current)
    progressTimer.current = null
  }, [])

  const PAUSE_LATENCY_MS = 1000

  const startProgress = useCallback((durationMs) => {
    clearProgress()
    const endTime = Date.now() + Math.max(durationMs - PAUSE_LATENCY_MS, 200)
    setPlayEndTime(endTime)
    progressTimer.current = setInterval(async () => {
      const remaining = endTime - Date.now()
      const elapsed = durationMs - remaining
      const pct = Math.min((elapsed / durationMs) * 100, 100)
      if (progressBarRef.current) progressBarRef.current.style.width = pct + '%'
      if (remaining <= 0) await stopPlayback()
    }, 50)
  }, [clearProgress]) // eslint-disable-line react-hooks/exhaustive-deps

  const stopPlayback = useCallback(async () => {
    clearProgress()
    if (progressBarRef.current) progressBarRef.current.style.width = '0%'
    await spFetch('https://api.spotify.com/v1/me/player/pause', { method: 'PUT' }).catch(() => {})
    // Only transition to stopped if a new playRandom hasn't already started
    const { spotifyMode } = useSpotifyStore.getState()
    if (spotifyMode === 'playing') setMode('stopped')
  }, [clearProgress, spFetch, setMode])

  const loadDevices = useCallback(async () => {
    setMode('sdk_loading')
    const res = await spFetch('https://api.spotify.com/v1/me/player/devices')
    if (!res.ok) { clearAuth(); setMode('login'); return }
    const data = await res.json()
    const devs = data.devices || []
    if (devs.length === 0) { setMode('no_device'); return }
    setDevices(devs)
    const active = devs.find(d => d.is_active) || devs[0]
    setDeviceId(active.id)
    setMode('ready')
  }, [spFetch, clearAuth, setMode, setDevices, setDeviceId])

  const extractPlaylistId = useCallback((val) => {
    val = (val || '').trim()
    const m = val.match(/playlist[/:]([A-Za-z0-9]+)/)
    if (m) return m[1]
    if (/^[A-Za-z0-9]{10,}$/.test(val)) return val
    return null
  }, [])

  const playRandom = useCallback(async (playlistInputValue) => {
    const { deviceId, currentPlaylistId, currentTrackUri: uriBeforeSkip, playDuration } = useSpotifyStore.getState()
    const playlistId = extractPlaylistId(playlistInputValue)
    if (!playlistId) return { error: 'invalid_playlist' }

    clearProgress()
    setTrackRevealed(false)
    setCurrentTrackData(null)
    if (send) send('game_reset')
    setMode('fetching')

    try {
      const playlistChanged = playlistId !== currentPlaylistId
      setCurrentPlaylistId(playlistId)

      if (playlistChanged) {
        const ctxRes = await spFetch(
          `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ context_uri: 'spotify:playlist:' + playlistId }),
          }
        )
        if (!ctxRes.ok && ctxRes.status !== 204 && ctxRes.status !== 202) {
          const b = await ctxRes.json().catch(() => ({}))
          throw new Error(b?.error?.message || `Error ${ctxRes.status}`)
        }
        await spFetch('https://api.spotify.com/v1/me/player/pause', { method: 'PUT' }).catch(() => {})
        await new Promise(r => setTimeout(r, 400))
      }

      await spFetch(
        `https://api.spotify.com/v1/me/player/next?device_id=${deviceId}`,
        { method: 'POST' }
      ).catch(() => {})

      let skipConfirmed = false
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 200))
        try {
          const chk = await spFetch('https://api.spotify.com/v1/me/player/currently-playing')
          if (chk.ok && chk.status !== 204) {
            const d = await chk.json()
            if (d?.item?.uri && d.item.uri !== uriBeforeSkip) { skipConfirmed = true; break }
          }
        } catch {}
      }
      if (!skipConfirmed) {
        await spFetch(
          `https://api.spotify.com/v1/me/player/next?device_id=${deviceId}`,
          { method: 'POST' }
        ).catch(() => {})
        await new Promise(r => setTimeout(r, 600))
      }

      let playRes = await spFetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position_ms: 0 }),
        }
      )

      if (playRes.status === 403) {
        setCurrentPlaylistId(null)
        const ctxRes2 = await spFetch(
          `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ context_uri: 'spotify:playlist:' + playlistId }),
          }
        )
        if (!ctxRes2.ok && ctxRes2.status !== 204 && ctxRes2.status !== 202) {
          const b = await ctxRes2.json().catch(() => ({}))
          throw new Error(b?.error?.message || `Error ${ctxRes2.status}`)
        }
        await spFetch('https://api.spotify.com/v1/me/player/pause', { method: 'PUT' }).catch(() => {})
        await new Promise(r => setTimeout(r, 400))
        await spFetch(`https://api.spotify.com/v1/me/player/next?device_id=${deviceId}`, { method: 'POST' }).catch(() => {})
        await new Promise(r => setTimeout(r, 500))
        playRes = await spFetch(
          `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position_ms: 0 }),
          }
        )
        setCurrentPlaylistId(playlistId)
      }

      if (!playRes.ok && playRes.status !== 204) {
        const body = await playRes.json().catch(() => ({}))
        throw new Error(body?.error?.message || `Error ${playRes.status}`)
      }

      setMode('playing')
      startProgress(playDuration)

      // Poll currently-playing AFTER play starts — this is the data shown on REVELAR
      ;(async () => {
        console.log('[REVELAR] IIFE iniciada, polling currently-playing...')
        for (let attempt = 0; attempt < 5; attempt++) {
          await new Promise(r => setTimeout(r, attempt === 0 ? 400 : 600))
          try {
            const r = await spFetch('https://api.spotify.com/v1/me/player/currently-playing')
            console.log(`[REVELAR] attempt ${attempt} → status ${r.status}`)
            if (r.ok && r.status !== 204) {
              const d = await r.json()
              const t = d?.item
              console.log('[REVELAR] item:', t?.name, t?.uri)
              if (t) {
                setCurrentTrackUri(t.uri)
                const artist = (t.artists || []).map(a => a.name).join(', ')
                const cover = t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || null
                const trackData = { name: t.name, artist, cover }
                setCurrentTrackData(trackData)
                console.log('[REVELAR] setCurrentTrackData OK:', trackData)
                if (send) send('play_track', { track: { name: t.name, artist } })
                return
              }
            }
          } catch (e) {
            console.error(`[REVELAR] attempt ${attempt} error:`, e)
          }
        }
        console.warn('[REVELAR] IIFE terminó sin datos — currentTrackData sigue null')
      })()

      return {}
    } catch (err) {
      console.error(err)
      setMode('ready')
      const isRestriction = err.message?.includes('Restriction violated') || err.message?.includes('UNKNOWN')
      return { error: isRestriction ? 'restriction' : err.message }
    }
  }, [extractPlaylistId, clearProgress, spFetch, setMode, setCurrentPlaylistId, setCurrentTrackUri, setCurrentTrackData, setTrackRevealed, startProgress, send])

  const replayTrack = useCallback(async ({ sendReset = true } = {}) => {
    const { deviceId, currentTrackUri, playDuration } = useSpotifyStore.getState()
    if (!currentTrackUri) return
    setTrackRevealed(false)
    if (sendReset && send) send('partial_reset')
    setMode('fetching')
    const playRes = await spFetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: [currentTrackUri], position_ms: 0 }),
      }
    )
    if (!playRes.ok && playRes.status !== 204) { setMode('stopped'); return }
    setMode('playing')
    startProgress(playDuration)
    // uris: [trackUri] breaks Spotify playlist context; null both so next playRandom reloads context
    // and uriBeforeSkip=null ensures skip confirmation passes immediately
    setCurrentPlaylistId(null)
    setCurrentTrackUri(null)
  }, [spFetch, setMode, setTrackRevealed, startProgress, send, setCurrentPlaylistId, setCurrentTrackUri])

  const addTime = useCallback((extraMs) => {
    const { playEndTime, playDuration } = useSpotifyStore.getState()
    const remaining = Math.max(playEndTime - Date.now(), 0)
    const newEnd = Date.now() + remaining + extraMs
    setPlayEndTime(newEnd)
    clearProgress()
    const totalMs = remaining + extraMs + (playDuration - (playDuration - remaining))
    progressTimer.current = setInterval(async () => {
      const rem = newEnd - Date.now()
      const pct = Math.min(((totalMs - rem) / totalMs) * 100, 100)
      if (progressBarRef.current) progressBarRef.current.style.width = pct + '%'
      if (rem <= 0) await stopPlayback()
    }, 50)
  }, [clearProgress, stopPlayback, setPlayEndTime])

  const scheduleAutoPlay = useCallback((playlistInputValue) => {
    clearTimeout(autoPlayTimer.current)
    const delay = 2000 + Math.random() * 3000
    autoPlayTimer.current = setTimeout(() => {
      const { spotifyMode } = useSpotifyStore.getState()
      if (spotifyMode !== 'playing' && spotifyMode !== 'fetching') {
        playRandom(playlistInputValue)
      }
    }, delay)
  }, [playRandom])

  const clearAutoPlay = useCallback(() => clearTimeout(autoPlayTimer.current), [])

  return {
    progressBarRef,
    loadDevices,
    playRandom,
    replayTrack,
    stopPlayback,
    addTime,
    scheduleAutoPlay,
    clearAutoPlay,
    clearProgress,
  }
}
