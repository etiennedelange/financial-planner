"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"

interface FieldErrorProps {
  message?: string
}

/** Validation error message that fades/slides in rather than popping in abruptly. */
export function FieldError({ message }: FieldErrorProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          key={message}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="text-sm text-destructive"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  )
}
