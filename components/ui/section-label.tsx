import { cn } from "@/lib/utils"

interface SectionLabelProps {
  /** "destructive" swaps the accent to red — use for danger/warning sections. */
  variant?: "default" | "destructive"
  className?: string
  children: React.ReactNode
}

/**
 * Canonical section header label — mono uppercase, muted by default.
 *
 * Use this instead of writing the raw Tailwind string. For full card sections
 * prefer PageCard, which composes SectionLabel automatically. Reserve the
 * destructive (red) variant for genuine danger-zone sections — the default
 * variant carries no accent color so gold stays scarce for primary actions.
 */
export function SectionLabel({ variant = "default", className, children }: SectionLabelProps) {
  return (
    <p
      className={cn(
        "text-[10px] font-mono uppercase tracking-widest",
        variant === "destructive"
          ? "text-destructive border-l-2 border-destructive pl-2"
          : "text-muted-foreground",
        className
      )}
    >
      {children}
    </p>
  )
}
