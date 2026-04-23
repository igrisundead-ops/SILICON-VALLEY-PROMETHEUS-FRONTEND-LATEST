import { NextResponse } from 'next/server'

import { readTemplateRuntimeHtml } from '@/lib/cinematic/server-assets'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const templateId = url.searchParams.get('id')?.trim() ?? ''

  if (!templateId) {
    return NextResponse.json({ error: 'Missing template id.' }, { status: 400 })
  }

  const templatePayload = await readTemplateRuntimeHtml(templateId)
  if (!templatePayload) {
    return NextResponse.json({ error: 'Unknown cinematic template.' }, { status: 404 })
  }

  return NextResponse.json(templatePayload, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
