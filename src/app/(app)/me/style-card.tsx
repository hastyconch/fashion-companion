import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { COLORS, type Color } from "@/lib/items/vocabulary";
import { VIBES, type Vibe } from "@/lib/profile/preferences";

/** The style profile as its own card: brief, keywords and favorite colors, nothing cut off. */
export function StyleCard({
  memo,
  keywords,
  vibes,
  colors,
  completed,
}: {
  memo: string | null;
  keywords: string[];
  vibes: Vibe[];
  colors: Color[];
  completed: boolean;
}) {
  if (!completed) {
    return (
      <section className="flex flex-col gap-4 rounded-3xl border bg-surface p-5" aria-label="Your style">
        <span className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Sparkles className="size-5 text-accent" aria-hidden />
        </span>
        <div className="space-y-1">
          <h2 className="font-display text-xl">Your style</h2>
          <p className="text-sm text-muted-foreground">
            Eight quick questions so your stylist knows what you love. About two minutes.
          </p>
        </div>
        <Button asChild className="self-start">
          <Link href="/style" prefetch={false}>
            Take the style quiz
          </Link>
        </Button>
      </section>
    );
  }

  // Keywords come from the AI brief; fall back to the styles picked in the quiz.
  const chips = keywords.length ? keywords : vibes.map((v) => VIBES[v].label.toLowerCase());

  return (
    <section className="flex flex-col gap-5 rounded-3xl border bg-surface p-5" aria-label="Your style">
      <header className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium tracking-[0.25em] text-accent uppercase">Your style</p>
        <Link
          href="/style"
          prefetch={false}
          className="-mr-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Edit <ChevronRight className="size-4" aria-hidden />
        </Link>
      </header>

      {memo && <p className="font-display text-xl leading-snug">{memo}</p>}

      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Style keywords">
          {chips.map((k) => (
            <li key={k} className="rounded-full bg-muted px-3 py-1.5 text-sm">
              {k}
            </li>
          ))}
        </ul>
      )}

      {colors.length > 0 && (
        <div className="flex items-center gap-3 border-t pt-4">
          <span className="text-sm text-muted-foreground">Colors you love</span>
          <ul className="flex flex-wrap gap-1.5" aria-label="Colors you love">
            {colors.map((c) => (
              <li key={c} title={c}>
                <span
                  className="block size-6 rounded-full border border-black/10 dark:border-white/35"
                  style={{ backgroundColor: COLORS[c] }}
                />
                <span className="sr-only">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
