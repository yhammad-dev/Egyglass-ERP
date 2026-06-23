"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  checked,
  onCheckedChange,
  id,
  ...props
}: {
  className?: string
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  id?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      id={id}
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-sm border border-input bg-transparent transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        checked && "bg-primary border-primary",
        className
      )}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      {checked && (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="size-3 mx-auto text-primary-foreground"
        >
          <path
            d="M4 8L7 11L12 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  )
}

export { Checkbox }
