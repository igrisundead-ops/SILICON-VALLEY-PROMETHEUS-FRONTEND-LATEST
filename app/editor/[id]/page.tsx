'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useParams, useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  CopyPlus,
  ChevronLeft,
  ChevronRight,
  Film,
  FolderOpen,
  ImageIcon,
  Layers3,
  MessageSquare,
  Music4,
  Palette,
  Pause,
  PenSquare,
  Play,
  Loader2,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  Wand2,
  X,
} from 'lucide-react'

import { MusicPlayNotification } from '@/components/editor/music-play-notification'
import { MusicSpotlightOrb } from '@/components/editor/music-spotlight-orb'
import { MusicRecommendationShowcase } from '@/components/editor/music-recommendation-showcase'
import { CinematicPreviewRuntime } from '@/components/editor/cinematic-preview-runtime'
import { EditWorkflowPanel } from '@/components/editor/edit-workflow-panel'
import { EditorialComposerFrameAssist } from '@/components/editor/editorial-composer-frame-assist'
import { FrameComposerDraftMirror } from '@/components/editor/frame-composer-draft-mirror'
import { StagedMusicRail } from '@/components/editor/staged-music-rail'
import { CinematicExportCluster } from '@/components/editor/cinematic-export-cluster'
import { EditorLoadingScreen } from '@/components/editor/editor-loading-screen'
import { InfinityTrailLoader } from '@/components/editor/infinity-trail-loader'
import { ViralClipJobPanel } from '@/components/editor/viral-clip-job-panel'
import { ViralClipSplitPreview } from '@/components/editor/viral-clip-split-preview'
import { ViralClipTrigger } from '@/components/editor/viral-clip-trigger'
import { useSourceStage } from '@/hooks/use-source-stage'
import { useViralClipJob } from '@/hooks/use-viral-clip-job'
import { WorkspaceNavBar, type WorkspaceNavItem } from '@/components/ui/anime-navbar'
import { clearPendingEditorNavigation, getRememberedEditorReturnPath } from '@/lib/editor-navigation'
import { useFrameTargeting } from '@/hooks/use-frame-targeting'
import { parseFrameReference } from '@/lib/editorial-frame/parse-frame-reference'
import {
  formatAspectFamily,
  formatDurationBucket,
  formatProcessingClass,
  formatSourceProfileMetric,
  formatTimeProfile,
  formatWeightBucket,
  getSourcePreviewAspectRatio,
  getOutputProfileAspectRatio,
} from '@/lib/media/source-profile'
import {
  MUSIC_CATALOG,
  createDefaultMusicPreference,
  normalizeMusicPreference,
} from '@/lib/music-catalog'
import {
  buildHeuristicSoundtrackProfile,
  buildMusicAnalysisStages,
  buildMusicRecommendationSet,
} from '@/lib/music-recommendation-core'
import { readLocalStorageJSON, writeLocalStorageJSON } from '@/lib/storage'
import { useStableReducedMotion } from '@/hooks/use-stable-reduced-motion'
import { buildRevealVariants } from '@/lib/motion'
import { buildCinematicAnimationPlan } from '@/lib/cinematic/animation-planner'
import { cn } from '@/lib/utils'
import { createProcessingJob, getJobStatus, getProject, setJobAnimationPlan, startProcessing, upsertProject } from '@/lib/mock'
import { analyzeMusicIntent } from '@/lib/music-intent'
import { queuePreviewRevisionRequest } from '@/lib/editorial-frame/mock-preview-api'
import { getSessionSourcePreview, setSessionSourcePreview } from '@/lib/source-preview-session'
import { createSourceAssetObjectUrl, getStoredSourceAssetFile } from '@/lib/source-asset-store'
import { STYLE_TEMPLATES, type StyleTemplate } from '@/lib/styles/style-templates'
import { toast } from 'sonner'
import type { FrameAssistSubmission, FrameSuggestion, QueuedPreviewRevisionState } from '@/lib/editorial-frame/types'
import type {
  AnimationPlan,
  MusicPreference,
  MusicRecommendation,
  MusicRecommendationGroup,
  MusicRecommendationPhase,
  MusicRecommendationPipelineResult,
  MusicSoundtrackProfile,
  MusicVideoContext,
  ProcessingJob,
  Project,
  OutputProfile,
  StagedMusicTrack,
  ViralClipTargetPlatform,
  CinematicAssetRegistry,
} from '@/lib/types'
import { SourceStagePlaceholder } from '@/components/editor/source-stage-placeholder'

type LeftTabKey = 'chat' | 'edit' | 'design' | 'assets'
type PreviewMediaKind = 'video' | 'image'
type PreviewFitMode = 'fill' | 'fit'
type BottomMode = 'Original' | 'Music' | 'Timeline'
type PreviewFramePreset = OutputProfile
type SessionPreviewState = {
  sourceKey: string
  url: string
  kind: PreviewMediaKind
}

type SplitPreviewAssetState = {
  sourceAssetId: string | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  leftUrl: string | null
  rightUrl: string | null
  errorMessage: string | null
}

const EMPTY_SPLIT_PREVIEW_ASSETS: SplitPreviewAssetState = {
  sourceAssetId: null,
  status: 'idle',
  leftUrl: null,
  rightUrl: null,
  errorMessage: null,
}

const PREVIEW_FRAME_PRESETS: PreviewFramePreset[] = ['source', '9:16', '1:1', '4:5', '16:9']

type ChatEntry = {
  id: string
  role: 'assistant' | 'user'
  text: string
  status?: 'loading' | 'ready'
  music?: ChatMusicBlock
}

type ChatMusicBlock = MusicRecommendationPipelineResult & {
  status: 'loading' | 'ready'
  query: string
  preference: MusicPreference
  contextSummary?: string
  profileModel?: string
}

type ChatApiResponse = {
  reply?: string
  error?: string
}

type ComposerAutomationRequest = {
  id: number
  prompt: string
}

type MusicApiResponse = MusicRecommendationPipelineResult & {
  error?: string
  contextSummary?: string
  profileModel?: string
}

const MUSIC_PREFERENCE_STORAGE_PREFIX = 'prometheus.editor.music-preferences.v1'
const STAGED_MUSIC_STORAGE_PREFIX = 'prometheus.editor.staged-music.v1'
const MUSIC_PREVIEW_VOLUME_STORAGE_PREFIX = 'prometheus.editor.music-preview-volume.v1'
const DEFAULT_MUSIC_PREVIEW_VOLUME = 0.34
const MUSIC_INTENT_KEYWORDS = [
  'add music',
  'music',
  'song',
  'songs',
  'track',
  'tracks',
  'soundtrack',
  'score',
  'cue',
  'beat',
  'beats',
  'instrumental',
  'playlist',
  'audio',
  'sound bed',
] as const

const EDIT_INTENT_KEYWORDS = [
  'edit',
  'edit this video',
  'make this video',
  'make this cut',
  'rough cut',
  'rough cuts',
  'refine',
  'tighten',
  'trim',
  'shorten',
  'extend',
  'reframe',
  'caption',
  'captions',
  'subtitle',
  'subtitle',
  'title card',
  'motion',
  'overlay',
  'overlay text',
  'timeline',
  'pacing',
  'hook',
  'intro',
  'outro',
  'remove dead air',
  'cinematic',
  'polish',
  'clean up',
] as const

function musicPreferenceStorageKey(projectId: string) {
  return `${MUSIC_PREFERENCE_STORAGE_PREFIX}.${projectId}`
}

function stagedMusicStorageKey(projectId: string) {
  return `${STAGED_MUSIC_STORAGE_PREFIX}.${projectId}`
}

function musicPreviewVolumeStorageKey(projectId: string) {
  return `${MUSIC_PREVIEW_VOLUME_STORAGE_PREFIX}.${projectId}`
}

function clampMusicPreviewVolume(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_MUSIC_PREVIEW_VOLUME
  return Math.max(0, Math.min(1, value))
}

function isMusicIntent(value: string) {
  const normalized = value.trim().toLowerCase()
  return MUSIC_INTENT_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

function isGenericMusicRequest(value: string) {
  const normalized = value.trim().toLowerCase()
  const exactMatches = [
    'add music',
    'music',
    'song',
    'songs',
    'track',
    'tracks',
    'soundtrack',
    'score',
    'cue',
    'beat',
    'beats',
    'instrumental',
    'playlist',
    'audio',
    'sound bed',
    'recommend music',
    'music recommendations',
    'song recommendations',
  ]

  return exactMatches.includes(normalized) || /^((add|recommend|suggest)\s+)?music(\s+.*)?$/.test(normalized) || /^[a-z\s]{1,20}$/.test(normalized)
}

function isEditIntent(value: string) {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return false
  if (EDIT_INTENT_KEYWORDS.some((keyword) => normalized.includes(keyword))) return true
  return /^(?:please\s+)?(?:can you\s+)?(?:make|edit|tighten|trim|reframe|caption|subtitle|refine|polish|cut)\b/.test(normalized)
}

function removeChatEntry(entries: ChatEntry[], entryId: string) {
  return entries.filter((entry) => entry.id !== entryId)
}

const HEADER_NAV_ITEMS: WorkspaceNavItem[] = [
  { name: 'Prompt', icon: MessageSquare },
  { name: 'Motion', icon: Film },
  { name: 'Music', icon: Music4 },
  { name: 'Output', icon: Sparkles },
]

const LEFT_TABS: Array<{ key: LeftTabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'chat', label: 'Chat', icon: MessageSquare },
  { key: 'edit', label: 'Edit', icon: PenSquare },
  { key: 'design', label: 'Design', icon: Palette },
  { key: 'assets', label: 'Assets', icon: FolderOpen },
]

const QUICK_ACTIONS = [
  { label: 'Edit this video', icon: PenSquare },
  { label: 'Generate rough cuts', icon: Wand2 },
  { label: 'Add music', icon: Music4 },
  { label: 'Generate title cards', icon: CopyPlus },
  { label: 'Cinematic captions', icon: MessageSquare },
  { label: 'Motion graphics', icon: Sparkles },
  { label: 'Polish pacing', icon: SlidersHorizontal },
]

const QUICK_ACTION_TILTS = [
  { rotate: -1.8, y: -7 },
  { rotate: 0.9, y: -2 },
  { rotate: -1.1, y: 3 },
  { rotate: 1.4, y: -5 },
  { rotate: -0.8, y: 2 },
  { rotate: 1.05, y: -1 },
  { rotate: -0.4, y: 4 },
] as const

const MUSIC_REFINEMENT_OPTIONS = [
  {
    key: 'minimal',
    label: 'More minimal',
    mood: 'minimal',
    energy: 'low',
    variantHint: 'minimal',
    hint: 'Soft, spacious, and under-dialogue.',
  },
  {
    key: 'cinematic',
    label: 'More cinematic',
    mood: 'cinematic',
    energy: 'medium',
    variantHint: 'cinematic',
    hint: 'Polished, score-like, and a little more elevated.',
  },
  {
    key: 'energetic',
    label: 'More energetic',
    mood: 'uplifting',
    energy: 'high',
    variantHint: 'energetic',
    hint: 'Forward motion for faster cuts and sharper hooks.',
  },
  {
    key: 'less-intense',
    label: 'Less intense',
    mood: 'minimal',
    energy: 'low',
    variantHint: 'less-intense',
    hint: 'Thoughtful but lighter and easier under dialogue.',
  },
  {
    key: 'emotional',
    label: 'More emotional',
    mood: 'minimal',
    energy: 'medium',
    variantHint: 'emotional',
    hint: 'Warmer, softer, and more reflective.',
  },
  {
    key: 'fresh',
    label: 'Freshen results',
    mood: 'cinematic',
    energy: 'medium',
    variantHint: 'fresh',
    hint: 'Keep the lane but rotate the archive lane.',
  },
] as const

const VIRAL_CLIP_PLATFORM_DEFAULT: ViralClipTargetPlatform = 'tiktok'

const VIRAL_CLIP_COUNT_PRESETS = [
  { min: 2, max: 3 },
  { min: 3, max: 5 },
  { min: 5, max: 8 },
] as const

const SHOULD_PREFETCH_EDITOR_SUPPORT_ROUTES = process.env.NODE_ENV === 'production'

const BOTTOM_MODES: BottomMode[] = ['Original', 'Music', 'Timeline']
const MUSIC_RECOMMENDATION_LIMIT = 8
const EDITOR_REQUEST_TIMEOUT_MS = 25_000

const CHAT_COMPOSER_FONT_STYLE = {
  fontFamily: '"SF Pro Text","SF Pro Display",-apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",Arial,sans-serif',
} satisfies React.CSSProperties

const CHAT_PLACEHOLDER_LINES = [
  'Sketch the next pass with a more cinematic rhythm...',
  'Carve the opener into something sharper and calmer...',
  'Let the pacing breathe, then land the hook earlier...',
  'Shape the visual beat so the tension rises cleaner...',
  'Push the framing toward something colder and bolder...',
  'Refine the cut until the emotional turn feels earned...',
  'Tune the motion so the whole pass feels more alive...',
] as const

function debugEditorPreview(event: string, detail?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'development') return

  console.debug('[editor-preview]', event, detail ?? {})
}

function msToTime(ms: number) {
  const safe = Math.max(0, ms)
  const seconds = Math.floor(safe / 1000)
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${`${seconds % 60}`.padStart(2, '0')}`
}

function buildAssistantReply({
  projectTitle,
  originalPrompt,
  sourceCount,
  input,
}: {
  projectTitle: string
  originalPrompt: string
  sourceCount: number
  input: string
}) {
  const normalized = input.trim().toLowerCase()
  const original = originalPrompt.trim() || 'shape the clip into a clearer final edit'
  const sourceNote = sourceCount > 0 ? ` I'm also holding ${sourceCount} staged source reference${sourceCount > 1 ? 's' : ''}.` : ''

  if (normalized.includes('rough cuts')) {
    return `Starting with rough cuts makes sense. I'd open with the strongest hook from "${original}", trim hesitation, and build a first pass around the cleanest beat changes.${sourceNote}`
  }

  if (normalized.includes('music')) {
    return `For music, I'd keep it supportive rather than dominant. Based on "${original}", I'd aim for a restrained bed that lifts momentum without crowding the voice.${sourceNote}`
  }

  if (normalized.includes('title')) {
    return `Title cards can work here if they stay spare. I'd use one typographic system, let the project name carry authority, and avoid over-decorating the message from "${original}".`
  }

  if (normalized.includes('caption')) {
    return `Captions should feel editorial, not noisy. I'd highlight only the strongest phrases from "${original}" and keep the pacing readable rather than hyperactive.`
  }

  if (normalized.includes('motion')) {
    return `Motion graphics should stay in service of the edit. For ${projectTitle}, I'd keep transitions minimal and reserve motion accents for moments that reinforce the original idea: "${original}".`
  }

  if (
    normalized.includes('viral')
    || normalized.includes('short-form')
    || normalized.includes('9:16')
    || normalized.includes('hook in the first 2 seconds')
  ) {
    return `For a viral clipping pass, I'd collapse the long-form source into a hook-first 9:16 sequence, trim every hesitation beat, and build around the most quotable moments from "${original}".${sourceNote} I'd also treat captions and reframes as retention tools, not decoration.`
  }

  return `Working from your original direction "${original}", I'd treat "${input.trim()}" as the next refinement pass and keep the system focused, paced, and uncluttered.${sourceNote}`
}

function buildMusicReply({
  projectTitle,
  sourceCount,
  videoContext,
}: {
  projectTitle: string
  sourceCount: number
  videoContext: MusicVideoContext
}) {
  const summary = videoContext.summary ? ` I'm reading the cut as ${videoContext.summary}.` : ''
  const paceLine =
    videoContext.pace === 'fast'
      ? 'keep the cue fast, upbeat, and forward-driving'
      : videoContext.pace === 'slow'
        ? 'keep the cue spacious and reflective'
        : 'keep the cue balanced and editorial'
  const sourceLine = sourceCount > 0 ? ` I'm also holding ${sourceCount} staged source${sourceCount > 1 ? 's' : ''} in view.` : ''

  return `For ${projectTitle}, I'd ${paceLine}.${summary}${sourceLine} I've lined up a few options below, and if you want me to narrow it, use the intensity selector so I can lock onto atmospheric, balanced, or driving.`
}

function selectEditStyleTemplate(prompt: string, videoContext: MusicVideoContext) {
  const contextText = normalizeInlineText([prompt, videoContext.summary, ...videoContext.signals].filter(Boolean).join(' '))
  const ranked = STYLE_TEMPLATES.map((template) => ({
    template,
    score: scoreEditStyleTemplate(template, contextText, videoContext),
  })).sort((left, right) => right.score - left.score)

  return ranked[0]?.template ?? STYLE_TEMPLATES[2] ?? STYLE_TEMPLATES[0]
}

function scoreEditStyleTemplate(template: StyleTemplate, contextText: string, videoContext: MusicVideoContext) {
  const tokens = `${template.name} ${template.description} ${template.tags.join(' ')}`.toLowerCase()
  let score = 0

  if (template.id === 'style_podcast_dynamic') {
    if (hasAny(contextText, ['caption', 'subtitle', 'typographic', 'voice', 'talking', 'podcast', 'long form', 'longform'])) score += 8
    if (hasAny(tokens, ['typography', 'caption'])) score += 3
  }

  if (template.id === 'style_reels_heat') {
    if (hasAny(contextText, ['fast', 'viral', 'hook', 'retention', 'short', 'reel', 'punchy', 'snappy'])) score += 8
  }

  if (template.id === 'style_docs_story') {
    if (hasAny(contextText, ['cinematic', 'documentary', 'story', 'reflective', 'calm', 'breathing', 'smooth'])) score += 8
  }

  if (template.id === 'style_iman_clean') {
    if (hasAny(contextText, ['clean', 'premium', 'minimal', 'polish', 'simple', 'precise'])) score += 7
  }

  if (template.id === 'style_iman_punchy') {
    if (hasAny(contextText, ['bold', 'impact', 'aggressive', 'strong', 'sharp'])) score += 7
  }

  if (template.id === 'style_cinematic_noir') {
    if (hasAny(contextText, ['moody', 'dark', 'shadow', 'slow', 'dramatic'])) score += 7
  }

  if (template.id === 'style_minimal_subtle') {
    if (hasAny(contextText, ['subtle', 'bare', 'minimal', 'quiet'])) score += 7
  }

  if (videoContext.pace === 'fast' && hasAny(tokens, ['snappy', 'aggressive', 'punchy', 'heavy'])) score += 2
  if (videoContext.pace === 'slow' && hasAny(tokens, ['smooth', 'cinematic', 'minimal'])) score += 2

  score += Math.min(template.previewImages.length, 2)
  return score
}

function buildEditQuickActionPrompt(projectTitle: string, videoContext: MusicVideoContext, styleTemplate: StyleTemplate) {
  const summary = videoContext.summary || 'the current cut'
  const pace =
    videoContext.pace === 'fast'
      ? 'fast and punchy'
      : videoContext.pace === 'slow'
        ? 'slower and more reflective'
        : 'balanced and editorial'

  return [
    `Edit this video for ${projectTitle}.`,
    `Keep the cut ${pace}.`,
    `Treat ${summary} as the main read.`,
    `Use ${styleTemplate.name} as the overlay lane.`,
    'Render the first pass directly on top of the imported media.',
  ].join(' ')
}

function buildEditAssistantReply({
  projectTitle,
  sourceCount,
  styleTemplate,
  prompt,
  videoContext,
}: {
  projectTitle: string
  sourceCount: number
  styleTemplate: StyleTemplate
  prompt: string
  videoContext: MusicVideoContext
}) {
  const sourceLine = sourceCount > 0 ? ` I still have ${sourceCount} staged source${sourceCount > 1 ? 's' : ''} in the chamber.` : ''
  const summary = videoContext.summary ? ` The cut reads as ${videoContext.summary}.` : ''
  const promptLine = prompt.trim().length > 0 ? ` You asked for "${prompt.trim()}".` : ''

  return `The edit pass is live for ${projectTitle}.${summary} I'm using ${styleTemplate.name} so the overlay stays faithful to the style lane.${sourceLine}${promptLine} The backend stream can keep adding text while the preview renders the same treatment on the imported video.`
}

function buildFallbackEditAnimationPlan({
  projectId,
  projectTitle,
  prompt,
  jobId,
  sourceLabel,
  styleTemplate,
}: {
  projectId: string
  projectTitle: string
  prompt: string
  jobId: string
  sourceLabel: string | null
  styleTemplate: StyleTemplate
}): AnimationPlan {
  const promptCopy = prompt.trim().length > 0 ? prompt.trim() : 'Edit this video.'
  const trimmedPrompt = promptCopy.length > 76 ? `${promptCopy.slice(0, 73)}...` : promptCopy
  const previewImage = styleTemplate.previewImages[0] ?? null
  const styleSignal = styleTemplate.tags[0] ?? 'Captions: High'

  const speechCues: AnimationPlan['speechCues'] = [
    {
      id: `${projectId}_edit_caption_0`,
      variant: 'heading',
      startMs: 0,
      endMs: 2200,
      text: projectTitle,
      leadText: 'Edit job live',
      accentText: styleTemplate.name,
      trailingText: `Job ${jobId.slice(0, 8)}`,
      treatment: 'boxed',
      tone: 'ice',
      region: 'center-stage',
      alignment: 'left',
      maxWidthPct: 66,
    },
    {
      id: `${projectId}_edit_caption_1`,
      variant: 'caption',
      startMs: 1200,
      endMs: 3600,
      text: trimmedPrompt,
      leadText: 'Prompt lane',
      accentText: trimmedPrompt,
      trailingText: sourceLabel ? `Rendering on ${sourceLabel}.` : 'Rendering on the imported media.',
      treatment: 'highlight',
      tone: 'amber',
      region: 'safe-lower-third',
      alignment: 'center',
      bottomPaddingPct: 13,
      maxWidthPct: 72,
    },
    {
      id: `${projectId}_edit_caption_2`,
      variant: 'caption',
      startMs: 2800,
      endMs: 5200,
      text: styleSignal,
      leadText: 'Style lane',
      accentText: styleTemplate.name,
      trailingText: styleTemplate.description,
      treatment: 'boxed',
      tone: 'lime',
      region: 'safe-lower-third',
      alignment: 'center',
      bottomPaddingPct: 13,
      maxWidthPct: 70,
    },
  ]

  const transitionCues: AnimationPlan['transitionCues'] = [
    {
      id: `${projectId}_edit_line_0`,
      type: 'line',
      startMs: 0,
      endMs: 1800,
      region: 'center-stage',
      direction: 'center-out',
      label: 'Edit pass',
    },
  ]

  const backgroundCues: AnimationPlan['backgroundCues'] = previewImage
    ? [
        {
          id: `${projectId}_edit_bg_0`,
          startMs: 0,
          endMs: 5400,
          kind: 'image',
          region: 'right-panel',
          sourceId: styleTemplate.id,
          sourceUrl: previewImage,
          transform: 'softWash',
          opacity: 0.68,
          blendMode: 'screen',
          placement: 'right-stage',
        },
      ]
    : []

  return {
    engineVersion: 'edit-preview-v1',
    generatedAt: new Date().toISOString(),
    safeZonePolicy: {
      landscapeOnly: false,
      avoidSpeakerFace: false,
      captionBottomPaddingPct: 13,
      maxCaptionWidthPct: 72,
    },
    speechCues,
    transitionCues,
    explainerCues: [],
    backgroundCues,
    counterCues: [],
    sfxCues: [],
  }
}

