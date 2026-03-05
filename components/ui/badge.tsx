import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all",
  {
    variants: {
      variant: {
        default: "bg-rose-500/15 text-rose-400 border border-rose-500/25",
        secondary: "border [background:var(--surface-hover)] [color:var(--text-muted)] [border-color:var(--border)]",
        success: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
        destructive: "bg-red-500/15 text-red-400 border border-red-500/25",
        warning: "bg-amber-500/15 text-amber-400 border border-amber-500/25",
        info: "bg-sky-500/15 text-sky-400 border border-sky-500/25",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
