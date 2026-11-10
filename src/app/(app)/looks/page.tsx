import type { Metadata } from "next";
import Link from "next/link";
import { Check, Layers, ThumbsUp } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { OutfitCollage } from "@/components/outfits/outfit-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { OUTFIT_OCCASIONS } from "@/lib/outfits/occasions";
import { loadSavedLooks } from "@/lib/outfits/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Looks" };

export default async function LooksPage() {
  const supabase = await createClient();
  const looks = await loadSavedLooks(supabase);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Looks"
        title="Outfits you love"
        description={looks.length ? "Everything you've liked or worn, newest first." : undefined}
      />
      {looks.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No looks yet"
          action={
            <Button asChild>
              <Link href="/">See today&apos;s outfits</Link>
            </Button>
          }
        >
          Outfits you like or wear will collect here, so you can come back to them.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {looks.map((look) => (
            <li key={look.id} className="flex flex-col gap-2">
              <OutfitCollage pieces={look.pieces} />
              <div className="space-y-0.5 px-1">
                <p className="font-display text-base leading-tight">{look.title}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {look.status === "worn" ? (
                    <Check className="size-3" aria-label="Worn" />
                  ) : (
                    <ThumbsUp className="size-3" aria-label="Liked" />
                  )}
                  {OUTFIT_OCCASIONS[look.occasion].label} ·{" "}
                  {new Date(`${look.forDate}T12:00:00Z`).toLocaleDateString("en", {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
