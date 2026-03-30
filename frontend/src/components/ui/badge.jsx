import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400/60 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-slate-900 text-white hover:bg-slate-800",
        secondary:
          "border-transparent bg-emerald-500 text-white hover:bg-emerald-600",
        destructive:
          "border-transparent bg-rose-500 text-white hover:bg-rose-600",
        outline: "text-slate-700 border-slate-300 bg-white/80",
        /** Status chips for tables — soft fills, readable on white */
        statusSuccess:
          "border-emerald-200/90 bg-emerald-50 text-emerald-900 font-semibold",
        statusWarning:
          "border-amber-200/90 bg-amber-50 text-amber-900 font-semibold",
        statusDanger:
          "border-rose-200/90 bg-rose-50 text-rose-900 font-semibold",
        statusNeutral:
          "border-slate-200/90 bg-slate-100 text-slate-700 font-semibold",
        statusInfo:
          "border-sky-200/90 bg-sky-50 text-sky-900 font-semibold",
        statusMuted:
          "border-slate-200/80 bg-slate-50 text-slate-600 font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
