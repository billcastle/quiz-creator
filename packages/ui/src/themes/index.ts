import type { Theme } from './types'

const modules = import.meta.glob<{ default: Theme }>('./*.ts', { eager: true })

export const themes: Theme[] = Object.values(modules)
  .map((m) => m.default)
  .filter((t): t is Theme => t != null && typeof t === 'object' && 'id' in t)
  .sort((a, b) => a.name.localeCompare(b.name))

export function applyTheme(theme: Theme): void {
  for (const [key, value] of Object.entries(theme.tokens)) {
    document.documentElement.style.setProperty(key, value)
  }
}

export type { Theme }
