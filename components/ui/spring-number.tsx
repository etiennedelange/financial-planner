"use client"

import { useEffect, useState } from "react"
import { useMotionValue, useSpring, useMotionValueEvent, useReducedMotion } from "motion/react"

interface SpringNumberProps {
  value: number
  format: (value: number) => string
  className?: string
}

/**
 * Renders a number that eases toward `value` with spring physics whenever it changes,
 * instead of snapping. Critically damped (no overshoot) to read as precise, not playful.
 */
export function SpringNumber({ value, format, className }: SpringNumberProps) {
  const prefersReducedMotion = useReducedMotion()
  const motionValue = useMotionValue(value)
  const spring = useSpring(motionValue, { stiffness: 140, damping: 26, mass: 0.5 })
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    motionValue.set(value)
    if (prefersReducedMotion) setDisplay(value)
  }, [value, motionValue, prefersReducedMotion])

  useMotionValueEvent(spring, "change", (latest) => {
    if (!prefersReducedMotion) setDisplay(latest)
  })

  return <span className={className}>{format(display)}</span>
}
