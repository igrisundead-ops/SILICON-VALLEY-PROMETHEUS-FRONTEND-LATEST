import type { BillingPlanId } from '@/lib/billing'

export type BillingPlanDefinition = {
  id: BillingPlanId
  name: string
  priceWhole: string
  priceFraction: string
  monthlyLabel: string
  creditsLabel: string
  accent: string
  ctaLabel: string
  featured?: boolean
  contactOnly?: boolean
  features: Array<{
    label: string
    emphasized?: boolean
    hint?: string
  }>
}

export const BILLING_PLAN_ORDER: BillingPlanId[] = ['creator', 'studio', 'cinema']

export const BILLING_PLAN_DEFINITIONS: Record<BillingPlanId, BillingPlanDefinition> = {
  creator: {
    id: 'creator',
    name: 'Creator',
    priceWhole: '$997',
    priceFraction: '.99',
    monthlyLabel: '/ mo',
    creditsLabel: '400 Credits / month',
    accent: 'from-[#1f7fff] via-[#3b9bff] to-[#77bcff]',
    ctaLabel: 'Get Started ($997/month)',
    features: [
      { label: 'AI-powered premium video editing tasks', emphasized: true },
      { label: 'Cinematic motion graphics automation tasks', emphasized: true },
      { label: 'Intelligent short-form repurposing tasks', emphasized: true },
      { label: 'Unlimited draft previews tasks', emphasized: true },
    ],
  },
  studio: {
    id: 'studio',
    name: 'Studio',
    priceWhole: '$2,500',
    priceFraction: '.99',
    monthlyLabel: '/ mo',
    creditsLabel: '5,000 Credits (everything in creator +)',
    accent: 'from-[#2a8cff] via-[#47a6ff] to-[#8ec8ff]',
    ctaLabel: 'Get Started ($2,500/month)',
    featured: true,
    features: [
      { label: 'Multi-brand workspace', hint: 'Separate client work inside one account.' },
      { label: 'Advanced motion graphics engine', hint: 'Expanded render and animation control.' },
      { label: 'Custom visual style presets', hint: 'Reusable looks for repeatable output.' },
      { label: 'Priority support', hint: 'Faster turnaround on operational issues.' },
    ],
  },
  cinema: {
    id: 'cinema',
    name: 'Cinema',
    priceWhole: '$5,000',
    priceFraction: '.99',
    monthlyLabel: '/ mo',
    creditsLabel: '30,000 Credits (everything in Studio +)',
    accent: 'from-[#2f92ff] via-[#56acff] to-[#8ec7ff]',
    ctaLabel: 'Contact Us',
    contactOnly: true,
    features: [
      { label: 'High-end video ad campaign generation', hint: 'Built for premium campaigns and launch volume.' },
      { label: 'Apple-style cinematic commercial production', hint: 'Designed for polished flagship storytelling.' },
      { label: 'White-glove onboarding', hint: 'Hands-on setup and implementation guidance.' },
      { label: 'Private implementation support', hint: 'Closer technical collaboration for custom workflows.' },
    ],
  },
}

export function isBillingPlanId(value: unknown): value is BillingPlanId {
  return value === 'creator' || value === 'studio' || value === 'cinema'
}

export function getBillingPlanDefinition(planId: BillingPlanId) {
  return BILLING_PLAN_DEFINITIONS[planId]
}
