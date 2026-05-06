import 'server-only'

import Stripe from 'stripe'

import type { BillingPlanId } from '@/lib/billing'

const STRIPE_API_VERSION = '2026-04-22.dahlia' as const

const STRIPE_PRICE_ID_ENV_NAMES: Record<BillingPlanId, string> = {
  creator: 'STRIPE_CREATOR_PRICE_ID',
  studio: 'STRIPE_STUDIO_PRICE_ID',
  cinema: 'STRIPE_CINEMA_PRICE_ID',
}

let stripeClient: Stripe | null = null

function cleanEnvValue(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function getStripeClient() {
  const secretKey = cleanEnvValue(process.env.STRIPE_SECRET_KEY)

  if (!secretKey) {
    throw new Error('Stripe is not configured. Add STRIPE_SECRET_KEY to .env.local.')
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: STRIPE_API_VERSION,
    })
  }

  return stripeClient
}

export function getStripePriceEnvName(planId: BillingPlanId) {
  return STRIPE_PRICE_ID_ENV_NAMES[planId]
}

export function getStripePriceId(planId: BillingPlanId) {
  return cleanEnvValue(process.env[getStripePriceEnvName(planId)]) ?? null
}

export function getStripeWebhookSecret() {
  const webhookSecret = cleanEnvValue(process.env.STRIPE_WEBHOOK_SECRET)

  if (!webhookSecret) {
    throw new Error('Stripe webhook is not configured. Add STRIPE_WEBHOOK_SECRET to .env.local.')
  }

  return webhookSecret
}
