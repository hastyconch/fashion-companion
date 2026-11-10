"use client";

import { useEffect } from "react";
import { CloudOff } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

/** Shown when a page in the app fails to load (e.g. the database is unreachable). */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState icon={CloudOff} title="Couldn't load this page" action={<Button onClick={() => retry()}>Try again</Button>}>
      Check your connection. If it keeps happening, the service may be down for a moment.
    </EmptyState>
  );
}
