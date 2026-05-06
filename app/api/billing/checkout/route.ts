import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { normalizeNextPath } from '@/lib/auth/redirect'
import { BILLING_DASHBOARD_PATH } from '@/lib/billing'
import { getBillingPlanDefinition, isBillingPlanId } from '@/lib/billing-plans'
import { createClient } from '@/lib/supabase/server'
import { getStripeClient, getStripePriceEnvName, getStripePriceId } from '@/lib/stripe'

const checkoutRequestSchema = z.object({
  planId: z.string(),
  nextPath: z.string().nullish(),
})

export async function POST(request: Request) {
  try {
    const payload = checkoutRequestSchema.parse(await request.json())

    if (!isBillingPlanId(payload.planId)) {
      return NextResponse.json({ error: 'Unknown billing plan.' }, { status: 400 })
    }

    const plan = getBillingPlanDefinition(payload.planId)

    if (plan.contactOnly) {
      return NextResponse.json({ error: `${plan.name} is still handled through sales.` }, { status: 400 })
    }

    const priceId = getStripePriceId(payload.planId)

    if (!priceId) {
      return NextResponse.json(
        {
          error: `Stripe is not fully configured yet. Add ${getStripePriceEnvName(payload.planId)} to .env.local.`,
        },
        { status: 400 },
      )
    }

    if (!priceId.startsWith('price_')) {
      return NextResponse.json(
        {
          error: `${getStripePriceEnvName(payload.planId)} must be a Stripe Price ID that starts with price_, not a Product ID.`,
        },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user?.id || !user.email) {
      return NextResponse.json({ error: 'Please sign in before starting checkout.' }, { status: 401 })
    }

    // Use a more robust origin detection for proxies and local dev
    const headersList = await headers()
    const host = headersList.get('host') || new URL(request.url).host
    const proto = headersList.get('x-forwarded-proto') || 'http'
    const origin = `${proto}://${host}`

    const nextPath = normalizeNextPath(payload.nextPath, '/')
    const cancelUrl = new URL(BILLING_DASHBOARD_PATH, origin)
    const successUrl = new URL('/settings/billing/success', origin)

    if (nextPath !== '/') {
      cancelUrl.searchParams.set('next', nextPath)
      successUrl.searchParams.set('next', nextPath)
    }

    successUrl.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}')

    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: user.id,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      // Explicitly disable managed_payments for the 2026-04-22.dahlia version
      // unless specifically configured in the Stripe Dashboard.
      managed_payments: { enabled: false },
      metadata: {
        planId: payload.planId,
        userId: user.id,
        nextPath,
      },
      subscription_data: {
        metadata: {
          planId: payload.planId,
          userId: user.id,
          nextPath,
        },
      },
    })

    if (!session.url) {
      throw new Error('Stripe did not return a hosted checkout URL.')
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[stripe checkout error]', error)
    const message = error instanceof Error ? error.message : 'Failed to start Stripe checkout.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
