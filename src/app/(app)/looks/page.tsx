import type { Metadata } from "next";
import { Layers } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Looks" };

export default function LooksPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Looks" title="Outfits you love" />
      <EmptyState icon={Layers} title="No looks yet">
        Outfits you like or wear will collect here, so you can come back to them.
      </EmptyState>
    </div>
  );
}
