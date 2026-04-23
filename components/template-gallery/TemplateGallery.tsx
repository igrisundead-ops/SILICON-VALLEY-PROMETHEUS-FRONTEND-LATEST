'use client'

import * as React from 'react'

import { TemplateCard, type TemplateGalleryItem } from '@/components/template-gallery/TemplateCard'
import { cn } from '@/lib/utils'

export function TemplateGallery({
  templates,
  onSelect,
  className,
}: {
  templates: TemplateGalleryItem[]
  onSelect: (template: TemplateGalleryItem) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        className,
      )}
    >
      {templates.map((t) => (
        <TemplateCard key={t.id} template={t} onSelect={onSelect} />
      ))}
    </div>
  )
}

