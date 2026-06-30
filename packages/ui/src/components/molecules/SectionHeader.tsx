export interface SectionHeaderProps {
  title: string
  seeAllHref?: string
}

export function SectionHeader({ title, seeAllHref }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h2>
      {seeAllHref && (
        <a href={seeAllHref} className="text-sm text-[var(--color-accent)] hover:underline">
          See all
        </a>
      )}
    </div>
  )
}
