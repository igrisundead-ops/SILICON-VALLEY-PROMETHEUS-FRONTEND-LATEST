import { NextResponse } from 'next/server'

import { isBillingPlanId } from '@/lib/billing-plans'
import { getStripeClient } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')?.trim()

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session_id.' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user?.id) {
      return NextResponse.json({ error: 'Please sign in before checking Stripe status.' }, { status: 401 })
    }

    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const ownerUserId = session.metadata?.userId ?? session.client_reference_id

    if (!ownerUserId || ownerUserId !== user.id) {
      return NextResponse.json({ error: 'This checkout session does not belong to the current user.' }, { status: 403 })
    }

    const rawPlanId = session.metadata?.planId
    const planId = isBillingPlanId(rawPlanId) ? rawPlanId : null
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription && 'id' in session.subscription
          ? session.subscription.id
          : null

    return NextResponse.json({
      id: session.id,
      status: session.status,
      paymentStatus: session.payment_status,
      planId,
      customerEmail: session.customer_details?.email ?? session.customer_email ?? user.email ?? null,
      subscriptionId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load Stripe session.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
