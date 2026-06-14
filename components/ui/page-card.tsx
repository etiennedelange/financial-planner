import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { SectionLabel } from "@/components/ui/section-label"
import { cn } from "@/lib/utils"

interface PageCardProps extends Omit<React.ComponentProps<"div">, "children"> {
  label: string
  /** "destructive" flips the accent to red — use for Danger Zone style sections. */
  labelVariant?: "default" | "destructive"
  /**
   * Short description rendered below the label in muted text.
   * Accepts ReactNode so you can include <strong> or other inline markup.
   */
  description?: ReactNode
  /** Small element prepended to the label row — typically a 16px icon. */
  leading?: ReactNode
  /** Element appended to the label row — typically an InfoTooltip. */
  trailing?: ReactNode
  /**
   * Extra classes forwarded to the outer Card.
   * Use for border overrides (e.g. border-destructive/40) and background tints.
   */
  className?: string
  /**
   * Extra classes forwarded to CardContent.
   * Use space-y-* to control the gap between the label header and your content.
   */
  contentClassName?: string
  children?: ReactNode
}

/**
 * Standard section card — shadow-none Card with a built-in SectionLabel header.
 *
 * Use this for every new card instead of Card + CardHeader + CardTitle.
 *
 * ```tsx
 * // Minimal
 * <PageCard label="Personal Information" contentClassName="space-y-4">
 *   <Input ... />
 * </PageCard>
 *
 * // With description + icon + tooltip (Insights-style)
 * <PageCard
 *   label="Optimal Contribution"
 *   description="The minimum monthly contribution needed."
 *   leading={<Target className="h-4 w-4 text-primary" />}
 *   trailing={<InfoTooltip content="..." />}
 *   contentClassName="space-y-3"
 * >
 *   ...
 * </PageCard>
 *
 * // Danger zone (red accent)
 * <PageCard label="Danger Zone" labelVariant="destructive" className="border-destructive/40" contentClassName="space-y-3">
 *   ...
 * </PageCard>
 * ```
 *
 * For chart cards that need a separate CardContent with custom padding,
 * use SectionLabel directly rather than PageCard.
 */
export function PageCard({
  label,
  labelVariant = "default",
  description,
  leading,
  trailing,
  className,
  contentClassName,
  children,
  ...props
}: PageCardProps) {
  return (
    <Card className={cn("shadow-none", className)} {...props}>
      <CardContent className={cn("pt-6", contentClassName)}>
        {/* w-full ensures left-alignment even inside flex-col/items-center parents */}
        <div className="w-full">
          <div className="flex items-center gap-2">
            {leading}
            <SectionLabel variant={labelVariant}>{label}</SectionLabel>
            {trailing}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground mt-1 pl-3">{description}</p>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}
