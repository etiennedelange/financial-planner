"use client"

import { animate, motion, useMotionValue, useTransform } from "motion/react"
import { useEffect } from "react"

// Smooth animated finance chart — rising line + pulsing dot + floating bars
export function FinanceAnimation() {
  // Animate the SVG path length for the rising line
  const pathLength = useMotionValue(0)
  const opacity = useTransform(pathLength, [0, 0.1], [0, 1])

  useEffect(() => {
    const controls = animate(pathLength, [0, 1, 1, 0], {
      duration: 3.2,
      repeat: Infinity,
      repeatDelay: 0.8,
      ease: ["easeInOut", "linear", "easeInOut"],
      times: [0, 0.55, 0.85, 1],
    })
    return controls.stop
  }, [pathLength])

  return (
    <svg
      width="64"
      height="52"
      viewBox="0 0 64 52"
      fill="none"
      className="overflow-visible"
      aria-hidden
    >
      {/* Background bars — staggered grow-up animation */}
      {[
        { x: 4,  h: 20, delay: 0 },
        { x: 16, h: 30, delay: 0.15 },
        { x: 28, h: 22, delay: 0.3 },
        { x: 40, h: 38, delay: 0.45 },
        { x: 52, h: 46, delay: 0.6 },
      ].map(({ x, h, delay }) => (
        <motion.rect
          key={x}
          x={x}
          y={52 - h}
          width={8}
          height={h}
          rx={2}
          className="fill-primary/20"
          initial={{ scaleY: 0, originY: 1 }}
          animate={{ scaleY: [0, 1, 1, 0] }}
          transition={{
            duration: 3.2,
            repeat: Infinity,
            repeatDelay: 0.8,
            delay,
            ease: "easeOut",
            times: [0, 0.45, 0.85, 1],
          }}
          style={{ transformOrigin: `${x + 4}px 52px` }}
        />
      ))}

      {/* Rising trend line */}
      <motion.path
        d="M 4 44 C 16 40, 20 28, 32 22 S 50 8, 60 4"
        className="stroke-primary"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        style={{ pathLength, opacity }}
      />

      {/* Pulsing dot at the tip */}
      <motion.circle
        cx="60"
        cy="4"
        r="3.5"
        className="fill-primary"
        animate={{
          scale: [1, 1.6, 1],
          opacity: [1, 0.4, 1],
        }}
        transition={{
          duration: 1.4,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.8,
        }}
        style={{ opacity }}
      />
    </svg>
  )
}
