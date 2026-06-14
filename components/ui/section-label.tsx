import { cn } from "@/lib/utils"

interface SectionLabelProps {
  /** "destructive" swaps the accent to red — use for danger/warning sections. */
  variant?: "default" | "destructive"
  className?: string
  children: React.ReactNode
}

/**
 * Canonical section header label — mono uppercase with a gold left-border accent.
 *
 * Use this instead of writing the raw Tailwind string. For full card sections
 * prefer PageCard, which composes SectionLabel automatically.
 */
export function SectionLabel({ variant = "default", className, children }: SectionLabelProps) {
  return (
    <p
      className={cn(
        "text-[10px] font-mono uppercase tracking-widest",
        variant === "destructive"
          ? "text-destructive border-l-2 border-destructive pl-2"
          : "text-muted-foreground border-l-2 border-primary pl-2",
        className
      )}
    >
      {children}
    </p>
  )
}
