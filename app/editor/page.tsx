'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

import { EditorLoadingScreen } from '@/components/editor/editor-loading-screen'
import { createProject, getMostRecentProject } from '@/lib/mock'

const EDITOR_FALLBACK_REDIRECT_DELAY_MS = 120

export default function EditorLandingPage() {
  const router = useRouter()
  const hardRedirectTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const project = getMostRecentProject() ?? createProject({ title: 'Untitled Project' })
    const editorHref = `/editor/${project.id}`

    router.replace(editorHref)

    hardRedirectTimerRef.current = window.setTimeout(() => {
      window.location.replace(editorHref)
    }, EDITOR_FALLBACK_REDIRECT_DELAY_MS)

    return () => {
      if (hardRedirectTimerRef.current !== null) {
        window.clearTimeout(hardRedirectTimerRef.current)
      }
    }
  }, [router])

  return <EditorLoadingScreen caption="Loading..." />
}
