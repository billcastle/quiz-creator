import { Badge } from '../ui/badge'
import { Button } from '../ui/button'

export interface FeaturedCardProps {
  title: string
  type: 'quiz' | 'survey' | 'exam'
  thumbnailUrl?: string
  onCTA?: () => void
}

export function FeaturedCard({ title, type, thumbnailUrl, onCTA }: FeaturedCardProps) {
  return (
    <div className="relative flex min-h-[180px] w-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
      <div className="relative mt-auto flex flex-col gap-2 p-5">
        <Badge variant={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</Badge>
        <h3 className="text-xl font-bold text-white">{title}</h3>
        <Button size="sm" onClick={onCTA} className="w-fit">
          Start now
        </Button>
      </div>
    </div>
  )
}
