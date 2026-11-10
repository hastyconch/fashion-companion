"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Camera, Check, ImagePlus, Loader2, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { preparePhoto } from "@/lib/images/resize";
import { createLimiter } from "@/lib/limiter";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Stage = "preparing" | "uploading" | "tagging" | "done" | "not_clothing" | "failed";

type Entry = {
  key: string;
  itemId: string;
  file: File;
  previewUrl: string;
  stage: Stage;
  /** True once the row exists, so a retry only needs to re-run tagging. */
  saved: boolean;
  description?: string | null;
  message?: string;
};

// Resizing is CPU-heavy on phones, uploads are network-heavy, tagging waits on AI.
const prepare = createLimiter(1);
const upload = createLimiter(2);
const tag = createLimiter(3);

const BUSY: Stage[] = ["preparing", "uploading", "tagging"];

export function ClosetSession({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<Entry[]>([]);
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const previews = useRef<string[]>([]);

  const patch = useCallback((key: string, changes: Partial<Entry>) => {
    setEntries((list) => list.map((e) => (e.key === key ? { ...e, ...changes } : e)));
  }, []);

  const runTagging = useCallback(
    async (entry: Entry) => {
      patch(entry.key, { stage: "tagging", message: undefined });
      try {
        const res = await tag(() => fetch(`/api/items/${entry.itemId}/tag`, { method: "POST" }));
        const body = await res.json().catch(() => null);
        if (res.status === 401) {
          patch(entry.key, { stage: "failed", message: "You were signed out. Sign in and retry." });
        } else if (body?.status === "done") {
          patch(entry.key, { stage: "done", description: body.description });
        } else if (body?.status === "not_clothing") {
          patch(entry.key, { stage: "not_clothing" });
        } else {
          patch(entry.key, { stage: "failed", message: body?.message ?? "Tagging didn't work." });
        }
      } catch {
        patch(entry.key, { stage: "failed", message: "No connection. Retry when you're back online." });
      }
    },
    [patch],
  );

  const processEntry = useCallback(
    async (entry: Entry) => {
      if (entry.saved) return runTagging(entry);

      patch(entry.key, { stage: "preparing", message: undefined });
      try {
        const { full, thumb } = await prepare(() => preparePhoto(entry.file));
        patch(entry.key, { stage: "uploading" });

        const base = `${userId}/${entry.itemId}`;
        await upload(async () => {
          const bucket = supabase.storage.from("closet");
          const options = { contentType: "image/jpeg", upsert: true, cacheControl: "31536000" };
          const results = await Promise.all([
            bucket.upload(`${base}/full.jpg`, full, options),
            bucket.upload(`${base}/thumb.jpg`, thumb, options),
          ]);
          const failed = results.find((r) => r.error);
          if (failed?.error) throw failed.error;

          const { error } = await supabase.from("items").insert({
            id: entry.itemId,
            image_path: `${base}/full.jpg`,
            thumb_path: `${base}/thumb.jpg`,
          });
          // 23505 = already inserted by an earlier attempt.
          if (error && error.code !== "23505") throw error;
        });
      } catch (error) {
        patch(entry.key, {
          stage: "failed",
          message: error instanceof Error && error.name === "UnsupportedImageError"
            ? error.message
            : "Upload failed. Check your connection and retry.",
        });
        return;
      }

      const saved = { ...entry, saved: true };
      patch(entry.key, { saved: true });
      await runTagging(saved);
    },
    [patch, runTagging, supabase, userId],
  );

  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      const added: Entry[] = Array.from(files)
        .filter((file) => file.type.startsWith("image/") || file.type === "")
        .map((file) => {
          const previewUrl = URL.createObjectURL(file);
          previews.current.push(previewUrl);
          return {
            key: crypto.randomUUID(),
            itemId: crypto.randomUUID(),
            file,
            previewUrl,
            stage: "preparing" as const,
            saved: false,
          };
        });
      // Newest on top in the list; processing still runs in the order picked.
      setEntries((list) => [...[...added].reverse(), ...list]);
      added.forEach((entry) => void processEntry(entry));
    },
    [processEntry],
  );

  const removeEntry = useCallback(
    async (entry: Entry) => {
      if (entry.saved) {
        const base = `${userId}/${entry.itemId}`;
        await supabase.storage.from("closet").remove([`${base}/full.jpg`, `${base}/thumb.jpg`]);
        await supabase.from("items").delete().eq("id", entry.itemId);
      }
      setEntries((list) => list.filter((e) => e.key !== entry.key));
    },
    [supabase, userId],
  );

  const busy = entries.some((e) => BUSY.includes(e.stage));

  // Warn before leaving while photos are still uploading or being tagged.
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const doneCount = entries.filter((e) => e.stage === "done").length;
  const reviewCount = entries.filter((e) => e.stage === "not_clothing" || e.stage === "failed").length;
  const workingCount = entries.filter((e) => BUSY.includes(e.stage)).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => cameraInput.current?.click()}
          className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-3xl bg-accent px-4 text-accent-foreground transition-transform active:scale-[0.98]"
        >
          <Camera className="size-7" strokeWidth={1.75} />
          <span className="text-sm font-medium">
            {entries.length ? "Take next photo" : "Take photo"}
          </span>
        </button>
        <button
          type="button"
          onClick={() => libraryInput.current?.click()}
          className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-3xl border bg-surface px-4 transition-transform active:scale-[0.98]"
        >
          <ImagePlus className="size-7" strokeWidth={1.75} />
          <span className="text-sm font-medium">Choose photos</span>
        </button>
      </div>

      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-label="Take a photo"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={libraryInput}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose photos"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          One item per photo, laid flat or hung against a plain wall, in good light. You can keep
          snapping while earlier photos upload and get tagged.
        </p>
      ) : (
        <section aria-label="This session" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {doneCount} added
              {workingCount > 0 && ` · ${workingCount} in progress`}
              {reviewCount > 0 && ` · ${reviewCount} need a look`}
            </p>
            <Button asChild variant="outline" size="sm" aria-disabled={busy}>
              <Link href="/closet">{busy ? "View closet" : "Done"}</Link>
            </Button>
          </div>
          <ul className="flex flex-col divide-y rounded-3xl border bg-surface">
            {entries.map((entry) => (
              <EntryRow
                key={entry.key}
                entry={entry}
                onRetry={() => void processEntry(entry)}
                onRemove={() => void removeEntry(entry)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const STAGE_TEXT: Record<Stage, string> = {
  preparing: "Preparing photo…",
  uploading: "Uploading…",
  tagging: "Tagging…",
  done: "Added",
  not_clothing: "This doesn't look like clothing",
  failed: "Something went wrong",
};

function EntryRow({
  entry,
  onRetry,
  onRemove,
}: {
  entry: Entry;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const working = BUSY.includes(entry.stage);
  const title =
    entry.stage === "done" ? (entry.description ?? "Added") : STAGE_TEXT[entry.stage];

  return (
    <li className="flex items-center gap-3 px-3 py-3">
      {/* Local preview of the photo just taken; it isn't uploaded yet. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={entry.previewUrl}
        alt=""
        className="size-14 shrink-0 rounded-xl bg-muted object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm", entry.stage === "done" && "font-medium")}>{title}</p>
        {entry.message && <p className="text-xs text-muted-foreground">{entry.message}</p>}
        {entry.stage === "not_clothing" && entry.saved && (
          <p className="text-xs text-muted-foreground">
            <Link href={`/closet/${entry.itemId}`} className="underline underline-offset-2">
              Keep it and add the details
            </Link>
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {working && (
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Working" />
        )}
        {entry.stage === "done" && <Check className="size-5 text-accent" aria-label="Done" />}
        {entry.stage === "failed" && (
          <>
            <AlertCircle className="size-5 text-destructive" aria-hidden />
            <Button variant="ghost" size="icon" onClick={onRetry} aria-label="Retry">
              <RotateCcw />
            </Button>
          </>
        )}
        {(entry.stage === "failed" || entry.stage === "not_clothing") && (
          <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remove">
            <X />
          </Button>
        )}
      </div>
    </li>
  );
}
