"use client";

export function Toggle({
  checked,
  onChange,
  label,
  description,
  icon,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-2xl bg-surface-2/60 p-3 text-left transition hover:bg-surface-2 disabled:opacity-50"
    >
      {icon && <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface text-brand">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-fg">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
      <span
        className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${checked ? "bg-brand" : "bg-black/15 dark:bg-white/15"}`}
      >
        <span
          className={`absolute top-[2px] size-[27px] rounded-full bg-white shadow-md transition-transform duration-200 ${checked ? "translate-x-[22px]" : "translate-x-[2px]"}`}
        />
      </span>
    </button>
  );
}

export function Chips<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string; swatch?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition active:scale-95 ${
            value === o.id ? "bg-brand text-[#04230f]" : "bg-surface-2 text-fg hover:brightness-110"
          }`}
        >
          {o.swatch && <span className="size-4 rounded-full ring-1 ring-black/10" style={{ background: o.swatch }} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}
