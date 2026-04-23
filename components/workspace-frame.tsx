'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'

import { DashboardSidebar } from '@/components/dashboard-sidebar'
import IsoLevelWarp from '@/components/ui/isometric-wave-grid-background'

const WORKSPACE_ROUTE_REGEX =
  /^\/(?:$|dashboard(?:\/|$)|projects(?:\/|$)|assets(?:\/|$)|editor(?:\/|$)|settings(?:\/|$)|exports(?:\/|$)|templates(?:\/|$)|team(?:\/|$)|highlights(?:\/|$)|captions(?:\/|$)|broll(?:\/|$)|brand-kit(?:\/|$)|billing(?:\/|$))/
const EDITOR_DETAIL_ROUTE_REGEX = /^\/editor\/[^/]+(?:\/|$)/

const AUTH_ROUTE_REGEX = /^\/(?:login|signup|verify|forgot-password|terms|privacy)(?:\/|$)/

function isWorkspaceRoute(pathname: string) {
  if (!pathname || pathname.startsWith('/api')) return false
  if (AUTH_ROUTE_REGEX.test(pathname)) return false
  return WORKSPACE_ROUTE_REGEX.test(pathname)
}

export function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const shouldRenderWorkspaceShell = isWorkspaceRoute(pathname)
  const shouldRenderSidebar = shouldRenderWorkspaceShell && !EDITOR_DETAIL_ROUTE_REGEX.test(pathname)

  if (!shouldRenderWorkspaceShell) {
    return <>{children}</>
  }

  return (
    <div className="relative h-screen w-full overflow-hidden font-sans">
      <IsoLevelWarp color="168, 124, 255" density={32} speed={1.15} />

      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_14%_2%,rgba(212,176,255,0.22)_0%,rgba(34,14,58,0.12)_38%,rgba(0,0,0,0)_68%),linear-gradient(180deg,rgba(12,7,20,0.62)_0%,rgba(6,4,10,0.84)_100%)]" />

      <div className="relative z-10 flex h-screen w-full">
        {shouldRenderSidebar ? <DashboardSidebar /> : null}

        <div className="relative z-10 flex h-screen flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  )
}