function buildMusicQuickActionPrompt(projectTitle: string, videoContext: MusicVideoContext) {
  const summary = videoContext.summary || 'the current cut'
  const pace =
    videoContext.pace === 'fast'
      ? 'fast-paced, upbeat, and driving'
      : videoContext.pace === 'slow'
        ? 'slower, spacious, and reflective'
        : 'balanced, editorial, and cinematic'
  const signals = videoContext.signals.length > 0 ? ` Signals: ${videoContext.signals.slice(0, 5).join(', ')}.` : ''

  return [
    `Recommend up to 3 music options for ${projectTitle}.`,
    `The current cut feels ${pace}.`,
    `Context: ${summary}.${signals}`,
    'Show tracks that fit the edit itself, not generic music suggestions.',
    'If the choice is broad, invite refinement with intensity options.',
  ].join(' ')
}

function buildViralClipQuickActionPrompt({
  projectTitle,
  originalPrompt,
  sourceCount,
  transportTime,
  videoContext,
}: {
  projectTitle: string
  originalPrompt: string
  sourceCount: number
  transportTime: string
  videoContext: MusicVideoContext
}) {
  const summary = videoContext.summary || 'the current cut'
  const signals = videoContext.signals.length > 0 ? ` Signals: ${videoContext.signals.slice(0, 5).join(', ')}.` : ''
  const sourceLine = sourceCount > 0 ? `Work from the ${sourceCount} staged source reference${sourceCount > 1 ? 's' : ''}.` : ''

  return [
    `Clip the current long-form source for ${projectTitle} into viral-ready short-form cuts.`,
    'Reframe the strongest moments for 9:16, cut all dead air, and prioritize a hook in the first 2 seconds.',
    'Suggest the first 3 clip angles or excerpts, the pacing shift for each, and the caption treatment that would keep retention high.',
    `Current runtime is about ${transportTime}.`,
    `Original direction: "${originalPrompt}".`,
    `Context: ${summary}.${signals}`,
    sourceLine,
    'Keep the advice grounded in this footage instead of generic short-form tips.',
  ]
    .filter(Boolean)
    .join(' ')
}

function buildProvidedTranscript(job: ProcessingJob | null) {
  const transcript = job?.artifacts.transcript
    ?.map((segment) => segment.text.trim())
    .filter((segment) => segment.length > 0)
    .join(' ')

  return transcript && transcript.length > 0 ? transcript : null
}

function buildVideoMusicContext({
  projectTitle,
  promptText,
  sourceProfile,
  job,
  sourceList,
}: {
  projectTitle: string
  promptText: string
  sourceProfile: Project['sourceProfile'] | null
  job: ProcessingJob | null
  sourceList: string[]
}): MusicVideoContext {
  const combinedText = normalizeInlineText([projectTitle, promptText, ...sourceList].join(' '))
  const signals = new Set<string>()

  if (hasAny(combinedText, ['coach', 'training', 'trainer', 'motivation', 'motivational'])) {
    signals.add('coach-led')
  }
  if (hasAny(combinedText, ['tiktok', 'reel', 'short-form', 'short form', 'instagram', 'youtube shorts'])) {
    signals.add('short-form')
  }
  if (hasAny(combinedText, ['upbeat', 'energetic', 'fast', 'snappy', 'punchy', 'fun', 'funk'])) {
    signals.add('upbeat')
  }
  if (hasAny(combinedText, ['calm', 'reflective', 'documentary', 'interview', 'talking', 'voice'])) {
    signals.add('voice-led')
  }
  if (job?.artifacts.highlights?.length) {
    signals.add('hook-driven')
  }
  if (job?.artifacts.scenes?.length && job.artifacts.scenes.length > 5) {
    signals.add('scene-changes')
  }
  if (sourceProfile?.aspectFamily === 'vertical_short' || sourceProfile?.aspectFamily === 'high_res_vertical') {
    signals.add('vertical')
  }

  const pace = inferVideoPace(sourceProfile, combinedText, job)
  const summaryParts = [
    pace === 'fast' ? 'fast-paced' : pace === 'slow' ? 'slow-moving' : 'balanced',
    signals.has('coach-led') ? 'coach-led' : null,
    signals.has('short-form') ? 'short-form' : null,
    signals.has('vertical') ? 'vertical framing' : null,
    signals.has('voice-led') ? 'voice-first' : null,
    signals.has('hook-driven') ? 'hook-driven' : null,
  ].filter(Boolean)

  const confidenceBase = 0.4 + Math.min(0.25, signals.size * 0.05) + (sourceProfile ? 0.1 : 0)
  const confidence = Math.max(0, Math.min(1, confidenceBase))
  const intent = analyzeMusicIntent({
    projectTitle,
    promptText,
    sourceList,
    sourceProfile,
    job,
    pace,
  })

  return {
    pace,
    summary: summaryParts.join(', '),
    signals: [...signals],
    confidence,
    intent,
  }
}

function buildMusicSourceLabel(sourceUrl: string) {
  try {
    const host = new URL(sourceUrl).hostname.replace(/^www\./i, '').toLowerCase()
    if (host.includes('spotify')) return 'Open Spotify'
    if (host.includes('apple') || host.includes('itunes')) return 'Open Apple Music'
    return 'Open source'
  } catch {
    return 'Open source'
  }
}

function inferVideoPace(
  sourceProfile: Project['sourceProfile'] | null,
  text: string,
  job: ProcessingJob | null,
): MusicVideoContext['pace'] {
  const normalized = normalizeInlineText(text)
  if (sourceProfile?.timeProfile === 'quick_edit') return 'fast'
  if (sourceProfile?.timeProfile === 'long_form_edit' || sourceProfile?.timeProfile === 'extended_processing') return 'slow'
  if (sourceProfile?.durationBucket === 'very_short' || sourceProfile?.durationBucket === 'short') return 'fast'
  if (sourceProfile?.durationBucket === 'long' || sourceProfile?.durationBucket === 'very_long') return 'slow'
  if (hasAny(normalized, ['fast-paced', 'fast paced', 'reel', 'tiktok', 'short-form', 'short form', 'coach', 'training'])) return 'fast'
  if (hasAny(normalized, ['documentary', 'reflective', 'interview', 'calm', 'slow'])) return 'slow'
  if ((job?.artifacts.highlights?.length ?? 0) >= 4 && (job?.artifacts.scenes?.length ?? 0) >= 5) return 'fast'
  return 'medium'
}

function normalizeInlineText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function hasAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle))
}

function sanitizeAssistantReply(value: string) {
  return value
    .replace(/^\s*[*-]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\s+\n/g, '\n')
    .trim()
}

type GroqStreamChoice = {
  delta?: {
    content?: string | Array<{ type?: string; text?: string }>
  }
  message?: {
    content?: string | Array<{ type?: string; text?: string }>
  }
}

type GroqStreamPayload = {
  choices?: GroqStreamChoice[]
}

function extractGroqStreamText(payload: unknown) {
  if (!payload || typeof payload !== 'object') return ''

  const choices = (payload as GroqStreamPayload).choices
  const firstChoice = choices?.[0]
  if (!firstChoice) return ''

  const content = firstChoice.delta?.content ?? firstChoice.message?.content
  if (typeof content === 'string') return content

  if (Array.isArray(content)) {
    return content.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('')
  }

  return ''
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

async function readGroqStreamText(
  response: Response,
  signal: AbortSignal,
  onText: (text: string) => void,
) {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Groq returned an empty stream.')
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let accumulated = ''
  let finished = false

  const consumeDataLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) return

    const data = trimmed.slice(5).trim()
    if (!data) return
    if (data === '[DONE]') {
      finished = true
      return
    }

    const parsed = safeJsonParse(data)
    const delta = sanitizeAssistantReply(extractGroqStreamText(parsed))
    if (!delta) return

    accumulated += delta
    onText(sanitizeAssistantReply(accumulated))
  }

  try {
    while (!finished) {
      if (signal.aborted) break

      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        consumeDataLine(line)
        if (finished || signal.aborted) break
      }
    }

    if (!finished && buffer.trim()) {
      consumeDataLine(buffer)
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // ignore
    }
  }

  return sanitizeAssistantReply(accumulated)
}

function EyeOrb({
  target,
  reduceMotion,
}: {
  target: { x: number; y: number } | null
  reduceMotion: boolean
}) {
  const eyeRef = React.useRef<HTMLDivElement | null>(null)
  const [pupilOffset, setPupilOffset] = React.useState({ x: 0, y: 0 })

  React.useEffect(() => {
    const eye = eyeRef.current
    if (!eye || !target) {
      setPupilOffset({ x: 0, y: 0 })
      return
    }

    const rect = eye.getBoundingClientRect()
    const eyeCenterX = rect.left + rect.width / 2
    const eyeCenterY = rect.top + rect.height / 2
    const dx = target.x - eyeCenterX
    const dy = target.y - eyeCenterY
    const angle = Math.atan2(dy, dx)
    const distance = Math.sqrt(dx * dx + dy * dy)
    const maxDistance = rect.width / 2 - 8
    const moveDistance = Math.min(maxDistance, distance / 8)

    setPupilOffset({
      x: Math.cos(angle) * moveDistance,
      y: Math.sin(angle) * moveDistance,
    })
  }, [target])

  return (
    <div
      ref={eyeRef}
      className="relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-white/12 bg-[radial-gradient(circle_at_30%_28%,rgba(255,255,255,0.98)_0%,rgba(244,247,255,0.96)_48%,rgba(196,206,224,0.9)_100%)] shadow-[0_8px_20px_-14px_rgba(255,255,255,0.52),inset_0_1px_0_rgba(255,255,255,0.82)]"
    >
      <motion.div
        className="absolute h-2.5 w-2.5 rounded-full bg-[#0b0e14] shadow-[0_0_10px_rgba(0,0,0,0.28)]"
        animate={{ x: pupilOffset.x, y: pupilOffset.y }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : {
                type: 'spring',
                stiffness: 380,
                damping: 26,
                mass: 0.32,
              }
        }
      />
    </div>
  )
}

function TypingEyes({
  target,
  reduceMotion,
}: {
  target: { x: number; y: number } | null
  reduceMotion: boolean
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <EyeOrb target={target} reduceMotion={reduceMotion} />
      <EyeOrb target={target} reduceMotion={reduceMotion} />
    </div>
  )
}

