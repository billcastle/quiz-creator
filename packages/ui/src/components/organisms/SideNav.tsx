import {
  BookOpen,
  Calculator,
  ClipboardList,
  Code2,
  FilePlus,
  FlaskConical,
  Globe,
  Hash,
  Home,
  Landmark,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from 'lucide-react'
import { NavItem } from '../molecules/NavItem'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Separator } from '../ui/separator'

export const CONTENT_CATEGORIES = [
  { id: 'general', label: 'General Knowledge', icon: BookOpen },
  { id: 'science', label: 'Science', icon: FlaskConical },
  { id: 'history', label: 'History', icon: Landmark },
  { id: 'technology', label: 'Technology', icon: Code2 },
  { id: 'math', label: 'Mathematics', icon: Calculator },
  { id: 'geography', label: 'Geography', icon: Globe },
  { id: 'other', label: 'Other', icon: Hash },
] as const

export type ContentCategory = (typeof CONTENT_CATEGORIES)[number]['id']

const NAV_ITEMS = [{ path: '/', icon: <Home className="h-5 w-5" />, label: 'Home' }]

export interface SideNavProps {
  activePath?: string
  onNavigate?: (path: string) => void
  onCreateQuiz?: () => void
  onCreateSurvey?: () => void
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  activeCategory?: string
  onCategoryClick?: (categoryId: string) => void
}

export function SideNav({
  activePath = '/',
  onNavigate,
  onCreateQuiz,
  onCreateSurvey,
  collapsed = false,
  onCollapsedChange,
  activeCategory,
  onCategoryClick,
}: SideNavProps) {
  return (
    <nav
      className={`flex h-full flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-surface)] transition-[width] duration-200 ${collapsed ? 'w-14' : 'w-56'}`}
    >
      {/* Main nav + categories — grows to fill space */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              state={collapsed ? 'collapsed' : activePath === item.path ? 'active' : 'default'}
              onClick={() => onNavigate?.(item.path)}
            />
          ))}
        </div>

        {/* Categories section — hidden when collapsed */}
        {!collapsed && (
          <>
            <Separator className="my-3" />
            <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-disabled)]">
              Categories
            </p>
            <div className="space-y-0.5">
              {CONTENT_CATEGORIES.map((cat) => {
                const Icon = cat.icon
                return (
                  <NavItem
                    key={cat.id}
                    icon={<Icon className="h-4 w-4" />}
                    label={cat.label}
                    state={activeCategory === cat.id ? 'active' : 'default'}
                    onClick={() => onCategoryClick?.(cat.id)}
                  />
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Fixed bottom: Create New + collapse toggle */}
      <div className="shrink-0 p-3 pt-0">
        <Separator className="mb-3" />

        {/* Create new dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {collapsed ? (
              <Button
                size="icon"
                className="w-full"
                aria-label="Create new questionnaire or survey"
                title="Create new"
              >
                <Plus className="h-4 w-4" />
              </Button>
            ) : (
              <Button className="w-full gap-2" aria-label="Create new questionnaire or survey">
                <Plus className="h-4 w-4" /> Create new
              </Button>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={onCreateQuiz}>
              <FilePlus className="mr-2 h-4 w-4" />
              Quiz
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreateSurvey}>
              <ClipboardList className="mr-2 h-4 w-4" />
              Survey
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          onClick={() => onCollapsedChange?.(!collapsed)}
          className="mt-2 flex w-full items-center justify-center rounded-md p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)]"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>
    </nav>
  )
}
