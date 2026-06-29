import { create } from 'zustand'
import { applyTheme, themes } from '../themes'
import type { Theme } from '../themes/types'

interface ThemeStore {
  activeThemeId: string
  setTheme: (id: string) => void
}

export const useThemeStore = create<ThemeStore>((set) => ({
  activeThemeId: 'default',
  setTheme: (id: string) => {
    const theme = themes.find((t: Theme) => t.id === id)
    if (!theme) return
    applyTheme(theme)
    localStorage.setItem('questify-theme', id)
    set({ activeThemeId: id })
  },
}))

export function initTheme(): void {
  const saved = localStorage.getItem('questify-theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const id = saved ?? (prefersDark ? 'dark' : 'default')
  const theme =
    themes.find((t: Theme) => t.id === id) ?? themes.find((t: Theme) => t.id === 'default')
  if (theme) {
    applyTheme(theme)
    useThemeStore.setState({ activeThemeId: theme.id })
  }
}
