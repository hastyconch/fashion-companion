"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FULL_SIZE, fitWithin } from "@/lib/images/resize";
import { cn } from "@/lib/utils";

export type CameraLatest = { previewUrl: string; state: "working" | "done" | "problem" } | null;

type Props = {
  /** Called with each captured photo; the camera stays open for the next one. */
  onCapture: (file: File) => void;
  onClose: () => void;
  /** Opens the phone's own camera instead (used when in-app capture isn't possible). */
  onFallback: () => void;
  addedCount: number;
  latest: CameraLatest;
};

/** True when this browser can show a live camera inside the page. */
export function canUseInAppCamera(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

/**
 * A full-screen viewfinder that stays open between shots: one tap per item,
 * no round trip through the camera app and no "Use Photo" confirmation.
 */
export function CameraCapture({ onCapture, onClose, onFallback, addedCount, latest }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"starting" | "ready" | "error">("starting");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let active = true;

    const stop = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };

    // Every state update below happens after an await, never synchronously in the effect.
    const start = async () => {
      stop();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 2560 },
            height: { ideal: 1920 },
          },
        });
        const video = videoRef.current;
        if (!active || !video) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        video.srcObject = stream;
        await video.play();
        if (active) setStatus("ready");
      } catch (err) {
        stop();
        if (!active) return;
        setError(cameraErrorMessage(err));
        setStatus("error");
      }
    };

    void start();

    // Phones stop the camera when the app goes to the background; restart on return.
    const onVisible = () => {
      const track = streamRef.current?.getVideoTracks()[0];
      if (document.visibilityState === "visible" && (!track || track.readyState === "ended")) {
        setStatus("starting");
        void start();
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("keydown", onKey);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("keydown", onKey);
      stop();
    };
  }, [onClose]);

  const capture = () => {
    const video = videoRef.current;
    if (status !== "ready" || !video?.videoWidth) return;
    // Capture straight at the stored size; no point keeping more pixels than we upload.
    const { width, height } = fitWithin(video.videoWidth, video.videoHeight, FULL_SIZE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
    setFlash(true);
    setTimeout(() => setFlash(false), 120);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Camera"
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
    >
      <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <p className="text-sm text-white/80" aria-live="polite">
          {addedCount === 0 ? "Fit one item in the frame" : `${addedCount} taken this session`}
        </p>
        <Button
          variant="ghost"
          onClick={onClose}
          className="text-white hover:bg-white/10 hover:text-white"
        >
          Done
        </Button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          aria-label="Camera preview"
          className="size-full object-cover"
        />
        {status === "ready" && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-6 inset-y-8 rounded-3xl border-2 border-white/40"
          />
        )}
        {status === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-8 animate-spin text-white/70" aria-label="Starting camera" />
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <AlertCircle className="size-8 text-white/80" aria-hidden />
            <p className="text-sm text-white/90">{error}</p>
            <Button
              onClick={onFallback}
              className="bg-white text-black hover:bg-white/90"
            >
              Use the phone&apos;s camera instead
            </Button>
          </div>
        )}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 bg-white transition-opacity duration-150",
            flash ? "opacity-70" : "opacity-0",
          )}
        />
      </div>

      <div className="grid grid-cols-3 items-center px-6 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex justify-start">
          {latest && (
            <div className="relative size-14 overflow-hidden rounded-xl border border-white/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={latest.previewUrl} alt="Last photo" className="size-full object-cover" />
              <span className="absolute right-0.5 bottom-0.5 flex size-5 items-center justify-center rounded-full bg-black/70">
                {latest.state === "working" && <Loader2 className="size-3 animate-spin" aria-label="Processing" />}
                {latest.state === "done" && <Check className="size-3" aria-label="Added" />}
                {latest.state === "problem" && <AlertCircle className="size-3" aria-label="Needs a look" />}
              </span>
            </div>
          )}
        </div>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={capture}
            disabled={status !== "ready"}
            aria-label="Take photo"
            className="flex size-20 items-center justify-center rounded-full border-4 border-white transition-transform active:scale-90 disabled:opacity-40"
          >
            <span className="size-16 rounded-full bg-white" />
          </button>
        </div>
        <div />
      </div>
    </div>
  );
}

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera access is blocked. Allow it in your browser settings, or use the phone's camera instead.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No camera was found on this device.";
  }
  if (name === "NotSupportedError") {
    return "This browser can't show the camera inside the app. Use the phone's camera instead.";
  }
  if (name === "NotReadableError") {
    return "The camera is being used by another app. Close it and try again.";
  }
  return "Couldn't start the camera.";
}
