import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[var(--color-accent)] text-[var(--color-accent-fg)]',
        secondary:
          'border-transparent bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)]',
        destructive: 'border-transparent bg-[var(--color-destructive)] text-white',
        outline: 'border-[var(--color-border)] text-[var(--color-text-primary)]',
        quiz: 'border-transparent bg-[var(--color-quiz)] text-white',
        survey: 'border-transparent bg-[var(--color-survey)] text-white',
        exam: 'border-transparent bg-[var(--color-exam)] text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
