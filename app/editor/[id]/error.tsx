'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, FolderKanban, RotateCcw } from 'lucide-react'

export default function EditorProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('Editor route failed to render.', error)
  }, [error])

  return (
    <div className="relative min-h-screen overflow-hidden px-6 py-10 text-white sm:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[14%] top-[-5rem] h-64 w-64 rounded-full bg-rose-400/16 blur-[110px]" />
        <div className="absolute right-[10%] top-[14%] h-72 w-72 rounded-full bg-amber-400/10 blur-[130px]" />
        <div className="absolute bottom-[-8rem] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-[140px]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="w-full max-w-2xl rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,13,24,0.95)_0%,rgba(8,6,14,0.98)_100%)] p-8 shadow-[0_40px_120px_-48px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:p-10">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.05]">
              <AlertTriangle className="h-6 w-6 text-rose-200" />
            </div>

            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/38">
                Editor Recovery
              </div>
              <h1 className="mt-3 text-3xl font-medium tracking-tight text-white/96 sm:text-[2.3rem]">
                This project hit a render problem
              </h1>
              <p className="mt-3 text-sm leading-7 text-white/58 sm:text-[15px]">
                The editor failed inside this route, so we kept the failure contained here instead of bouncing the whole dashboard.
              </p>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs leading-6 text-white/52">
                {error.message || 'Unknown editor error'}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => reset()}
                  className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 text-sm text-white transition-colors hover:bg-white/[0.1]"
                >
                  <RotateCcw className="h-4 w-4" />
                  Retry editor
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/projects')}
                  className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-transparent px-4 py-2 text-sm text-white/78 transition-colors hover:border-white/20 hover:text-white"
                >
                  <FolderKanban className="h-4 w-4" />
                  Back to projects
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
