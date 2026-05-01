'use client'

import { Toaster } from 'sonner'

export function AppToaster() {
  return (
    <Toaster
      richColors
      closeButton
      position="top-right"
      theme="dark"
      toastOptions={{
        style: {
          background: 'rgba(10, 10, 14, 0.96)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          color: '#fff',
        },
      }}
    />
  )
}
