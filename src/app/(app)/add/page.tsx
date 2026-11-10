import type { Metadata } from "next";
import { Camera } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Add" };

export default function AddPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Add"
        title="Add to your closet"
        description="Lay the piece flat or hang it against a plain wall, in good light."
      />
      <EmptyState icon={Camera} title="Camera coming next">
        Taking and uploading photos, with automatic tagging, arrives in the next
        update.
      </EmptyState>
    </div>
  );
}
