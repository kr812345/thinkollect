import { create } from 'zustand'

interface ThemeStore {
  theme: 'dark' | 'bright'
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: 'bright', // default
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'bright' : 'dark' })),
}))

export const getThemeColors = (theme: 'dark' | 'bright') => {
  if (theme === 'bright') {
    return {
      bg: '#f4f1ea',
      surface: '#ece7dc',
      border: '#ddd6c8',
      text: '#1f1d1a',
      textMuted: '#6b665d',
      textDim: '#9a9488',
      tint: '#9a5b2c',
      onTint: '#fffaf2',
      danger: '#b3261e',
      card: '#faf8f3',
      insight: '#9a5b2c',
      insightBg: 'rgba(154, 91, 44, 0.08)',
    }
  }
  return {
    bg: '#141412',
    surface: '#1b1a17',
    border: '#2a2824',
    text: '#ede8de',
    textMuted: '#a39d91',
    textDim: '#6f6a61',
    tint: '#d39a62',
    onTint: '#1a140e',
    danger: '#e5484d',
    card: '#1b1a17',
    insight: '#d39a62',
    insightBg: 'rgba(211, 154, 98, 0.10)',
  }
}
