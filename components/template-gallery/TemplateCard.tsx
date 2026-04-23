'use client'

import * as React from 'react'
import Image from 'next/image'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { gradientFromId, hashToNumber, pickStableFallbackImage } from '@/components/template-gallery/utils'

export type TemplateCategory = 'Talking Head' | 'Podcast' | 'Reels' | 'Documentary'

export interface TemplateGalleryItem {
  id: string
  title: string
  category: TemplateCategory
  previewImage: string
  avatarImage?: string
  categoryImage?: string
  impressions?: string[]
}

type AvatarMode = 'image' | 'gradient'

function shouldUseImageFallback(templateId: string): boolean {
  return hashToNumber(templateId) % 2 === 0
}

function AvatarBubble({
  template,
}: {
  template: Pick<TemplateGalleryItem, 'id' | 'avatarImage' | 'categoryImage' | 'category'>
}) {
  const useImageFallback = React.useMemo(
    () => shouldUseImageFallback(template.id),
    [template.id],
  )

  const fallbackPoolSrc = React.useMemo(
    () => pickStableFallbackImage(template.id),
    [template.id],
  )

  const [mode, setMode] = React.useState<AvatarMode>(() => {
    if (template.avatarImage) return 'image'
    if (template.categoryImage) return 'image'
    return useImageFallback ? 'image' : 'gradient'
  })

  const [src, setSrc] = React.useState<string | null>(() => {
    if (template.avatarImage) return template.avatarImage
    if (template.categoryImage) return template.categoryImage
    return useImageFallback ? fallbackPoolSrc : null
  })

  const tried = React.useRef<{ avatar: boolean; category: boolean; pool: boolean }>({
    avatar: false,
    category: false,
    pool: false,
  })

  const handleError = () => {
    if (src === template.avatarImage && !tried.current.avatar) {
      tried.current.avatar = true
      if (template.categoryImage) {
        setSrc(template.categoryImage)
        setMode('image')
        return
      }
    }
    if (src === template.categoryImage && !tried.current.category) {
      tried.current.category = true
      if (useImageFallback) {
        setSrc(fallbackPoolSrc)
        setMode('image')
        return
      }
    }
    if (src === fallbackPoolSrc && !tried.current.pool) {
      tried.current.pool = true
    }
    setSrc(null)
    setMode('gradient')
  }

  return (
    <div className="absolute right-4 top-4 z-20">
      <div className="size-14 rounded-full border-2 border-white/80 shadow-[0_10px_24px_rgba(0,0,0,0.45)] overflow-hidden bg-black/40">
        {mode === 'image' && src ? (
          // Using <img> for bubble for consistent onError fallback behavior.
          <img
            src={src}
            alt={`${template.category} avatar`}
            className="h-full w-full object-cover"
            width={56}
            height={56}
            loading="lazy"
            onError={handleError}
          />
        ) : (
          <div className="h-full w-full" style={gradientFromId(template.id)} />
        )}
      </div>
    </div>
  )
}

function Preview({
  templateId,
  src,
  alt,
}: {
  templateId: string
  src: string
  alt: string
}) {
  const [imageOk, setImageOk] = React.useState(true)

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40">
      <div className="absolute inset-0" style={gradientFromId(templateId)} />
      {imageOk ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover"
          onError={() => setImageOk(false)}
          priority={false}
        />
      ) : null}

      {/* readability overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
    </div>
  )
}

export function TemplateCard({
  template,
  onSelect,
  className,
}: {
  template: TemplateGalleryItem
  onSelect?: (template: TemplateGalleryItem) => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(template)}
      className={cn('text-left w-full', className)}
    >
      <Card className="rounded-2xl border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-all hover:-translate-y-0.5 hover:border-purple-400/30">
        <CardContent className="p-4">
          <div className="relative">
            <Preview
              templateId={template.id}
              src={template.previewImage}
              alt={`${template.title} preview`}
            />

            <AvatarBubble template={template} />

            <div className="absolute left-4 top-4 z-20">
              <Badge
                variant="outline"
                className="border-white/25 bg-black/40 text-white/85 backdrop-blur-md"
              >
                {template.category}
              </Badge>
            </div>

            <div className="absolute inset-x-4 bottom-4 z-20">
              <div className="text-sm font-semibold text-white/95 line-clamp-2">
                {template.title}
              </div>
            </div>
          </div>

          {template.impressions?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {template.impressions.slice(0, 4).map((t) => (
                <Badge
                  key={t}
                  variant="secondary"
                  className="bg-white/[0.03] text-white/70 border-white/10"
                >
                  {t}
                </Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </button>
  )
}

