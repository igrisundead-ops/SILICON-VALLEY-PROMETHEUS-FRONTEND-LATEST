export function isBrowser() {
  return typeof window !== 'undefined'
}

export function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export function readLocalStorageJSON<T>(key: string): T | null {
  if (!isBrowser()) return null
  return safeJsonParse<T>(window.localStorage.getItem(key))
}

export function writeLocalStorageJSON<T>(key: string, value: T): void {
  if (!isBrowser()) return
  window.localStorage.setItem(key, JSON.stringify(value))
}

