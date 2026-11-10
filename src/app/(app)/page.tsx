import Link from "next/link";
import { Check } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { countItems } from "@/lib/items/queries";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/** Enough pieces for the stylist to start combining outfits. */
const CLOSET_GOAL = 10;

type StepView = {
  title: string;
  body: string;
  done: boolean;
  href?: string;
  cta?: string;
  progress?: number;
  quote?: string | null;
};

export default async function TodayPage() {
  const supabase = await createClient();
  const [{ data: profile }, itemCount] = await Promise.all([
    supabase.from("profiles").select("display_name, style_memo, style_completed_at").maybeSingle(),
    countItems(supabase),
  ]);

  const name = profile?.display_name?.trim();
  const closetReady = itemCount >= CLOSET_GOAL;
  const styleDone = Boolean(profile?.style_completed_at);

  const steps: StepView[] = [
    {
      title: "Add your clothes",
      body: closetReady
        ? `${itemCount} pieces in your closet. Keep adding whenever you like.`
        : itemCount > 0
          ? `${itemCount} of ${CLOSET_GOAL} pieces added. Tops, bottoms, shoes and a jacket make a good start.`
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
    {
      title: "Get dressed",
      body: "Daily outfits built from your closet, the weather and your plans. Coming next.",
      done: false,
    },
  ];

  // Highlight the first unfinished step that can be done now.
  const current = steps.findIndex((s, i) => !s.done && i < 2);
  const ready = closetReady && styleDone;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Today"
        title={name ? `Welcome, ${name}.` : "Welcome."}
        description={
          ready
            ? "Your closet and style profile are set. Daily outfits are coming next."
            : "Two things to set up, in any order, and your stylist can start putting outfits together."
        }
      />
      <ol className="flex flex-col gap-3">
        {steps.map((step, index) => {
          const highlighted = index === current;
          const actionable = Boolean(step.href);
          return (
            <li
              key={step.title}
              className={cn(
                "flex gap-4 rounded-3xl border bg-surface p-5",
                !actionable && "opacity-60",
              )}
            >
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
                  <h2 className="font-medium">{step.title}</h2>
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
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${step.progress * 100}%` }}
                    />
                  </div>
                )}
                {step.href && (
                  <Button
                    asChild
                    className="self-start"
                    variant={highlighted ? "default" : "outline"}
                  >
                    <Link href={step.href}>{step.cta}</Link>
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Check className="size-4" /> You&apos;re signed in and your data is private to you.
      </p>
    </div>
  );
}
