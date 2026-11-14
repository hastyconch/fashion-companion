"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";

import { DuplicatePrompt } from "@/components/closet/duplicate-prompt";
import { Button } from "@/components/ui/button";
import type { DuplicateOf, TagStatus } from "@/lib/items/queries";
import type { ItemStatus } from "@/lib/items/vocabulary";
import { cn } from "@/lib/utils";
import { answerDuplicate, deleteItem, setItemStatus } from "./actions";

const STATUS_OPTIONS: { value: ItemStatus; label: string }[] = [
  { value: "active", label: "In closet" },
  { value: "laundry", label: "In laundry" },
  { value: "archived", label: "Archived" },
];

export function StatusControl({ itemId, status }: { itemId: string; status: ItemStatus }) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState(status);

  return (
    <div
      role="radiogroup"
      aria-label="Status"
      className={cn("grid grid-cols-3 gap-1 rounded-2xl border bg-surface p-1", pending && "opacity-70")}
    >
      {STATUS_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={optimistic === option.value}
          onClick={() => {
            setOptimistic(option.value);
            startTransition(() => setItemStatus(itemId, option.value));
          }}
          className={cn(
            "min-h-11 rounded-xl text-sm transition-colors",
            optimistic === option.value ? "bg-primary text-primary-foreground" : "hover:bg-muted",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function RetryTagging({ itemId, tagStatus }: { itemId: string; tagStatus: TagStatus }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const text =
    tagStatus === "pending"
      ? "Tagging didn't finish."
      : tagStatus === "not_clothing"
        ? "This didn't look like clothing to the tagger."
        : "Automatic tagging failed.";

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm">
        {text} Fill in the details below, or try again.
        {message && <span className="block text-destructive">{message}</span>}
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={state === "working"}
        onClick={async () => {
          setState("working");
          setMessage(null);
          try {
            const res = await fetch(`/api/items/${itemId}/tag`, { method: "POST" });
            const body = await res.json().catch(() => null);
            if (body?.status === "failed") setMessage(body.message);
            setState(body?.status === "failed" ? "error" : "idle");
          } catch {
            setMessage("No connection.");
            setState("error");
          }
          router.refresh();
        }}
      >
        <RotateCcw /> {state === "working" ? "Tagging…" : "Try again"}
      </Button>
    </div>
  );
}

export function DeleteItem({ itemId }: { itemId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button variant="ghost" className="self-start text-destructive" onClick={() => setConfirming(true)}>
        <Trash2 /> Delete item
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/40 px-4 py-3">
      <p className="text-sm">Delete this item and its photo? This can&apos;t be undone.</p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="border-destructive text-destructive"
          disabled={pending}
          onClick={() => startTransition(() => deleteItem(itemId))}
        >
          {pending ? "Deleting…" : "Delete"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function DuplicateQuestion({
  itemId,
  photoUrl,
  match,
}: {
  itemId: string;
  photoUrl: string | null;
  match: DuplicateOf;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <DuplicatePrompt
      newPhotoUrl={photoUrl}
      match={match}
      busy={pending}
      onAnswer={(answer) => startTransition(() => answerDuplicate(itemId, answer))}
    />
  );
}
