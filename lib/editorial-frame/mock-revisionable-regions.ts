import type { RevisionableRegion } from './types'

export const MOCK_REVISIONABLE_REGIONS: RevisionableRegion[] = [
  {
    id: 'opener-typography-1-24',
    label: 'Opener Typography Entrance',
    startFrame: 1,
    endFrame: 24,
    category: 'typography',
    thumbnailUrl: '/style-previews/iman-1.jpg',
    assetNames: ['Title lockup', 'Type motion'],
    confidence: 0.98,
    source: 'backend_log',
    isExact: true,
  },
  {
    id: 'graph-rise-30-35',
    label: 'Graph Rise Animation',
    startFrame: 30,
    endFrame: 35,
    category: 'graph',
    thumbnailUrl: '/style-previews/docs-story-1.jpg',
    assetNames: ['Graph stroke', 'Value counter'],
    confidence: 0.96,
    source: 'backend_log',
    isExact: true,
  },
  {
    id: 'speaker-lower-third-86-102',
    label: 'Speaker Lower Third In',
    startFrame: 86,
    endFrame: 102,
    category: 'overlay',
    thumbnailUrl: '/style-previews/podcast-1.jpg',
    assetNames: ['Lower third', 'Speaker tag'],
    confidence: 0.91,
    source: 'inferred',
    isExact: true,
  },
  {
    id: 'quote-card-slide-145-172',
    label: 'Quote Card Slide',
    startFrame: 145,
    endFrame: 172,
    category: 'scene',
    thumbnailUrl: '/style-previews/red-statue-1.jpg',
    assetNames: ['Quote card', 'Motion shadow'],
    confidence: 0.88,
    source: 'inferred',
    isExact: true,
  },
  {
    id: 'cta-endcap-motion-248-276',
    label: 'CTA Endcap Motion',
    startFrame: 248,
    endFrame: 276,
    category: 'transition',
    thumbnailUrl: '/style-previews/reels-heat-2.webp',
    assetNames: ['CTA badge', 'Exit motion'],
    confidence: 0.9,
    source: 'backend_log',
    isExact: true,
  },
]

export const FRAME_ASSIST_RECENT_TARGETS_STORAGE_PREFIX = 'prometheus.editor.frame-recent-targets.v1'

export function getFrameAssistStorageKey(projectId: string) {
  return `${FRAME_ASSIST_RECENT_TARGETS_STORAGE_PREFIX}.${projectId}`
}
