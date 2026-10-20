import { forwardRef, type ButtonHTMLAttributes } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-accent text-white hover:bg-accent-strong border border-transparent",
  secondary: "bg-surface-2 text-fg border border-border-strong hover:bg-elevated",
  ghost: "bg-transparent text-muted hover:text-fg hover:bg-surface-2 border border-transparent",
  danger: "bg-danger/10 text-red-300 border border-danger/40 hover:bg-danger/20",
} as const;
const sizes = { sm: "h-8 px-3 text-xs", md: "h-9 px-4 text-sm", lg: "h-11 px-5 text-sm" } as const;

export type ButtonVariant = keyof typeof variants;
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: keyof typeof sizes };

export function buttonClass(variant: ButtonVariant = "primary", size: keyof typeof sizes = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap",
    variants[variant],
    sizes[size],
    extra,
  );
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button({ variant = "primary", size = "md", className, ...props }, ref) {
  return <button ref={ref} className={buttonClass(variant, size, className)} {...props} />;
});

export function LinkButton({ href, variant = "primary", size = "md", className, children }: { href: string; variant?: ButtonVariant; size?: keyof typeof sizes; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}
