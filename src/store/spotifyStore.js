import { create } from 'zustand'

export const useSpotifyStore = create((set) => ({
  spotifyMode: 'init',
  currentTrackData: null,
  currentTrackUri: null,
  deviceId: null,
  currentPlaylistId: null,
  playDuration: parseInt(localStorage.getItem('buzzer_duration') || '2000'),
  playEndTime: 0,
  devices: [],
  trackRevealed: false,
  npCardVisible: false,

  setMode: (mode) => set({ spotifyMode: mode }),
  setCurrentTrackData: (data) => set({ currentTrackData: data }),
  setCurrentTrackUri: (uri) => set({ currentTrackUri: uri }),
  setDeviceId: (id) => set({ deviceId: id }),
  setCurrentPlaylistId: (id) => set({ currentPlaylistId: id }),
  setDevices: (devices) => set({ devices }),
  setPlayEndTime: (t) => set({ playEndTime: t }),
  setTrackRevealed: (v) => set({ trackRevealed: v }),
  setNpCardVisible: (v) => set({ npCardVisible: v }),

  setPlayDuration: (ms) => {
    localStorage.setItem('buzzer_duration', ms)
    set({ playDuration: ms })
  },

  resetTrack: () => set({
    currentTrackData: null,
    currentTrackUri: null,
    trackRevealed: false,
  }),
}))
