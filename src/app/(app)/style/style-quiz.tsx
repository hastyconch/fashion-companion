"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, LocateFixed, MapPin, RotateCcw, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COLORS, COLOR_NAMES, type Color } from "@/lib/items/vocabulary";
import { searchPlaces, type Place } from "@/lib/profile/geocoding";
import {
  ADVENTURE_LABELS,
  BOTTOM_FITS,
  COMFORT_LABELS,
  MAX_VIBES,
  NOTES_MAX,
  OCCASIONS,
  TOP_FITS,
  VIBES,
  type Occasion,
  type Preferences,
  type Vibe,
} from "@/lib/profile/preferences";
import { cn } from "@/lib/utils";
import { generateSummary, saveAnswers, saveLocation, saveName, saveSummary } from "./actions";

const STEPS = ["name", "occasions", "vibes", "fit", "colors", "feel", "notes", "location"] as const;
type Step = (typeof STEPS)[number] | "summary";

export type StyleInitial = {
  name: string;
  preferences: Preferences;
  city: string | null;
  memo: string | null;
  keywords: string[];
  completed: boolean;
};

export function StyleQuiz({ initial, startAt }: { initial: StyleInitial; startAt?: "location" }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(startAt ?? (initial.completed ? "summary" : "name"));
  const [name, setName] = useState(initial.name);
  const [prefs, setPrefs] = useState<Preferences>(initial.preferences);
  const [city, setCity] = useState<string | null>(initial.city);
  const [memo, setMemo] = useState(initial.memo);
  const [keywords, setKeywords] = useState(initial.keywords);
  const [summaryState, setSummaryState] = useState<"ready" | "writing" | "error">(
    initial.memo ? "ready" : "error",
  );
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const changed = useRef(false);

  const index = step === "summary" ? STEPS.length : STEPS.indexOf(step);
  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
    setPrefs((p) => ({ ...p, [key]: value }));

  const writeSummary = async () => {
    setSummaryState("writing");
    setSummaryError(null);
    const result = await generateSummary();
    if (result.ok) {
      setMemo(result.memo);
      setKeywords(result.keywords);
      setSummaryState("ready");
    } else {
      setSummaryError(result.error);
      setSummaryState("error");
    }
  };

  const goTo = (target: Step) => {
    setError(null);
    setStep(target);
    window.scrollTo({ top: 0 });
    // Write (or rewrite) the brief when arriving at the end with new answers.
    if (target === "summary" && (changed.current || !memo)) {
      changed.current = false;
      void writeSummary();
    }
  };

  const advance = () => goTo(index + 1 < STEPS.length ? STEPS[index + 1] : "summary");

  const saveAndAdvance = () =>
    startSaving(async () => {
      const result = await saveStep(step, name, prefs);
      if (!result.ok) return setError(result.error);
      if (step !== "location") changed.current = true;
      advance();
    });

  if (step === "summary") {
    return (
      <Summary
        state={summaryState}
        error={summaryError}
        memo={memo}
        keywords={keywords}
        onRewrite={() => void writeSummary()}
        onEditAnswers={() => goTo("name")}
        onSaved={(text) => {
          setMemo(text);
          setSummaryState("ready");
        }}
        onDone={() => {
          router.push("/");
          router.refresh();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          Question {index + 1} of {STEPS.length}
        </p>
        <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${((index + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {step === "name" && (
        <Question title="What should we call you?" hint="Just a first name is fine.">
          <Label htmlFor="name" className="sr-only">
            Name
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoComplete="given-name"
            placeholder="Your name"
          />
        </Question>
      )}

      {step === "occasions" && (
        <Question title="What do you dress for most weeks?" hint="Pick all that apply.">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(OCCASIONS) as Occasion[]).map((o) => (
              <ToggleTile
                key={o}
                selected={prefs.occasions?.includes(o) ?? false}
                onClick={() => set("occasions", toggle(prefs.occasions ?? [], o))}
              >
                {OCCASIONS[o]}
              </ToggleTile>
            ))}
          </div>
        </Question>
      )}

      {step === "vibes" && (
        <Question title="Which styles feel like you?" hint={`Pick up to ${MAX_VIBES}.`}>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(VIBES) as Vibe[]).map((v) => {
              const selected = prefs.vibes?.includes(v) ?? false;
              const full = (prefs.vibes?.length ?? 0) >= MAX_VIBES && !selected;
              return (
                <ToggleTile
                  key={v}
                  selected={selected}
                  disabled={full}
                  onClick={() => set("vibes", toggle(prefs.vibes ?? [], v))}
                >
                  <span className="flex w-full flex-col items-start gap-2 text-left">
                    <span className="flex gap-1" aria-hidden>
                      {VIBES[v].swatch.map((c) => (
                        <span
                          key={c}
                          className={cn(
                            "size-4 rounded-full border",
                            selected ? "border-white/60" : "border-black/10 dark:border-white/35",
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </span>
                    <span className="font-medium">{VIBES[v].label}</span>
                    <span className={cn("text-xs", selected ? "opacity-80" : "text-muted-foreground")}>
                      {VIBES[v].blurb}
                    </span>
                  </span>
                </ToggleTile>
              );
            })}
          </div>
        </Question>
      )}

      {step === "fit" && (
        <Question title="How do you like things to fit?">
          <div className="flex flex-col gap-6">
            <Segmented
              legend="Tops"
              options={Object.entries(TOP_FITS)}
              value={prefs.top_fit ?? null}
              onChange={(v) => set("top_fit", v as Preferences["top_fit"])}
            />
            <Segmented
              legend="Bottoms"
              options={Object.entries(BOTTOM_FITS)}
              value={prefs.bottom_fit ?? null}
              onChange={(v) => set("bottom_fit", v as Preferences["bottom_fit"])}
            />
          </div>
        </Question>
      )}

      {step === "colors" && (
        <Question title="Colors you love, and colors you'd rather skip">
          <div className="flex flex-col gap-6">
            <Swatches
              legend="Love wearing"
              selected={prefs.colors_love ?? []}
              onToggle={(c) => {
                set("colors_love", toggle(prefs.colors_love ?? [], c));
                set("colors_avoid", (prefs.colors_avoid ?? []).filter((x) => x !== c));
              }}
            />
            <Swatches
              legend="Rather avoid"
              selected={prefs.colors_avoid ?? []}
              onToggle={(c) => {
                set("colors_avoid", toggle(prefs.colors_avoid ?? [], c));
                set("colors_love", (prefs.colors_love ?? []).filter((x) => x !== c));
              }}
            />
          </div>
        </Question>
      )}

      {step === "feel" && (
        <Question title="What matters when you get dressed?">
          <div className="flex flex-col gap-6">
            <Segmented
              legend="Comfort or polish?"
              options={COMFORT_LABELS.map((label, i) => [String(i + 1), label])}
              value={prefs.comfort ? String(prefs.comfort) : null}
              onChange={(v) => set("comfort", Number(v))}
              stacked
            />
            <Segmented
              legend="How adventurous are you with style?"
              options={ADVENTURE_LABELS.map((label, i) => [String(i + 1), label])}
              value={prefs.adventure ? String(prefs.adventure) : null}
              onChange={(v) => set("adventure", Number(v))}
              stacked
            />
          </div>
        </Question>
      )}

      {step === "notes" && (
        <Question
          title="Anything else your stylist should know?"
          hint="For example: I run cold, no shorts, I need to look sharp on Mondays."
        >
          <Label htmlFor="notes" className="sr-only">
            Notes
          </Label>
          <textarea
            id="notes"
            value={prefs.notes ?? ""}
            onChange={(e) => set("notes", e.target.value.slice(0, NOTES_MAX))}
            rows={4}
            className="w-full rounded-xl border border-input bg-surface px-4 py-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
          <p className="text-right text-xs text-muted-foreground">
            {(prefs.notes ?? "").length}/{NOTES_MAX}
          </p>
        </Question>
      )}

      {step === "location" && (
        <Question
          title="Where are you based?"
          hint="Used only for local weather, so outfits suit the day. Rounded to about 1 km."
        >
          <LocationPicker city={city} onChange={setCity} />
        </Question>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-5 flex items-center gap-2 border-t bg-background px-5 py-3 md:bottom-0 md:mx-0 md:px-0">
        {index > 0 && (
          <Button variant="ghost" onClick={() => goTo(STEPS[index - 1])} disabled={saving}>
            Back
          </Button>
        )}
        <div className="flex-1" />
        {step !== "location" && (
          <Button variant="link" className="text-muted-foreground" onClick={advance} disabled={saving}>
            Skip
          </Button>
        )}
        <Button onClick={step === "location" ? advance : saveAndAdvance} disabled={saving}>
          {saving ? "Saving…" : step === "location" ? (city ? "Finish" : "Skip and finish") : "Next"}
        </Button>
      </div>
    </div>
  );
}

function saveStep(step: Step, name: string, p: Preferences) {
  switch (step) {
    case "name":
      return saveName(name);
    case "occasions":
      return saveAnswers({ occasions: p.occasions ?? [] });
    case "vibes":
      return saveAnswers({ vibes: p.vibes ?? [] });
    case "fit":
      return saveAnswers({ top_fit: p.top_fit ?? null, bottom_fit: p.bottom_fit ?? null });
    case "colors":
      return saveAnswers({ colors_love: p.colors_love ?? [], colors_avoid: p.colors_avoid ?? [] });
    case "feel":
      return saveAnswers({ comfort: p.comfort ?? null, adventure: p.adventure ?? null });
    case "notes":
      return saveAnswers({ notes: p.notes ?? "" });
    default:
      return Promise.resolve({ ok: true as const });
  }
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Question({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <header className="space-y-2">
        <h1 className="font-display text-3xl leading-tight">{title}</h1>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </header>
      {children}
    </section>
  );
}

function ToggleTile({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-14 items-center rounded-2xl border px-4 py-3 text-left text-sm transition-colors disabled:opacity-40",
        selected ? "border-primary bg-primary text-primary-foreground" : "bg-surface hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function Segmented({
  legend,
  options,
  value,
  onChange,
  stacked,
}: {
  legend: string;
  options: [string, string][];
  value: string | null;
  onChange: (value: string) => void;
  stacked?: boolean;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div
        role="radiogroup"
        className={cn(
          "grid gap-1 rounded-2xl border bg-surface p-1",
          stacked ? "grid-cols-1 sm:grid-cols-5" : "grid-cols-4",
        )}
      >
        {options.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={value === key}
            onClick={() => onChange(key)}
            className={cn(
              "min-h-11 rounded-xl px-2 text-sm transition-colors",
              value === key ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Swatches({
  legend,
  selected,
  onToggle,
}: {
  legend: string;
  selected: Color[];
  onToggle: (color: Color) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-1">
        {COLOR_NAMES.map((c) => {
          const on = selected.includes(c);
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              aria-label={`${legend}: ${c}`}
              title={c}
              onClick={() => onToggle(c)}
              className="flex size-11 items-center justify-center rounded-full"
            >
              <span
                className={cn(
                  "size-8 rounded-full border border-black/10 dark:border-white/35",
                  on && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                )}
                style={{ backgroundColor: COLORS[c] }}
              />
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{selected.length ? selected.join(", ") : "None"}</p>
    </fieldset>
  );
}

function LocationPicker({ city, onChange }: { city: string | null; onChange: (city: string | null) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [status, setStatus] = useState<"idle" | "searching" | "locating" | "saving">("idle");
  const [message, setMessage] = useState<string | null>(null);

  // Debounced search; every state update happens in the timer or after the fetch.
  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("searching");
      try {
        const places = await searchPlaces(query, controller.signal);
        setResults(places);
        setMessage(places.length ? null : "No places found. Try a nearby city.");
      } catch {
        if (!controller.signal.aborted) setMessage("Couldn't search right now. Try again.");
      } finally {
        if (!controller.signal.aborted) setStatus("idle");
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const choose = async (place: { label: string; latitude: number; longitude: number; timezone: string | null }) => {
    setStatus("saving");
    const result = await saveLocation({
      city: place.label,
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone,
    });
    setStatus("idle");
    if (!result.ok) return setMessage(result.error);
    onChange(place.label);
    setQuery("");
    setResults([]);
    setMessage(null);
  };

  const useCurrent = () => {
    if (!("geolocation" in navigator)) return setMessage("This browser can't share your location.");
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        void choose({
          label: "Your current location",
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
        }),
      () => {
        setStatus("idle");
        setMessage("Couldn't get your location. Search for your city instead.");
      },
      { timeout: 10000, maximumAge: 60 * 60 * 1000 },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {city && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border bg-surface px-4 py-3">
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <MapPin className="size-4 shrink-0 text-accent" aria-hidden />
            <span className="truncate">{city}</span>
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remove location"
            onClick={async () => {
              const result = await saveLocation(null);
              if (result.ok) onChange(null);
            }}
          >
            <X />
          </Button>
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length < 2) setResults([]);
          }}
          placeholder={city ? "Change city" : "Search for your city"}
          aria-label="Search for your city"
          className="pl-10"
        />
      </div>
      {results.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-surface" aria-label="Places">
          {results.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => void choose(place)}
                disabled={status === "saving"}
                className="flex min-h-12 w-full items-center px-4 text-left text-sm hover:bg-muted"
              >
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" className="self-start" onClick={useCurrent} disabled={status !== "idle"}>
        {status === "locating" ? <Loader2 className="animate-spin" /> : <LocateFixed />}
        Use my current location
      </Button>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {status === "searching" ? "Searching…" : status === "saving" ? "Saving…" : message}
      </p>
    </div>
  );
}

function Summary({
  state,
  error,
  memo,
  keywords,
  onRewrite,
  onEditAnswers,
  onSaved,
  onDone,
}: {
  state: "ready" | "writing" | "error";
  error: string | null;
  memo: string | null;
  keywords: string[];
  onRewrite: () => void;
  onEditAnswers: () => void;
  onSaved: (memo: string) => void;
  onDone: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memo ?? "");
  const [saving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const showEditor = editing || state === "error";

  const save = () =>
    startSaving(async () => {
      const result = await saveSummary(draft);
      if (!result.ok) return setSaveError(result.error);
      setSaveError(null);
      setEditing(false);
      onSaved(draft.trim());
    });

  return (
    <div className="flex flex-col gap-8">
      <header className="space-y-2">
        <p className="text-xs font-medium tracking-[0.25em] text-accent uppercase">Your style</p>
        <h1 className="font-display text-3xl leading-tight">
          {state === "writing" ? "Reading your answers…" : "Here's how we see your style"}
        </h1>
      </header>

      {state === "writing" && (
        <div className="flex flex-col gap-3" aria-busy="true">
          <div className="h-28 animate-pulse rounded-3xl bg-muted" />
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Looking at your answers and your closet
          </p>
        </div>
      )}

      {state !== "writing" && !showEditor && memo && (
        <div className="flex flex-col gap-4 rounded-3xl border bg-surface p-6">
          <p className="font-display text-xl leading-snug">{memo}</p>
          {keywords.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Style keywords">
              {keywords.map((k) => (
                <li key={k} className="rounded-full bg-muted px-3 py-1 text-xs">
                  {k}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state !== "writing" && showEditor && (
        <div className="flex flex-col gap-3">
          {state === "error" && error && (
            <p role="alert" className="rounded-xl bg-muted px-4 py-3 text-sm">
              {error}
            </p>
          )}
          <Label htmlFor="memo">{memo ? "Edit your style summary" : "Describe your style in a sentence or two"}</Label>
          <textarea
            id="memo"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 800))}
            rows={5}
            placeholder="Relaxed, mostly neutral, with one statement piece. Comfortable for the office, a bit sharper for evenings."
            className="w-full rounded-xl border border-input bg-surface px-4 py-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving || !draft.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
            {editing && (
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      {state !== "writing" && (
        <div className="flex flex-col gap-3">
          {!showEditor && memo && (
            <Button size="lg" onClick={onDone}>
              <Check /> Looks right
            </Button>
          )}
          <div className="flex flex-wrap gap-2">
            {!showEditor && memo && (
              <Button
                variant="outline"
                onClick={() => {
                  setDraft(memo);
                  setEditing(true);
                }}
              >
                Edit summary
              </Button>
            )}
            <Button variant="outline" onClick={onRewrite}>
              <RotateCcw /> {memo ? "Rewrite" : "Try again"}
            </Button>
            <Button variant="ghost" onClick={onEditAnswers}>
              Change answers
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
