import type { Theme } from './types'

export default {
  id: 'dark',
  name: 'Dark',
  swatches: ['#0f172a', '#1e293b', '#60a5fa', '#f8fafc', '#334155'],
  tokens: {
    '--color-bg-base': '#0f172a',
    '--color-bg-surface': '#1e293b',
    '--color-bg-subtle': '#0f172a',
    '--color-border': '#334155',
    '--color-border-focus': '#60a5fa',
    '--color-text-primary': '#f8fafc',
    '--color-text-secondary': '#94a3b8',
    '--color-text-disabled': '#475569',
    '--color-accent': '#60a5fa',
    '--color-accent-hover': '#3b82f6',
    '--color-accent-fg': '#0f172a',
    '--color-destructive': '#f87171',
    '--color-success': '#4ade80',
    '--color-warning': '#fbbf24',
    '--color-quiz': '#a78bfa',
    '--color-survey': '#38bdf8',
    '--color-exam': '#fb923c',
  },
} satisfies Theme
