"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-[--color-border] bg-white px-3 py-1 text-sm text-[--color-foreground] shadow-sm",
          "placeholder:text-[--color-muted-foreground]",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-ring] focus-visible:ring-offset-0 focus-visible:border-primary-500",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[--color-foreground]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
export type { InputProps };
