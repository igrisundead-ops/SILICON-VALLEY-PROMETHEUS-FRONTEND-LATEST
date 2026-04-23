'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { FileText, FileVideo2, Folder, Search } from 'lucide-react'

import { PrometheusShell } from '@/components/prometheus-shell'
import { Input } from '@/components/ui/input'
import { rememberCurrentPathForEditorReturn } from '@/lib/editor-navigation'
import type { Project, ProjectStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const OWNER_EMAILS = ['you@prometheus.local', 'studio@prometheus.local', 'team@prometheus.local']

type ProjectsApiResponse = {
  projects?: Project[]
  error?: string
}

type StatusFilter = 'all' | ProjectStatus

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'processing', label: 'Processing' },
  { value: 'ready', label: 'Ready' },
  { value: 'exported', label: 'Exported' },
]
const SHOULD_PREFETCH_PROJECT_EDITORS = process.env.NODE_ENV === 'production'

export default function ProjectsPage() {
  const router = useRouter()

  const [query, setQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [projects, setProjects] = React.useState<Project[]>([])
  const [brokenPreviewIds, setBrokenPreviewIds] = React.useState<Record<string, true>>({})
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const controller = new AbortController()
    let isDisposed = false

    const loadProjects = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const res = await fetch('/api/projects', {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        })

        const payload = (await res.json().catch(() => null)) as ProjectsApiResponse | null
        if (!res.ok) {
          throw new Error(payload?.error ?? `Unable to load projects (${res.status})`)
        }

        if (isDisposed) return
        setProjects(Array.isArray(payload?.projects) ? payload.projects : [])
      } catch (err) {
        if (isDisposed || controller.signal.aborted) return
        const message = err instanceof Error ? err.message : 'Unable to load projects'
        setError(message)
        setProjects([])
      } finally {
        if (!isDisposed) setIsLoading(false)
      }
    }

    loadProjects()

    return () => {
      isDisposed = true
      controller.abort()
    }
  }, [])

  const filteredProjects = React.useMemo(() => {
    const safeQuery = query.trim().toLowerCase()
    return projects
      .filter((project) => {
        if (statusFilter !== 'all' && project.status !== statusFilter) return false
        if (!safeQuery) return true
        return project.title.toLowerCase().includes(safeQuery)
      })
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  }, [projects, query, statusFilter])

  React.useEffect(() => {
    if (!SHOULD_PREFETCH_PROJECT_EDITORS || isLoading) return

    for (const project of filteredProjects.slice(0, 6)) {
      void router.prefetch(`/editor/${project.id}`)
    }
  }, [filteredProjects, isLoading, router])

  const openProjectEditor = React.useCallback(
    (projectId: string) => {
      rememberCurrentPathForEditorReturn()
      router.push(`/editor/${projectId}`)
    },
    [router],
  )

  const isEmpty = !isLoading && filteredProjects.length === 0
  const isDataEmpty = !isLoading && projects.length === 0

  return (
    <PrometheusShell>
      <div className="h-full px-3 py-3 md:px-4 md:py-4">
        <div className="mx-auto h-full max-w-[1500px] overflow-hidden rounded-[30px] border border-white/18 bg-[linear-gradient(145deg,rgba(255,255,255,0.09)_0%,rgba(255,255,255,0.03)_30%,rgba(7,7,12,0.76)_100%)] shadow-[0_48px_120px_-64px_rgba(0,0,0,0.94),inset_0_1px_0_rgba(255,255,255,0.24)] backdrop-blur-3xl">
          <section className="h-full min-h-[calc(100vh-124px)] bg-[radial-gradient(130%_90%_at_80%_0%,rgba(183,123,255,0.18)_0%,rgba(92,70,140,0.08)_34%,rgba(0,0,0,0)_66%)] px-4 py-5 md:px-6">
            <div className="border-b border-white/12 pb-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-lg font-medium text-white/94">Project Folders</div>
                  <div className="mt-1 text-xs text-white/56">
                    Read-only mode: projects are managed in Xano and synced to this view.
                  </div>
                </div>

                <div className="relative w-full max-w-[390px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/35" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search projects"
                    className="h-10 rounded-xl border-white/16 bg-white/[0.06] pl-9 text-sm text-white/90 placeholder:text-white/42"
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {STATUS_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setStatusFilter(filter.value)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      statusFilter === filter.value
                        ? 'border-white/28 bg-white/[0.14] text-white'
                        : 'border-white/14 bg-white/[0.03] text-white/62 hover:border-white/24 hover:text-white'
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-xl border border-rose-300/35 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <div className="pt-5">
              <h2 className="text-3xl font-semibold tracking-tight text-white/95">Folders</h2>
              {isLoading ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={`loading-${index}`}
                      className="h-[210px] animate-pulse rounded-[22px] border border-white/10 bg-white/[0.04]"
                    />
                  ))}
                </div>
              ) : isEmpty ? (
                <div className="mt-4 rounded-2xl border border-white/12 bg-white/[0.03] px-4 py-10 text-center text-white/62">
                  {isDataEmpty ? 'No projects found in Xano yet.' : 'No projects match this filter.'}
                </div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredProjects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => openProjectEditor(project.id)}
                      className="group rounded-[22px] border border-white/15 bg-[linear-gradient(152deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.04)_30%,rgba(7,7,11,0.78)_100%)] p-3 text-left shadow-[0_28px_54px_-34px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/26"
                    >
                      <div className="relative h-[132px]">
                        <div className="absolute left-5 top-0 h-7 w-24 rounded-t-[12px] border border-white/20 border-b-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0.08)_100%)]" />
                        <div className="absolute inset-x-0 bottom-0 top-5 overflow-hidden rounded-2xl border border-white/16 bg-[linear-gradient(168deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.03)_72%)]">
                          {project.thumbnailUrl && !brokenPreviewIds[project.id] ? (
                            project.previewKind === 'video' ? (
                              <video
                                src={project.thumbnailUrl}
                                muted
                                loop
                                autoPlay
                                playsInline
                                preload="metadata"
                                className="h-full w-full object-cover opacity-[0.85] transition-transform duration-300 group-hover:scale-[1.04]"
                                onError={() =>
                                  setBrokenPreviewIds((prev) => ({
                                    ...prev,
                                    [project.id]: true,
                                  }))
                                }
                              />
                            ) : (
                              <img
                                src={project.thumbnailUrl}
                                alt={project.title}
                                className="h-full w-full object-cover opacity-[0.85] transition-transform duration-300 group-hover:scale-[1.04]"
                                onError={() =>
                                  setBrokenPreviewIds((prev) => ({
                                    ...prev,
                                    [project.id]: true,
                                  }))
                                }
                              />
                            )
                          ) : (
                            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0)_52%),linear-gradient(165deg,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0.02)_68%)]">
                              <Folder className="size-11 text-white/74" />
                            </div>
                          )}
                          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.14)_0%,rgba(0,0,0,0)_28%,rgba(0,0,0,0.38)_100%)]" />
                        </div>
                      </div>
                      <div className="pt-2">
                        <div className="truncate text-lg text-white/94">{project.title}</div>
                        <div className="text-sm capitalize text-white/58">{project.status} folder</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-7">
              <h3 className="text-3xl font-semibold tracking-tight text-white/95">Recently Updated</h3>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-white/12 bg-[linear-gradient(160deg,rgba(255,255,255,0.08)_0%,rgba(8,8,12,0.8)_100%)] backdrop-blur-xl">
                <div className="min-w-[640px]">
                  <div className="grid grid-cols-[minmax(0,1.35fr)_240px_140px] border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.12em] text-white/44">
                    <div>File</div>
                    <div>Owner</div>
                    <div>Status</div>
                  </div>
                  {filteredProjects.slice(0, 6).map((project, index) => (
                    <button
                      key={`${project.id}-row`}
                      type="button"
                      onClick={() => openProjectEditor(project.id)}
                      className="grid w-full grid-cols-[minmax(0,1.35fr)_240px_140px] items-center px-4 py-3 text-left transition-colors hover:bg-white/[0.06]"
                    >
                      <div className="flex min-w-0 items-center gap-2 text-white/86">
                        {project.previewKind === 'video' ? (
                          <FileVideo2 className="size-4 shrink-0 text-violet-200/90" />
                        ) : (
                          <FileText className="size-4 shrink-0 text-white/70" />
                        )}
                        <span className="truncate">{project.title}.mp4</span>
                      </div>
                      <div className="text-sm text-white/58">{OWNER_EMAILS[index % OWNER_EMAILS.length]}</div>
                      <div className="text-sm capitalize text-white/66">{project.status}</div>
                    </button>
                  ))}
                  {!isLoading && filteredProjects.length === 0 ? (
                    <div className="px-4 py-8 text-sm text-white/56">No uploaded files yet.</div>
                  ) : null}
                </div>
              </div>
              {filteredProjects.length > 0 ? (
                <div className="mt-2 text-xs text-white/45">
                  Last update: {formatDistanceToNow(new Date(filteredProjects[0]!.updatedAt), { addSuffix: true })}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </PrometheusShell>
  )
}
