'use client'

import * as React from 'react'
import { ArrowUpRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ButtonWitnIconProps = React.ComponentProps<typeof Button> & {
  icon?: React.ReactNode
  iconClassName?: string
  iconWrapClassName?: string
  labelClassName?: string
}

function ButtonWithIconDemo({
  children = "Let's Collaborate",
  className,
  icon,
  iconClassName,
  iconWrapClassName,
  labelClassName,
  ...props
}: ButtonWitnIconProps) {
  const resolvedIcon = icon ?? <ArrowUpRight className={cn('size-4', iconClassName)} />

  return (
    <Button
      className={cn(
        'group relative h-12 w-fit overflow-hidden rounded-full border border-white/14 bg-white p-1 pl-6 pr-14 text-sm font-medium text-[#0d0d11] shadow-[0_20px_40px_-28px_rgba(255,255,255,0.85)] transition-[padding,background-color,color,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:pl-14 hover:pr-6 hover:bg-white/94 disabled:border-white/10 disabled:bg-white/[0.08] disabled:text-white/38 disabled:shadow-none disabled:hover:pl-6 disabled:hover:pr-14',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'relative z-10 whitespace-nowrap transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5 disabled:translate-x-0',
          labelClassName,
        )}
      >
        {children}
      </span>

      <div
        className={cn(
          'absolute right-1 flex size-10 items-center justify-center rounded-full bg-[#0f0b17] text-white transition-[right,transform,background-color,color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:right-[calc(100%-44px)] group-hover:rotate-45 group-disabled:right-1 group-disabled:rotate-0 group-disabled:bg-white/12 group-disabled:text-white/48',
          iconWrapClassName,
        )}
      >
        {resolvedIcon}
      </div>
    </Button>
  )
}

export default ButtonWithIconDemo
