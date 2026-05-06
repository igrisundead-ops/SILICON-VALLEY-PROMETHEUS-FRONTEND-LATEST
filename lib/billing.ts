import { readLocalStorageJSON, writeLocalStorageJSON } from '@/lib/storage'

export type BillingPlanId = 'creator' | 'studio' | 'cinema'

export type BillingAccessState = {
  status: 'inactive' | 'active'
  planId: BillingPlanId | null
  activatedAt: string | null
  source: 'demo' | 'external' | null
}

export const BILLING_STORAGE_KEY = 'prometheus.billing-access.v1'
export const BILLING_DASHBOARD_PATH = '/settings/billing'

export const DEFAULT_BILLING_ACCESS_STATE: BillingAccessState = {
  status: 'inactive',
  planId: null,
  activatedAt: null,
  source: null,
}

export function readBillingAccessState(): BillingAccessState {
  const stored = readLocalStorageJSON<Partial<BillingAccessState>>(BILLING_STORAGE_KEY)
  if (!stored || typeof stored !== 'object') return DEFAULT_BILLING_ACCESS_STATE

  return {
    status: stored.status === 'active' ? 'active' : 'inactive',
    planId: stored.planId === 'creator' || stored.planId === 'studio' || stored.planId === 'cinema' ? stored.planId : null,
    activatedAt: typeof stored.activatedAt === 'string' ? stored.activatedAt : null,
    source: stored.source === 'demo' || stored.source === 'external' ? stored.source : null,
  }
}

export function hasBillingAccess() {
  return readBillingAccessState().status === 'active'
}

export function setBillingAccess(planId: BillingPlanId, source: BillingAccessState['source'] = 'demo') {
  writeLocalStorageJSON<BillingAccessState>(BILLING_STORAGE_KEY, {
    status: 'active',
    planId,
    activatedAt: new Date().toISOString(),
    source,
  })
}

export function clearBillingAccess() {
  writeLocalStorageJSON<BillingAccessState>(BILLING_STORAGE_KEY, DEFAULT_BILLING_ACCESS_STATE)
}

export function buildBillingHref(nextPath?: string | null) {
  if (!nextPath) return BILLING_DASHBOARD_PATH
  return `${BILLING_DASHBOARD_PATH}?next=${encodeURIComponent(nextPath)}`
}
