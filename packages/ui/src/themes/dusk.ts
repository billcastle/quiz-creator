import type { Theme } from './types'

export default {
  id: 'dusk',
  name: 'Dusk',
  swatches: ['#1a0f14', '#2a1c24', '#bcf8ec', '#e8f8f5', '#8b687f'],
  tokens: {
    '--color-bg-base': '#1a0f14',
    '--color-bg-surface': '#2a1c24',
    '--color-bg-subtle': '#3a2b34',
    '--color-border': '#8b687f',
    '--color-border-focus': '#aed9e0',
    '--color-text-primary': '#e8f8f5',
    '--color-text-secondary': '#aed9e0',
    '--color-text-disabled': '#8b687f',
    '--color-accent': '#bcf8ec',
    '--color-accent-hover': '#aed9e0',
    '--color-accent-fg': '#1a0f14',
    '--color-destructive': '#f28b8b',
    '--color-success': '#bcf8ec',
    '--color-warning': '#9fa0c3',
    '--color-quiz': '#9fa0c3',
    '--color-survey': '#aed9e0',
    '--color-exam': '#8b687f',
  },
} satisfies Theme
