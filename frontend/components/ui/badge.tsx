import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-white text-black font-semibold',
        secondary: 'border-white/[0.08] bg-white/[0.06] text-white hover:bg-white/[0.1]',
        destructive: 'border-destructive/30 bg-destructive/15 text-destructive',
        outline: 'border-white/[0.12] text-foreground bg-transparent',
        success: 'border-[#23a55a]/30 bg-[#23a55a]/15 text-[#23a55a]',
        warning: 'border-[#f0b232]/30 bg-[#f0b232]/15 text-[#f0b232]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
