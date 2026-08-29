"use client"

import { motion, useReducedMotion } from "motion/react"
import { SpringNumber } from "@/components/ui/spring-number"

interface RollingValueProps {
  value: number
  format: (value: number) => string
  className?: string
  /**
   * Value to start from on first appearance. Defaults to `value` — the number
   * fades in already settled. Pass `0` to count up from zero: the one earned
   * count-up in the app, the Monte Carlo verdict.
   */
  initial?: number
}

/**
 * A number that fades in on first appearance, then rolls between values with
 * the tool's critically damped spring (precise, never bouncy). With `initial`
 * set, the first appearance counts up from that value instead — the dial
 * sweeping to its reading.
 */
export function RollingValue({ value, format, className, initial }: RollingValueProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      <SpringNumber value={value} format={format} initial={initial} />
    </motion.span>
  )
}