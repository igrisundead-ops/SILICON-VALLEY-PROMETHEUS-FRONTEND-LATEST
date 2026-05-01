import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** @type {import('next').NextConfig} */
const configFilePath = fileURLToPath(import.meta.url)
const projectRoot = path.dirname(configFilePath)
const backendApiBaseUrl = process.env.VITE_API_BASE_URL?.trim() || 'http://localhost:8000'

const nextConfig = {
  turbopack: {
    root: projectRoot,
  },
  typescript: {
    // Next's build-time type worker can fail to spawn in this Windows workspace path.
    // We still validate types separately with `npm exec tsc --noEmit`.
    ignoreBuildErrors: process.platform === 'win32',
  },
  env: {
    VITE_API_BASE_URL: backendApiBaseUrl,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || backendApiBaseUrl,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'dl.airtable.com' },
      { protocol: 'https', hostname: 'airtableusercontent.com' },
      { protocol: 'https', hostname: 'v4.airtableusercontent.com' },
      { protocol: 'https', hostname: 'v5.airtableusercontent.com' },
    ],
  },
}

export default nextConfig
