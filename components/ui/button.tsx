import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-rose-500 via-fuchsia-500 to-purple-600 text-white shadow-lg shadow-rose-500/25 hover:from-rose-400 hover:to-purple-500 hover:shadow-rose-500/40 hover:scale-[1.02] active:scale-[0.98]",
        secondary:
          "border backdrop-blur-sm hover:scale-[1.02] active:scale-[0.98] [background:var(--surface)] [border-color:var(--border)] [color:var(--text-muted)] hover:[background:var(--surface-hover)]",
        ghost: "hover:bg-[var(--surface)] [color:var(--text-muted)] hover:[color:var(--text)]",
        destructive: "bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25",
        success:
          "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-400 hover:scale-[1.02] active:scale-[0.98]",
        outline:
          "border [border-color:var(--border)] bg-transparent [color:var(--text)] hover:[background:var(--surface)] hover:scale-[1.02] active:scale-[0.98]",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 sm:h-13 px-6 sm:px-8 text-base",
        xl: "h-14 px-10 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)

Button.displayName = "Button"

export { Button, buttonVariants }
