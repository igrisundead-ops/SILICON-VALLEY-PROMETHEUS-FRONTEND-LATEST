import 'server-only'

import { XANO_BASE } from './config'

type XanoFetchOptions = Omit<RequestInit, 'body' | 'headers'> & {
  body?: unknown
  headers?: Record<string, string>
}

export async function xanoFetch<T>(
  pathOrUrl: string,
  options: XanoFetchOptions = {},
  token?: string
): Promise<T> {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${XANO_BASE}${pathOrUrl}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  }

  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, {
    ...options,
    cache: 'no-store',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  const text = await res.text()
  const data = text ? safeJsonParse(text) : null

  if (!res.ok) {
    const errorPayload = {
      status: res.status,
      statusText: res.statusText,
      url,
      response: data,
    }
    throw new Error(`[XANO] ${res.status} ${res.statusText} ${url} :: ${safeStringify(errorPayload)}`)
  }

  return data as T
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
