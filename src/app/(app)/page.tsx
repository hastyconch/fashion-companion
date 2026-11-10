import { headers } from "next/headers";
import Link from "next/link";
import { Check } from "lucide-react";

import { TodayOutfits } from "@/components/outfits/today-outfits";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { countItems } from "@/lib/items/queries";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { prefersFahrenheit } from "@/lib/weather/open-meteo";

/** Enough pieces for varied outfits; suggestions start as soon as outfits are possible. */
const CLOSET_GOAL = 10;

export default async function TodayPage() {
  const supabase = await createClient();
  const [{ data: profile }, itemCount, requestHeaders] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, style_memo, style_completed_at, latitude, timezone")
      .maybeSingle(),
    countItems(supabase),
    headers(),
  ]);

  const name = profile?.display_name?.trim();
  const closetReady = itemCount >= CLOSET_GOAL;
  const styleDone = Boolean(profile?.style_completed_at);
  const setupDone = closetReady && styleDone;
  const dateLabel = profile?.timezone
    ? new Intl.DateTimeFormat("en", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: profile.timezone,
      }).format(new Date())
    : null;

  const steps = [
    {
      title: "Add your clothes",
      body: closetReady
        ? `${itemCount} pieces in your closet.`
        : itemCount > 0
          ? `${itemCount} of ${CLOSET_GOAL} pieces added. More pieces mean more varied outfits.`
          : "Photograph what you own. We tag each piece for you.",
      href: "/add",
      cta: itemCount > 0 ? "Add more" : "Add your first item",
      done: closetReady,
      progress: Math.min(1, itemCount / CLOSET_GOAL),
    },
    {
      title: "Tell us your style",
      body: styleDone
        ? "Your stylist's brief:"
        : "Eight quick questions about how you dress, what you love and what you avoid. About two minutes.",
      href: "/style",
      cta: styleDone ? "Edit your style" : "Take the style quiz",
      done: styleDone,
      quote: styleDone ? profile?.style_memo : null,
    },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Today"
        title={itemCount > 0 ? (dateLabel ?? "What to wear today") : name ? `Welcome, ${name}.` : "Welcome."}
        description={
          itemCount > 0
            ? `${name ? `${name}, here's` : "Here's"} what to wear, from your own closet.`
            : "Two quick things to set up, in any order, and your stylist can start putting outfits together."
        }
      />

      {itemCount > 0 && (
        <TodayOutfits
          fahrenheit={prefersFahrenheit(requestHeaders.get("accept-language"))}
          hasLocation={profile?.latitude != null}
          hasStyle={styleDone}
        />
      )}

      {!setupDone && (
        <section className="flex flex-col gap-3" aria-label="Setup">
          {itemCount > 0 && <h2 className="text-sm font-medium text-muted-foreground">Finish setting up</h2>}
          <ol className="flex flex-col gap-3">
            {steps.map((step, index) => {
              const highlighted = index === current;
              return (
                <li key={step.title} className="flex gap-4 rounded-3xl border bg-surface p-5">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium",
                      highlighted || step.done
                        ? "bg-accent text-accent-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {step.done ? <Check className="size-4" aria-label="Done" /> : index + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="space-y-1">
                      <h3 className="font-medium">{step.title}</h3>
                      <p className="text-sm text-muted-foreground">{step.body}</p>
                    </div>
                    {step.quote && (
                      <blockquote className="line-clamp-4 border-l-2 border-accent pl-3 font-display text-base leading-snug">
                        {step.quote}
                      </blockquote>
                    )}
                    {step.progress !== undefined && step.progress > 0 && !step.done && (
                      <div
                        className="h-1.5 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-label="Closet progress"
                        aria-valuemin={0}
                        aria-valuemax={CLOSET_GOAL}
                        aria-valuenow={itemCount}
                      >
                        <div className="h-full rounded-full bg-accent" style={{ width: `${step.progress * 100}%` }} />
                      </div>
                    )}
                    <Button asChild className="self-start" variant={highlighted ? "default" : "outline"}>
                      <Link href={step.href}>{step.cta}</Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
