import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border border-white/8 bg-white/3 px-3 py-1.5 text-sm transition-all outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[#949ba4] focus-visible:border-white/40 focus-visible:ring-2 focus-visible:ring-white/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 text-foreground font-mono",
        className
      )}
      {...props}
    />
  )
}

export { Input }
