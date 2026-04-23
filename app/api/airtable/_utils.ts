import 'server-only'

export const AIRTABLE_NAME_FIELD_ID = 'fld7tTApn7Aw1nsVW'
export const AIRTABLE_IMAGE_FIELD_ID = 'fldgBSDLL8s1OeUjF'

export const REQUIRED_AIRTABLE_ENV_VARS = [
  'AIRTABLE_TOKEN',
  'AIRTABLE_BASE_ID',
  'AIRTABLE_IMAGE_TABLE',
] as const

export type AirtableEnv = {
  token: string
  baseId: string
  tableId: string
}

function isNonEmpty(value: string | undefined) {
  return typeof value === 'string' && value.trim().length > 0
}

// Note: Next.js reads `.env` at dev server startup; restart `npm run dev` after env changes.
export function getAirtableEnv():
  | { ok: true; env: AirtableEnv }
  | { ok: false; missing: string[] } {
  const missing: string[] = []
  for (const key of REQUIRED_AIRTABLE_ENV_VARS) {
    if (!isNonEmpty(process.env[key])) missing.push(key)
  }

  if (missing.length > 0) return { ok: false, missing }

  return {
    ok: true,
    env: {
      token: process.env.AIRTABLE_TOKEN!,
      baseId: process.env.AIRTABLE_BASE_ID!,
      tableId: process.env.AIRTABLE_IMAGE_TABLE!,
    },
  }
}

export async function readAirtableErrorMessage(res: Response) {
  try {
    const body = (await res.json()) as { error?: { message?: string } }
    if (body?.error?.message) return body.error.message
  } catch {
    // ignore
  }
  return `HTTP ${res.status}`
}

