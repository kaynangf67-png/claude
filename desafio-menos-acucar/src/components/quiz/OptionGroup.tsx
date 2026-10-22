"use client";

import { Check } from "lucide-react";
import type { QuizOption } from "@/domain/quiz";
import { cn } from "@/lib/cn";

interface Props {
  name: string;
  labelledBy: string;
  describedBy?: string;
  options: QuizOption[];
  multiple: boolean;
  max?: number;
  value: string[];
  onChange: (value: string[]) => void;
  invalid?: boolean;
}

/**
 * Grupo de opções com inputs nativos (radio/checkbox) escondidos visualmente:
 * teclado, leitor de tela e setas funcionam como o navegador espera.
 */
export function OptionGroup({ name, labelledBy, describedBy, options, multiple, max, value, onChange, invalid }: Props) {
  const atMax = multiple && max !== undefined && value.length >= max;

  function toggle(v: string) {
    if (!multiple) return onChange([v]);
    if (value.includes(v)) return onChange(value.filter((x) => x !== v));
    if (atMax) return;
    onChange([...value, v]);
  }

  return (
    <div
      role={multiple ? "group" : "radiogroup"}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className="grid gap-2.5"
    >
      {options.map((opt) => {
        const selected = value.includes(opt.value);
        const disabled = !selected && atMax;
        const id = `${name}-${opt.value}`;
        return (
          <label
            key={opt.value}
            htmlFor={id}
            className={cn(
              "group relative flex cursor-pointer items-start gap-3.5 rounded-xl border bg-white px-4 py-3.5 transition-[border-color,background-color,box-shadow] duration-150",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-forest has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-paper",
              selected ? "border-forest bg-fresh-50 shadow-[inset_0_0_0_1px_var(--color-forest)]" : "border-line hover:border-forest/35",
              disabled && "cursor-not-allowed opacity-50 hover:border-line",
            )}
          >
            <input
              id={id}
              type={multiple ? "checkbox" : "radio"}
              name={name}
              value={opt.value}
              checked={selected}
              disabled={disabled}
              onChange={() => toggle(opt.value)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={cn(
                "mt-0.5 grid size-5 shrink-0 place-items-center border transition-colors",
                multiple ? "rounded-md" : "rounded-full",
                selected ? "border-forest bg-forest text-paper" : "border-sand-200 bg-white",
              )}
            >
              {selected && (multiple ? <Check className="size-3.5" strokeWidth={3} /> : <span className="size-2 rounded-full bg-paper" />)}
            </span>
            <span className="min-w-0">
              <span className={cn("block leading-snug font-semibold", selected ? "text-forest-900" : "text-ink")}>{opt.label}</span>
              {opt.hint && <span className="mt-0.5 block text-sm leading-snug text-muted">{opt.hint}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}
