import { Readable } from 'node:stream'

import { NextResponse } from 'next/server'

import {
  createNodeStream,
  resolveBackgroundFile,
  resolveTemplateSupportFile,
} from '@/lib/cinematic/server-assets'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const kind = url.searchParams.get('kind')?.trim() ?? ''

  if (kind === 'background') {
    const id = url.searchParams.get('id')?.trim() ?? ''
    if (!id) {
      return NextResponse.json({ error: 'Missing background id.' }, { status: 400 })
    }

    const file = await resolveBackgroundFile(id)
    if (!file) {
      return NextResponse.json({ error: 'Unknown background asset.' }, { status: 404 })
    }

    return new NextResponse(Readable.toWeb(createNodeStream(file.filePath)) as ReadableStream, {
      headers: {
        'Content-Type': file.contentType,
        'Content-Length': String(file.fileStat.size),
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    })
  }

  if (kind === 'template-asset') {
    const assetPath = url.searchParams.get('path')?.trim() ?? ''
    if (!assetPath) {
      return NextResponse.json({ error: 'Missing template asset path.' }, { status: 400 })
    }

    const file = await resolveTemplateSupportFile(assetPath)
    if (!file) {
      return NextResponse.json({ error: 'Unknown template support asset.' }, { status: 404 })
    }

    return new NextResponse(Readable.toWeb(createNodeStream(file.filePath)) as ReadableStream, {
      headers: {
        'Content-Type': file.contentType,
        'Content-Length': String(file.fileStat.size),
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    })
  }

  return NextResponse.json({ error: 'Unsupported cinematic asset kind.' }, { status: 400 })
}
