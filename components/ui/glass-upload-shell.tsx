'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

type ShellProps = React.ComponentProps<'div'>;

function CinematicNoise({ className }: { className?: string }) {
  const id = React.useId().replace(/:/g, '');

  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn('absolute inset-0 h-full w-full', className)}
    >
      <defs>
        <filter id={`${id}-noise`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="2" seed="8" />
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0 0.018" />
          </feComponentTransfer>
        </filter>
      </defs>
      <rect width="100" height="100" filter={`url(#${id}-noise)`} opacity="0.7" />
    </svg>
  );
}

export function GlassUploadBackdrop({ className, children, ...props }: ShellProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[28px] border border-white/10 bg-[#090b11] shadow-[0_46px_120px_-60px_rgba(0,0,0,0.92)] sm:rounded-[34px]',
        className,
      )}
      {...props}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(24,28,38,0.96)_0%,rgba(12,15,22,0.98)_38%,rgba(7,9,14,1)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.015)_18%,rgba(255,255,255,0)_34%),radial-gradient(circle_at_22%_12%,rgba(255,110,84,0.12),transparent_22%),radial-gradient(circle_at_78%_16%,rgba(108,128,255,0.12),transparent_20%)]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-x-[10%] top-0 h-px bg-white/14" />
      <CinematicNoise className="pointer-events-none opacity-55 mix-blend-soft-light" />
      {children}
    </div>
  );
}

export function GlassBubbleCard({ className, children, ...props }: ShellProps) {
  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,21,31,0.9)_0%,rgba(9,11,17,0.98)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_26px_60px_-40px_rgba(0,0,0,0.88)] sm:rounded-[28px]',
        className,
      )}
      {...props}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.015)_18%,rgba(0,0,0,0)_46%),radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.08),transparent_26%)]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-px bg-white/12" />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
