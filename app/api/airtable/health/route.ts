import { NextResponse } from 'next/server'
import {
  AIRTABLE_IMAGE_FIELD_ID,
  AIRTABLE_NAME_FIELD_ID,
  getAirtableEnv,
  readAirtableErrorMessage,
} from '@/app/api/airtable/_utils'

export const runtime = 'nodejs'

export async function GET() {
  const envResult = getAirtableEnv()
  if (!envResult.ok) {
    return NextResponse.json(
      { ok: false, where: 'env', missing: envResult.missing },
      { status: 500 }
    )
  }

  const { token, baseId, tableId } = envResult.env
  console.log('[Airtable] config', { baseId, tableId })

  const params = new URLSearchParams()
  params.set('pageSize', '1')
  params.append('fields[]', AIRTABLE_NAME_FIELD_ID)
  params.append('fields[]', AIRTABLE_IMAGE_FIELD_ID)

  const url = `https://api.airtable.com/v0/${baseId}/${tableId}?${params.toString()}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    const message = await readAirtableErrorMessage(res)
    console.error('[Airtable] health check failed', {
      baseId,
      tableId,
      status: res.status,
      error: message,
    })

    return NextResponse.json(
      { ok: false, where: 'airtable', status: res.status, error: message },
      { status: res.status === 403 ? 403 : res.status }
    )
  }

  return NextResponse.json(
    { ok: true, baseId, table: tableId },
    { status: 200 }
  )
}
