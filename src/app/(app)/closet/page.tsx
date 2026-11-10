import type { Metadata } from "next";
import Link from "next/link";
import { Shirt } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Closet" };

export default function ClosetPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Closet" title="Everything you own" />
      <EmptyState
        icon={Shirt}
        title="Your closet is empty"
        action={
          <Button asChild>
            <Link href="/add">Add your first item</Link>
          </Button>
        }
      >
        Add about 10 pieces (tops, bottoms, shoes, a jacket) and your stylist can
        start putting outfits together.
      </EmptyState>
    </div>
  );
}
