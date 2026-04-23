import type {
  AnimationPlan,
  BRollSuggestion,
  DetectedScene,
  HighlightTimestamp,
  ProcessingJob,
  ProcessingJobInput,
  Project,
  ProjectStatus,
  TranscriptSegment,
} from '@/lib/types'
import { readLocalStorageJSON, writeLocalStorageJSON } from '@/lib/storage'

const STORAGE = {
  projects: 'prometheus.projects.v1',
  jobsByProjectId: 'prometheus.jobsByProjectId.v1',
  activeStyleId: 'prometheus.activeStyleId.v1',
} as const

export const PROJECTS_UPDATED_EVENT = 'prometheus:projects-updated'

function nowIso() {
  return new Date().toISOString()
}

function dispatchProjectsUpdated() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(PROJECTS_UPDATED_EVENT))
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedFromString(value: string) {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function getActiveStyleId(): string | null {
  return readLocalStorageJSON<string>(STORAGE.activeStyleId)
}

export function setActiveStyleId(styleId: string | null) {
  if (!styleId) {
    writeLocalStorageJSON(STORAGE.activeStyleId, '')
    return
  }
  writeLocalStorageJSON(STORAGE.activeStyleId, styleId)
}

export function listProjects(): Project[] {
  return readLocalStorageJSON<Project[]>(STORAGE.projects) ?? []
}

export function getMostRecentProject(): Project | null {
  const projects = listProjects()
  if (projects.length === 0) return null

  return [...projects].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0] ?? null
}

export function resetProjectData(): void {
  writeLocalStorageJSON<Project[]>(STORAGE.projects, [])
  writeLocalStorageJSON<Record<string, ProcessingJob>>(STORAGE.jobsByProjectId, {})
  dispatchProjectsUpdated()
}

export function upsertProject(project: Project): void {
  const current = listProjects()
  const next = [project, ...current.filter((p) => p.id !== project.id)]
  writeLocalStorageJSON(STORAGE.projects, next)
  dispatchProjectsUpdated()
}

export function getProject(id: string): Project | null {
  return listProjects().find((p) => p.id === id) ?? null
}

export function renameProject(projectId: string, title: string): Project | null {
  const project = getProject(projectId)
  if (!project) return null

  const nextTitle = title.trim()
  const next: Project = {
    ...project,
    title: nextTitle.length > 0 ? nextTitle : 'Untitled Project',
    updatedAt: nowIso(),
  }
  upsertProject(next)
  return next
}

export function createProject(params?: {
  title?: string
  thumbnailUrl?: string
  previewKind?: 'video' | 'image'
  sourceProfile?: Project['sourceProfile']
  sourceAssetId?: string
}): Project {
  const project: Project = {
    id: uid('proj'),
    title: params?.title ?? 'Untitled Project',
    status: 'draft',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    thumbnailUrl: params?.thumbnailUrl ?? '',
    previewKind: params?.previewKind,
    sourceProfile: params?.sourceProfile,
    sourceAssetId: params?.sourceAssetId,
  }
  upsertProject(project)
  return project
}

type JobsByProjectId = Record<string, ProcessingJob>

function readJobs(): JobsByProjectId {
  return readLocalStorageJSON<JobsByProjectId>(STORAGE.jobsByProjectId) ?? {}
}

function writeJobs(value: JobsByProjectId) {
  writeLocalStorageJSON(STORAGE.jobsByProjectId, value)
}

