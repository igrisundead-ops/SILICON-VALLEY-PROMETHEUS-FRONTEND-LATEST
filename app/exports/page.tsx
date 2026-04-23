'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

import { PrometheusShell } from '@/components/prometheus-shell'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function ExportsLandingPage() {
  const router = useRouter()
  return (
    <PrometheusShell
      header={
        <PageHeader
          title="Exports"
          description="Exports are per project. Pick a project to preview presets."
          actions={
            <Button
              onClick={() => router.push('/projects')}
              className="bg-white text-black hover:bg-white/90"
            >
              Browse Projects <ArrowRight className="size-4" />
            </Button>
          }
        />
      }
    >
      <div className="px-8 py-6">
        <Card className="border-dashed">
          <CardContent className="p-10 text-center">
            <div className="text-sm text-white/70">Open an export page via a project.</div>
            <div className="mt-2 text-xs text-white/45">Go to the editor, then hit Export.</div>
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={() => router.push('/projects')}>
                Browse Projects
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PrometheusShell>
  )
}

