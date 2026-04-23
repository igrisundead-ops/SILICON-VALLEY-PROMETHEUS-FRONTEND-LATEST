'use client'

import * as React from 'react'
import { useReducedMotion } from 'framer-motion'

export function useStableReducedMotion() {
  const prefersReducedMotion = useReducedMotion() ?? false
  const [hasMounted, setHasMounted] = React.useState(false)

  React.useEffect(() => {
    setHasMounted(true)
  }, [])

  return hasMounted ? prefersReducedMotion : true
}
