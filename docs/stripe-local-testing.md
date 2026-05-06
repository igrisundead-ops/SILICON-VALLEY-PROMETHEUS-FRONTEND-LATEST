# Stripe Local Testing

This project uses Stripe-hosted Checkout for subscriptions.

## Requirements

- Node.js and npm
- A Stripe account in test mode
- Stripe CLI installed and logged in
- Supabase env vars already working for local auth

## Env vars

Add these to `.env.local`:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CREATOR_PRICE_ID=price_...
STRIPE_STUDIO_PRICE_ID=price_...
STRIPE_CINEMA_PRICE_ID=price_...
```

Notes:

- `STRIPE_SECRET_KEY` comes from `Stripe Dashboard -> Developers -> API keys`
- `STRIPE_WEBHOOK_SECRET` comes from `stripe listen` or a configured webhook endpoint in the Stripe Dashboard
- Price IDs come from `Stripe Dashboard -> Product catalog -> open product -> copy price id`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is not required for the current hosted Checkout flow

## Install the Stripe CLI

Install the Stripe CLI from:

`https://docs.stripe.com/stripe-cli`

Then log in:

```bash
stripe login
```

## Start the app

```bash
npm install
npm run dev
```

This app usually starts on `http://localhost:3000`.
If port `3000` is busy, Next.js may move to `3001`.

## Forward webhooks locally

If the app is on port `3000`:

```bash
npm run stripe:listen:3000
```

If the app is on port `3001`:

```bash
npm run stripe:listen:3001
```

Stripe CLI will print a webhook signing secret:

```bash
Ready! Your webhook signing secret is whsec_...
```

Copy that value into `.env.local` as `STRIPE_WEBHOOK_SECRET`, then restart the dev server.

## Trigger test events

```bash
npm run stripe:trigger:checkout
npm run stripe:trigger:invoice-paid
npm run stripe:trigger:invoice-failed
```

These are useful for confirming the webhook route receives events.

## Real checkout flow test

1. Sign in locally.
2. Open `/settings/billing`.
3. Click a paid plan.
4. Complete checkout in Stripe test mode.
5. Watch the Stripe CLI output and the Next.js server logs.
6. Confirm you land on `/settings/billing/success`.

## Recommended Stripe test card

Use Stripe's standard Visa test card:

```text
4242 4242 4242 4242
```

Use any future expiry date, any 3-digit CVC, and any valid postal code.

## Current limitation

The app currently mirrors successful checkout into local browser billing state for testing. The production-safe next step is persisting subscription state from the webhook into your database and checking billing access from the server.
