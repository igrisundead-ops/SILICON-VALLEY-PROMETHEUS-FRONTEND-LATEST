'use client'

import dynamic from 'next/dynamic'

const AppToaster = dynamic(() => import('@/components/ui/app-toaster').then((mod) => mod.AppToaster), {
  ssr: false,
})

const CinematicClickRipple = dynamic(
  () => import('@/components/ui/cinematic-click-ripple').then((mod) => mod.CinematicClickRipple),
  {
    ssr: false,
  },
)

export function RootClientEffects() {
  return (
    <>
      <CinematicClickRipple />
      <AppToaster />
    </>
  )
}
