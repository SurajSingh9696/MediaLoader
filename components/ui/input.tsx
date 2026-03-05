import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-xl px-4 py-2 text-base placeholder:opacity-40 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500/50 disabled:cursor-not-allowed disabled:opacity-50 backdrop-blur-sm",
          className
        )}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          color: "var(--text)",
        }}
        ref={ref}
        {...props}
      />
    )
  }
)

Input.displayName = "Input"

export { Input }