function FloatingChatComposer({
  projectId,
  draft,
  onDraftChange,
  onSubmit,
  onStop,
  loading,
  reduceMotion,
  isOpen,
  onOpenChange,
  queuedPreviewRevision,
  onClearQueuedPreview,
}: {
  projectId: string
  draft: string
  onDraftChange: (value: string) => void
  onSubmit: (submission: FrameAssistSubmission) => void | Promise<void>
  onStop: () => void
  loading: boolean
  reduceMotion: boolean
  isOpen: boolean
  onOpenChange: (nextOpen: boolean) => void
  queuedPreviewRevision?: QueuedPreviewRevisionState | null
  onClearQueuedPreview?: () => void
}) {
  const composerId = React.useId()
  const hasDraft = draft.trim().length > 0
  const composerInputRef = React.useRef<HTMLInputElement | null>(null)
  const composerMeasureRef = React.useRef<HTMLSpanElement | null>(null)
  const composerPlaceholderMeasureRef = React.useRef<HTMLSpanElement | null>(null)
  const mouseMoveFrameRef = React.useRef<number | null>(null)
  const pointerResetTimeoutRef = React.useRef<number | null>(null)
  const draftRef = React.useRef(draft)
  const placeholderTextRef = React.useRef('')
  const eyeSourceRef = React.useRef<'placeholder' | 'caret' | 'pointer'>(hasDraft ? 'caret' : 'placeholder')
  const [isHandleHovered, setIsHandleHovered] = React.useState(false)
  const [eyeTarget, setEyeTarget] = React.useState<{ x: number; y: number } | null>(null)
  const [placeholderIndex, setPlaceholderIndex] = React.useState(0)
  const [placeholderText, setPlaceholderText] = React.useState('')
  const [placeholderPhase, setPlaceholderPhase] = React.useState<'typing' | 'holding' | 'deleting'>('typing')
  const [caretIndex, setCaretIndex] = React.useState(0)
  const [pendingSelectionRange, setPendingSelectionRange] = React.useState<{ start: number; end: number } | null>(null)
  const [suppressedAssistKey, setSuppressedAssistKey] = React.useState<string | null>(null)
  const [draftScrollLeft, setDraftScrollLeft] = React.useState(0)
  const frameAssist = useFrameTargeting({ projectId, draft, caretIndex })
  const draftMirrorAnalysis = React.useMemo(() => parseFrameReference(draft, draft.length), [draft])
  const frameAssistKey = React.useMemo(() => {
    if (!frameAssist.analysis.referenceText) return null
    return `${caretIndex}:${frameAssist.analysis.referenceStartIndex ?? 'na'}:${frameAssist.analysis.referenceEndIndex ?? 'na'}:${frameAssist.analysis.referenceText}`
  }, [
    caretIndex,
    frameAssist.analysis.referenceEndIndex,
    frameAssist.analysis.referenceStartIndex,
    frameAssist.analysis.referenceText,
  ])
  const isFrameAssistSuppressed = suppressedAssistKey !== null && suppressedAssistKey === frameAssistKey
  const isFrameAssistExpanded = Boolean(frameAssist.previewRegion || queuedPreviewRevision)
  const queuedPreviewRawText = queuedPreviewRevision?.request.rawText ?? null

  const updateCaretTarget = React.useCallback((activate = true) => {
    const input = composerInputRef.current
    const measure = composerMeasureRef.current
    if (!input || !measure) return

    const selectionIndex = input.selectionStart ?? input.value.length
    setCaretIndex(selectionIndex)
    setDraftScrollLeft(input.scrollLeft)
    const beforeCaret = input.value.slice(0, selectionIndex).replaceAll(' ', '\u00a0') || '\u200b'
    measure.textContent = beforeCaret

    const rect = input.getBoundingClientRect()
    const computed = window.getComputedStyle(input)
    const paddingLeft = Number.parseFloat(computed.paddingLeft) || 0
    const measureWidth = measure.getBoundingClientRect().width
    const minX = rect.left + paddingLeft
    const maxX = rect.right - 18

    if (activate) {
      eyeSourceRef.current = 'caret'
    }
    setEyeTarget({
      x: Math.min(maxX, Math.max(minX, rect.left + paddingLeft + measureWidth - input.scrollLeft)),
      y: rect.top + rect.height / 2,
    })
  }, [])

  const updatePlaceholderTarget = React.useCallback((text: string) => {
    const input = composerInputRef.current
    const measure = composerPlaceholderMeasureRef.current
    if (!input || !measure) return

    measure.textContent = text.replaceAll(' ', '\u00a0') || '\u200b'

    const rect = input.getBoundingClientRect()
    const computed = window.getComputedStyle(input)
    const paddingLeft = Number.parseFloat(computed.paddingLeft) || 0
    const measureWidth = measure.getBoundingClientRect().width
    const minX = rect.left + paddingLeft
    const maxX = rect.right - 18

    setEyeTarget({
      x: Math.min(maxX, Math.max(minX, rect.left + paddingLeft + measureWidth)),
      y: rect.top + rect.height / 2,
    })
  }, [])

  React.useEffect(() => {
    draftRef.current = draft
  }, [draft])

  React.useEffect(() => {
    placeholderTextRef.current = placeholderText
  }, [placeholderText])

  React.useEffect(() => {
    if (!isOpen) return

    const rafId = window.requestAnimationFrame(() => {
      composerInputRef.current?.focus()
      if (draftRef.current.trim().length > 0) {
        updateCaretTarget(false)
      } else {
        updatePlaceholderTarget(placeholderTextRef.current)
      }
    })

    return () => window.cancelAnimationFrame(rafId)
  }, [isOpen, updateCaretTarget, updatePlaceholderTarget])

  React.useEffect(() => {
    if (!isOpen || !hasDraft) return

    const rafId = window.requestAnimationFrame(() => {
      updateCaretTarget()
    })

    return () => window.cancelAnimationFrame(rafId)
  }, [draft, hasDraft, isOpen, updateCaretTarget])

  React.useEffect(() => {
    if (hasDraft) {
      eyeSourceRef.current = 'caret'
      return
    }

    eyeSourceRef.current = 'placeholder'
  }, [hasDraft])

  React.useEffect(() => {
    if (!isOpen || hasDraft) return

    const currentLine = CHAT_PLACEHOLDER_LINES[placeholderIndex]
    let timeoutId: number | null = null

    if (placeholderPhase === 'typing') {
      if (placeholderText.length < currentLine.length) {
        timeoutId = window.setTimeout(() => {
          setPlaceholderText(currentLine.slice(0, placeholderText.length + 1))
        }, 55)
      } else {
        timeoutId = window.setTimeout(() => {
          setPlaceholderPhase('holding')
        }, 1200)
      }
    } else if (placeholderPhase === 'holding') {
      timeoutId = window.setTimeout(() => {
        setPlaceholderPhase('deleting')
      }, 450)
    } else if (placeholderText.length > 0) {
      timeoutId = window.setTimeout(() => {
        setPlaceholderText(currentLine.slice(0, placeholderText.length - 1))
      }, 28)
    } else {
      timeoutId = window.setTimeout(() => {
        setPlaceholderIndex((current) => (current + 1) % CHAT_PLACEHOLDER_LINES.length)
        setPlaceholderPhase('typing')
      }, 220)
    }

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [hasDraft, isOpen, placeholderIndex, placeholderPhase, placeholderText])

  React.useEffect(() => {
    if (!hasDraft) {
      setDraftScrollLeft(0)
    }
  }, [hasDraft])

  React.useEffect(() => {
    if (!isOpen || hasDraft) return
    if (eyeSourceRef.current === 'pointer') return

    const rafId = window.requestAnimationFrame(() => {
      updatePlaceholderTarget(placeholderText)
    })

    return () => window.cancelAnimationFrame(rafId)
  }, [hasDraft, isOpen, placeholderText, updatePlaceholderTarget])

  React.useEffect(() => {
    if (!isOpen) return

    const handleMouseMove = (event: MouseEvent) => {
      if (mouseMoveFrameRef.current !== null) {
        window.cancelAnimationFrame(mouseMoveFrameRef.current)
      }

      mouseMoveFrameRef.current = window.requestAnimationFrame(() => {
        eyeSourceRef.current = 'pointer'
        setEyeTarget({
          x: event.clientX,
          y: event.clientY,
        })
        mouseMoveFrameRef.current = null
      })

      if (pointerResetTimeoutRef.current !== null) {
        window.clearTimeout(pointerResetTimeoutRef.current)
      }

      pointerResetTimeoutRef.current = window.setTimeout(() => {
        pointerResetTimeoutRef.current = null
        if (draftRef.current.trim().length > 0) {
          updateCaretTarget(false)
          eyeSourceRef.current = 'caret'
        } else {
          updatePlaceholderTarget(placeholderTextRef.current)
          eyeSourceRef.current = 'placeholder'
        }
      }, 900)
    }

    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (mouseMoveFrameRef.current !== null) {
        window.cancelAnimationFrame(mouseMoveFrameRef.current)
        mouseMoveFrameRef.current = null
      }
      if (pointerResetTimeoutRef.current !== null) {
        window.clearTimeout(pointerResetTimeoutRef.current)
        pointerResetTimeoutRef.current = null
      }
    }
  }, [isOpen, updateCaretTarget, updatePlaceholderTarget])

  React.useEffect(() => {
    if (suppressedAssistKey && suppressedAssistKey !== frameAssistKey) {
      setSuppressedAssistKey(null)
    }
  }, [frameAssistKey, suppressedAssistKey])

  React.useEffect(() => {
    const nextSelection = pendingSelectionRange
    if (!nextSelection) return

    const input = composerInputRef.current
    if (!input) return

    const rafId = window.requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(nextSelection.start, nextSelection.end)
      setPendingSelectionRange(null)
    })

    return () => window.cancelAnimationFrame(rafId)
  }, [pendingSelectionRange])

  const handleFrameAssistRetarget = React.useCallback(() => {
    setSuppressedAssistKey(null)
    const input = composerInputRef.current
    if (input && frameAssist.analysis.referenceStartIndex !== null && frameAssist.analysis.referenceEndIndex !== null) {
      input.focus()
      input.setSelectionRange(frameAssist.analysis.referenceStartIndex, frameAssist.analysis.referenceEndIndex)
      setCaretIndex(frameAssist.analysis.referenceStartIndex)
      return
    }

    if (queuedPreviewRawText) {
      const restoredDraft = queuedPreviewRawText
      const restoredAnalysis = parseFrameReference(restoredDraft, restoredDraft.length)
      onDraftChange(restoredDraft)
      const nextCaretIndex = restoredAnalysis.referenceEndIndex ?? restoredDraft.length
      setCaretIndex(nextCaretIndex)
      setPendingSelectionRange({
        start: restoredAnalysis.referenceStartIndex ?? nextCaretIndex,
        end: nextCaretIndex,
      })
      return
    }

    composerInputRef.current?.focus()
    updateCaretTarget()
  }, [
    frameAssist.analysis.referenceEndIndex,
    frameAssist.analysis.referenceStartIndex,
    onDraftChange,
    queuedPreviewRawText,
    updateCaretTarget,
  ])

  const handleFrameAssistClear = React.useCallback(() => {
    const nextDraft = frameAssist.clearFrameTarget()
    onDraftChange(nextDraft)
    setCaretIndex(nextDraft.length)
    setPendingSelectionRange({ start: nextDraft.length, end: nextDraft.length })
    setSuppressedAssistKey(null)
    onClearQueuedPreview?.()
  }, [frameAssist, onClearQueuedPreview, onDraftChange])

  const handleFrameAssistSelect = React.useCallback(
    (suggestion: FrameSuggestion) => {
      const next = frameAssist.confirmSuggestion(suggestion)
      const nextAnalysis = parseFrameReference(next.nextDraft, next.nextCaretIndex)
      onDraftChange(next.nextDraft)
      setCaretIndex(next.nextCaretIndex)
      setPendingSelectionRange({ start: next.nextCaretIndex, end: next.nextCaretIndex })
      setSuppressedAssistKey(
        nextAnalysis.referenceText
          ? `${next.nextCaretIndex}:${nextAnalysis.referenceStartIndex ?? 'na'}:${nextAnalysis.referenceEndIndex ?? 'na'}:${nextAnalysis.referenceText}`
          : null,
      )
    },
    [frameAssist, onDraftChange],
  )

  const activeFrameSuggestion =
    frameAssist.suggestions.length > 0
      ? frameAssist.suggestions[
          frameAssist.clampSuggestionIndex(frameAssist.activeSuggestionIndex >= 0 ? frameAssist.activeSuggestionIndex : 0)
        ] ?? frameAssist.suggestions[0]
      : null

  const handleComposerSubmit = React.useCallback(async () => {
    const nextValue = draft.trim()
    if (!nextValue) return

    const revisionRequest = frameAssist.buildRevisionRequest()
    if (revisionRequest.frameTarget) {
      frameAssist.recordRecentTarget(revisionRequest)
    }

    await onSubmit({
      rawText: nextValue,
      analysis: frameAssist.analysis,
      revisionRequest,
    })
  }, [draft, frameAssist, onSubmit])

  const handleComposerKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const hasVisibleSuggestions = frameAssist.isPopoverOpen && !isFrameAssistSuppressed && frameAssist.suggestions.length > 0

      if (event.key === 'Escape' && hasVisibleSuggestions) {
        event.preventDefault()
        if (frameAssistKey) {
          setSuppressedAssistKey(frameAssistKey)
        }
        return
      }

      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && hasVisibleSuggestions) {
        event.preventDefault()
        const delta = event.key === 'ArrowDown' ? 1 : -1
        frameAssist.setActiveSuggestionIndex((current) =>
          frameAssist.clampSuggestionIndex((current < 0 ? 0 : current) + delta),
        )
        return
      }

      if (event.key === 'Enter') {
        if (hasVisibleSuggestions && activeFrameSuggestion) {
          event.preventDefault()
          handleFrameAssistSelect(activeFrameSuggestion)
          return
        }

        if (!hasDraft) return
        event.preventDefault()
        void handleComposerSubmit()
      }
    },
    [
      activeFrameSuggestion,
      frameAssist,
      frameAssistKey,
      handleComposerSubmit,
      handleFrameAssistSelect,
      hasDraft,
      isFrameAssistSuppressed,
    ],
  )

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center overflow-visible">
      <motion.div
        className={cn(
          'pointer-events-auto relative origin-bottom overflow-visible bg-[linear-gradient(135deg,rgba(146,163,255,0.34)_0%,rgba(127,242,212,0.26)_38%,rgba(255,255,255,0.16)_68%,rgba(140,113,255,0.3)_100%)] p-[1px] transition-[height,width,border-radius,box-shadow] duration-300',
          isOpen
            ? isFrameAssistExpanded
              ? 'h-[188px] w-[min(38rem,calc(100vw-3rem))] rounded-[30px]'
              : 'h-[128px] w-[min(38rem,calc(100vw-3rem))] rounded-[30px]'
            : isHandleHovered
              ? 'h-[74px] w-[min(20rem,calc(100vw-4rem))] rounded-[28px]'
              : 'h-14 w-14 rounded-full',
        )}
        style={CHAT_COMPOSER_FONT_STYLE}
        initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.96 }}
        animate={
          reduceMotion
            ? undefined
            : {
                opacity: 1,
                y: isOpen ? 0 : isHandleHovered ? -8 : 0,
                boxShadow: isOpen
                  ? '0 30px 56px -28px rgba(0,0,0,0.92), 0 0 0 1px rgba(255,255,255,0.04)'
                  : isHandleHovered
                    ? '0 24px 42px -28px rgba(0,0,0,0.86), 0 0 42px -24px rgba(127,242,212,0.48)'
                    : '0 14px 28px -24px rgba(0,0,0,0.86)',
              }
        }
        transition={
          reduceMotion
            ? undefined
            : {
                type: 'spring',
                stiffness: 260,
                damping: 28,
                mass: 0.86,
              }
        }
        onMouseEnter={() => {
          if (!isOpen) setIsHandleHovered(true)
        }}
        onMouseLeave={() => {
          if (!isOpen) setIsHandleHovered(false)
        }}
      >
        {!isOpen ? (
          <button
            type="button"
            aria-label="Open chat composer"
            onClick={() => onOpenChange(true)}
            className="absolute inset-0 z-20 cursor-pointer"
          />
        ) : null}

        <div className="relative h-full w-full overflow-visible rounded-[inherit] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_34%),radial-gradient(circle_at_24%_120%,rgba(127,242,212,0.18)_0%,rgba(127,242,212,0)_42%),linear-gradient(180deg,rgba(18,18,24,0.98)_0%,rgba(8,8,12,0.98)_100%)] backdrop-blur-[30px]">
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-x-8 bottom-2 h-px bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(127,242,212,0.72)_48%,rgba(255,255,255,0)_100%)]"
            animate={
              reduceMotion
                ? undefined
                : {
                    opacity: isOpen || isHandleHovered ? [0.26, 0.78, 0.34] : 0.22,
                    x: isOpen || isHandleHovered ? ['-10%', '10%', '-4%'] : '0%',
                  }
            }
            transition={
              reduceMotion
                ? undefined
                : {
                    duration: 3.4,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: 'easeInOut',
                  }
            }
          />
          <div className="pointer-events-none absolute inset-0 rounded-[inherit] border border-white/10" />

          <AnimatePresence initial={false} mode="wait">
            {isOpen ? (
              <motion.div
                key="open-composer"
                className="relative flex h-full flex-col px-4 py-3"
                initial={reduceMotion ? false : { opacity: 0, y: 12, filter: 'blur(10px)' }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={reduceMotion ? undefined : { opacity: 0, y: 8, filter: 'blur(6px)' }}
                transition={{ duration: reduceMotion ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
              >
                <span
                  ref={composerMeasureRef}
                  aria-hidden
                  className="pointer-events-none absolute left-4 top-11 invisible whitespace-pre text-[20px] italic tracking-[0.01em]"
                  style={{
                    fontFamily: 'var(--font-newsreader), "Iowan Old Style", "Palatino Linotype", serif',
                  }}
                />
                <span
                  ref={composerPlaceholderMeasureRef}
                  aria-hidden
                  className="pointer-events-none absolute left-4 top-11 invisible whitespace-pre text-[20px] italic tracking-[0.01em]"
                  style={{
                    fontFamily: 'var(--font-newsreader), "Iowan Old Style", "Palatino Linotype", serif',
                  }}
                />

                <div className="relative flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-white/38">
                    <motion.span
                      aria-hidden
                      className="size-1.5 rounded-full bg-[#7ff2d4]"
                      animate={reduceMotion ? undefined : { opacity: [0.44, 1, 0.44], scale: [0.92, 1.12, 0.92] }}
                      transition={{ duration: 2.1, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                    />
                    Editor Relay
                  </div>

                  <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 sm:block">
                    <TypingEyes target={eyeTarget} reduceMotion={reduceMotion} />
                  </div>

                  <motion.button
                    type="button"
                    aria-label={hasDraft ? 'Collapse chat composer' : 'Close chat composer'}
                    onClick={() => onOpenChange(false)}
                    className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white/54 transition-colors hover:text-white/82"
                    whileHover={reduceMotion ? undefined : { y: -1, scale: 1.05 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.94 }}
                  >
                    <X className="size-3" />
                  </motion.button>
                </div>

                <EditorialComposerFrameAssist
                  suggestions={frameAssist.suggestions}
                  activeSuggestionIndex={frameAssist.activeSuggestionIndex}
                  isPopoverOpen={frameAssist.isPopoverOpen && !isFrameAssistSuppressed}
                  previewRegion={frameAssist.previewRegion}
                  queuedPreviewRevision={queuedPreviewRevision}
                  validationNote={frameAssist.analysis.validationNote}
                  onMoveActiveSuggestion={(delta) => {
                    frameAssist.setActiveSuggestionIndex((current) =>
                      frameAssist.clampSuggestionIndex((current < 0 ? 0 : current) + delta),
                    )
                  }}
                  onSelectSuggestion={handleFrameAssistSelect}
                  onDismissSuggestions={() => {
                    if (frameAssistKey) {
                      setSuppressedAssistKey(frameAssistKey)
                    }
                  }}
                  onClearFrameTarget={handleFrameAssistClear}
                  onRetargetFrameTarget={handleFrameAssistRetarget}
                  className="relative z-30 mt-2"
                />

                <div className="relative mt-2 flex-1 overflow-visible">
                  {!hasDraft ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center overflow-hidden">
                      <div
                        className="flex items-center whitespace-nowrap text-[20px] italic leading-[1.35] tracking-[0.01em] text-white/40"
                        style={{
                          fontFamily: 'var(--font-newsreader), "Iowan Old Style", "Palatino Linotype", serif',
                        }}
                      >
                        <span>{placeholderText}</span>
                        <motion.span
                          aria-hidden
                          className="ml-1 inline-block h-6 w-px bg-white/42"
                          animate={reduceMotion ? undefined : { opacity: [0.15, 0.9, 0.15] }}
                          transition={{ duration: 1.1, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                        />
                      </div>
                    </div>
                  ) : null}
                  {hasDraft ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center overflow-hidden">
                      <FrameComposerDraftMirror
                        draft={draft}
                        analysis={draftMirrorAnalysis}
                        scrollLeft={draftScrollLeft}
                      />
                    </div>
                  ) : null}
                  <input
                    type="text"
                    id={composerId}
                    ref={composerInputRef}
                    value={draft}
                    onChange={(event) => {
                      onDraftChange(event.target.value)
                      setCaretIndex(event.target.selectionStart ?? event.target.value.length)
                      setDraftScrollLeft(event.currentTarget.scrollLeft)
                    }}
                    onClick={() => updateCaretTarget()}
                    onFocus={() => {
                      if (draftRef.current.trim().length > 0) {
                        updateCaretTarget()
                      }
                    }}
                    onScroll={(event) => {
                      setDraftScrollLeft(event.currentTarget.scrollLeft)
                    }}
                    onKeyUp={() => updateCaretTarget()}
                    onSelect={() => updateCaretTarget()}
                    onKeyDown={handleComposerKeyDown}
                    placeholder=""
                    className={cn(
                      'relative z-10 h-full w-full overflow-hidden bg-transparent px-0 py-0 text-[20px] italic leading-[1.35] tracking-[0.01em] text-transparent outline-none',
                    )}
                    style={{
                      fontFamily: 'var(--font-newsreader), "Iowan Old Style", "Palatino Linotype", serif',
                      caretColor: 'rgba(255,255,255,0.78)',
                    }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-white/36">
                    <motion.button
                      type="button"
                      className="grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-white/[0.04] transition-colors hover:text-white/76"
                      whileHover={reduceMotion ? undefined : { y: -1, scale: 1.05 }}
                      whileTap={reduceMotion ? undefined : { scale: 0.95 }}
                    >
                      <ImageIcon className="size-2.5" />
                    </motion.button>
                    <motion.button
                      type="button"
                      className="grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-white/[0.04] transition-colors hover:text-white/76"
                      whileHover={reduceMotion ? undefined : { y: -1, scale: 1.05 }}
                      whileTap={reduceMotion ? undefined : { scale: 0.95 }}
                    >
                      <Film className="size-2.5" />
                    </motion.button>
                  </div>

                  <motion.button
                    type="button"
                    onClick={loading ? onStop : () => void handleComposerSubmit()}
                    disabled={!loading && !hasDraft}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-[#bebec7] p-0 text-[#101014] shadow-[0_18px_32px_-24px_rgba(255,255,255,0.92)] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-45"
                    whileHover={reduceMotion ? undefined : { y: -1, scale: 1.04 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.95 }}
                  >
                    {loading ? <div className="h-3 w-3 rounded-[2px] bg-current" /> : <ArrowUp className="size-4" />}
                  </motion.button>
                </div>
              </motion.div>
            ) : isHandleHovered ? (
              <motion.div
                key="closed-composer-expanded"
                className="relative flex h-full w-full items-start justify-center px-4 pt-3"
                initial={reduceMotion ? false : { opacity: 0.92 }}
                animate={reduceMotion ? undefined : { opacity: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0.92 }}
                transition={{ duration: reduceMotion ? 0 : 0.2 }}
              >
                <div className="relative flex w-full items-center gap-3">
                  <div className="mt-0.5 h-1 w-6 shrink-0 rounded-full bg-white/58" />
                  <motion.div
                    className="flex min-w-0 items-center gap-2"
                    animate={reduceMotion ? undefined : { opacity: isHandleHovered ? 1 : 0.92, x: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' }}
                  >
                    <MessageSquare className="size-4 shrink-0 text-white/72" />
                    <span className="truncate text-sm text-white/72">Open chat</span>
                  </motion.div>
                </div>

                <AnimatePresence>
                  {isHandleHovered ? (
                    <>
                      <motion.span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 rounded-[inherit] border border-[#7ff2d4]/28"
                        initial={{ opacity: 0.42, scale: 0.92 }}
                        animate={{ opacity: 0, scale: 1.16 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.1, ease: 'easeOut', repeat: Number.POSITIVE_INFINITY }}
                      />
                      <motion.span
                        aria-hidden
                        className="pointer-events-none absolute -inset-x-5 -inset-y-4 rounded-[999px] bg-[radial-gradient(circle_at_center,rgba(127,242,212,0.22)_0%,rgba(127,242,212,0)_58%)] blur-2xl"
                        initial={{ opacity: 0.34 }}
                        animate={{ opacity: [0.24, 0.54, 0.26] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.9, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY }}
                      />
                    </>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                key="closed-composer-icon"
                className="relative grid h-full w-full place-items-center"
                initial={reduceMotion ? false : { opacity: 0.92, scale: 0.96 }}
                animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0.92, scale: 0.96 }}
                transition={{ duration: reduceMotion ? 0 : 0.2 }}
              >
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-[8%] rounded-full bg-[radial-gradient(circle_at_50%_28%,rgba(255,255,255,0.2)_0%,rgba(255,255,255,0.08)_24%,rgba(255,255,255,0)_70%)] blur-md"
                  animate={
                    reduceMotion
                      ? undefined
                      : {
                          opacity: [0.58, 0.9, 0.62],
                          scale: [0.98, 1.03, 0.98],
                        }
                  }
                  transition={{ duration: 2.2, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                />
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-[2px] rounded-full border border-white/10 bg-[linear-gradient(180deg,rgba(15,15,20,0.98)_0%,rgba(8,8,12,0.98)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                />
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-[6px] rounded-full border border-[#7ff2d4]/18"
                  animate={
                    reduceMotion
                      ? undefined
                      : {
                          opacity: [0.52, 0.88, 0.58],
                        }
                  }
                  transition={{ duration: 2.8, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                />
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-[10px] rounded-full bg-[radial-gradient(circle_at_32%_24%,rgba(127,242,212,0.18)_0%,rgba(127,242,212,0)_68%)]"
                />
                <MessageSquare className="relative size-4 text-white/78 drop-shadow-[0_0_16px_rgba(255,255,255,0.16)]" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

const ChatWorkspacePanel = React.memo(function ChatWorkspacePanel({
  projectId,
  projectTitle,
  initialPrompt,
  initialSources,
  videoContext,
  composerPortalTarget,
  automationRequest,
  musicSpotlightPortalTarget,
  onEditRequest,
}: {
  projectId: string
  projectTitle: string
  initialPrompt: string
  initialSources: string[]
  videoContext: MusicVideoContext
  composerPortalTarget: HTMLDivElement | null
  automationRequest?: ComposerAutomationRequest | null
  musicSpotlightPortalTarget?: HTMLDivElement | null
  onEditRequest?: (request: { prompt: string; styleTemplate: StyleTemplate }) => void | Promise<void>
}) {
  const reduceMotion = useStableReducedMotion()
  const [entries, setEntries] = React.useState<ChatEntry[]>(() => [])
  const [draft, setDraft] = React.useState('')
  const [pendingReplies, setPendingReplies] = React.useState(0)
  const [isComposerOpen, setIsComposerOpen] = React.useState(false)
  const [queuedPreviewRevision, setQueuedPreviewRevision] = React.useState<QueuedPreviewRevisionState | null>(null)
  const [musicPreference, setMusicPreference] = React.useState<MusicPreference>(() =>
    createDefaultMusicPreference(),
  )
  const [stagedTracks, setStagedTracks] = React.useState<StagedMusicTrack[]>([])
  const [musicStorageReady, setMusicStorageReady] = React.useState(false)
  const [musicPreviewVolume, setMusicPreviewVolume] = React.useState(DEFAULT_MUSIC_PREVIEW_VOLUME)
  const musicPreviewVolumeRef = React.useRef(DEFAULT_MUSIC_PREVIEW_VOLUME)
  const [activePreviewTrack, setActivePreviewTrack] = React.useState<MusicRecommendation | null>(null)
  const [previewPlaying, setPreviewPlaying] = React.useState(false)
  const [dismissedSpotlightTrackId, setDismissedSpotlightTrackId] = React.useState<string | null>(null)
  const entriesRef = React.useRef(entries)
  const requestControllersRef = React.useRef<AbortController[]>([])
  const previewAudioRef = React.useRef<HTMLAudioElement | null>(null)
  const musicPreviewToggleCooldownRef = React.useRef<number | null>(null)
  const threadViewportRef = React.useRef<HTMLDivElement | null>(null)
  const threadContentRef = React.useRef<HTMLDivElement | null>(null)
  const threadEndRef = React.useRef<HTMLDivElement | null>(null)
  const chatEntryRefs = React.useRef(new Map<string, HTMLDivElement>())
  const musicCardRefs = React.useRef(new Map<string, HTMLDivElement>())
  const pendingReplyScrollEntryIdRef = React.useRef<string | null>(null)
  const followLatestRef = React.useRef(false)
  const replyHighlightTimerRef = React.useRef<number | null>(null)
  const announcedMusicToastKeysRef = React.useRef(new Set<string>())
  const handledAutomationRequestIdRef = React.useRef<number | null>(null)
  const [highlightedEntryId, setHighlightedEntryId] = React.useState<string | null>(null)
  const queuedPreviewRequestTokenRef = React.useRef<string | null>(null)
  const stagedTrackIdSet = React.useMemo(
    () => new Set(stagedTracks.map((track) => track.recommendation.id)),
    [stagedTracks],
  )

  React.useEffect(() => {
    const viewport = threadViewportRef.current
    if (!viewport) return

    const updateFollowLatest = () => {
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
      followLatestRef.current = distanceFromBottom < 120
    }

    updateFollowLatest()
    viewport.addEventListener('scroll', updateFollowLatest, { passive: true })

    return () => viewport.removeEventListener('scroll', updateFollowLatest)
  }, [])

  React.useEffect(() => {
    const viewport = threadViewportRef.current
    const content = threadContentRef.current
    if (!viewport || !content) return

    const scrollToBottom = (behavior: ScrollBehavior) => {
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior,
      })
    }

    if (followLatestRef.current) {
      scrollToBottom(reduceMotion ? 'auto' : 'smooth')
    }

    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => {
      if (!followLatestRef.current) return
      scrollToBottom('auto')
    })

    observer.observe(content)

    return () => observer.disconnect()
  }, [pendingReplies, reduceMotion, entries])

  React.useEffect(() => {
    entriesRef.current = entries
  }, [entries])

  React.useEffect(() => {
    const readyEntries = entries.filter((entry) => entry.music?.status === 'ready' && entry.music.recommendations.length > 0)

    readyEntries.forEach((entry) => {
      const topRecommendation = entry.music?.recommendations[0]
      if (!topRecommendation) return

      const toastKey = `${entry.id}:${topRecommendation.id}`
      if (announcedMusicToastKeysRef.current.has(toastKey)) return
      announcedMusicToastKeysRef.current.add(toastKey)

      const sourceUrl = topRecommendation.sourceUrl ?? null
      const sourceLabel = sourceUrl ? buildMusicSourceLabel(sourceUrl) : 'Open source'

      toast.custom(
        (toastId) => (
          <MusicPlayNotification
            recommendation={topRecommendation}
            sourceLabel={sourceLabel}
            onPlayPreview={() => {
              if (typeof window !== 'undefined') {
                window.open(topRecommendation.previewUrl, '_blank', 'noopener,noreferrer')
              }
              toast.dismiss(toastId)
            }}
            onOpenSource={
              sourceUrl
                ? () => {
                    if (typeof window !== 'undefined') {
                      window.open(sourceUrl, '_blank', 'noopener,noreferrer')
                    }
                    toast.dismiss(toastId)
                  }
                : undefined
            }
          />
        ),
        {
          duration: 12000,
        },
      )
    })
  }, [entries])

  React.useEffect(() => {
    return () => {
      requestControllersRef.current.forEach((controller) => controller.abort())
      requestControllersRef.current = []
    }
  }, [])

  React.useEffect(() => {
    if (!projectId) return

    const savedPreference = readLocalStorageJSON<MusicPreference>(musicPreferenceStorageKey(projectId))
    const savedQueue = readLocalStorageJSON<StagedMusicTrack[]>(stagedMusicStorageKey(projectId))
    const savedPreviewVolume = readLocalStorageJSON<number>(musicPreviewVolumeStorageKey(projectId))
    const nextPreference = normalizeMusicPreference(savedPreference, initialPrompt)

    setMusicPreference(nextPreference)
    setStagedTracks(Array.isArray(savedQueue) ? savedQueue : [])
    const nextPreviewVolume = clampMusicPreviewVolume(
      typeof savedPreviewVolume === 'number' ? savedPreviewVolume : DEFAULT_MUSIC_PREVIEW_VOLUME,
    )
    musicPreviewVolumeRef.current = nextPreviewVolume
    setMusicPreviewVolume(nextPreviewVolume)
    setMusicStorageReady(true)
  }, [initialPrompt, projectId])

  React.useEffect(() => {
    if (!musicStorageReady) return
    writeLocalStorageJSON(musicPreferenceStorageKey(projectId), musicPreference)
  }, [musicPreference, musicStorageReady, projectId])

  React.useEffect(() => {
    if (!musicStorageReady) return
    writeLocalStorageJSON(stagedMusicStorageKey(projectId), stagedTracks)
  }, [musicStorageReady, projectId, stagedTracks])

  React.useEffect(() => {
    if (!musicStorageReady) return
    writeLocalStorageJSON(musicPreviewVolumeStorageKey(projectId), musicPreviewVolume)
  }, [musicPreviewVolume, musicStorageReady, projectId])

  React.useEffect(() => {
    if (!queuedPreviewRevision) return

    const timeoutId = window.setTimeout(() => {
      queuedPreviewRequestTokenRef.current = null
      setQueuedPreviewRevision(null)
    }, 8500)

    return () => window.clearTimeout(timeoutId)
  }, [queuedPreviewRevision])

  React.useEffect(() => {
    return () => {
      previewAudioRef.current?.pause()
      previewAudioRef.current = null
    }
  }, [])

  React.useEffect(() => {
    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio()
    }

    const audio = previewAudioRef.current
    if (!activePreviewTrack) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      return
    }

    audio.loop = true
    audio.preload = 'auto'
    audio.volume = musicPreviewVolumeRef.current
    audio.src = activePreviewTrack.previewUrl
    audio.load()

    if (previewPlaying) {
      void audio.play().catch(() => {
        setPreviewPlaying(false)
      })
    } else {
      audio.pause()
    }
  }, [activePreviewTrack, previewPlaying])

  React.useEffect(() => {
    return () => {
      if (musicPreviewToggleCooldownRef.current !== null) {
        window.clearTimeout(musicPreviewToggleCooldownRef.current)
        musicPreviewToggleCooldownRef.current = null
      }
    }
  }, [])

  const armMusicPreviewToggleCooldown = React.useCallback(() => {
    if (musicPreviewToggleCooldownRef.current !== null) {
      window.clearTimeout(musicPreviewToggleCooldownRef.current)
    }

    musicPreviewToggleCooldownRef.current = window.setTimeout(() => {
      musicPreviewToggleCooldownRef.current = null
    }, 220)
  }, [])

  React.useEffect(() => {
    musicPreviewVolumeRef.current = musicPreviewVolume
    if (!previewAudioRef.current) return
    previewAudioRef.current.volume = musicPreviewVolume
  }, [musicPreviewVolume])

  const handleMusicPreviewVolumeChange = React.useCallback((nextValue: number) => {
    setMusicPreviewVolume(clampMusicPreviewVolume(nextValue / 100))
  }, [])

  const flashReplyHighlight = React.useCallback((entryId: string) => {
    if (replyHighlightTimerRef.current) {
      window.clearTimeout(replyHighlightTimerRef.current)
      replyHighlightTimerRef.current = null
    }

    setHighlightedEntryId(entryId)
    replyHighlightTimerRef.current = window.setTimeout(() => {
      setHighlightedEntryId((current) => (current === entryId ? null : current))
      replyHighlightTimerRef.current = null
    }, 1600)
  }, [])

  React.useEffect(() => {
    return () => {
      if (replyHighlightTimerRef.current) {
        window.clearTimeout(replyHighlightTimerRef.current)
        replyHighlightTimerRef.current = null
      }
    }
  }, [])

  React.useEffect(() => {
    if (!activePreviewTrack) return

    const cardNode = musicCardRefs.current.get(activePreviewTrack.id)
    if (!cardNode) return

    cardNode.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'center',
      inline: 'nearest',
    })
  }, [activePreviewTrack, reduceMotion])

  React.useEffect(() => {
    const pendingEntryId = pendingReplyScrollEntryIdRef.current
    if (!pendingEntryId) return

    const entryNode = chatEntryRefs.current.get(pendingEntryId)
    if (!entryNode) return

    entryNode.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'center',
    })
    flashReplyHighlight(pendingEntryId)
    pendingReplyScrollEntryIdRef.current = null
  }, [entries, flashReplyHighlight, reduceMotion])

  const stopPendingReplies = React.useCallback(() => {
    requestControllersRef.current.forEach((controller) => controller.abort())
    requestControllersRef.current = []
    setPendingReplies(0)
  }, [])

  const mergeEntryInState = React.useCallback((entryId: string, updater: (entry: ChatEntry) => ChatEntry) => {
    setEntries((current) => {
      const next = current.map((entry) => (entry.id === entryId ? updater(entry) : entry))
      entriesRef.current = next
      return next
    })
  }, [])

  const removeEntryInState = React.useCallback((entryId: string) => {
    setEntries((current) => {
      const next = removeChatEntry(current, entryId)
      entriesRef.current = next
      return next
    })
  }, [])

  const collectRecentMusicTrackIds = React.useCallback(() => {
    const trackIds = new Set<string>()

    stagedTracks.forEach((track) => {
      if (track.recommendation.id) {
        trackIds.add(track.recommendation.id)
      }
    })

    entriesRef.current.forEach((entry) => {
      entry.music?.recommendations.slice(0, 3).forEach((recommendation) => {
        if (recommendation.id) {
          trackIds.add(recommendation.id)
        }
      })
    })

    return [...trackIds]
  }, [stagedTracks])

  const fetchMusicRecommendations = React.useCallback(
    async (
      query: string,
      signal: AbortSignal,
      musicPreferenceOverride?: Partial<MusicPreference> | null,
      variantHint?: string,
      recentlyUsedTrackIds?: string[],
    ) => {
      const response = await fetch('/api/music/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        signal,
        body: JSON.stringify({
          query,
          projectTitle,
          initialPrompt,
          musicPreference: musicPreferenceOverride ?? musicPreference,
          videoContext,
          variantHint,
          recentlyUsedTrackIds,
        }),
      })

      const payload = (await response.json().catch(() => null)) as MusicApiResponse | null
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to build music recommendations right now.')
      }

      return payload
    },
    [initialPrompt, musicPreference, projectTitle, videoContext],
  )

  const resolveMusicRecommendations = React.useCallback(
    async (
      query: string,
      signal: AbortSignal,
      musicPreferenceOverride?: Partial<MusicPreference> | null,
      variantHint?: string,
    ): Promise<{
      recommendations: MusicRecommendation[]
      preference: MusicPreference
      fallback: boolean
      confidence: number
      needsRefinement: boolean
      source: 'groq' | 'heuristic'
      contextSummary: string
      recommendationGroups: MusicRecommendationGroup[]
      profile: MusicSoundtrackProfile
      phases: MusicRecommendationPhase[]
      archiveCount: number
      profileModel?: string
      variantHint?: string
      reasoningSummary: string
    }> => {
      const contextConfidence = videoContext.confidence ?? 0.5
      const recentlyUsedTrackIds = collectRecentMusicTrackIds()
      const resolvedPreference = normalizeMusicPreference(
        musicPreferenceOverride ?? musicPreference,
        [query, projectTitle, initialPrompt].filter(Boolean).join(' '),
        videoContext,
      )
      const fallbackProfile = buildHeuristicSoundtrackProfile({
        query,
        projectTitle,
        initialPrompt,
        preference: musicPreferenceOverride ?? musicPreference,
        videoContext,
        variantHint,
      })
      try {
        const remoteResult = await fetchMusicRecommendations(query, signal, musicPreferenceOverride, variantHint, recentlyUsedTrackIds)
        return {
          recommendations: remoteResult?.recommendations ?? [],
          preference: resolvedPreference,
          fallback: remoteResult?.fallback ?? false,
          confidence: remoteResult?.confidence ?? contextConfidence,
          needsRefinement: remoteResult?.needsRefinement ?? contextConfidence < 0.55,
          source: remoteResult?.source ?? 'heuristic',
          contextSummary: remoteResult?.contextSummary ?? remoteResult?.reasoningSummary ?? fallbackProfile.reasoningSummary,
          recommendationGroups: remoteResult?.recommendationGroups ?? [],
          profile: remoteResult?.profile ?? fallbackProfile,
          phases: remoteResult?.phases ?? buildMusicAnalysisStages({
            profile: remoteResult?.profile ?? fallbackProfile,
            archiveCount: remoteResult?.archiveCount ?? MUSIC_CATALOG.length,
            videoContext,
            variantHint,
          }),
          archiveCount: remoteResult?.archiveCount ?? MUSIC_CATALOG.length,
          profileModel: remoteResult?.profileModel,
          variantHint: remoteResult?.variantHint ?? variantHint,
          reasoningSummary: remoteResult?.reasoningSummary ?? fallbackProfile.reasoningSummary,
        }
      } catch {
        const fallbackBundle = buildMusicRecommendationSet({
          query,
          projectTitle,
          initialPrompt,
          preference: musicPreferenceOverride ?? musicPreference,
          videoContext,
          variantHint,
          recentlyUsedTrackIds,
          catalog: MUSIC_CATALOG,
          limit: MUSIC_RECOMMENDATION_LIMIT,
        })

        return {
          recommendations: fallbackBundle.recommendations,
          preference: resolvedPreference,
          fallback: true,
          confidence: fallbackBundle.confidence ?? contextConfidence,
          needsRefinement: fallbackBundle.needsRefinement ?? contextConfidence < 0.55,
          source: fallbackBundle.source,
          contextSummary: fallbackBundle.reasoningSummary,
          recommendationGroups: fallbackBundle.recommendationGroups,
          profile: fallbackBundle.profile,
          phases: fallbackBundle.phases,
          archiveCount: fallbackBundle.archiveCount,
          variantHint: fallbackBundle.variantHint,
          reasoningSummary: fallbackBundle.reasoningSummary,
        }
      }
    },
    [collectRecentMusicTrackIds, fetchMusicRecommendations, initialPrompt, musicPreference, projectTitle, videoContext],
  )

  const togglePreviewTrack = React.useCallback((recommendation: MusicRecommendation) => {
    if (musicPreviewToggleCooldownRef.current !== null) return
    armMusicPreviewToggleCooldown()

    if (activePreviewTrack?.id === recommendation.id) {
      setPreviewPlaying((current) => !current)
      return
    }

    setActivePreviewTrack(recommendation)
    setPreviewPlaying(true)
  }, [activePreviewTrack, armMusicPreviewToggleCooldown])

  const stageTrack = React.useCallback((recommendation: MusicRecommendation) => {
    const isAlreadyStaged = stagedTracks.some((track) => track.recommendation.id === recommendation.id)
    if (isAlreadyStaged) {
      setStagedTracks((current) => current.filter((track) => track.recommendation.id !== recommendation.id))
      return
    }

    const nextStage: StagedMusicTrack = {
      id: `stage-${projectId}-${recommendation.id}`,
      projectId,
      recommendation,
      addedAt: new Date().toISOString(),
    }

    setStagedTracks((current) => {
      const next = [nextStage, ...current.filter((track) => track.recommendation.id !== recommendation.id)]
      return next
    })

    setMusicPreference({
      mood: recommendation.mood,
      energy: recommendation.energy,
      sourcePlatform: recommendation.sourcePlatform,
      updatedAt: new Date().toISOString(),
    })
  }, [projectId, stagedTracks])

  const removeStagedTrack = React.useCallback((trackId: string) => {
    setStagedTracks((current) => current.filter((track) => track.id !== trackId))
  }, [])

  const clearStagedTracks = React.useCallback(() => {
    setStagedTracks([])
  }, [])

  const handleDismissSpotlightTrack = React.useCallback((trackId: string) => {
    setDismissedSpotlightTrackId(trackId)

    if (activePreviewTrack?.id === trackId) {
      setPreviewPlaying(false)
      setActivePreviewTrack(null)
    }
  }, [activePreviewTrack])

  const refineMusicTrack = React.useCallback(
    async (entryId: string, toneKey: string) => {
      const preset = MUSIC_REFINEMENT_OPTIONS.find((option) => option.key === toneKey)
      if (!preset) return

      const entry = entriesRef.current.find((item) => item.id === entryId && item.music)
      if (!entry?.music) return

      const previousMusic = entry.music
      const controller = new AbortController()
      let requestTimedOut = false
      const requestTimeoutId = window.setTimeout(() => {
        requestTimedOut = true
        controller.abort()
      }, EDITOR_REQUEST_TIMEOUT_MS)
      requestControllersRef.current = [...requestControllersRef.current, controller]
      setPendingReplies((current) => current + 1)

      const nextPreference: Partial<MusicPreference> = {
        ...entry.music.preference,
        mood: toneKey === 'fresh' ? entry.music.preference.mood : preset.mood,
        energy: toneKey === 'fresh' ? entry.music.preference.energy : preset.energy,
        updatedAt: new Date().toISOString(),
      }

      mergeEntryInState(entryId, (currentEntry) => ({
        ...currentEntry,
        music: currentEntry.music
          ? {
              ...currentEntry.music,
              status: 'loading',
              preference: {
                ...currentEntry.music.preference,
                mood: toneKey === 'fresh' ? currentEntry.music.preference.mood : preset.mood,
                energy: toneKey === 'fresh' ? currentEntry.music.preference.energy : preset.energy,
                updatedAt: new Date().toISOString(),
              },
            }
          : currentEntry.music,
      }))

      pendingReplyScrollEntryIdRef.current = entryId

      try {
        const result = await resolveMusicRecommendations(entry.music.query, controller.signal, nextPreference, preset.variantHint ?? toneKey)
        if (controller.signal.aborted) {
          if (requestTimedOut) {
            toast.error('Music refinement timed out. Restored the previous recommendation.')
          }

          mergeEntryInState(entryId, (currentEntry) => ({
            ...currentEntry,
            music: previousMusic,
          }))
          return
        }

        setMusicPreference(result.preference)
        mergeEntryInState(entryId, (currentEntry) => ({
          ...currentEntry,
          status: 'ready',
          music: currentEntry.music
            ? {
                ...currentEntry.music,
                status: 'ready',
                preference: result.preference,
                recommendations: result.recommendations,
                fallback: result.fallback,
                confidence: result.confidence,
                needsRefinement: result.needsRefinement,
                source: result.source,
                contextSummary: result.contextSummary,
                reasoningSummary: result.reasoningSummary,
                recommendationGroups: result.recommendationGroups,
                profile: result.profile,
                phases: result.phases,
                archiveCount: result.archiveCount,
                profileModel: result.profileModel,
                variantHint: result.variantHint,
              }
            : currentEntry.music,
        }))
      } finally {
        window.clearTimeout(requestTimeoutId)
        requestControllersRef.current = requestControllersRef.current.filter(
          (activeController) => activeController !== controller,
        )
        setPendingReplies((current) => Math.max(0, current - 1))
      }
    },
    [mergeEntryInState, resolveMusicRecommendations, setMusicPreference],
  )

  const submitMessage = React.useCallback(
    async (
      rawValue: string,
      options?: {
        forceMusic?: boolean
        musicQuickAction?: boolean
        scrollToReply?: boolean
        showUserMessage?: boolean
        revisionRequest?: FrameAssistSubmission['revisionRequest'] | null
      },
    ) => {
      const nextValue = rawValue.trim()
      if (!nextValue) return

      const shouldScrollToReply = options?.scrollToReply ?? true
      const shouldRecommendMusicCandidate = options?.forceMusic ?? isMusicIntent(nextValue)
      const shouldEditRequest = !options?.forceMusic && (isEditIntent(nextValue) || Boolean(options?.revisionRequest?.frameTarget))
      const shouldRecommendMusic = shouldEditRequest ? false : shouldRecommendMusicCandidate
      const shouldShowUserMessage = options?.showUserMessage ?? true
      const musicContextConfidence = videoContext.confidence ?? 0.5
      const editPromptBasis = options?.revisionRequest?.instructionText?.trim() || nextValue
      const editStyleTemplate = shouldEditRequest ? selectEditStyleTemplate(editPromptBasis, videoContext) : null
      const isBroadMusicRequest =
        shouldRecommendMusic &&
        (options?.musicQuickAction === true || isGenericMusicRequest(nextValue) || nextValue.length < 20)
      const assistantId = shouldRecommendMusic
        ? `assistant-music-${Date.now()}`
        : shouldEditRequest
          ? `assistant-edit-${Date.now()}`
          : `assistant-${Date.now()}`
      const loadingText = shouldRecommendMusic
        ? 'Pulling a few cues that match the current cut...'
        : shouldEditRequest
          ? `Starting ${editStyleTemplate?.name ?? 'the edit pass'} on the imported video...`
          : 'Shaping the next pass from the original direction...'
      const musicReply = shouldRecommendMusic
        ? buildMusicReply({
            projectTitle,
            sourceCount: initialSources.length,
            videoContext,
          })
        : ''
      const editReplyFallback =
        shouldEditRequest && editStyleTemplate
          ? buildEditAssistantReply({
              projectTitle,
              sourceCount: initialSources.length,
              styleTemplate: editStyleTemplate,
              prompt: editPromptBasis,
              videoContext,
            })
          : ''
      const loadingMusicProfile = shouldRecommendMusic
        ? buildHeuristicSoundtrackProfile({
            query: nextValue,
            projectTitle,
            initialPrompt,
            preference: musicPreference,
            videoContext,
            variantHint: isBroadMusicRequest ? 'fresh' : undefined,
          })
        : null
      const loadingMusicPhases = shouldRecommendMusic && loadingMusicProfile
        ? buildMusicAnalysisStages({
            profile: loadingMusicProfile,
            archiveCount: MUSIC_CATALOG.length,
            videoContext,
            variantHint: isBroadMusicRequest ? 'fresh' : undefined,
          })
        : []

      const baseEntries = entriesRef.current.filter((entry) => entry.status !== 'loading')
      const userEntry: ChatEntry | null = shouldShowUserMessage
        ? {
            id: `user-${Date.now()}`,
            role: 'user',
            text: nextValue,
          }
        : null
      const displayEntries = userEntry ? [...baseEntries, userEntry] : baseEntries
      const messageHistory = [
        ...baseEntries.map((entry) => ({
          role: entry.role,
          text: entry.text,
        })),
        { role: 'user' as const, text: nextValue },
      ]
      const loadingAssistant: ChatEntry = {
        id: assistantId,
        role: 'assistant',
        text: shouldRecommendMusic ? musicReply : loadingText,
        status: 'loading',
        music: shouldRecommendMusic
          ? {
              status: 'loading',
              query: nextValue,
              preference: musicPreference,
              recommendations: [],
              recommendationGroups: [],
              phases: loadingMusicPhases,
              profile: loadingMusicProfile ?? buildHeuristicSoundtrackProfile({
                query: nextValue,
                projectTitle,
                initialPrompt,
                preference: musicPreference,
                videoContext,
                variantHint: isBroadMusicRequest ? 'fresh' : undefined,
              }),
              archiveCount: MUSIC_CATALOG.length,
              source: 'heuristic',
              fallback: true,
              variantHint: isBroadMusicRequest ? 'fresh' : undefined,
              confidence: musicContextConfidence,
              needsRefinement: isBroadMusicRequest || musicContextConfidence < 0.55,
              contextSummary: loadingMusicProfile?.reasoningSummary ?? videoContext.summary,
              reasoningSummary: loadingMusicProfile?.reasoningSummary ?? videoContext.summary,
            }
          : undefined,
      }

      const nextEntries = [...displayEntries, loadingAssistant]
      entriesRef.current = nextEntries
      setEntries(nextEntries)
      if (shouldRecommendMusic || shouldScrollToReply) {
        pendingReplyScrollEntryIdRef.current = assistantId
      }

      setPendingReplies((current) => current + 1)

      if (shouldEditRequest && editStyleTemplate) {
        try {
          void onEditRequest?.({
            prompt: editPromptBasis,
            styleTemplate: editStyleTemplate,
          })
        } catch {
          // The edit reply can still stream even if the job staging signal fails.
        }
      }

      const controller = new AbortController()
      let requestTimedOut = false
      let chatTaskCompleted = shouldRecommendMusic
      let musicTaskCompleted = !shouldRecommendMusic
      const requestTimeoutId = window.setTimeout(() => {
        requestTimedOut = true
        controller.abort()
      }, EDITOR_REQUEST_TIMEOUT_MS)
      requestControllersRef.current = [...requestControllersRef.current, controller]
      let replyResolved = shouldRecommendMusic
      let latestReplyText = shouldRecommendMusic ? musicReply : loadingText

      try {
        const chatTask = shouldRecommendMusic
          ? Promise.resolve()
          : (async () => {
            try {
              const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                cache: 'no-store',
                signal: controller.signal,
                body: JSON.stringify({
                  projectTitle,
                  originalPrompt: initialPrompt,
                  initialSources,
                  videoContext,
                  stream: shouldEditRequest,
                  workflow: shouldEditRequest ? 'edit' : 'chat',
                  messages: messageHistory,
                  revisionRequest: options?.revisionRequest ?? null,
                }),
              })

              if (shouldEditRequest) {
                if (!response.ok) {
                  const payload = (await response.json().catch(() => null)) as ChatApiResponse | null
                  throw new Error(
                    payload?.error?.trim() ||
                      `Groq request failed with ${response.status} ${response.statusText}.`,
                  )
                }

                if (!response.body) {
                  throw new Error('Groq returned an empty stream.')
                }

                const streamedReply = await readGroqStreamText(response, controller.signal, (partialText) => {
                  latestReplyText = partialText || loadingText
                  mergeEntryInState(assistantId, (entry) => ({
                    ...entry,
                    text: latestReplyText,
                    status: 'loading',
                  }))
                })

                if (controller.signal.aborted) return

                const finalReply = sanitizeAssistantReply(streamedReply) || editReplyFallback || loadingText
                latestReplyText = finalReply
                replyResolved = Boolean(finalReply)
                chatTaskCompleted = true
                mergeEntryInState(assistantId, (entry) => ({
                  ...entry,
                  text: finalReply,
                  status: 'ready',
                }))
                return
              }

              const payload = (await response.json().catch(() => null)) as ChatApiResponse | null
              const nextReply = typeof payload?.reply === 'string' ? payload.reply.trim() : ''
              const nextError = typeof payload?.error === 'string' ? payload.error.trim() : ''

              if (controller.signal.aborted) return

              if (response.ok && nextReply) {
                latestReplyText = nextReply
                replyResolved = true
                chatTaskCompleted = true
                mergeEntryInState(assistantId, (entry) => ({
                  ...entry,
                  text: nextReply,
                  status: 'ready',
                }))
                return
              }

              const chatErrorText = nextError || 'Groq could not answer right now.'
              latestReplyText = chatErrorText
              replyResolved = true
              chatTaskCompleted = true
              mergeEntryInState(assistantId, (entry) => ({
                ...entry,
                text: chatErrorText,
                status: 'ready',
              }))
            } catch (error) {
              if (controller.signal.aborted) return

              const chatErrorText =
                error instanceof Error
                  ? error.message
                  : 'The live Groq reply could not be completed right now.'

              if (shouldEditRequest) {
                const fallbackReply = sanitizeAssistantReply(editReplyFallback || chatErrorText || loadingText)
                latestReplyText = fallbackReply
                replyResolved = true
                chatTaskCompleted = true
                mergeEntryInState(assistantId, (entry) => ({
                  ...entry,
                  text: fallbackReply,
                  status: 'ready',
                }))
                return
              }

              latestReplyText = chatErrorText
              replyResolved = true
              chatTaskCompleted = true
              mergeEntryInState(assistantId, (entry) => ({
                ...entry,
                text: chatErrorText,
                status: 'ready',
              }))
            }
          })()

        const musicTask = shouldRecommendMusic
            ? (async () => {
              const result = await resolveMusicRecommendations(
                nextValue,
                controller.signal,
                undefined,
                isBroadMusicRequest ? 'fresh' : undefined,
              )
              if (controller.signal.aborted) return

              setMusicPreference(result.preference)
              musicTaskCompleted = true
              mergeEntryInState(assistantId, (entry) => ({
                ...entry,
                status: 'ready',
                music: {
                  status: 'ready',
                  query: nextValue,
                  preference: result.preference,
                  recommendations: result.recommendations,
                  recommendationGroups: result.recommendationGroups ?? [],
                  phases: result.phases ?? [],
                  profile: result.profile,
                  archiveCount: result.archiveCount ?? MUSIC_CATALOG.length,
                  source: result.source,
                  fallback: result.fallback,
                  confidence: result.confidence,
                  needsRefinement: isBroadMusicRequest || result.needsRefinement,
                  contextSummary: result.contextSummary,
                  reasoningSummary: result.reasoningSummary,
                  profileModel: result.profileModel,
                  variantHint: result.variantHint,
                },
              }))
            })()
          : Promise.resolve()

        await Promise.allSettled([chatTask, musicTask])

        if (controller.signal.aborted) {
          if (!(chatTaskCompleted && musicTaskCompleted)) {
            if (requestTimedOut) {
              toast.error(
                shouldRecommendMusic
                  ? 'Music lookup timed out. Please try again.'
                  : 'That send request timed out. Please try again.',
              )
            }
            removeEntryInState(assistantId)
          }
          return
        }

        if (shouldEditRequest && !replyResolved) {
          const fallbackReply = sanitizeAssistantReply(editReplyFallback || latestReplyText || loadingText)
          latestReplyText = fallbackReply
          replyResolved = true
          chatTaskCompleted = true
          mergeEntryInState(assistantId, (entry) => ({
            ...entry,
            text: fallbackReply,
            status: 'ready',
          }))
          return
        }

        if (shouldRecommendMusic && !replyResolved) {
          latestReplyText = buildAssistantReply({
            projectTitle,
            originalPrompt: initialPrompt,
            sourceCount: initialSources.length,
            input: nextValue,
          })
          mergeEntryInState(assistantId, (entry) => ({
            ...entry,
            text: latestReplyText,
            status: 'ready',
          }))
        }
      } catch (error) {
        if (controller.signal.aborted) {
          removeEntryInState(assistantId)
          return
        }

        const assistantEntry: ChatEntry = {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          text:
            error instanceof Error
              ? error.message
              : 'The live Groq reply could not be completed right now.',
        }
        const withAssistantError = [...entriesRef.current, assistantEntry]
        entriesRef.current = withAssistantError
        setEntries(withAssistantError)
      } finally {
        window.clearTimeout(requestTimeoutId)
        requestControllersRef.current = requestControllersRef.current.filter(
          (activeController) => activeController !== controller,
        )
        setPendingReplies((current) => Math.max(0, current - 1))
      }
    },
    [
      initialPrompt,
      initialSources,
      onEditRequest,
      musicPreference,
      projectTitle,
      mergeEntryInState,
      removeEntryInState,
      resolveMusicRecommendations,
      videoContext,
    ],
  )

  const handleSubmit = React.useCallback(
    async (submission: FrameAssistSubmission) => {
      const nextValue = submission.rawText.trim()
      if (!nextValue) return

      if (submission.revisionRequest.frameTarget) {
        const previewRequestToken = `preview-queue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        queuedPreviewRequestTokenRef.current = previewRequestToken
        setQueuedPreviewRevision({
          requestId: previewRequestToken,
          request: submission.revisionRequest,
          queuedAt: new Date().toISOString(),
          etaMs: 2200,
          status: 'queueing',
        })

        void queuePreviewRevisionRequest(submission.revisionRequest)
          .then((queuedState) => {
            if (queuedPreviewRequestTokenRef.current !== previewRequestToken) return
            setQueuedPreviewRevision(queuedState)
          })
          .catch(() => {
            if (queuedPreviewRequestTokenRef.current !== previewRequestToken) return
            setQueuedPreviewRevision({
              requestId: `${previewRequestToken}-fallback`,
              request: submission.revisionRequest,
              queuedAt: new Date().toISOString(),
              etaMs: 2200,
              status: 'queued',
            })
          })
      }

      void submitMessage(nextValue, {
        revisionRequest: submission.revisionRequest,
      })
      setDraft('')
    },
    [submitMessage],
  )

  const clearQueuedPreviewRevision = React.useCallback(() => {
    queuedPreviewRequestTokenRef.current = null
    setQueuedPreviewRevision(null)
  }, [])

  const handlePresetAction = React.useCallback((label: string) => {
    if (label === 'Add music') {
      submitMessage(buildMusicQuickActionPrompt(projectTitle, videoContext), {
        forceMusic: true,
        musicQuickAction: true,
        scrollToReply: true,
        showUserMessage: false,
      })
      return
    }

    const editStyleTemplate = selectEditStyleTemplate(label, videoContext)
    const editPrompt = buildEditQuickActionPrompt(projectTitle, videoContext, editStyleTemplate)
    const nextPrompt = label === 'Edit this video' ? editPrompt : `${label}. ${editPrompt}`
    void submitMessage(nextPrompt, {
      forceMusic: false,
      scrollToReply: true,
      showUserMessage: false,
    })
  }, [projectTitle, submitMessage, videoContext])

  React.useEffect(() => {
    if (!automationRequest) return
    if (handledAutomationRequestIdRef.current === automationRequest.id) return

    handledAutomationRequestIdRef.current = automationRequest.id
    setIsComposerOpen(true)
    setDraft('')
    void submitMessage(automationRequest.prompt, {
      forceMusic: false,
      scrollToReply: true,
      showUserMessage: false,
    })
  }, [automationRequest, submitMessage])

  const spotlightCandidateTrack = stagedTracks[0] ?? null
  const spotlightCandidateTrackId = spotlightCandidateTrack?.recommendation.id ?? null

  React.useEffect(() => {
    if (dismissedSpotlightTrackId && dismissedSpotlightTrackId !== spotlightCandidateTrackId) {
      setDismissedSpotlightTrackId(null)
    }
  }, [dismissedSpotlightTrackId, spotlightCandidateTrackId])

  const latestMusicEntry = [...entries].reverse().find((entry) => Boolean(entry.music)) ?? null
  const latestMusicBlock = latestMusicEntry?.music ?? null
  const spotlightTrack =
    spotlightCandidateTrack && dismissedSpotlightTrackId !== spotlightCandidateTrackId
      ? spotlightCandidateTrack
      : null

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-4 top-3 z-20 h-px bg-[linear-gradient(90deg,rgba(127,242,212,0)_0%,rgba(127,242,212,0.56)_24%,rgba(255,255,255,0.16)_50%,rgba(127,242,212,0.32)_76%,rgba(127,242,212,0)_100%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-14 bg-[linear-gradient(180deg,rgba(19,19,23,0.98)_0%,rgba(19,19,23,0.92)_38%,rgba(19,19,23,0)_100%)] blur-sm"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-[linear-gradient(180deg,rgba(19,19,23,0)_0%,rgba(19,19,23,0.9)_62%,rgba(19,19,23,1)_100%)] blur-sm"
        />
        <div ref={threadViewportRef} className="h-full overflow-y-auto overscroll-contain px-4 py-4 pb-32">
          <div ref={threadContentRef} className="space-y-4 pr-2">
        <motion.div
          variants={buildRevealVariants({ delay: 0.04, distance: 14, blur: 8, duration: 0.28 })}
          initial="hidden"
          whileInView="visible"
          viewport={{ root: threadViewportRef, once: false, amount: 0.4 }}
          className="space-y-2"
        >
          <div className="text-[10px] uppercase tracking-[0.34em] text-white/32">Project</div>
          <h1 className="text-[1.85rem] leading-tight text-white">{projectTitle}</h1>
          <div className="flex items-center gap-2 text-xs text-white/42">
            <CheckCircle2 className="size-3.5 text-white/48" />
            All changes saved
          </div>
        </motion.div>

        <motion.div
          variants={buildRevealVariants({ delay: 0.1, distance: 16, blur: 10, duration: 0.3 })}
          initial="hidden"
          whileInView="visible"
          viewport={{ root: threadViewportRef, once: false, amount: 0.4 }}
          className="rounded-[18px] border border-white/8 bg-white/[0.02] p-4"
        >
          <div className="text-[10px] uppercase tracking-[0.32em] text-white/35">Prompt</div>
          <p className="mt-3 text-sm leading-6 text-white/78">{initialPrompt}</p>
          {initialSources.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {initialSources.slice(0, 4).map((source) => (
                <span
                  key={source}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/58"
                >
                  {source}
                </span>
              ))}
            </div>
          ) : null}
        </motion.div>

        <motion.div
          variants={buildRevealVariants({ delay: 0.16, distance: 12, blur: 8, duration: 0.28 })}
          initial="hidden"
          whileInView="visible"
          viewport={{ root: threadViewportRef, once: false, amount: 0.4 }}
          className="grid gap-2 sm:grid-cols-2"
        >
          {QUICK_ACTIONS.map(({ label, icon: Icon }, index) => {
            const actionTilt = QUICK_ACTION_TILTS[index] ?? QUICK_ACTION_TILTS[QUICK_ACTION_TILTS.length - 1] ?? {
              rotate: 0,
              y: 0,
            }

            return (
              <motion.button
                key={label}
                type="button"
                onClick={() => handlePresetAction(label)}
                initial={
                  reduceMotion
                    ? false
                    : {
                        opacity: 0,
                        y: actionTilt.y + 12,
                        scale: 0.94,
                        rotate: actionTilt.rotate - 1.2,
                      }
                }
                animate={
                  reduceMotion
                    ? undefined
                    : {
                        opacity: 1,
                        y: actionTilt.y,
                        scale: 1,
                        rotate: actionTilt.rotate,
                      }
                }
                transition={
                  reduceMotion
                    ? undefined
                    : {
                        duration: 0.34,
                        delay: 0.1 + index * 0.07,
                        ease: [0.22, 1, 0.36, 1],
                      }
                }
                whileHover={
                  reduceMotion
                    ? undefined
                    : {
                        y: actionTilt.y - 2,
                        rotate: actionTilt.rotate * 0.55,
                        scale: 1.02,
                      }
                }
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                className="flex min-h-[40px] w-full min-w-0 items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full border border-white/8 bg-[#101015]/94 px-3 py-2 text-center text-[10px] leading-none text-white/70 shadow-[0_18px_28px_-24px_rgba(0,0,0,0.82)] transition-colors hover:border-white/14 hover:text-white sm:text-[11px]"
              >
                <motion.span
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.72, rotate: -10 }}
                  animate={reduceMotion ? undefined : { opacity: 1, scale: 1, rotate: 0 }}
                  transition={
                    reduceMotion
                      ? undefined
                      : {
                          duration: 0.28,
                          delay: 0.16 + index * 0.07,
                          ease: [0.22, 1, 0.36, 1],
                        }
                  }
                >
                  <Icon className="size-3.5" />
                </motion.span>
                <motion.span
                  initial={reduceMotion ? false : { opacity: 0, x: -10 }}
                  animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
                  transition={
                    reduceMotion
                      ? undefined
                      : {
                          duration: 0.28,
                          delay: 0.2 + index * 0.07,
                          ease: [0.22, 1, 0.36, 1],
                        }
                  }
                >
                  {label}
                </motion.span>
              </motion.button>
            )
          })}
        </motion.div>

        <motion.div layout className="space-y-3">
          {entries.map((entry, index) => (
            <motion.div
              key={entry.id}
              ref={(node) => {
                if (node) {
                  chatEntryRefs.current.set(entry.id, node)
                } else {
                  chatEntryRefs.current.delete(entry.id)
                }
              }}
              layout
              initial={reduceMotion ? false : 'hidden'}
              whileInView={reduceMotion ? undefined : 'visible'}
              exit={reduceMotion ? undefined : 'exit'}
              viewport={reduceMotion ? undefined : { root: threadViewportRef, once: false, amount: 0.35 }}
              variants={
                reduceMotion
                  ? undefined
                  : buildRevealVariants({
                      delay: 0.04 + index * 0.03,
                      distance: 22,
                      blur: 10,
                      scale: 0.98,
                      duration: 0.34,
                    })
              }
              className={cn(
                'relative scroll-mt-20 max-w-[94%] rounded-[18px] border px-4 py-3 text-sm leading-6 shadow-[0_24px_36px_-32px_rgba(0,0,0,0.72)]',
                entry.role === 'assistant'
                  ? 'border-white/8 bg-white/[0.03] text-white/74'
                  : 'ml-auto border-white/12 bg-white/[0.06] text-white',
              )}
            >
              <AnimatePresence initial={false}>
                {highlightedEntryId === entry.id ? (
                  <motion.div
                    aria-hidden
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
                    animate={
                      reduceMotion
                        ? undefined
                        : {
                            opacity: [0, 1, 0],
                            scale: [0.985, 1, 1.005],
                          }
                    }
                    exit={reduceMotion ? undefined : { opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 1.55, ease: 'easeOut' }}
                    className="pointer-events-none absolute -inset-2 rounded-[22px] bg-[radial-gradient(circle_at_top,rgba(127,242,212,0.24)_0%,rgba(127,242,212,0.12)_28%,rgba(127,242,212,0)_72%)] blur-2xl"
                  />
                ) : null}
              </AnimatePresence>
              {entry.role === 'assistant' ? (
                <div className="space-y-3">
                  {entry.status === 'loading' && !entry.music ? (
                    <div className="flex items-start gap-2 text-sm leading-6 text-white/72">
                      <span className="mt-2.5 flex shrink-0 items-center gap-1">
                        <span className="size-1.5 animate-pulse rounded-full bg-white/48 [animation-delay:-0.2s]" />
                        <span className="size-1.5 animate-pulse rounded-full bg-white/48" />
                        <span className="size-1.5 animate-pulse rounded-full bg-white/48 [animation-delay:0.2s]" />
                      </span>
                      <span>{entry.text}</span>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-6 tracking-[0.01em] text-white/74">
                      {entry.text}
                    </p>
                  )}

                  {entry.music ? (
                    <div className="space-y-3 pt-1">
                      <MusicRecommendationShowcase
                        music={entry.music}
                        isPreviewing={(trackId) => activePreviewTrack?.id === trackId}
                        previewPlaying={previewPlaying}
                        stagedTrackIds={stagedTrackIdSet}
                        onPreviewToggle={togglePreviewTrack}
                        onAdd={stageTrack}
                        onRefine={(toneKey) => void refineMusicTrack(entry.id, toneKey)}
                        viewportRoot={threadViewportRef}
                        registerCardRef={(trackId, node) => {
                          if (node) {
                            musicCardRefs.current.set(trackId, node)
                          } else {
                            musicCardRefs.current.delete(trackId)
                          }
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                entry.text
              )}
            </motion.div>
          ))}
          <div ref={threadEndRef} className="h-1" />
        </motion.div>
        </div>
        <motion.div
          variants={buildRevealVariants({ delay: 0.22, distance: 12, blur: 8, duration: 0.28 })}
          initial="hidden"
          whileInView="visible"
          viewport={{ root: threadViewportRef, once: false, amount: 0.25 }}
          className="shrink-0 border-t border-white/8 bg-[#101116]/92 px-4 py-3 backdrop-blur-md"
        >
          <StagedMusicRail
            projectTitle={projectTitle}
            preference={musicPreference}
            profile={latestMusicBlock?.profile}
            stagedTracks={stagedTracks}
            musicVolumePercent={Math.round(musicPreviewVolume * 100)}
            onMusicVolumeChange={handleMusicPreviewVolumeChange}
            onRemoveTrack={removeStagedTrack}
            onClearAll={clearStagedTracks}
          />
        </motion.div>
      </div>
      </div>

      {musicSpotlightPortalTarget && spotlightTrack
        ? createPortal(
            <AnimatePresence mode="wait" initial={false}>
              <MusicSpotlightOrb
                key={spotlightTrack.recommendation.id}
                recommendation={spotlightTrack.recommendation}
                status={
                  activePreviewTrack?.id === spotlightTrack.recommendation.id && previewPlaying
                    ? 'previewing'
                    : 'staged'
                }
                onDismiss={() => handleDismissSpotlightTrack(spotlightTrack.recommendation.id)}
              />
            </AnimatePresence>,
            musicSpotlightPortalTarget,
          )
        : null}

      {composerPortalTarget
          ? createPortal(
            <FloatingChatComposer
              projectId={projectId}
              draft={draft}
              onDraftChange={setDraft}
              onSubmit={handleSubmit}
              onStop={stopPendingReplies}
              loading={pendingReplies > 0}
              reduceMotion={reduceMotion}
              isOpen={isComposerOpen}
              onOpenChange={setIsComposerOpen}
              queuedPreviewRevision={queuedPreviewRevision}
              onClearQueuedPreview={clearQueuedPreviewRevision}
            />,
            composerPortalTarget,
          )
        : null}
    </div>
  )
})

function SecondaryPanel({
  title,
  description,
  items,
}: {
  title: string
  description: string
  items: string[]
}) {
  const reduceMotion = useStableReducedMotion()
  const panelViewportRef = React.useRef<HTMLDivElement | null>(null)

  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-4">
      <motion.div
        variants={buildRevealVariants({ delay: 0.04, distance: 14, blur: 8, duration: 0.28 })}
        initial={reduceMotion ? false : 'hidden'}
        whileInView={reduceMotion ? undefined : 'visible'}
        viewport={reduceMotion ? undefined : { once: false, amount: 0.45 }}
        className="rounded-[18px] border border-white/8 bg-white/[0.02] p-4"
      >
        <div className="text-[10px] uppercase tracking-[0.32em] text-white/35">{title}</div>
        <p className="mt-3 text-sm leading-6 text-white/66">{description}</p>
      </motion.div>
      <div ref={panelViewportRef} className="mt-4 space-y-2 overflow-y-auto">
        {items.map((item) => (
          <motion.div
            key={item}
            variants={buildRevealVariants({ delay: 0.06, distance: 10, blur: 6, duration: 0.24 })}
            initial={reduceMotion ? false : 'hidden'}
            whileInView={reduceMotion ? undefined : 'visible'}
            viewport={reduceMotion ? undefined : { root: panelViewportRef, once: false, amount: 0.45 }}
            className="rounded-[16px] border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-white/68"
          >
            {item}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export default function EditorPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const projectId = params.id

  const [project, setProject] = React.useState<Project | null>(null)
  const [job, setJob] = React.useState<ProcessingJob | null>(null)
  const [isEditorBootReady, setIsEditorBootReady] = React.useState(false)
  const [leftTab, setLeftTab] = React.useState<LeftTabKey>('chat')
  const [fitMode, setFitMode] = React.useState<PreviewFitMode>('fill')
  const [scale, setScale] = React.useState(100)
  const [offsetX, setOffsetX] = React.useState(0)
  const [offsetY, setOffsetY] = React.useState(0)
  const [previewPlaying, setPreviewPlaying] = React.useState(false)
  const [previewDurationSec, setPreviewDurationSec] = React.useState(0)
  const [previewCurrentTimeSec, setPreviewCurrentTimeSec] = React.useState(0)
  const [previewIntrinsicAspectRatio, setPreviewIntrinsicAspectRatio] = React.useState<number | null>(null)
  const [persistedPreviewUrl, setPersistedPreviewUrl] = React.useState<string | null>(null)
  const [handoffPreview, setHandoffPreview] = React.useState<SessionPreviewState | null>(null)
  const [sourceAssetLabel, setSourceAssetLabel] = React.useState<string | null>(null)
  const [isPreviewMediaReady, setIsPreviewMediaReady] = React.useState(false)
  const [isPreviewLoadingVisible, setIsPreviewLoadingVisible] = React.useState(false)
  const [isInlineSourceDragOver, setIsInlineSourceDragOver] = React.useState(false)
  const [previewFramePreset, setPreviewFramePreset] = React.useState<PreviewFramePreset>('source')
  const [bottomMode, setBottomMode] = React.useState<BottomMode>('Music')
  const [viralClipTargetPlatform, setViralClipTargetPlatform] =
    React.useState<ViralClipTargetPlatform>(VIRAL_CLIP_PLATFORM_DEFAULT)
  const [viralClipClipPresetIndex, setViralClipClipPresetIndex] = React.useState(1)
  const [viralClipSplitPreviewActive, setViralClipSplitPreviewActive] = React.useState(false)
  const [viralClipSplitAnimationKey, setViralClipSplitAnimationKey] = React.useState(0)
  const [viralClipSplitPreviewAssets, setViralClipSplitPreviewAssets] =
    React.useState<SplitPreviewAssetState>(EMPTY_SPLIT_PREVIEW_ASSETS)
  const [isLockedViralClipTriggerHovered, setIsLockedViralClipTriggerHovered] = React.useState(false)
  const splitPreviewAssetCacheRef = React.useRef<Map<string, { leftUrl: string; rightUrl: string }>>(new Map())
  const previousPreviewFramePresetRef = React.useRef<PreviewFramePreset>(previewFramePreset)
  const previousFitModeRef = React.useRef<PreviewFitMode>(fitMode)
  const previewVideoRef = React.useRef<HTMLVideoElement | null>(null)
  const previewPlaybackIntentRef = React.useRef<'playing' | 'paused'>('paused')
  const previewPlaybackCommandRef = React.useRef(0)
  const previewToggleCooldownRef = React.useRef<number | null>(null)
  const sourceFileInputRef = React.useRef<HTMLInputElement | null>(null)
  const centerShellRef = React.useRef<HTMLElement | null>(null)
  const [chatComposerPortal, setChatComposerPortal] = React.useState<HTMLDivElement | null>(null)
  const [musicSpotlightPortalTarget, setMusicSpotlightPortalTarget] = React.useState<HTMLDivElement | null>(null)
  const inspectorViewportRef = React.useRef<HTMLDivElement | null>(null)
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = React.useState(false)
  const [syncedColumnHeight, setSyncedColumnHeight] = React.useState<number | null>(null)
  const [isDeferredChromeReady, setIsDeferredChromeReady] = React.useState(false)
  const [cinematicRegistry, setCinematicRegistry] = React.useState<CinematicAssetRegistry | null>(null)
  const [inlinePreviewStatusVariant, setInlinePreviewStatusVariant] = React.useState<'hidden' | 'expanded' | 'icon'>('hidden')
  const [inlinePreviewStatusHovered, setInlinePreviewStatusHovered] = React.useState(false)
  const inlinePreviewStatusTimeoutRef = React.useRef<number | null>(null)
  const inlinePreviewStatusHasShownRef = React.useRef(false)
  const projectPreviewSourceKey = project?.sourceAssetId ?? projectId
  const handoffPreviewForCurrentSource =
    handoffPreview?.sourceKey === projectPreviewSourceKey ? handoffPreview : null
  const stableProjectPreviewUrl =
    handoffPreviewForCurrentSource?.url
    ?? (project?.sourceAssetId ? persistedPreviewUrl ?? project?.thumbnailUrl ?? null : project?.thumbnailUrl ?? null)
  const {
    previewKind: stagedPreviewKind,
    phase: sourceStagePhase,
    error: sourceStageError,
    stageSource: stageSourceFile,
  } = useSourceStage({
    currentPreviewUrl: null,
    currentPreviewKind: null,
  })
  const viralClipJob = useViralClipJob({
    projectId,
    videoId: project?.sourceAssetId ?? null,
  })
  const {
    health: viralClipBackendHealth,
    lifecycle: viralClipLifecycle,
    jobId: viralClipJobId,
    backendStage: viralClipBackendStage,
    stageLabel: viralClipStageLabel,
    stageDetail: viralClipStageDetail,
    progressPercent: viralClipProgressPercent,
    warnings: viralClipWarnings,
    statusMessage: viralClipStatusMessage,
    errorMessage: viralClipErrorMessage,
    resultError: viralClipResultError,
    selectedClips: viralClipSelectedClips,
    startJob: startViralClipJob,
    refreshBackendHealth: refreshViralClipBackendHealth,
    refreshResult: refreshViralClipResult,
  } = viralClipJob

  React.useEffect(() => {
    clearPendingEditorNavigation(`/editor/${projectId}`)
  }, [projectId])

  React.useEffect(() => {
    const sessionSourcePreview = getSessionSourcePreview(projectId, project?.sourceAssetId ?? null)

    if (!sessionSourcePreview) return

    debugEditorPreview('session-handoff-preview', {
      projectId,
      sourceAssetId: sessionSourcePreview.sourceAssetId,
      previewUrl: sessionSourcePreview.url,
      previewKind: sessionSourcePreview.kind,
    })
    setHandoffPreview({
      sourceKey: sessionSourcePreview.sourceAssetId ?? projectPreviewSourceKey,
      url: sessionSourcePreview.url,
      kind: sessionSourcePreview.kind,
    })
  }, [project?.sourceAssetId, projectId, projectPreviewSourceKey])

  React.useLayoutEffect(() => {
    let active = true
    let intervalId: number | null = null

    const syncState = () => {
      if (!active) return

      const nextProject = getProject(projectId)
      const nextJob = getJobStatus(projectId)

      setProject(nextProject)
      setJob(nextJob)
      setIsEditorBootReady(true)

      if (nextJob?.status === 'completed' && intervalId !== null) {
        window.clearInterval(intervalId)
        intervalId = null
      }
    }

    syncState()
    intervalId = window.setInterval(syncState, 900)

    return () => {
      active = false
      if (intervalId !== null) {
        window.clearInterval(intervalId)
      }
    }
  }, [projectId])

  React.useEffect(() => {
    let active = true
    let nextObjectUrl: string | null = null

    setPersistedPreviewUrl(null)

    if (!project?.sourceAssetId) return

    void createSourceAssetObjectUrl(project.sourceAssetId)
      .then((resolvedUrl) => {
        if (!active) {
          if (resolvedUrl) {
            URL.revokeObjectURL(resolvedUrl)
          }
          return
        }

        nextObjectUrl = resolvedUrl
        debugEditorPreview('restored-persisted-preview-url', {
          projectId,
          sourceAssetId: project.sourceAssetId,
          resolvedUrl,
        })
        setPersistedPreviewUrl(resolvedUrl)
      })
      .catch(() => {
        if (!active) return
        debugEditorPreview('restore-persisted-preview-failed', {
          projectId,
          sourceAssetId: project.sourceAssetId,
        })
        setPersistedPreviewUrl(null)
      })

    return () => {
      active = false
      if (nextObjectUrl) {
        URL.revokeObjectURL(nextObjectUrl)
      }
    }
  }, [project?.sourceAssetId, projectId])

  React.useEffect(() => {
    let active = true

    setSourceAssetLabel(null)

    if (!project?.sourceAssetId) return

    void getStoredSourceAssetFile(project.sourceAssetId)
      .then((file) => {
        if (!active) return
        if (!file) {
          setSourceAssetLabel(null)
          return
        }
        const nextLabel = file.name?.trim().replace(/\.[^/.]+$/, '') || file.name?.trim() || 'Source video'
        setSourceAssetLabel(nextLabel)
      })
      .catch(() => {
        if (!active) return
        setSourceAssetLabel(null)
      })

    return () => {
      active = false
    }
  }, [project?.sourceAssetId])

  React.useEffect(() => {
    if (!project?.sourceAssetId || !persistedPreviewUrl) return
    if (!project.thumbnailUrl || !project.thumbnailUrl.startsWith('blob:')) return

    const nextProject: Project = {
      ...project,
      thumbnailUrl: '',
      updatedAt: new Date().toISOString(),
    }

    upsertProject(nextProject)
    setProject(nextProject)
  }, [persistedPreviewUrl, project])

  React.useEffect(() => {
    const shell = centerShellRef.current
    if (!shell || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(([entry]) => {
      const nextHeight = Math.ceil(entry.contentRect.height)
      setSyncedColumnHeight(nextHeight > 0 ? nextHeight : null)
    })

    observer.observe(shell)
    setSyncedColumnHeight(Math.ceil(shell.getBoundingClientRect().height))

    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    let rafId = 0
    let timeoutId = 0

    rafId = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => {
        setIsDeferredChromeReady(true)
      }, 140)
    })

    return () => {
      window.cancelAnimationFrame(rafId)
      window.clearTimeout(timeoutId)
    }
  }, [])

  React.useEffect(() => {
    let active = true

    void fetch('/api/cinematic/assets', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load cinematic assets (${response.status}).`)
        }
        return (await response.json()) as CinematicAssetRegistry
      })
      .then((registry) => {
        if (!active) return
        setCinematicRegistry(registry)
      })
      .catch(() => {
        if (!active) return
        setCinematicRegistry(null)
      })

    return () => {
      active = false
    }
  }, [])

  React.useEffect(() => {
    if (!SHOULD_PREFETCH_EDITOR_SUPPORT_ROUTES) return

    void router.prefetch('/projects')
    void router.prefetch(`/exports/${projectId}`)
  }, [projectId, router])

  const handleBackNavigation = React.useCallback(() => {
    const rememberedPath = getRememberedEditorReturnPath()

    if (rememberedPath && rememberedPath !== `/editor/${projectId}` && !rememberedPath.startsWith('/editor/')) {
      router.push(rememberedPath)
      return
    }

    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }

    router.push('/')
  }, [projectId, router])

  const totalDurationMs = React.useMemo(() => {
    const scenes = job?.artifacts.scenes ?? []
    return scenes.length > 0 ? scenes[scenes.length - 1]!.endMs : 48_000
  }, [job])

  const progressPercent = React.useMemo(() => {
    if (!job?.steps.length) return 0
    return Math.round((job.steps.reduce((sum, step) => sum + step.progress, 0) / job.steps.length) * 100)
  }, [job])

  const incomingPreviewKind = (handoffPreviewForCurrentSource?.kind ?? stagedPreviewKind ?? project?.previewKind ?? 'video') as PreviewMediaKind
  const previewSourceKey = projectPreviewSourceKey

  React.useEffect(() => {
    debugEditorPreview('session-preview-state', {
      projectId,
      previewSourceKey,
      sourceAssetId: project?.sourceAssetId ?? null,
      stagedPreviewKind,
      stableProjectPreviewUrl,
      handoffPreviewUrl: handoffPreviewForCurrentSource?.url ?? null,
      handoffPreviewKind: handoffPreviewForCurrentSource?.kind ?? null,
      sourceStagePhase,
    })
  }, [handoffPreviewForCurrentSource, project?.sourceAssetId, projectId, previewSourceKey, sourceStagePhase, stableProjectPreviewUrl, stagedPreviewKind])

  const transportDurationSec = previewDurationSec > 0 ? previewDurationSec : totalDurationMs / 1000
  const transportProgress = transportDurationSec > 0 ? (previewCurrentTimeSec / transportDurationSec) * 100 : 0
  const transportCurrentTime = msToTime(previewCurrentTimeSec * 1000)
  const transportTime = msToTime(transportDurationSec * 1000)
  const previewUrl = stableProjectPreviewUrl ?? ''
  const previewKind = incomingPreviewKind
  const shouldUseLegacySessionPreviewSurface = Boolean(handoffPreviewForCurrentSource?.url) && previewKind === 'video'
  const hasPreviewMedia = Boolean(previewUrl)
  const clipModeActive = previewFramePreset === '9:16'
  const viralClipTriggerBusy =
    viralClipLifecycle === 'submitting' || viralClipLifecycle === 'submitted' || viralClipLifecycle === 'polling'
  const showViralClipSplitPreview = viralClipSplitPreviewActive && clipModeActive && hasPreviewMedia
  React.useEffect(() => {
    if (!showViralClipSplitPreview) {
      setIsLockedViralClipTriggerHovered(false)
    }
  }, [showViralClipSplitPreview])

  React.useEffect(() => {
    return () => {
      if (inlinePreviewStatusTimeoutRef.current !== null) {
        window.clearTimeout(inlinePreviewStatusTimeoutRef.current)
        inlinePreviewStatusTimeoutRef.current = null
      }
    }
  }, [])

  React.useEffect(() => {
    const isInlinePreviewStatusActive =
      Boolean(hasPreviewMedia) &&
      (sourceStageError || sourceStagePhase === 'staging_local_preview' || sourceStagePhase === 'persisting')

    if (!isInlinePreviewStatusActive) {
      inlinePreviewStatusHasShownRef.current = false
      setInlinePreviewStatusHovered(false)
      if (inlinePreviewStatusTimeoutRef.current !== null) {
        window.clearTimeout(inlinePreviewStatusTimeoutRef.current)
        inlinePreviewStatusTimeoutRef.current = null
      }
      setInlinePreviewStatusVariant('hidden')
      return
    }

    if (inlinePreviewStatusHasShownRef.current) {
      return
    }

    inlinePreviewStatusHasShownRef.current = true
    setInlinePreviewStatusVariant('expanded')
    if (inlinePreviewStatusTimeoutRef.current !== null) {
      window.clearTimeout(inlinePreviewStatusTimeoutRef.current)
    }
    inlinePreviewStatusTimeoutRef.current = window.setTimeout(() => {
      setInlinePreviewStatusVariant('icon')
      inlinePreviewStatusTimeoutRef.current = null
    }, 2200)
  }, [hasPreviewMedia, sourceStageError, sourceStagePhase])

  const hasPreviewFrameAdjustment = scale !== 100 || offsetX !== 0 || offsetY !== 0
  const showInlinePreviewStatus = Boolean(hasPreviewMedia) && inlinePreviewStatusVariant !== 'hidden'
  const isInlinePreviewStatusExpanded =
    inlinePreviewStatusVariant === 'expanded' || inlinePreviewStatusHovered
  const inlinePreviewStatusLabel = sourceStageError
    ? sourceStageError
    : sourceStagePhase === 'staging_local_preview'
      ? 'Preparing the new source preview'
      : sourceStagePhase === 'persisting'
        ? 'Saving the source in the background'
        : null
  const sourceMetrics = project?.sourceProfile ? formatSourceProfileMetric(project.sourceProfile) : null
  const previewAspectRatio = getSourcePreviewAspectRatio(
    project?.sourceProfile ?? null,
    previewKind === 'image' ? 1 : 16 / 9,
  )
  const resolvedPreviewAspectRatio =
    previewFramePreset === 'source'
      ? previewIntrinsicAspectRatio ?? previewAspectRatio
      : getOutputProfileAspectRatio(previewFramePreset, project?.sourceProfile ?? null)
  const visiblePreviewAspectRatio = showViralClipSplitPreview ? 2.24 : resolvedPreviewAspectRatio
  const previewFrameWidth = `min(100%, calc((clamp(250px, 40vh, 460px) - 2rem) * ${visiblePreviewAspectRatio.toFixed(4)}))`
  const previewFrameTransformStyle = hasPreviewFrameAdjustment
    ? {
        transform: `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${scale / 100})`,
        transformOrigin: 'center center',
        willChange: 'transform',
      }
    : undefined

  const promptText = job?.input.prompt?.trim() || 'Your clip is staged and ready for refinement.'
  const sourceList = React.useMemo(() => job?.input.sources ?? [], [job?.input.sources])
  const videoContext = buildVideoMusicContext({
    projectTitle: project?.title ?? 'Untitled Project',
    promptText,
    sourceProfile: project?.sourceProfile ?? null,
    job,
    sourceList,
  })
  const viralClipClipPreset = VIRAL_CLIP_COUNT_PRESETS[viralClipClipPresetIndex] ?? VIRAL_CLIP_COUNT_PRESETS[1]!
  const viralClipProvidedTranscript = buildProvidedTranscript(job)
  const viralClipPrompt = React.useMemo(
    () =>
      buildViralClipQuickActionPrompt({
        projectTitle: project?.title ?? 'Untitled Project',
        originalPrompt: promptText,
        sourceCount: sourceList.length,
        transportTime,
        videoContext,
      }),
    [project?.title, promptText, sourceList.length, transportTime, videoContext],
  )

  const previewOverlayPlan = job?.artifacts.animationPlan ?? null

  React.useEffect(() => {
    if (!cinematicRegistry || !previewOverlayPlan || !job?.input.prompt) return
    if (previewOverlayPlan.registrySignature === cinematicRegistry.signature) return

    const nextPlan = buildCinematicAnimationPlan({
      projectId,
      input: job.input,
      transcript: job.artifacts.transcript,
      scenes: job.artifacts.scenes,
      highlights: job.artifacts.highlights,
      brollSuggestions: job.artifacts.brollSuggestions,
      registry: cinematicRegistry,
    })

    const updatedJob = setJobAnimationPlan(projectId, nextPlan)
    if (updatedJob) {
      setJob(updatedJob)
    }
  }, [cinematicRegistry, job, previewOverlayPlan, projectId])

  const currentSplitPreviewAssets =
    viralClipSplitPreviewAssets.sourceAssetId === (project?.sourceAssetId ?? null)
      ? viralClipSplitPreviewAssets
      : EMPTY_SPLIT_PREVIEW_ASSETS

  const ensureViralClipSplitPreviewAssets = React.useCallback(
    async (sourceAssetId: string, sourceVideoFile: File | null) => {
      const cached = splitPreviewAssetCacheRef.current.get(sourceAssetId)
      if (cached) {
        setViralClipSplitPreviewAssets({
          sourceAssetId,
          status: 'ready',
          leftUrl: cached.leftUrl,
          rightUrl: cached.rightUrl,
          errorMessage: null,
        })
        return cached
      }

      let splitSourceFile = sourceVideoFile
      if (!splitSourceFile && previewKind === 'video' && previewUrl) {
        const previewResponse = await fetch(previewUrl)
        if (!previewResponse.ok) {
          throw new Error('Unable to restore the visible preview for split reel generation.')
        }

        const previewBlob = await previewResponse.blob()
        splitSourceFile = new File([previewBlob], 'split-preview-source.mp4', {
          type: previewBlob.type || 'video/mp4',
        })
      }

      if (!splitSourceFile) {
        throw new Error('Unable to access the source video file for split reel generation.')
      }

      setViralClipSplitPreviewAssets({
        sourceAssetId,
        status: 'loading',
        leftUrl: null,
        rightUrl: null,
        errorMessage: null,
      })

      const formData = new FormData()
      formData.append('source_video', splitSourceFile, splitSourceFile.name || 'source.mp4')

      const response = await fetch('/api/cinematic/split-preview', {
        method: 'POST',
        body: formData,
      })
      const payload = (await response.json().catch(() => null)) as
        | { leftUrl?: string; rightUrl?: string; error?: string }
        | null

      if (!response.ok || !payload?.leftUrl || !payload?.rightUrl) {
        throw new Error(payload?.error || 'Failed to build split reel previews.')
      }

      const nextAssets = {
        leftUrl: payload.leftUrl,
        rightUrl: payload.rightUrl,
      }
      splitPreviewAssetCacheRef.current.set(sourceAssetId, nextAssets)
      setViralClipSplitPreviewAssets({
        sourceAssetId,
        status: 'ready',
        leftUrl: nextAssets.leftUrl,
        rightUrl: nextAssets.rightUrl,
        errorMessage: null,
      })

      return nextAssets
    },
    [previewKind, previewUrl],
  )

  const handleGenerateViralClips = React.useCallback(async () => {
    if (!project?.sourceAssetId) {
      setViralClipSplitPreviewActive(false)
      setPreviewFramePreset('source')
      toast.error('Add a source video first so the clip workflow has something to analyze.')
      return
    }

    try {
      if (!viralClipSplitPreviewActive) {
        previousFitModeRef.current = fitMode
        previousPreviewFramePresetRef.current = previewFramePreset
      }
      setFitMode('fill')
      setPreviewFramePreset('9:16')
      setViralClipSplitPreviewActive(true)
      setViralClipSplitAnimationKey((current) => current + 1)

      const sourceVideoFile = await getStoredSourceAssetFile(project.sourceAssetId).catch(() => null)
      const splitPreviewPromise = ensureViralClipSplitPreviewAssets(project.sourceAssetId, sourceVideoFile)

      const [viralClipJobResult, splitPreviewResult] = await Promise.allSettled([
        startViralClipJob(
          {
            projectId,
            videoId: project.sourceAssetId,
            targetPlatform: viralClipTargetPlatform,
            clipCountMin: viralClipClipPreset.min,
            clipCountMax: viralClipClipPreset.max,
            prompt: viralClipPrompt,
            sourceMediaRef: project.sourceAssetId,
            creatorNiche: videoContext.summary || undefined,
            metadataOverrides: {
              projectTitle: project?.title ?? 'Untitled Project',
              sourceAssetId: project.sourceAssetId,
              previewKind: project?.previewKind ?? null,
              sourceProfileMetric: sourceMetrics,
              sourceProfile: project?.sourceProfile ?? null,
              clipMode: 'viral',
              targetPlatform: viralClipTargetPlatform,
              clipCountMin: viralClipClipPreset.min,
              clipCountMax: viralClipClipPreset.max,
            },
            providedTranscript: viralClipProvidedTranscript ?? undefined,
          },
          {
            sourceVideoFile,
          },
        ),
        splitPreviewPromise,
      ])

      if (viralClipJobResult.status === 'rejected') {
        throw viralClipJobResult.reason
      }

      if (splitPreviewResult.status === 'rejected') {
        const splitPreviewError =
          splitPreviewResult.reason instanceof Error
            ? splitPreviewResult.reason.message
            : 'Split reel generation failed.'

        setViralClipSplitPreviewAssets({
          sourceAssetId: project.sourceAssetId,
          status: 'error',
          leftUrl: null,
          rightUrl: null,
          errorMessage: splitPreviewError,
        })
        toast.error(splitPreviewError)
      }

      toast.success('Viral clip job submitted. Watching backend stages now.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to launch the viral clip job.')
    }
  }, [
    fitMode,
    project,
    projectId,
    previewFramePreset,
    sourceMetrics,
    viralClipClipPreset.max,
    viralClipClipPreset.min,
    viralClipPrompt,
    viralClipProvidedTranscript,
    viralClipTargetPlatform,
    viralClipSplitPreviewActive,
    ensureViralClipSplitPreviewAssets,
    startViralClipJob,
    videoContext.summary,
  ])

  const handleRestoreLandscapePreview = React.useCallback(() => {
    setIsLockedViralClipTriggerHovered(false)
    setViralClipSplitPreviewActive(false)
    setPreviewFramePreset(previousPreviewFramePresetRef.current)
    setFitMode(previousFitModeRef.current)
  }, [])

  const startPreviewPlayback = React.useCallback(() => {
    if (previewKind !== 'video' || !previewUrl) return
    const video = previewVideoRef.current
    if (!video) return

    previewPlaybackIntentRef.current = 'playing'
    const commandId = ++previewPlaybackCommandRef.current
    const playPromise = video.play()
    setPreviewPlaying(true)

    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        if (previewPlaybackCommandRef.current !== commandId) return
        if (previewPlaybackIntentRef.current !== 'playing') return
        debugEditorPreview('video-play-rejected', {
          projectId,
          previewUrl,
        })
        previewPlaybackIntentRef.current = 'paused'
        setPreviewPlaying(false)
      })
    }
  }, [previewKind, previewUrl, projectId])

  const clearPreviewToggleCooldown = React.useCallback(() => {
    if (previewToggleCooldownRef.current === null) return
    window.clearTimeout(previewToggleCooldownRef.current)
    previewToggleCooldownRef.current = null
  }, [])

  const armPreviewToggleCooldown = React.useCallback(() => {
    clearPreviewToggleCooldown()
    previewToggleCooldownRef.current = window.setTimeout(() => {
      previewToggleCooldownRef.current = null
    }, 220)
  }, [clearPreviewToggleCooldown])

  const handleEditRequest = React.useCallback(
    (request: { prompt: string; styleTemplate: StyleTemplate }) => {
      if (!project?.sourceAssetId) {
        toast.error('Add a source video first so the edit pass has something to render.')
        return
      }

      const prompt = request.prompt.trim()
      if (!prompt) return

      const nextJob = createProcessingJob({
        projectId,
        input: {
          prompt,
          sources: sourceList,
          styleId: request.styleTemplate.id,
        },
      })
      const startedJob = startProcessing(nextJob)
      const fallbackPlan = buildFallbackEditAnimationPlan({
        projectId,
        projectTitle: project?.title ?? 'Untitled Project',
        prompt,
        jobId: nextJob.id,
        sourceLabel: sourceAssetLabel ?? project?.title ?? null,
        styleTemplate: request.styleTemplate,
      })
      const jobWithFallbackPlan = setJobAnimationPlan(projectId, fallbackPlan) ?? startedJob

      setJob(jobWithFallbackPlan)
      previewPlaybackIntentRef.current = 'paused'
      previewPlaybackCommandRef.current += 1
      clearPreviewToggleCooldown()
      setPreviewPlaying(false)
      if (previewKind === 'video' && previewUrl) {
        void startPreviewPlayback()
      }

      toast.success(`Edit job ${nextJob.id.slice(0, 6)} started.`)

      if (cinematicRegistry) {
        const refinedPlan = buildCinematicAnimationPlan({
          projectId,
          input: nextJob.input,
          transcript: jobWithFallbackPlan.artifacts.transcript,
          scenes: jobWithFallbackPlan.artifacts.scenes,
          highlights: jobWithFallbackPlan.artifacts.highlights,
          brollSuggestions: jobWithFallbackPlan.artifacts.brollSuggestions,
          registry: cinematicRegistry,
        })

        const refinedJob = setJobAnimationPlan(projectId, refinedPlan)
        if (refinedJob) {
          setJob(refinedJob)
        }
      }
    },
    [
      cinematicRegistry,
      clearPreviewToggleCooldown,
      previewKind,
      previewUrl,
      project?.sourceAssetId,
      project?.title,
      projectId,
      sourceAssetLabel,
      sourceList,
      startPreviewPlayback,
    ],
  )

  React.useEffect(() => {
    setPreviewPlaying(false)
    setPreviewCurrentTimeSec(0)
    setPreviewDurationSec(0)
    setPreviewIntrinsicAspectRatio(null)
    setIsPreviewMediaReady(false)
    setViralClipSplitPreviewActive(false)
    previewPlaybackIntentRef.current = 'paused'
    previewPlaybackCommandRef.current += 1
    clearPreviewToggleCooldown()
    debugEditorPreview('preview-url-reset', {
      projectId,
      previewKind,
      previewUrl,
    })
  }, [clearPreviewToggleCooldown, previewKind, previewUrl, projectId])

  React.useEffect(() => {
    if (previewKind !== 'video' || !previewUrl || isPreviewMediaReady) {
      setIsPreviewLoadingVisible(false)
      return
    }

    setIsPreviewLoadingVisible(true)
    const timeoutId = window.setTimeout(() => {
      setIsPreviewLoadingVisible(false)
    }, 2000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isPreviewMediaReady, previewKind, previewUrl])

  const handlePreviewMetadataLoaded = React.useCallback(() => {
    const video = previewVideoRef.current
    if (!video) return
    setPreviewDurationSec(Number.isFinite(video.duration) ? video.duration : 0)
    if (Number.isFinite(video.videoWidth) && Number.isFinite(video.videoHeight) && video.videoWidth > 0 && video.videoHeight > 0) {
      setPreviewIntrinsicAspectRatio(video.videoWidth / video.videoHeight)
    }
    debugEditorPreview('video-loaded-metadata', {
      projectId,
      previewUrl,
      duration: Number.isFinite(video.duration) ? video.duration : null,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      readyState: video.readyState,
    })
  }, [previewUrl, projectId])

  const handlePreviewVideoReady = React.useCallback(() => {
    handlePreviewMetadataLoaded()
    setIsPreviewMediaReady(true)
    debugEditorPreview('video-ready', {
      projectId,
      previewUrl,
    })
  }, [handlePreviewMetadataLoaded, previewUrl, projectId])

  React.useEffect(() => {
    const video = previewVideoRef.current
    if (!video || previewKind !== 'video' || !previewUrl) return

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      handlePreviewVideoReady()
    }
  }, [handlePreviewVideoReady, previewKind, previewUrl])

  const handlePreviewImageLoaded = React.useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const image = event.currentTarget
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        setPreviewIntrinsicAspectRatio(image.naturalWidth / image.naturalHeight)
      }
      setIsPreviewMediaReady(true)
      debugEditorPreview('image-ready', {
        projectId,
        previewUrl,
        imageWidth: image.naturalWidth,
        imageHeight: image.naturalHeight,
      })
    },
    [previewUrl, projectId],
  )

  const handlePreviewTimeUpdate = React.useCallback(() => {
    const video = previewVideoRef.current
    if (!video) return
    setPreviewCurrentTimeSec(video.currentTime)
  }, [])

  const handlePreviewEnded = React.useCallback(() => {
    previewPlaybackIntentRef.current = 'paused'
    debugEditorPreview('video-ended', {
      projectId,
      previewUrl,
    })
    setPreviewPlaying(false)
  }, [previewUrl, projectId])

  const handlePreviewVideoPlay = React.useCallback(() => {
    if (previewPlaybackIntentRef.current !== 'playing') return
    debugEditorPreview('video-play', {
      projectId,
      previewUrl,
    })
    setPreviewPlaying(true)
  }, [previewUrl, projectId])

  const handlePreviewVideoPause = React.useCallback(() => {
    if (previewPlaybackIntentRef.current !== 'paused') return
    debugEditorPreview('video-pause', {
      projectId,
      previewUrl,
    })
    setPreviewPlaying(false)
  }, [previewUrl, projectId])

  const handlePreviewVideoError = React.useCallback(() => {
    const video = previewVideoRef.current
    debugEditorPreview('video-error', {
      projectId,
      previewUrl,
      currentSrc: video?.currentSrc ?? null,
      networkState: video?.networkState ?? null,
      readyState: video?.readyState ?? null,
      errorCode: video?.error?.code ?? null,
      errorMessage: video?.error?.message ?? null,
    })
  }, [previewUrl, projectId])

  const previewFrameLabel = React.useCallback((framePreset: PreviewFramePreset) => {
    if (framePreset === 'source') return 'Source'
    return framePreset
  }, [])

  const handlePreviewSeek = React.useCallback((nextValue: number) => {
    const video = previewVideoRef.current
    if (!video || !transportDurationSec) return
    const nextTime = (nextValue / 100) * transportDurationSec
    video.currentTime = nextTime
    setPreviewCurrentTimeSec(nextTime)
  }, [transportDurationSec])

  const pausePreviewPlayback = React.useCallback(() => {
    const video = previewVideoRef.current
    previewPlaybackIntentRef.current = 'paused'
    previewPlaybackCommandRef.current += 1
    if (video) {
      video.pause()
    }
    setPreviewPlaying(false)
  }, [])

  const togglePreviewPlayback = React.useCallback(() => {
    if (previewKind !== 'video' || !previewUrl) return
    if (previewToggleCooldownRef.current !== null) return
    armPreviewToggleCooldown()
    if (previewPlaybackIntentRef.current === 'paused') {
      startPreviewPlayback()
      return
    }

    pausePreviewPlayback()
  }, [armPreviewToggleCooldown, pausePreviewPlayback, previewKind, previewUrl, startPreviewPlayback])

  const handlePreviewPlayRequest = React.useCallback(() => {
    if (previewKind !== 'video' || !previewUrl) return
    if (previewToggleCooldownRef.current !== null) return
    armPreviewToggleCooldown()
    startPreviewPlayback()
  }, [armPreviewToggleCooldown, previewKind, previewUrl, startPreviewPlayback])

  React.useEffect(() => {
    return () => {
      clearPreviewToggleCooldown()
    }
  }, [clearPreviewToggleCooldown])

  const openInlineSourcePicker = React.useCallback(() => {
    sourceFileInputRef.current?.click()
  }, [])

  const handleInlineSourceSelection = React.useCallback(
    async (files: File[]) => {
      const file = files[0]
      if (!file) return

      if (!project) {
        toast.error('The project is still loading. Please try again in a moment.')
        return
      }

      try {
        const stagedSource = await stageSourceFile(file, {
          allowedMediaKinds: ['video'],
        })

        if (!stagedSource) return

        const sessionSourcePreview = setSessionSourcePreview({
          projectId,
          file,
          previewKind: stagedSource.previewKind ?? 'video',
          sourceAssetId: stagedSource.assetId,
        })

        if (sessionSourcePreview) {
          setHandoffPreview({
            sourceKey: stagedSource.assetId,
            url: sessionSourcePreview.url,
            kind: sessionSourcePreview.kind,
          })
        }

        const nextProject: Project = {
          ...project,
          sourceAssetId: stagedSource.assetId,
          previewKind: stagedSource.previewKind ?? 'video',
          thumbnailUrl: '',
          sourceProfile: stagedSource.sourceProfile ?? project.sourceProfile,
          updatedAt: new Date().toISOString(),
        }

        upsertProject(nextProject)
        setProject(nextProject)

        setPreviewPlaying(false)
        previewPlaybackIntentRef.current = 'paused'
        previewPlaybackCommandRef.current += 1
        setPreviewCurrentTimeSec(0)
        setPreviewDurationSec(0)
        setPreviewIntrinsicAspectRatio(null)
        setPreviewFramePreset('source')
        setViralClipSplitPreviewActive(false)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to stage that source video right now.')
      }
    },
    [project, projectId, stageSourceFile],
  )

  const handleInlineSourceFileInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.currentTarget.files ?? [])
      event.currentTarget.value = ''
      void handleInlineSourceSelection(files)
    },
    [handleInlineSourceSelection],
  )

  const handleInlineSourceDrop = React.useCallback(
    (event: React.DragEvent<HTMLButtonElement>) => {
      event.preventDefault()
      setIsInlineSourceDragOver(false)
      void handleInlineSourceSelection(Array.from(event.dataTransfer.files ?? []))
    },
    [handleInlineSourceSelection],
  )

  const handleInlineSourceDragOver = React.useCallback((event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setIsInlineSourceDragOver(true)
  }, [])

  const handleInlineSourceDragLeave = React.useCallback(() => {
    setIsInlineSourceDragOver(false)
  }, [])

  const hasSourceAsset = Boolean(project?.sourceAssetId)

  const renderLeftPanel = () => {
    switch (leftTab) {
      case 'edit':
        return (
          <EditWorkflowPanel
            projectTitle={project?.title ?? 'Untitled Project'}
            sourceLabel={sourceAssetLabel}
            job={job}
          />
        )
      case 'design':
        return (
          <SecondaryPanel
            title="Design"
            description="Shape the motion language, titles, and overlays without clutter."
            items={[
              'Use restrained typography',
              'Keep one dominant visual anchor',
              'Avoid over-animated transitions',
            ]}
          />
        )
      case 'assets':
        return (
          <SecondaryPanel
            title="Assets"
            description="Gather the lightweight elements for the edit without leaving the workspace."
            items={[
              'Reference stills',
              'Music stems',
              'Caption kit',
              'Logo lockup',
            ]}
          />
        )
      case 'chat':
      default:
        return (
          <ChatWorkspacePanel
            key={projectId}
            projectId={projectId}
            projectTitle={project?.title ?? 'Untitled Project'}
            initialPrompt={promptText}
            initialSources={sourceList}
            videoContext={videoContext}
            composerPortalTarget={showViralClipSplitPreview ? null : chatComposerPortal}
            musicSpotlightPortalTarget={isDeferredChromeReady ? musicSpotlightPortalTarget : null}
            onEditRequest={handleEditRequest}
          />
        )
    }
  }

  return !isEditorBootReady ? (
    <EditorLoadingScreen caption="Opening editor..." />
  ) : (
    <>
      <div className="relative h-screen overflow-hidden bg-[#07070a] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(84,69,126,0.24)_0%,rgba(84,69,126,0.08)_24%,rgba(7,7,10,0)_56%),linear-gradient(180deg,rgba(16,14,24,0.72)_0%,rgba(7,7,10,1)_42%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:100%_44px] opacity-[0.06]"
      />

      <div className="relative flex h-screen flex-col overflow-hidden">
        <header className="relative z-30 border-b border-white/8">
          <div className="mx-auto flex w-full max-w-[1580px] flex-col gap-4 px-4 py-4 lg:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <motion.button
                type="button"
                onClick={handleBackNavigation}
                variants={buildRevealVariants({ delay: 0.03, distance: 10, blur: 6, duration: 0.24 })}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: false, amount: 0.55 }}
                className="inline-flex items-center gap-2 text-sm text-white/72 transition-colors hover:text-white"
              >
                <ArrowLeft className="size-4" />
                <span>Back</span>
              </motion.button>

              <motion.div
                variants={buildRevealVariants({ delay: 0.08, distance: 10, blur: 6, duration: 0.24 })}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: false, amount: 0.55 }}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-400/18 bg-emerald-400/8 px-3 py-1.5 text-[11px] text-emerald-100"
              >
                <span className="size-2 rounded-full bg-emerald-300" />
                {hasSourceAsset
                  ? job?.status === 'completed'
                    ? 'Ready to refine'
                    : 'Processing in background'
                  : 'Waiting for a source video'}
              </motion.div>
            </div>

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <motion.div
                variants={buildRevealVariants({ delay: 0.1, distance: 14, blur: 8, duration: 0.28 })}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: false, amount: 0.45 }}
                className="min-w-0"
              >
                <div className="truncate text-[1.45rem] leading-tight text-white">
                  {project?.title ?? 'Loading project...'}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-white/42">
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="size-3.5" />
                    All changes saved
                  </span>
                  <span>{progressPercent}% staged</span>
                </div>
              </motion.div>

              <motion.div
                variants={buildRevealVariants({ delay: 0.16, distance: 14, blur: 8, duration: 0.28 })}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: false, amount: 0.45 }}
                className="xl:flex-1"
              >
                <WorkspaceNavBar items={HEADER_NAV_ITEMS} defaultActive="Prompt" className="xl:flex-1" />
              </motion.div>

              <motion.div
                variants={buildRevealVariants({ delay: 0.22, distance: 14, blur: 8, duration: 0.28 })}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: false, amount: 0.45 }}
              >
                {isDeferredChromeReady ? (
                  <CinematicExportCluster onExport={() => router.push(`/exports/${projectId}`)} />
                ) : (
                  <div className="h-[52px] w-[220px] rounded-full border border-white/8 bg-white/[0.03]" />
                )}
              </motion.div>
            </div>
          </div>
        </header>

        <main className="relative z-20 mx-auto flex w-full max-w-[1580px] flex-1 min-h-0 overflow-hidden px-3 py-3 lg:px-6 lg:py-4">
          <div
            className={cn(
              'grid h-full min-h-0 w-full items-start gap-3 overflow-hidden',
              isLeftPanelCollapsed
                ? 'lg:grid-cols-[84px_minmax(0,1fr)] xl:grid-cols-[84px_minmax(0,1fr)_290px]'
                : 'lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_290px]',
            )}
          >
            <motion.aside
              layout
              className={cn(
                'flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/8 bg-[#131317] transition-[width,transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                isLeftPanelCollapsed && 'lg:rounded-[26px]',
              )}
              style={syncedColumnHeight ? { height: syncedColumnHeight } : undefined}
            >
              <motion.div
                variants={buildRevealVariants({ delay: 0.08, distance: 12, blur: 8, duration: 0.26 })}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: false, amount: 0.5 }}
                className="border-b border-white/8 px-4 py-4"
              >
                <div className="flex items-center justify-between gap-2">
                  {!isLeftPanelCollapsed ? (
                    <div className="grid flex-1 grid-cols-4 gap-2">
                      {LEFT_TABS.map(({ key, label, icon: Icon }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setLeftTab(key)}
                          className={cn(
                            'inline-flex items-center justify-center gap-2 rounded-[14px] px-3 py-2 text-sm transition-colors',
                            leftTab === key
                              ? 'bg-white/[0.10] text-white'
                              : 'text-white/48 hover:bg-white/[0.04] hover:text-white/82',
                          )}
                        >
                          <Icon className="size-4" />
                          <span className="hidden sm:inline">{label}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-1" aria-hidden />
                  )}

                  <button
                    type="button"
                    onClick={() => setIsLeftPanelCollapsed((current) => !current)}
                    className="grid size-9 shrink-0 place-items-center rounded-full border border-white/8 bg-white/[0.03] text-white/48 transition-colors hover:text-white/80"
                    aria-label={isLeftPanelCollapsed ? 'Expand left panel' : 'Collapse left panel'}
                  >
                    {isLeftPanelCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
                  </button>
                </div>
              </motion.div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={leftTab}
                  variants={buildRevealVariants({ delay: 0.12, distance: 16, blur: 10, duration: 0.3 })}
                  initial="hidden"
                  animate={isLeftPanelCollapsed ? 'hidden' : 'visible'}
                  exit="exit"
                  className={cn(
                    'min-h-0 flex-1',
                    isLeftPanelCollapsed ? 'pointer-events-none invisible' : 'visible',
                  )}
                  aria-hidden={isLeftPanelCollapsed}
                >
                  {renderLeftPanel()}
                </motion.div>
              </AnimatePresence>
            </motion.aside>

            <section
              ref={centerShellRef}
              className="relative self-start flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/8 bg-[#111115]"
            >
              <motion.div
                variants={buildRevealVariants({ delay: 0.08, distance: 12, blur: 8, duration: 0.26 })}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: false, amount: 0.45 }}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-4"
              >
                <div className="inline-flex items-center gap-2 text-white/48">
                  <ViralClipTrigger
                    active={clipModeActive || viralClipTriggerBusy}
                    processing={viralClipTriggerBusy}
                    disabled={clipModeActive || viralClipTriggerBusy}
                    onLockedHoverChange={setIsLockedViralClipTriggerHovered}
                    onActivate={() => {
                      void handleGenerateViralClips()
                    }}
                  />
                  <button type="button" className="grid size-9 place-items-center rounded-full border border-white/8 bg-white/[0.02] transition-colors hover:text-white/72">
                    <Sparkles className="size-4" />
                  </button>
                  <button type="button" className="grid size-9 place-items-center rounded-full border border-white/8 bg-white/[0.02] transition-colors hover:text-white/72">
                    <Layers3 className="size-4" />
                  </button>
                  <button type="button" className="grid size-9 place-items-center rounded-full border border-white/8 bg-white/[0.02] transition-colors hover:text-white/72">
                    <SlidersHorizontal className="size-4" />
                  </button>
                </div>

                <div className="rounded-[16px] border border-white/8 bg-[#17171d] px-4 py-2 text-center text-xs leading-5 text-white/58">
                  Preview may be choppy on this device. Exports stay frame-perfect.
                </div>

                <div className="text-xs text-white/35">
                  {hasSourceAsset
                    ? job?.status === 'completed'
                      ? 'Ready for export'
                      : 'Staging current pass'
                    : sourceStageError
                      ? 'Source required'
                      : 'Awaiting source upload'}
                </div>
              </motion.div>

              <div className="flex min-h-0 flex-col px-4 py-3">
                <div className="w-full max-w-[860px] self-center rounded-[18px] border border-white/8 bg-[#09090c] p-3">
                  <div className="flex h-[clamp(250px,40vh,460px)] items-center justify-center rounded-[14px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0)_100%)] p-4">
                    <div className="relative flex h-full w-full items-center justify-center">
                      <div
                        ref={setMusicSpotlightPortalTarget}
                        className="pointer-events-none absolute right-2 top-2 z-20"
                      />
                      <input
                        ref={sourceFileInputRef}
                        type="file"
                        accept="video/*"
                        className="sr-only"
                        onChange={handleInlineSourceFileInputChange}
                      />
                      <motion.div
                        layout
                        className="group relative overflow-hidden rounded-[8px] border border-[#267dff]/18 bg-black shadow-[0_18px_48px_-30px_rgba(0,0,0,0.95)] transition-[border-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[#267dff]/28 hover:shadow-[0_20px_54px_-30px_rgba(38,125,255,0.2)]"
                        style={{
                          aspectRatio: visiblePreviewAspectRatio,
                          width: previewFrameWidth,
                          height: 'auto',
                          willChange: 'width, height, transform',
                        }}
                        transition={{
                          layout: {
                            duration: 0.72,
                            ease: [0.645, 0.045, 0.355, 1],
                          },
                        }}
                      >
                        <div className="relative h-full w-full">
                          {hasSourceAsset && hasPreviewMedia && !clipModeActive ? (
                            <motion.div
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                              className="pointer-events-none absolute bottom-3 left-3 z-20"
                            >
                              <div className="inline-flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full border border-white/10 bg-black/48 px-3 py-1.5 text-[11px] text-white/86 shadow-[0_18px_30px_-22px_rgba(0,0,0,0.95)] backdrop-blur-md">
                                <Film className="size-3.5 shrink-0 text-[#9ff6e3]" />
                                <div className="min-w-0 truncate font-medium text-white/90">
                                  {sourceAssetLabel ?? project?.title ?? 'Source video'}
                                </div>
                              </div>
                            </motion.div>
                          ) : null}

                          {hasPreviewMedia ? (
                            <>
                              <CinematicPreviewRuntime
                                animationPlan={previewOverlayPlan}
                                currentTimeMs={previewCurrentTimeSec * 1000}
                                aspectRatio={visiblePreviewAspectRatio}
                                showSafeZones={Boolean(previewOverlayPlan)}
                                className="absolute inset-0"
                              >
                                {showViralClipSplitPreview ? (
                                  <ViralClipSplitPreview
                                    key={`viral-split-${viralClipSplitAnimationKey}-${previewUrl}`}
                                    active={showViralClipSplitPreview}
                                    animationKey={viralClipSplitAnimationKey}
                                    previewUrl={previewUrl}
                                    previewKind={previewKind}
                                    title={sourceAssetLabel ?? project?.title ?? 'Source video'}
                                    isPlaying={previewPlaying}
                                    currentTimeSec={previewCurrentTimeSec}
                                    mediaTransformStyle={shouldUseLegacySessionPreviewSurface ? undefined : previewFrameTransformStyle}
                                    objectFit={fitMode === 'fill' ? 'cover' : 'contain'}
                                    splitVideoSources={currentSplitPreviewAssets}
                                    highlightRestore={isLockedViralClipTriggerHovered}
                                    onRestoreLandscape={handleRestoreLandscapePreview}
                                  />
                                ) : previewKind === 'image' ? (
                                  <div className="absolute inset-0 overflow-hidden bg-black">
                                    <div className="absolute inset-0" style={shouldUseLegacySessionPreviewSurface ? undefined : previewFrameTransformStyle}>
                                      <img
                                        src={previewUrl}
                                        alt={project?.title ?? 'Project preview'}
                                        className="block h-full w-full bg-black"
                                        onLoad={handlePreviewImageLoaded}
                                        style={{
                                          objectFit: fitMode === 'fill' ? 'cover' : 'contain',
                                        }}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black">
                                    <div
                                      className="absolute inset-0 cursor-pointer"
                                      onPointerDown={(event) => {
                                        event.preventDefault()
                                        event.stopPropagation()
                                        togglePreviewPlayback()
                                      }}
                                      style={shouldUseLegacySessionPreviewSurface ? undefined : previewFrameTransformStyle}
                                    >
                                      <video
                                        key={previewUrl}
                                        ref={previewVideoRef}
                                        src={previewUrl}
                                        muted
                                        playsInline
                                        controls={false}
                                        preload="auto"
                                        onLoadedMetadata={handlePreviewMetadataLoaded}
                                        onLoadedData={handlePreviewVideoReady}
                                        onCanPlay={handlePreviewVideoReady}
                                        onTimeUpdate={handlePreviewTimeUpdate}
                                        onEnded={handlePreviewEnded}
                                        onPlay={handlePreviewVideoPlay}
                                        onPause={handlePreviewVideoPause}
                                        onError={handlePreviewVideoError}
                                        className="pointer-events-none block h-full w-full select-none bg-black"
                                        style={{
                                          objectFit: fitMode === 'fill' ? 'cover' : 'contain',
                                        }}
                                      />
                                    </div>

                                    {!isPreviewMediaReady && isPreviewLoadingVisible ? (
                                      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/15 px-6">
                                        <InfinityTrailLoader
                                          label="Loading source preview"
                                          subtitle="Preparing the visible video surface."
                                          variant="stacked"
                                          className="w-full max-w-[320px]"
                                        />
                                      </div>
                                    ) : null}
                                  </div>
                                )}
                              </CinematicPreviewRuntime>

                              {previewKind === 'video' && hasPreviewMedia && !previewPlaying && !showViralClipSplitPreview ? (
                                <button
                                  type="button"
                                  onClick={handlePreviewPlayRequest}
                                  className="absolute bottom-3 right-3 z-20 inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/58 px-3 py-1.5 text-[11px] text-white/86 shadow-[0_18px_30px_-22px_rgba(0,0,0,0.95)] backdrop-blur-md transition-colors hover:bg-black/72"
                                >
                                  <Play className="size-3 fill-current" />
                                  Play preview
                                </button>
                              ) : null}

                              {showInlinePreviewStatus ? (
                                <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-5">
                                  <motion.button
                                    type="button"
                                    aria-label={
                                      sourceStageError
                                        ? 'Source upload error'
                                        : inlinePreviewStatusLabel ?? 'Source upload status'
                                    }
                                    layout
                                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                                    onHoverStart={() => setInlinePreviewStatusHovered(true)}
                                    onHoverEnd={() => setInlinePreviewStatusHovered(false)}
                                    onFocus={() => setInlinePreviewStatusHovered(true)}
                                    onBlur={() => setInlinePreviewStatusHovered(false)}
                                    className={cn(
                                      'pointer-events-auto inline-flex items-center overflow-hidden border border-white/10 bg-black/44 shadow-[0_18px_30px_-22px_rgba(0,0,0,0.95)] backdrop-blur-md transition-[border-radius,padding,gap,background-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                                      isInlinePreviewStatusExpanded
                                        ? 'gap-2 rounded-full px-3 py-1.5 text-[11px] text-white/72'
                                        : 'size-9 justify-center rounded-full text-white/84 hover:bg-black/56',
                                    )}
                                  >
                                    <motion.span
                                      aria-hidden
                                      className="flex size-4 shrink-0 items-center justify-center"
                                      animate={
                                        sourceStageError
                                          ? { rotate: 0, scale: [0.92, 1.02, 0.92] }
                                          : { rotate: 360 }
                                      }
                                      transition={
                                        sourceStageError
                                          ? { duration: 1.1, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }
                                          : { duration: 1, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }
                                      }
                                    >
                                      {sourceStageError ? (
                                        <AlertCircle className="size-4 text-rose-100" />
                                      ) : (
                                        <Loader2 className="size-4 text-[#9ff6e3]" />
                                      )}
                                    </motion.span>

                                    <AnimatePresence initial={false}>
                                      {isInlinePreviewStatusExpanded && inlinePreviewStatusLabel ? (
                                        <motion.span
                                          key="inline-preview-status-label"
                                          initial={{ opacity: 0, x: -6 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          exit={{ opacity: 0, x: -4 }}
                                          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                                        >
                                          {inlinePreviewStatusLabel}
                                        </motion.span>
                                      ) : null}
                                    </AnimatePresence>
                                  </motion.button>
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <SourceStagePlaceholder
                              status={sourceStageError ? 'error' : previewUrl || hasSourceAsset ? 'loading' : 'empty'}
                              isDragActive={isInlineSourceDragOver}
                              onPickSource={openInlineSourcePicker}
                              onDragOver={handleInlineSourceDragOver}
                              onDragLeave={handleInlineSourceDragLeave}
                              onDrop={handleInlineSourceDrop}
                            />
                          )}

                          <div className="pointer-events-none absolute inset-[10%] rounded-[8px] border border-dashed border-white/12" />
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </div>

                {hasSourceAsset || viralClipLifecycle !== 'idle' ? (
                  <ViralClipJobPanel
                    backendHealth={viralClipBackendHealth}
                    lifecycle={viralClipLifecycle}
                    backendStage={viralClipBackendStage}
                    stageLabel={viralClipStageLabel}
                    stageDetail={viralClipStageDetail}
                    jobId={viralClipJobId}
                    progressPercent={viralClipProgressPercent}
                    warnings={viralClipWarnings}
                    statusMessage={viralClipStatusMessage}
                    errorMessage={viralClipErrorMessage}
                    resultError={viralClipResultError}
                    selectedClips={viralClipSelectedClips}
                    targetPlatform={viralClipTargetPlatform}
                    clipCountMin={viralClipClipPreset.min}
                    clipCountMax={viralClipClipPreset.max}
                    onTargetPlatformChange={setViralClipTargetPlatform}
                    onClipCountPresetChange={(preset) => {
                      const nextPresetIndex = VIRAL_CLIP_COUNT_PRESETS.findIndex(
                        (candidate) => candidate.min === preset.min && candidate.max === preset.max,
                      )
                      if (nextPresetIndex >= 0) {
                        setViralClipClipPresetIndex(nextPresetIndex)
                      }
                    }}
                    onRefreshHealth={() => {
                      void refreshViralClipBackendHealth()
                    }}
                    onRefreshResult={() => {
                      void refreshViralClipResult()
                    }}
                  />
                ) : null}

                <div className="mt-2.5 flex w-full max-w-[860px] flex-wrap items-center gap-3 self-center rounded-[20px] border border-white/8 bg-[#0c0c10] px-4 py-2.5">
                  <button
                    type="button"
                    onClick={togglePreviewPlayback}
                    disabled={previewKind !== 'video' || !previewUrl}
                    className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-white/76 transition-colors hover:text-white disabled:cursor-not-allowed disabled:text-white/28"
                  >
                    {previewPlaying ? <Pause className="size-4" /> : <Play className="size-4 fill-current" />}
                  </button>

                  <div className="min-w-[84px] text-sm text-white/72">
                    {transportCurrentTime} / {transportTime}
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={transportProgress}
                    onChange={(event) => handlePreviewSeek(Number(event.target.value))}
                    disabled={previewKind !== 'video' || !previewUrl}
                    className="h-1.5 flex-1 accent-white disabled:cursor-not-allowed disabled:opacity-40"
                  />

                  <button
                    type="button"
                    className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-white/54 transition-colors hover:text-white/82"
                  >
                    <Volume2 className="size-4" />
                  </button>
                </div>

                <div className="mt-2 flex w-full max-w-[860px] flex-wrap items-center justify-center gap-2 self-center">
                  {BOTTOM_MODES.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setBottomMode(mode)}
                      className={cn(
                        'rounded-full border px-4 py-2 text-xs transition-colors',
                        bottomMode === mode
                          ? 'border-white/14 bg-white/[0.10] text-white'
                          : 'border-white/8 bg-white/[0.03] text-white/56 hover:text-white/78',
                      )}
                      >
                      {mode}
                    </button>
                  ))}
                </div>

              </div>
            </section>

            <motion.aside
              layout
              className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/8 bg-[#131317] lg:col-span-2 xl:col-span-1"
              style={syncedColumnHeight ? { height: syncedColumnHeight } : undefined}
            >
              <motion.div
                variants={buildRevealVariants({ delay: 0.1, distance: 12, blur: 8, duration: 0.26 })}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: false, amount: 0.45 }}
                className="flex items-center justify-between border-b border-white/8 px-4 py-4"
              >
                <div>
                  <div className="text-sm text-white">Video</div>
                  <div className="mt-1 text-xs text-white/38">Transform and frame the current source.</div>
                </div>
                <button
                  type="button"
                  className="grid size-8 place-items-center rounded-full border border-white/8 bg-white/[0.03] text-white/42 transition-colors hover:text-white/72"
                >
                  <Settings2 className="size-4" />
                </button>
              </motion.div>

              <div ref={inspectorViewportRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <motion.div
                  variants={buildRevealVariants({ delay: 0.14, distance: 14, blur: 10, duration: 0.28 })}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ root: inspectorViewportRef, once: false, amount: 0.4 }}
                  className="rounded-[18px] border border-white/8 bg-white/[0.02] p-4"
                >
                  <div className="text-[10px] uppercase tracking-[0.32em] text-white/35">Frame</div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {PREVIEW_FRAME_PRESETS.map((framePreset) => (
                      <button
                        key={framePreset}
                        type="button"
                        onClick={() => {
                          setViralClipSplitPreviewActive(false)
                          setPreviewFramePreset(framePreset)
                        }}
                        className={cn(
                          'rounded-[12px] border px-3 py-2 text-left text-sm transition-colors',
                          previewFramePreset === framePreset
                            ? 'border-[#267dff]/45 bg-[#267dff]/12 text-white'
                            : 'border-white/8 bg-white/[0.03] text-white/58 hover:border-white/14 hover:bg-white/[0.05] hover:text-white/82',
                        )}
                      >
                        <div className="font-medium text-white/88">{previewFrameLabel(framePreset)}</div>
                        <div className="mt-1 text-[11px] text-white/42">
                          {framePreset === 'source'
                            ? 'Auto uses the loaded media shape.'
                            : `Render the preview in ${framePreset} format.`}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 text-xs leading-5 text-white/46">
                    Auto detects the media shape first, then lets you switch the frame if you want a different delivery ratio.
                  </div>
                  {clipModeActive ? (
                    <div className="mt-3 rounded-[14px] border border-[#9ff6e3]/16 bg-[#9ff6e3]/[0.06] px-3 py-2 text-[11px] leading-5 text-[#dffdf5]">
                      Viral clip mode is armed. This preview is stress-testing the cut in a 9:16 delivery frame.
                    </div>
                  ) : null}
                </motion.div>

                <motion.div
                  variants={buildRevealVariants({ delay: 0.18, distance: 14, blur: 10, duration: 0.28 })}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ root: inspectorViewportRef, once: false, amount: 0.4 }}
                  className="mt-4 rounded-[18px] border border-white/8 bg-white/[0.02] p-4"
                >
                  <div className="text-[10px] uppercase tracking-[0.32em] text-[#c9b7ff]/68">Transform</div>

                  <div className="mt-4 rounded-[14px] border border-white/8 bg-[#0d0d12] p-1">
                    <div className="grid grid-cols-2 gap-1">
                      {(['fill', 'fit'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setFitMode(mode)}
                          className={cn(
                            'rounded-[10px] px-3 py-2 text-sm transition-colors',
                            fitMode === mode ? 'bg-white/[0.12] text-white' : 'text-white/44 hover:text-white/74',
                          )}
                        >
                          {mode === 'fill' ? 'Fill' : 'Fit'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <InspectorField
                    label="Scale"
                    value={`${Math.round(scale)}%`}
                    viewportRoot={inspectorViewportRef}
                    revealDelay={0.18}
                  >
                    <input
                      type="range"
                      min={80}
                      max={130}
                      value={scale}
                      onChange={(event) => setScale(Number(event.target.value))}
                      className="h-1.5 w-full accent-white"
                    />
                  </InspectorField>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <InspectorNumberField
                      label="Offset X"
                      value={offsetX}
                      onChange={setOffsetX}
                      viewportRoot={inspectorViewportRef}
                      revealDelay={0.22}
                    />
                    <InspectorNumberField
                      label="Offset Y"
                      value={offsetY}
                      onChange={setOffsetY}
                      viewportRoot={inspectorViewportRef}
                      revealDelay={0.26}
                    />
                  </div>
                </motion.div>

                <motion.div
                  variants={buildRevealVariants({ delay: 0.24, distance: 14, blur: 10, duration: 0.28 })}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ root: inspectorViewportRef, once: false, amount: 0.4 }}
                  className="mt-4 rounded-[18px] border border-white/8 bg-white/[0.02] p-4"
                >
                  <div className="text-[10px] uppercase tracking-[0.32em] text-white/35">Source Profile</div>
                  {project?.sourceProfile ? (
                    <>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/8 bg-[#0d0d12] px-3 py-1 text-[11px] text-white/74">
                          {formatAspectFamily(project.sourceProfile.aspectFamily)}
                        </span>
                        <span className="rounded-full border border-white/8 bg-[#0d0d12] px-3 py-1 text-[11px] text-white/74">
                          {formatTimeProfile(project.sourceProfile.timeProfile)}
                        </span>
                        <span className="rounded-full border border-white/8 bg-[#0d0d12] px-3 py-1 text-[11px] text-white/74">
                          {formatProcessingClass(project.sourceProfile.processingClass)}
                        </span>
                      </div>
                      <div className="mt-4 space-y-3 text-sm text-white/68">
                        <InspectorMeta
                          label="Resolution"
                          value={sourceMetrics?.resolution ?? 'Unknown resolution'}
                          viewportRoot={inspectorViewportRef}
                          revealDelay={0.26}
                        />
                        <InspectorMeta
                          label="Duration"
                          value={sourceMetrics?.duration ?? 'Unknown duration'}
                          viewportRoot={inspectorViewportRef}
                          revealDelay={0.3}
                        />
                        <InspectorMeta
                          label="Weight"
                          value={formatWeightBucket(project.sourceProfile.weightBucket)}
                          viewportRoot={inspectorViewportRef}
                          revealDelay={0.34}
                        />
                        <InspectorMeta
                          label="Bucket"
                          value={formatDurationBucket(project.sourceProfile.durationBucket)}
                          viewportRoot={inspectorViewportRef}
                          revealDelay={0.38}
                        />
                      </div>
                    </>
                  ) : hasSourceAsset ? (
                    <div className="mt-3 rounded-[14px] border border-white/8 bg-[#0d0d12] p-4">
                      <div className="text-sm font-medium text-white/88">Source staged</div>
                      <div className="mt-1 text-xs leading-5 text-white/46">
                        The frame is live. Local profiling will fill in richer source details as they become available.
                      </div>
                      <button
                        type="button"
                        onClick={openInlineSourcePicker}
                        className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white px-3 py-2 text-[11px] font-medium text-black transition-transform hover:scale-[1.01]"
                      >
                        <Sparkles className="size-3.5" />
                        Replace video
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-[14px] border border-white/8 bg-[#0d0d12] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white/88">No source attached yet</div>
                          <div className="mt-1 text-xs leading-5 text-white/46">
                            Stage a video in the main frame and the preview will wake up in place.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={openInlineSourcePicker}
                          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white px-3 py-2 text-[11px] font-medium text-black transition-transform hover:scale-[1.01]"
                        >
                          <Sparkles className="size-3.5" />
                          Choose video
                        </button>
                      </div>
                      {sourceStageError ? (
                        <div className="mt-3 rounded-[12px] border border-rose-400/16 bg-rose-500/8 px-3 py-2 text-[11px] leading-5 text-rose-100/92">
                          {sourceStageError}
                        </div>
                      ) : null}
                    </div>
                  )}
                </motion.div>

                <motion.div
                  variants={buildRevealVariants({ delay: 0.32, distance: 14, blur: 10, duration: 0.28 })}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ root: inspectorViewportRef, once: false, amount: 0.4 }}
                  className="mt-4 rounded-[18px] border border-white/8 bg-white/[0.02] p-4"
                >
                  <div className="text-[10px] uppercase tracking-[0.32em] text-white/35">Source</div>
                  <div className="mt-4 space-y-3 text-sm text-white/68">
                    <InspectorMeta
                      label="Type"
                      value={previewKind === 'image' ? 'Image' : 'Video'}
                      viewportRoot={inspectorViewportRef}
                      revealDelay={0.34}
                    />
                    <InspectorMeta
                      label="Status"
                      value={hasSourceAsset ? (job?.status === 'completed' ? 'Ready' : 'Staging') : 'No source'}
                      viewportRoot={inspectorViewportRef}
                      revealDelay={0.38}
                    />
                    <InspectorMeta
                      label="Duration"
                      value={transportTime}
                      viewportRoot={inspectorViewportRef}
                      revealDelay={0.42}
                    />
                    <InspectorMeta
                      label="Prompt"
                      value={promptText.slice(0, 48)}
                      viewportRoot={inspectorViewportRef}
                      revealDelay={0.46}
                    />
                  </div>
                </motion.div>

                <motion.div
                  variants={buildRevealVariants({ delay: 0.35, distance: 14, blur: 10, duration: 0.28 })}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ root: inspectorViewportRef, once: false, amount: 0.4 }}
                  className="mt-4 rounded-[18px] border border-white/8 bg-white/[0.02] p-4"
                >
                  <div className="text-[10px] uppercase tracking-[0.32em] text-[#f4eb72]/72">Preview Rendering</div>
                  <div className="mt-3 rounded-[14px] border border-white/8 bg-[#0d0d12] px-3 py-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-white/84">
                        {previewOverlayPlan ? 'Live edit overlay' : 'Direct source preview only'}
                      </span>
                      <span className="text-[11px] uppercase tracking-[0.22em] text-white/36">
                        {previewOverlayPlan ? 'streaming edit pass' : 'overlays off'}
                      </span>
                    </div>
                    <div className="mt-2 text-xs leading-5 text-white/46">
                      {previewOverlayPlan
                        ? 'The backend edit stream is painting typographic beats and preset assets directly onto the imported video.'
                        : 'Cinematic captions, explainer panels, background washes, and other generated preview treatments will attach here once an edit job starts.'}
                    </div>
                  </div>

                  <div className="mt-3 rounded-[14px] border border-white/8 bg-[#0d0d12] px-3 py-3 text-sm text-white/72">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/42">Current view</span>
                      <span className="text-[11px] uppercase tracking-[0.22em] text-white/35">
                        {bottomMode.toLowerCase()}
                      </span>
                    </div>
                    <div className="mt-2 font-medium text-white/88">
                      {previewOverlayPlan
                        ? 'The editor is rendering the live style lane on top of the uploaded media.'
                        : 'The editor is showing the uploaded media without generated video edits.'}
                    </div>
                    <div className="mt-2 text-xs leading-5 text-white/46">
                      {previewOverlayPlan
                        ? 'Use the frame controls, crop and fit controls, and playback controls as usual. The style lane is active on top of the imported clip.'
                        : 'Use the frame controls, crop and fit controls, and playback controls as usual. The auto-styled cinematic layer is no longer applied on top.'}
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  variants={buildRevealVariants({ delay: 0.38, distance: 14, blur: 10, duration: 0.28 })}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ root: inspectorViewportRef, once: false, amount: 0.4 }}
                  className="mt-4 rounded-[18px] border border-white/8 bg-white/[0.02] p-4"
                >
                  <div className="text-[10px] uppercase tracking-[0.32em] text-white/35">Queue</div>
                  <div className="mt-4 space-y-2">
                    {(job?.steps ?? []).map((step, index) => (
                      <motion.div
                        key={step.key}
                        variants={buildRevealVariants({ delay: 0.42 + index * 0.04, distance: 10, blur: 6, duration: 0.24 })}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ root: inspectorViewportRef, once: false, amount: 0.35 }}
                        className="rounded-[14px] border border-white/8 bg-[#0d0d12] px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-white/78">{step.title}</span>
                          <span className="text-white/40">{Math.round(step.progress * 100)}%</span>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-white/[0.54]"
                            style={{ width: `${Math.max(6, Math.round(step.progress * 100))}%` }}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </motion.aside>
          </div>
        </main>
      </div>
      </div>
      <div
        ref={setChatComposerPortal}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[60] h-0 w-0 overflow-visible"
      />
    </>
  )
}

