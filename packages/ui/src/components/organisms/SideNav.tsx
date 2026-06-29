import { BarChart2, BookOpen, Compass, Home, Plus } from 'lucide-react'
import { CategoryTabs } from '../molecules/CategoryTabs'
import { NavItem } from '../molecules/NavItem'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'survey', label: 'Survey' },
  { value: 'exam', label: 'Exam' },
]

const NAV_ITEMS = [
  { path: '/', icon: <Home className="h-5 w-5" />, label: 'Home' },
  { path: '/discover', icon: <Compass className="h-5 w-5" />, label: 'Discover' },
  { path: '/my-quizzes', icon: <BookOpen className="h-5 w-5" />, label: 'My Quizzes' },
  { path: '/analytics', icon: <BarChart2 className="h-5 w-5" />, label: 'Analytics' },
]

export interface SideNavProps {
  activePath?: string
  activeCategory?: string
  onCategoryChange?: (value: string) => void
  onNavigate?: (path: string) => void
  onCreateNew?: () => void
}

export function SideNav({
  activePath = '/',
  activeCategory = 'all',
  onCategoryChange,
  onNavigate,
  onCreateNew,
}: SideNavProps) {
  return (
    <nav className="flex h-full w-56 flex-col gap-4 border-r border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3">
      <Button onClick={onCreateNew} className="w-full gap-2">
        <Plus className="h-4 w-4" /> Create new
      </Button>
      <Separator />
      <div className="space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.path}
            icon={item.icon}
            label={item.label}
            state={activePath === item.path ? 'active' : 'default'}
            onClick={() => onNavigate?.(item.path)}
          />
        ))}
      </div>
      <Separator />
      <div className="space-y-2">
        <p className="px-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-disabled)]">
          Categories
        </p>
        <CategoryTabs
          tabs={CATEGORIES}
          value={activeCategory}
          onValueChange={onCategoryChange ?? (() => {})}
          className="flex-col gap-1"
        />
      </div>
    </nav>
  )
}
