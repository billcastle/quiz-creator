import { LayoutGrid, Menu } from 'lucide-react'
import { SearchBar } from '../molecules/SearchBar'
import { Avatar, AvatarFallback } from '../ui/avatar'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { ThemeToggle } from './ThemeToggle'

export interface TopNavProps {
  searchValue?: string
  onSearchChange?: (value: string) => void
  onSearchClear?: () => void
  isAuthenticated?: boolean
  avatarFallback?: string
  onLogoClick?: () => void
  onSignOut?: () => void
  onHamburgerClick?: () => void
}

export function TopNav({
  searchValue = '',
  onSearchChange,
  onSearchClear,
  isAuthenticated = false,
  avatarFallback = 'U',
  onLogoClick,
  onSignOut,
  onHamburgerClick,
}: TopNavProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onHamburgerClick}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <button type="button" onClick={onLogoClick} className="flex shrink-0 items-center gap-2">
        <LayoutGrid className="h-5 w-5 text-[var(--color-accent)]" />
        <span className="font-bold text-[var(--color-text-primary)]">Questify</span>
      </button>

      <div className="flex flex-1 items-center">
        <SearchBar
          value={searchValue}
          onChange={onSearchChange ?? (() => {})}
          onClear={onSearchClear}
          className="max-w-sm flex-1"
        />
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        {isAuthenticated && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar size="sm" className="cursor-pointer">
                <AvatarFallback>{avatarFallback}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onSignOut}>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
