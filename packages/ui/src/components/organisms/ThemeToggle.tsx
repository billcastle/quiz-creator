import { Check, Palette } from 'lucide-react'
import { useEffect } from 'react'
import { initTheme, useThemeStore } from '../../stores/theme'
import { themes } from '../../themes'
import type { Theme } from '../../themes/types'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-3 w-3 rounded-full border border-black/10"
      style={{ backgroundColor: color }}
    />
  )
}

export function ThemeToggle() {
  const { activeThemeId, setTheme } = useThemeStore()

  useEffect(() => {
    initTheme()
  }, [])

  const activeTheme = themes.find((t: Theme) => t.id === activeThemeId) ?? themes[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Palette className="h-4 w-4" />
          <span>{activeTheme?.name ?? 'Theme'}</span>
          {activeTheme?.swatches.slice(0, 2).map((color) => (
            <Swatch key={color} color={color} />
          ))}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {themes.map((theme: Theme) => (
          <DropdownMenuItem
            key={theme.id}
            onClick={() => setTheme(theme.id)}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex-1 text-sm">{theme.name}</span>
            <span className="flex gap-1">
              {theme.swatches.slice(0, 2).map((color) => (
                <Swatch key={color} color={color} />
              ))}
            </span>
            {activeThemeId === theme.id && <Check className="h-4 w-4 shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
