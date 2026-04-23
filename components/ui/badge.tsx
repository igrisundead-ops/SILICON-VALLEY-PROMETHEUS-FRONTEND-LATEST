import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-white/10 bg-white/5 text-white/80 hover:bg-white/10',
        secondary:
          'border-white/10 bg-white/3 text-white/70 hover:bg-white/7',
        outline: 'border-white/20 text-white/70',
        success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
        warning: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