function buildArtifacts(seedKey: string) {
  const rand = mulberry32(seedFromString(seedKey))

  const transcript: TranscriptSegment[] = Array.from({ length: 9 }).map((_, i) => {
    const startMs = i * 9000 + Math.floor(rand() * 500)
    const endMs = startMs + 7500 + Math.floor(rand() * 700)
    return {
      id: uid('ts'),
      startMs,
      endMs,
      speaker: i % 2 === 0 ? 'Host' : 'Guest',
      text: [
        "It doesn't matter if you are in your first job.",
        'Structure over surface is what makes the message stick.',
        'Retrieval is the skill people actually remember.',
        'We tracked $741,824 in collected revenue from this shift.',
        'Myth versus fact is the wrong comparison when the offer is weak.',
        'System design feels abstract until the process is visualized clearly.',
        'When YouTube and Snapchat compete, the format decides the winner.',
        'Alex Hormozi would call this the value equation in motion.',
        'The final move is a hard call to action with one clean promise.',
      ][i]!,
    }
  })

  const scenes: DetectedScene[] = Array.from({ length: 7 }).map((_, i) => {
    const startMs = i * 12000 + Math.floor(rand() * 600)
    const endMs = startMs + 10500 + Math.floor(rand() * 1200)
    return {
      id: uid('sc'),
      startMs,
      endMs,
      label: `Scene ${i + 1}`,
    }
  })

  const highlights: HighlightTimestamp[] = Array.from({ length: 5 }).map((_, i) => {
    const atMs = 5000 + i * 17000 + Math.floor(rand() * 1400)
    return {
      id: uid('hi'),
      atMs,
      label: ['Hook', 'Contrast', 'Framework', 'Proof', 'CTA'][i] ?? `Highlight ${i + 1}`,
    }
  })

  const brollSuggestions: BRollSuggestion[] = Array.from({ length: 6 }).map((_, i) => {
    const startMs = 7000 + i * 14000 + Math.floor(rand() * 900)
    const endMs = startMs + 4000 + Math.floor(rand() * 700)
    const confidence = clamp01(0.55 + rand() * 0.4)
    return {
      id: uid('br'),
      startMs,
      endMs,
      query: [
        'Entrepreneur typing late night',
        'Luxury city b-roll',
        'Money / finance visuals',
        'Calendar time-lapse',
        'Podcast mic close-up',
        'Fast-paced UI montage',
      ][i] ?? 'Generic b-roll',
      confidence,
    }
  })

  return { transcript, scenes, highlights, brollSuggestions }
}

export function createProcessingJob(params: {
  projectId: string
  input: ProcessingJobInput
}): ProcessingJob {
  const startedAt = nowIso()
  return {
    id: uid('job'),
    projectId: params.projectId,
    status: 'running',
    createdAt: nowIso(),
    startedAt,
    steps: [
      { key: 'video-analysis', title: 'Video Analysis', status: 'running', progress: 0 },
      { key: 'scene-detection', title: 'Scene Detection', status: 'pending', progress: 0 },
      { key: 'audio-processing', title: 'Audio Processing', status: 'pending', progress: 0 },
      { key: 'ai-enhancement', title: 'AI Enhancement', status: 'pending', progress: 0 },
    ],
    input: params.input,
    artifacts: {
      ...buildArtifacts(params.projectId),
      styleId: params.input.styleId,
    },
  }
}

export function startProcessing(job: ProcessingJob): ProcessingJob {
  const jobs = readJobs()
  jobs[job.projectId] = job
  writeJobs(jobs)

  const project = getProject(job.projectId)
  if (project) {
    upsertProject({ ...project, status: 'processing', updatedAt: nowIso() })
  }
  return job
}

export function setJobAnimationPlan(projectId: string, animationPlan: AnimationPlan) {
  const jobs = readJobs()
  const job = jobs[projectId]
  if (!job) return null

  const next: ProcessingJob = {
    ...job,
    artifacts: {
      ...job.artifacts,
      animationPlan,
    },
  }

  jobs[projectId] = next
  writeJobs(jobs)
  return next
}

const STEP_DURATIONS_MS: Record<ProcessingJob['steps'][number]['key'], number> = {
  'video-analysis': 2600,
  'scene-detection': 2400,
  'audio-processing': 2200,
  'ai-enhancement': 2800,
}

export function getJobStatus(projectId: string): ProcessingJob | null {
  const jobs = readJobs()
  const job = jobs[projectId]
  if (!job) return null

  const startedAtMs = Date.parse(job.startedAt)
  const elapsedMs = Math.max(0, Date.now() - startedAtMs)

  let cursor = 0
  const updatedSteps = job.steps.map((step) => {
    const d = STEP_DURATIONS_MS[step.key]
    const stepStart = cursor
    const stepEnd = cursor + d
    cursor = stepEnd

    if (elapsedMs < stepStart) {
      return { ...step, status: 'pending' as const, progress: 0 }
    }
    if (elapsedMs >= stepEnd) {
      return { ...step, status: 'completed' as const, progress: 1 }
    }
    const progress = clamp01((elapsedMs - stepStart) / d)
    return { ...step, status: 'running' as const, progress }
  })

  const allDone = updatedSteps.every((s) => s.status === 'completed')
  const status: ProcessingJob['status'] = allDone ? 'completed' : 'running'

  const next: ProcessingJob = { ...job, steps: updatedSteps, status }
  jobs[projectId] = next
  writeJobs(jobs)

  const project = getProject(projectId)
  if (project) {
    const nextStatus: ProjectStatus = allDone ? 'ready' : 'processing'
    if (project.status !== nextStatus) {
      upsertProject({ ...project, status: nextStatus, updatedAt: nowIso() })
    }
  }

  return next
}
