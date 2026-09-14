import { create } from 'zustand'

interface ThemeStore {
  theme: 'dark' | 'bright'
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: 'dark', // default
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'bright' : 'dark' })),
}))

export const getThemeColors = (theme: 'dark' | 'bright') => {
  if (theme === 'bright') {
    return {
      bg: '#ffffff',
      surface: '#f5f5f5',
      border: '#e5e5e5',
      text: '#000000',
      textMuted: '#525252',
      textDim: '#a3a3a3',
      tint: '#007aff',
      danger: '#ef4444',
      card: '#ffffff'
    }
  }
  return {
    bg: '#000000',
    surface: '#111111',
    border: '#1f1f1f',
    text: '#f5f5f5',
    textMuted: '#a3a3a3',
    textDim: '#3a3a3a',
    tint: '#0a84ff',
    danger: '#ef4444',
    card: '#0a0a0a'
  }
}
