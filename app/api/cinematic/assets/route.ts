import { NextResponse } from 'next/server'

import { readCinematicAssetRegistry } from '@/lib/cinematic/server-assets'

export const runtime = 'nodejs'

export async function GET() {
  const registry = await readCinematicAssetRegistry()
  return NextResponse.json(registry, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
