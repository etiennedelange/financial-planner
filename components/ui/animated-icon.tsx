"use client"

import { useReducedMotion } from "motion/react"
import { useRef } from "react"
import type { HTMLAttributes, Ref } from "react"

/**
 * Imperative handle exposed by every @animateicons/react icon.
 * Attach it via `iconProps.ref` to drive the icon's path-level
 * animation from the surrounding control.
 */
interface AnimatedIconHandle {
  startAnimation: () => void
  stopAnimation: () => void
}

type AnimatedIconProps = HTMLAttributes<HTMLDivElement> & {
  size?: number
  duration?: number
  isAnimated?: boolean
  color?: string
}

export type AnimatedIconComponent = React.ComponentType<
  AnimatedIconProps & { ref?: Ref<AnimatedIconHandle> }
>

/**
 * Wires an @animateicons/react icon's imperative animation handle to its
 * control's hover and focus states, so the whole control — not just the icon
 * box — triggers the motion.
 *
 * ```
 * const { iconProps, controlProps } = useAnimatedIcon()
 * <Link {...controlProps} ...>
 *   <WalletIcon {...iconProps} size={16} />
 * </Link>
 * ```
 */
export function useAnimatedIcon() {
  const ref = useRef<AnimatedIconHandle>(null)
  const reduceMotion = useReducedMotion()

  const start = () => {
    if (reduceMotion) return
    ref.current?.startAnimation()
  }
  const stop = () => {
    if (reduceMotion) return
    ref.current?.stopAnimation()
  }

  return {
    iconProps: { ref } as { ref: Ref<AnimatedIconHandle> },
    controlProps: {
      onMouseEnter: start,
      onMouseLeave: stop,
      onFocus: start,
      onBlur: stop,
    },
  }
}