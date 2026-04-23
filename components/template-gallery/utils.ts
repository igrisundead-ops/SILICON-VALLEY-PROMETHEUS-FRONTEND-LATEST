export function hashToNumber(input: string): number {
  // FNV-1a 32-bit
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const FALLBACK_IMAGES = [
  '/fallbacks/fallback-1.jpg',
  '/fallbacks/fallback-2.jpg',
  '/fallbacks/fallback-3.jpg',
  '/fallbacks/fallback-4.jpg',
  '/fallbacks/fallback-5.jpg',
  '/fallbacks/fallback-6.jpg',
] as const

export function pickStableFallbackImage(templateId: string): string {
  const n = hashToNumber(templateId)
  return FALLBACK_IMAGES[n % FALLBACK_IMAGES.length]
}

const GRADIENTS = [
  { from: '#a855f7', via: '#6366f1', to: '#ec4899' }, // purple -> indigo -> pink
  { from: '#22c55e', via: '#06b6d4', to: '#6366f1' }, // green -> cyan -> indigo
  { from: '#f97316', via: '#a855f7', to: '#2563eb' }, // orange -> purple -> blue
  { from: '#f43f5e', via: '#8b5cf6', to: '#22c55e' }, // rose -> violet -> green
  { from: '#0ea5e9', via: '#a855f7', to: '#f59e0b' }, // sky -> purple -> amber
] as const

export function gradientFromId(templateId: string): React.CSSProperties {
  const n = hashToNumber(templateId)
  const g = GRADIENTS[n % GRADIENTS.length]
  return {
    backgroundImage: `linear-gradient(135deg, ${g.from}, ${g.via}, ${g.to})`,
  }
}

