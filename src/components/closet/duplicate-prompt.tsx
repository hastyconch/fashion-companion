"use client";

import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DuplicateAnswer = "same" | "similar" | "different";

/**
 * "Looks like you already own this": the new photo next to the item it might
 * be, and three answers. Same item removes the new one.
 */
export function DuplicatePrompt({
  newPhotoUrl,
  match,
  onAnswer,
  busy = false,
  className,
}: {
  newPhotoUrl: string | null;
  match: { description: string | null; thumbUrl: string | null; reason: string };
  onAnswer: (answer: DuplicateAnswer) => void;
  busy?: boolean;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Possible duplicate"
      className={cn("flex flex-col gap-3 rounded-2xl bg-muted p-3", busy && "opacity-70", className)}
    >
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 items-center gap-1.5">
          <Photo src={newPhotoUrl} label="New photo" />
          <Photo src={match.thumbUrl} label="Already in your closet" />
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Copy className="size-3.5 shrink-0 text-accent" aria-hidden />
            Looks like you already own this
          </p>
          <p className="text-xs text-muted-foreground">
            {match.description ? `${match.description}. ` : ""}
            {match.reason}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Answer onClick={() => onAnswer("same")} disabled={busy}>
          Same item
        </Answer>
        <Answer onClick={() => onAnswer("similar")} disabled={busy}>
          Keep both
        </Answer>
        <Answer onClick={() => onAnswer("different")} disabled={busy}>
          Different
        </Answer>
      </div>
      <p className="text-xs text-muted-foreground">
        Same item removes the new photo. Keep both if it&apos;s a similar piece you also own.
      </p>
    </div>
  );
}

function Answer({ children, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="outline" className="h-11 bg-surface px-2" {...props}>
      {children}
    </Button>
  );
}

function Photo({ src, label, className }: { src: string | null; label: string; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={label} className={cn("size-14 rounded-xl bg-surface object-cover", className)} />
  ) : (
    <span role="img" aria-label={label} className={cn("block size-14 rounded-xl bg-surface", className)} />
  );
}
