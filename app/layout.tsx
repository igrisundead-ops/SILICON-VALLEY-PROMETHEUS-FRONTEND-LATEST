import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { CinematicClickRipple } from '@/components/ui/cinematic-click-ripple'
import { ThemeProvider } from '@/components/theme-provider'
import { WorkspaceFrame } from '@/components/workspace-frame'
import './globals.css'

export const metadata: Metadata = {
  title: 'v0 App',
  description: 'Created with v0',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <WorkspaceFrame>{children}</WorkspaceFrame>
          <CinematicClickRipple />
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
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
