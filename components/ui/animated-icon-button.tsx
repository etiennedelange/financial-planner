"use client"

import { Button, type ButtonProps } from "@/components/ui/button"
import {
  useAnimatedIcon,
  type AnimatedIconComponent,
} from "@/components/ui/animated-icon"

export interface AnimatedIconButtonProps extends Omit<ButtonProps, "children"> {
  icon: AnimatedIconComponent
  iconSize?: number
  iconClassName?: string
  iconAriaHidden?: boolean
}

/**
 * Icon-only Button that drives an @animateicons/react icon from the button's
 * hover and focus states.
 */
export function AnimatedIconButton({
  icon: Icon,
  iconSize = 14,
  iconClassName,
  iconAriaHidden,
  ...props
}: AnimatedIconButtonProps) {
  const { iconProps, controlProps } = useAnimatedIcon()

  return (
    <Button {...controlProps} {...props}>
      <Icon
        {...iconProps}
        size={iconSize}
        className={iconClassName}
        aria-hidden={iconAriaHidden || undefined}
      />
    </Button>
  )
}