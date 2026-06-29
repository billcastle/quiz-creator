import { LayoutGrid } from 'lucide-react'
import { SearchBar } from '../molecules/SearchBar'
import { Avatar, AvatarFallback } from '../ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

export interface TopNavProps {
  searchValue: string
  onSearchChange: (value: string) => void
  onSearchClear?: () => void
  avatarFallback?: string
}

export function TopNav({
  searchValue,
  onSearchChange,
  onSearchClear,
  avatarFallback = 'U',
}: TopNavProps) {
  return (
    <header className="flex h-14 items-center gap-4 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4">
      <div className="flex shrink-0 items-center gap-2">
        <LayoutGrid className="h-5 w-5 text-[var(--color-accent)]" />
        <span className="font-bold text-[var(--color-text-primary)]">Questify</span>
      </div>
      <div className="flex flex-1 items-center gap-3">
        <SearchBar
          value={searchValue}
          onChange={onSearchChange}
          onClear={onSearchClear}
          className="max-w-sm flex-1"
        />
        <Select>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="quiz">Quiz</SelectItem>
            <SelectItem value="survey">Survey</SelectItem>
            <SelectItem value="exam">Exam</SelectItem>
          </SelectContent>
        </Select>
        <Select>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recent</SelectItem>
            <SelectItem value="popular">Popular</SelectItem>
            <SelectItem value="az">A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Avatar size="sm">
        <AvatarFallback>{avatarFallback}</AvatarFallback>
      </Avatar>
    </header>
  )
}
