"use client";

import { useState, useTransition } from "react";
import { Check, Lightbulb, RefreshCw, Shirt, ThumbsDown, ThumbsUp } from "lucide-react";

import { reactToOutfit, swapPiece, wearOutfit } from "@/app/(app)/outfit-actions";
import { Button } from "@/components/ui/button";
import { DISLIKE_REASONS } from "@/lib/outfits/occasions";
import type { OutfitPiece, OutfitView } from "@/lib/outfits/queries";
import { cn } from "@/lib/utils";

/** A collage of the outfit's pieces. */
export function OutfitCollage({ pieces, className }: { pieces: OutfitPiece[]; className?: string }) {
  const shown = pieces.slice(0, 6);
  return (
    <div
      className={cn(
        "grid gap-1 overflow-hidden rounded-2xl bg-muted",
        shown.length <= 4 ? "grid-cols-2" : "grid-cols-3",
        className,
      )}
      aria-hidden
    >
      {shown.map((p) => (
        <div key={p.id} className="aspect-[4/3] bg-muted">
          {p.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center">
              <Shirt className="size-5 text-muted-foreground" />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** One suggested outfit with reactions, swaps and "Wearing this". */
export function OutfitCard({ outfit: initial }: { outfit: OutfitView }) {
  const [outfit, setOutfit] = useState(initial);
  const [askReason, setAskReason] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busyPiece, setBusyPiece] = useState<string | null>(null);
  const [tried, setTried] = useState<Record<number, string[]>>({});
  const [pending, startTransition] = useTransition();
  const worn = outfit.status === "worn";

  const react = (status: "liked" | "disliked" | "suggested", reason: string | null = null) =>
    startTransition(async () => {
      const previous = outfit;
      setOutfit({ ...outfit, status, feedbackReason: reason });
      const result = await reactToOutfit(outfit.id, status, reason);
      if (!result.ok) {
        setOutfit(previous);
        setMessage(result.error);
      }
    });

  const wear = () =>
    startTransition(async () => {
      const result = await wearOutfit(outfit.id);
      if (result.ok) {
        setOutfit({ ...outfit, status: "worn", feedbackReason: null });
        setAskReason(false);
      } else setMessage(result.error);
    });

  const swap = async (slot: number, piece: OutfitPiece) => {
    setBusyPiece(piece.id);
    setMessage(null);
    const seen = [...(tried[slot] ?? []), piece.id];
    const result = await swapPiece(outfit.id, piece.id, seen);
    setBusyPiece(null);
    if (!result.ok) return setMessage(result.error);
    setTried({ ...tried, [slot]: seen });
    setOutfit((o) => ({ ...o, pieces: o.pieces.map((p, i) => (i === slot ? result.piece : p)) }));
  };

  return (
    <article className="flex flex-col gap-4 rounded-3xl border bg-surface p-4" aria-label={outfit.title}>
      <OutfitCollage pieces={outfit.pieces} />

      <div className="space-y-2 px-1">
        <h3 className="font-display text-xl leading-tight">{outfit.title}</h3>
        {outfit.reason && <p className="text-sm text-muted-foreground">{outfit.reason}</p>}
        {outfit.tip && (
          <p className="flex gap-2 text-sm">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
            <span>{outfit.tip}</span>
          </p>
        )}
      </div>

      <ul className="flex flex-col divide-y rounded-2xl border" aria-label="Pieces">
        {outfit.pieces.map((piece, slot) => (
          <li key={`${slot}-${piece.id}`} className="flex items-center gap-3 py-1 pr-1 pl-2">
            <span className="size-9 shrink-0 overflow-hidden rounded-lg bg-muted">
              {piece.thumbUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={piece.thumbUrl} alt="" className="size-full object-cover" />
              )}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">{piece.description ?? piece.category}</span>
            {!worn && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Swap ${piece.description ?? "this piece"}`}
                disabled={busyPiece !== null}
                onClick={() => void swap(slot, piece)}
              >
                <RefreshCw className={cn(busyPiece === piece.id && "animate-spin")} />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {message && (
        <p role="status" className="px-1 text-sm text-muted-foreground">
          {message}
        </p>
      )}

      {worn ? (
        <p className="flex items-center gap-2 px-1 text-sm font-medium">
          <Check className="size-4 text-accent" /> Worn today
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            variant={outfit.status === "liked" ? "default" : "outline"}
            size="icon"
            aria-label="Like"
            aria-pressed={outfit.status === "liked"}
            disabled={pending}
            onClick={() => react(outfit.status === "liked" ? "suggested" : "liked")}
          >
            <ThumbsUp />
          </Button>
          <Button
            variant={outfit.status === "disliked" ? "default" : "outline"}
            size="icon"
            aria-label="Dislike"
            aria-pressed={outfit.status === "disliked"}
            disabled={pending}
            onClick={() => {
              if (outfit.status === "disliked") {
                setAskReason(false);
                react("suggested");
              } else {
                setAskReason(true);
                react("disliked");
              }
            }}
          >
            <ThumbsDown />
          </Button>
          <Button className="min-w-0 flex-1" onClick={wear} disabled={pending}>
            Wearing this
          </Button>
        </div>
      )}

      {askReason && outfit.status === "disliked" && (
        <div className="flex flex-col gap-2 px-1">
          <p className="text-xs text-muted-foreground">What was off? It helps your stylist.</p>
          <div className="flex flex-wrap gap-2">
            {DISLIKE_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                aria-pressed={outfit.feedbackReason === reason}
                onClick={() => {
                  react("disliked", reason);
                  setAskReason(false);
                }}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-sm",
                  outfit.feedbackReason === reason ? "border-primary bg-primary text-primary-foreground" : "bg-surface",
                )}
              >
                {reason}
              </button>
            ))}
          </div>
        </div>
      )}
      {outfit.status === "disliked" && !askReason && outfit.feedbackReason && (
        <p className="px-1 text-xs text-muted-foreground">Noted: {outfit.feedbackReason.toLowerCase()}.</p>
      )}
    </article>
  );
}
