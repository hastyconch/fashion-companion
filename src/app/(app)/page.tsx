import Link from "next/link";
import { Check } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    title: "Add your clothes",
    body: "Photograph what you own. We tag each piece for you.",
    href: "/add",
    cta: "Add your first item",
  },
  {
    title: "Tell us your style",
    body: "A short quiz about how you dress, what you love and what you avoid.",
  },
  {
    title: "Get dressed",
    body: "Daily outfits built from your closet, the weather and your plans.",
  },
];

export default async function TodayPage() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .maybeSingle();

  const name = profile?.display_name?.trim();

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Today"
        title={name ? `Welcome, ${name}.` : "Welcome."}
        description="Your stylist needs to see your closet first. Here's how to get your first outfit."
      />
      <ol className="flex flex-col gap-3">
        {STEPS.map((step, index) => {
          const current = index === 0;
          return (
            <li
              key={step.title}
              className={cn(
                "flex gap-4 rounded-3xl border bg-surface p-5",
                !current && "opacity-60",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium",
                  current ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {index + 1}
              </span>
              <div className="flex flex-col gap-3">
                <div className="space-y-1">
                  <h2 className="font-medium">{step.title}</h2>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </div>
                {current && step.href && (
                  <Button asChild className="self-start">
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
