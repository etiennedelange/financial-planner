"use client"

import { motion, useReducedMotion } from "motion/react"

interface AnimatedValueProps {
  value: number | string
  format?: (value: number) => React.ReactNode
  className?: string
  duration?: number
}

/**
 * Displays a value with smooth entrance/exit animation.
 * Particularly useful for derived calculations that update when inputs change.
 */
export function AnimatedValue({
  value,
  format,
  className = "",
  duration = 0.2,
}: AnimatedValueProps) {
  const shouldReduceMotion = useReducedMotion()
  const numValue = typeof value === "number" ? value : parseFloat(value)

  return (
    <motion.span
      key={String(value)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: shouldReduceMotion ? 0 : duration,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
    >
      {format ? format(numValue) : value}
    </motion.span>
  )
}
