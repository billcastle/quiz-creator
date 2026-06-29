export interface Theme {
  id: string
  name: string
  /** Five hex colors shown as swatches in ThemeToggle: [bg, surface, accent, text, border] */
  swatches: [string, string, string, string, string]
  tokens: {
    '--color-bg-base': string
    '--color-bg-surface': string
    '--color-bg-subtle': string
    '--color-border': string
    '--color-border-focus': string
    '--color-text-primary': string
    '--color-text-secondary': string
    '--color-text-disabled': string
    '--color-accent': string
    '--color-accent-hover': string
    '--color-accent-fg': string
    '--color-destructive': string
    '--color-success': string
    '--color-warning': string
    '--color-quiz': string
    '--color-survey': string
    '--color-exam': string
  }
}
