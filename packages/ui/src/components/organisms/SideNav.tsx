import { ClipboardList, FilePlus, Home, Plus } from 'lucide-react'
import { NavItem } from '../molecules/NavItem'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Separator } from '../ui/separator'

const NAV_ITEMS = [
  { path: '/', icon: <Home className="h-5 w-5" />, label: 'Home' },
  {
    path: '/quiz/new',
    icon: <FilePlus className="h-5 w-5" />,
    label: 'Create Quiz',
  },
  {
    path: '/survey/new',
    icon: <ClipboardList className="h-5 w-5" />,
    label: 'Create Survey',
  },
]

export interface SideNavProps {
  activePath?: string
  onNavigate?: (path: string) => void
  onCreateQuiz?: () => void
  onCreateSurvey?: () => void
}

export function SideNav({
  activePath = '/',
  onNavigate,
  onCreateQuiz,
  onCreateSurvey,
}: SideNavProps) {
  return (
    <nav className="flex h-full w-56 flex-col gap-4 border-r border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="w-full gap-2">
            <Plus className="h-4 w-4" /> Create new
          </Button>
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
    </nav>
  )
}