function InspectorField({
  label,
  value,
  children,
  viewportRoot,
  revealDelay = 0,
}: {
  label: string
  value: string
  children: React.ReactNode
  viewportRoot?: React.RefObject<HTMLDivElement | null>
  revealDelay?: number
}) {
  const reduceMotion = useStableReducedMotion()
  return (
    <motion.div
      variants={buildRevealVariants({ delay: revealDelay, distance: 12, blur: 8, duration: 0.26 })}
      initial={reduceMotion ? false : 'hidden'}
      whileInView={reduceMotion ? undefined : 'visible'}
      viewport={reduceMotion ? undefined : { root: viewportRoot, once: false, amount: 0.4 }}
      className="mt-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-white/42">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      {children}
    </motion.div>
  )
}

function InspectorNumberField({
  label,
  value,
  onChange,
  viewportRoot,
  revealDelay = 0,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  viewportRoot?: React.RefObject<HTMLDivElement | null>
  revealDelay?: number
}) {
  const reduceMotion = useStableReducedMotion()
  return (
    <motion.label
      variants={buildRevealVariants({ delay: revealDelay, distance: 12, blur: 8, duration: 0.26 })}
      initial={reduceMotion ? false : 'hidden'}
      whileInView={reduceMotion ? undefined : 'visible'}
      viewport={reduceMotion ? undefined : { root: viewportRoot, once: false, amount: 0.4 }}
      className="block"
    >
      <div className="mb-2 text-xs text-white/42">{label}</div>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full rounded-[14px] border border-white/8 bg-[#0d0d12] px-3 text-sm text-white outline-none transition-colors focus:border-white/16"
      />
    </motion.label>
  )
}

function InspectorMeta({
  label,
  value,
  viewportRoot,
  revealDelay = 0,
}: {
  label: string
  value: string
  viewportRoot?: React.RefObject<HTMLDivElement | null>
  revealDelay?: number
}) {
  const reduceMotion = useStableReducedMotion()
  return (
    <motion.div
      variants={buildRevealVariants({ delay: revealDelay, distance: 10, blur: 6, duration: 0.24 })}
      initial={reduceMotion ? false : 'hidden'}
      whileInView={reduceMotion ? undefined : 'visible'}
      viewport={reduceMotion ? undefined : { root: viewportRoot, once: false, amount: 0.4 }}
      className="flex items-center justify-between gap-3 rounded-[14px] border border-white/8 bg-[#0d0d12] px-3 py-3"
    >
      <span className="text-white/42">{label}</span>
      <span className="max-w-[60%] truncate text-right text-white/78">{value}</span>
    </motion.div>
  )
}

