'use client'

export interface PrometheusShellProps {
  children: React.ReactNode
  header?: React.ReactNode
  overlay?: React.ReactNode
}

export function PrometheusShell({ children, header, overlay }: PrometheusShellProps) {
  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden font-sans">
      {header ? <div className="shrink-0">{header}</div> : null}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <main className="relative z-auto h-full overflow-y-auto overflow-x-hidden overscroll-contain">
          {children}
        </main>
        {overlay ? <div className="pointer-events-none absolute inset-0 z-20">{overlay}</div> : null}
      </div>
    </div>
  )
}
