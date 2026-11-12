"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CloudSun, MapPin, RotateCcw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OUTFIT_OCCASIONS, type OutfitOccasion } from "@/lib/outfits/occasions";
import type { OutfitView } from "@/lib/outfits/queries";
import { cn } from "@/lib/utils";
import { formatTemp, weatherLabel } from "@/lib/weather/open-meteo";
import { OutfitCard } from "./outfit-card";

type State =
  | { kind: "loading"; slow: boolean }
  | { kind: "ready"; outfits: OutfitView[]; error?: string }
  | { kind: "not_ready"; missing: string[] }
  | { kind: "error"; error: string };

/** Fetches (or creates) today's outfits; returns the state to show. */
async function fetchOutfits(occasion: OutfitOccasion, refresh: boolean): Promise<State> {
  try {
    const res = await fetch("/api/outfits", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: localDate(), occasion, refresh }),
    });
    const body = await res.json().catch(() => null);
    if (body?.status === "ok") return { kind: "ready", outfits: body.outfits };
    if (body?.status === "not_ready") return { kind: "not_ready", missing: body.missing };
    if (body?.outfits?.length) return { kind: "ready", outfits: body.outfits, error: body.error };
    return { kind: "error", error: body?.error ?? "Couldn't load today's outfits." };
  } catch {
    return { kind: "error", error: "No connection. Try again." };
  }
}

/**
 * Lets the server work out "today" in this time zone on the next visit, so it
 * can render the outfits straight into the page.
 */
function rememberTimeZone() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
}

/** The user's local calendar date, YYYY-MM-DD. */
function localDate() {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function TodayOutfits({
  fahrenheit,
  hasLocation,
  hasStyle,
  initialOutfits,
}: {
  fahrenheit: boolean;
  hasLocation: boolean;
  hasStyle: boolean;
  /** Today's everyday outfits, when the server could already load them. */
  initialOutfits: OutfitView[] | null;
}) {
  const [occasion, setOccasion] = useState<OutfitOccasion>("everyday");
  const [state, setState] = useState<State>(
    initialOutfits?.length ? { kind: "ready", outfits: initialOutfits } : { kind: "loading", slow: false },
  );
  const request = useRef(0);
  // Occasions seen this visit, so switching back is instant.
  const seen = useRef(new Map<OutfitOccasion, OutfitView[]>(initialOutfits?.length ? [["everyday", initialOutfits]] : []));

  // Only the latest request may update the screen (occasion taps can overlap).
  // State is set from callbacks, never synchronously inside the effect.
  // `background`: cached outfits are already on screen; only replace them with
  // fresh ones, never with a spinner or an error.
  const load = (forOccasion: OutfitOccasion, refresh = false, background = false) => {
    const id = ++request.current;
    const slowTimer = background
      ? undefined
      : setTimeout(() => {
          if (request.current === id) setState({ kind: "loading", slow: true });
        }, 1500);
    return fetchOutfits(forOccasion, refresh).then((next) => {
      clearTimeout(slowTimer);
      if (next.kind === "ready") seen.current.set(forOccasion, next.outfits);
      if (request.current !== id || (background && next.kind !== "ready")) return;
      setState(next);
    });
  };

  useEffect(() => {
    rememberTimeZone();
    if (initialOutfits?.length) return;
    const id = ++request.current;
    const slowTimer = setTimeout(() => {
      if (request.current === id) setState({ kind: "loading", slow: true });
    }, 1500);
    fetchOutfits("everyday", false).then((next) => {
      clearTimeout(slowTimer);
      if (next.kind === "ready") seen.current.set("everyday", next.outfits);
      if (request.current === id) setState(next);
    });
    return () => clearTimeout(slowTimer);
    // Runs once on mount; initialOutfits only seeds the first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (next: OutfitOccasion) => {
    setOccasion(next);
    const cached = seen.current.get(next);
    // Show what we have instantly, then refresh quietly in the background.
    setState(cached ? { kind: "ready", outfits: cached } : { kind: "loading", slow: false });
    void load(next, false, Boolean(cached));
  };

  const refresh = () => {
    setState({ kind: "loading", slow: true });
    void load(occasion, true);
  };

  const weather = state.kind === "ready" ? state.outfits.find((o) => o.weather)?.weather : null;

  return (
    <section className="flex flex-col gap-5" aria-label="Today's outfits">
      {weather && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CloudSun className="size-4" aria-hidden />
          {weatherLabel(weather.code)} · {formatTemp(weather.high, fahrenheit)} / {formatTemp(weather.low, fahrenheit)}
          {weather.precipChance >= 30 && ` · ${weather.precipChance}% rain`}
        </p>
      )}

      <div
        role="radiogroup"
        aria-label="Occasion"
        className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0"
      >
        {(Object.keys(OUTFIT_OCCASIONS) as OutfitOccasion[]).map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={occasion === key}
            onClick={() => occasion !== key && choose(key)}
            className={cn(
              "inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-sm transition-colors",
              occasion === key ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:bg-muted",
            )}
          >
            {OUTFIT_OCCASIONS[key].label}
          </button>
        ))}
      </div>

      {state.kind === "loading" && (
        <div className="flex flex-col gap-3" aria-busy="true">
          {state.slow && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="size-4 animate-pulse text-accent" aria-hidden />
              Your stylist is putting outfits together…
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-80 animate-pulse rounded-3xl bg-muted" />
            ))}
          </div>
        </div>
      )}

      {state.kind === "not_ready" && (
        <div className="flex flex-col gap-3 rounded-3xl border bg-surface p-5">
          <p className="text-sm">
            To put full outfits together, your stylist needs {state.missing.join(", and ")}.
          </p>
          <Button asChild className="self-start">
            <Link href="/add">Add clothes</Link>
          </Button>
        </div>
      )}

      {state.kind === "error" && (
        <div className="flex flex-col gap-3 rounded-3xl border bg-surface p-5">
          <p className="text-sm">{state.error}</p>
          <Button variant="outline" className="self-start" onClick={() => choose(occasion)}>
            <RotateCcw /> Try again
          </Button>
        </div>
      )}

      {state.kind === "ready" && (
        <>
          {state.error && <p className="text-sm text-muted-foreground">{state.error}</p>}
          <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0">
            {state.outfits.map((outfit) => (
              <div key={`${outfit.id}-${outfit.status}`} className="w-[85%] shrink-0 snap-center md:w-auto">
                <OutfitCard outfit={outfit} />
              </div>
            ))}
          </div>
          <Button variant="outline" className="self-start" onClick={refresh}>
            <Sparkles /> New ideas
          </Button>
        </>
      )}

      {(!hasLocation || !hasStyle) && state.kind !== "loading" && (
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          {!hasLocation && (
            <Link href="/style?step=location" className="inline-flex items-center gap-2 underline-offset-4 hover:underline">
              <MapPin className="size-4" /> Add your city for weather-aware outfits
            </Link>
          )}
          {!hasStyle && (
            <Link href="/style" className="inline-flex items-center gap-2 underline-offset-4 hover:underline">
              <Sparkles className="size-4" /> Take the style quiz for outfits that suit you better
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
