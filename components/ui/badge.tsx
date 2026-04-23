import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[--color-ring] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary-100 text-primary-700",
        secondary:
          "border-transparent bg-slate-100 text-slate-600",
        destructive:
          "border-transparent bg-red-100 text-red-700",
        outline:
          "border-[--color-border] text-slate-600 bg-transparent",
        success:
          "border-transparent bg-emerald-100 text-emerald-700",
        warning:
          "border-transparent bg-amber-100 text-amber-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, style, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant }), className)}
      style={style}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
export type { BadgeProps };
