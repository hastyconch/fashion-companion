"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ItemDetail } from "@/lib/items/queries";
import {
  CATEGORIES,
  CATEGORY_SINGULAR,
  COLORS,
  COLOR_NAMES,
  FORMALITY_LABELS,
  LIMITS,
  PATTERNS,
  SEASONS,
  WARMTH_LABELS,
  type Color,
} from "@/lib/items/vocabulary";
import { cn } from "@/lib/utils";
import { saveItemTags, type EditState } from "./actions";

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);

export function TagEditor({ item }: { item: ItemDetail }) {
  const [state, action, pending] = useActionState(saveItemTags.bind(null, item.id), {
    status: "idle",
  } satisfies EditState);
  const [colors, setColors] = useState<Color[]>(item.colors);

  const toggleColor = (color: Color) =>
    setColors((current) =>
      current.includes(color) ? current.filter((c) => c !== color) : [...current, color],
    );

  return (
    <form action={action} className="flex flex-col gap-6">
      <Field label="Description" htmlFor="description">
        <Input
          id="description"
          name="description"
          defaultValue={item.description ?? ""}
          maxLength={LIMITS.description}
          placeholder="Navy merino crew-neck sweater"
        />
      </Field>

      <Fieldset legend="Category">
        {CATEGORIES.map((c) => (
          <ChoiceChip key={c} type="radio" name="category" value={c} defaultChecked={item.category === c} required>
            {CATEGORY_SINGULAR[c]}
          </ChoiceChip>
        ))}
      </Fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Type" htmlFor="subcategory">
          <Input id="subcategory" name="subcategory" defaultValue={item.subcategory ?? ""} maxLength={LIMITS.subcategory} placeholder="Sweater" />
        </Field>
        <Field label="Material" htmlFor="material">
          <Input id="material" name="material" defaultValue={item.material ?? ""} maxLength={LIMITS.material} placeholder="Wool" />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">
          Colors <span className="font-normal text-muted-foreground">(up to {LIMITS.colors}, main color first)</span>
        </legend>
        <div className="flex flex-wrap gap-1">
          {COLOR_NAMES.map((c) => {
            const index = colors.indexOf(c);
            const selected = index >= 0;
            const disabled = !selected && colors.length >= LIMITS.colors;
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleColor(c)}
                disabled={disabled}
                aria-pressed={selected}
                aria-label={c}
                title={c}
                className="relative flex size-11 items-center justify-center rounded-full disabled:opacity-30"
              >
                <span
                  className={cn(
                    "size-8 rounded-full border border-black/10 dark:border-white/35",
                    selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                  )}
                  style={{ backgroundColor: COLORS[c] }}
                />
                {selected && (
                  <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-foreground text-[10px] font-medium text-background">
                    {index + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {colors.map((c) => (
          <input key={c} type="hidden" name="colors" value={c} />
        ))}
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {colors.length ? colors.join(", ") : "No colors selected"}
        </p>
      </fieldset>

      <Fieldset legend="Pattern">
        {PATTERNS.map((p) => (
          <ChoiceChip key={p} type="radio" name="pattern" value={p} defaultChecked={item.pattern === p}>
            {capitalize(p)}
          </ChoiceChip>
        ))}
      </Fieldset>

      <Scale name="formality" legend="Formality" labels={FORMALITY_LABELS} value={item.formality} />
      <Scale name="warmth" legend="Warmth" labels={WARMTH_LABELS} value={item.warmth} />

      <Fieldset legend="Seasons">
        {SEASONS.map((s) => (
          <ChoiceChip key={s} type="checkbox" name="seasons" value={s} defaultChecked={item.seasons.includes(s)}>
            {capitalize(s)}
          </ChoiceChip>
        ))}
      </Fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Style" htmlFor="style_tags" hint="Comma-separated, e.g. classic, minimalist">
          <Input id="style_tags" name="style_tags" defaultValue={item.style_tags.join(", ")} />
        </Field>
        <Field label="Brand" htmlFor="brand">
          <Input id="brand" name="brand" defaultValue={item.brand ?? ""} maxLength={LIMITS.brand} />
        </Field>
      </div>

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-5 flex items-center gap-3 border-t bg-background px-5 py-3 md:bottom-0 md:mx-0 md:px-0">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <p aria-live="polite" className="text-sm">
          {state.status === "saved" && !pending && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Check className="size-4" /> Saved
            </span>
          )}
          {state.status === "error" && <span className="text-destructive">{state.message}</span>}
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

/** A native radio/checkbox styled as a chip, so FormData works without JS state. */
function ChoiceChip({
  children,
  ...input
}: React.ComponentProps<"input"> & { children: React.ReactNode }) {
  return (
    <label className="cursor-pointer">
      <input className="peer sr-only" {...input} />
      <span className="inline-flex h-11 items-center rounded-full border bg-surface px-4 text-sm transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
        {children}
      </span>
    </label>
  );
}

function Scale({
  name,
  legend,
  labels,
  value,
}: {
  name: string;
  legend: string;
  labels: readonly string[];
  value: number | null;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-5 gap-1 rounded-2xl border bg-surface p-1">
        {labels.map((label, i) => (
          <label key={label} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={i + 1}
              defaultChecked={value === i + 1}
              className="peer sr-only"
            />
            <span className="flex min-h-11 items-center justify-center rounded-xl px-1 text-center text-xs leading-tight transition-colors peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
              {label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
