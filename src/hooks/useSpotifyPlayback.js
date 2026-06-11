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

  const startProgress = useCallback((durationMs) => {
    clearProgress()
    const endTime = Date.now() + durationMs
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
    setMode('stopped')
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
    if (send) send('game_reset')
    setMode('fetching')

    try {
      await spFetch(
        `https://api.spotify.com/v1/me/player/shuffle?state=false&device_id=${deviceId}`,
        { method: 'PUT' }
      ).catch(() => {})

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
      if (!skipConfirmed) await new Promise(r => setTimeout(r, 200))

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

      ;(async () => {
        for (let attempt = 0; attempt < 4; attempt++) {
          await new Promise(r => setTimeout(r, attempt === 0 ? 800 : 500))
          try {
            const r = await spFetch('https://api.spotify.com/v1/me/player/currently-playing')
            if (r.ok && r.status !== 204) {
              const d = await r.json()
              const t = d?.item
              if (t && t.uri !== uriBeforeSkip) {
                setCurrentTrackUri(t.uri)
                const artist = (t.artists || []).map(a => a.name).join(', ')
                const cover = t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || null
                const trackData = { name: t.name, artist, cover }
                setCurrentTrackData(trackData)
                if (send) send('play_track', { track: { name: t.name, artist } })
                return
              }
            }
          } catch {}
        }
      })()

      return {}
    } catch (err) {
      console.error(err)
      setMode('ready')
      const isRestriction = err.message?.includes('Restriction violated') || err.message?.includes('UNKNOWN')
      return { error: isRestriction ? 'restriction' : err.message }
    }
  }, [extractPlaylistId, clearProgress, spFetch, setMode, setCurrentPlaylistId, setCurrentTrackUri, setCurrentTrackData, setTrackRevealed, startProgress, send])

  const replayTrack = useCallback(async () => {
    const { deviceId, currentTrackUri, playDuration } = useSpotifyStore.getState()
    if (!currentTrackUri) return
    setTrackRevealed(false)
    if (send) send('partial_reset')
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
  }, [spFetch, setMode, setTrackRevealed, startProgress, send])

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
