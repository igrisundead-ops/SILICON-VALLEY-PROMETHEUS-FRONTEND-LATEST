import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

import { getStripeClient, getStripeWebhookSecret } from '@/lib/stripe'

export async function POST(request: Request) {
  try {
    const signature = (await headers()).get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 })
    }

    const stripe = getStripeClient()
    const payload = await request.text()
    const event = stripe.webhooks.constructEvent(payload, signature, getStripeWebhookSecret())

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        console.info('[stripe webhook] checkout.session.completed', {
          sessionId: session.id,
          userId: session.metadata?.userId ?? session.client_reference_id ?? null,
          planId: session.metadata?.planId ?? null,
          subscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
        })
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'invoice.paid':
      case 'invoice.payment_failed':
        console.info('[stripe webhook] event received', { type: event.type, eventId: event.id })
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe webhook failed.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
