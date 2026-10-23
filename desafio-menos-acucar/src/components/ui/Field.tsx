import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

interface FieldProps extends ComponentProps<"input"> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, className, id, ...rest }: FieldProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  const describedBy = [error && `${fieldId}-erro`, hint && `${fieldId}-dica`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-12 w-full rounded-lg border bg-white px-3.5 text-base text-ink placeholder:text-muted/70 transition-colors",
          "focus:border-forest focus:ring-2 focus:ring-forest/15 focus:outline-none",
          error ? "border-danger/60" : "border-line hover:border-sand-200",
        )}
        {...rest}
      />
      {hint && !error && (
        <p id={`${fieldId}-dica`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${fieldId}-erro`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextArea({ label, error, hint, className, id, ...rest }: Omit<ComponentProps<"textarea">, "children"> & { label: string; error?: string; hint?: string }) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      <textarea
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-erro` : hint ? `${fieldId}-dica` : undefined}
        className={cn(
          "min-h-28 w-full resize-y rounded-lg border bg-white px-3.5 py-3 text-base leading-relaxed text-ink placeholder:text-muted/70",
          "focus:border-forest focus:ring-2 focus:ring-forest/15 focus:outline-none",
          error ? "border-danger/60" : "border-line",
        )}
        {...rest}
      />
      {hint && !error && (
        <p id={`${fieldId}-dica`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${fieldId}-erro`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  error,
  className,
  name,
}: {
  label: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string;
  className?: string;
  name: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-ink">
        <input
          id={id}
          name={name}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-erro` : undefined}
          className="mt-0.5 size-5 shrink-0 cursor-pointer rounded border-line accent-[var(--color-forest)]"
        />
        <span>{label}</span>
      </label>
      {error && (
        <p id={`${id}-erro`} className="mt-1.5 pl-8 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
