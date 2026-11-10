"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { ClosetFilters } from "@/lib/items/filters";
import { CATEGORIES, CATEGORY_LABELS, COLORS, COLOR_NAMES, SEASONS } from "@/lib/items/vocabulary";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "laundry", label: "In laundry" },
  { value: "review", label: "Needs a look" },
  { value: "archived", label: "Archived" },
] as const;

/** Filter chips and search, stored in the URL so they survive a refresh. */
export function ClosetFilterBar({ filters }: { filters: ClosetFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(filters.q);

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  // Debounced search.
  useEffect(() => {
    if (q.trim() === filters.q) return;
    const timer = setTimeout(() => setParam("q", q.trim() || null), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const toggle = (key: string, current: string | null, value: string) =>
    setParam(key, current === value ? null : value);

  return (
    <div className={cn("flex flex-col gap-3 transition-opacity", pending && "opacity-70")}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your closet"
          aria-label="Search your closet"
          className="pl-10"
        />
      </div>

      <ChipRow label="Category">
        {CATEGORIES.map((c) => (
          <Chip key={c} active={filters.category === c} onClick={() => toggle("category", filters.category, c)}>
            {CATEGORY_LABELS[c]}
          </Chip>
        ))}
      </ChipRow>

      <ChipRow label="Color">
        {COLOR_NAMES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => toggle("color", filters.color, c)}
            aria-pressed={filters.color === c}
            aria-label={c}
            title={c}
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95",
            )}
          >
            <span
              className={cn(
                "size-7 rounded-full border border-black/10 dark:border-white/35",
                filters.color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
              )}
              style={{ backgroundColor: COLORS[c] }}
            />
          </button>
        ))}
      </ChipRow>

      <ChipRow label="Season and status">
        {SEASONS.map((s) => (
          <Chip key={s} active={filters.season === s} onClick={() => toggle("season", filters.season, s)}>
            {s[0].toUpperCase() + s.slice(1)}
          </Chip>
        ))}
        <span aria-hidden className="mx-1 w-px shrink-0 self-stretch bg-border" />
        {STATUS_OPTIONS.map((o) => (
          <Chip
            key={o.value}
            active={filters.status === o.value}
            onClick={() => setParam("status", filters.status === o.value ? null : o.value)}
          >
            {o.label}
          </Chip>
        ))}
      </ChipRow>
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-5 flex items-center gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0"
    >
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-1 rounded-full border px-4 text-sm whitespace-nowrap transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-surface text-foreground hover:bg-muted",
      )}
    >
      {children}
      {active && <X className="size-3.5" aria-hidden />}
    </button>
  );
}
