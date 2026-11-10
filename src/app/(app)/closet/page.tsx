import type { Metadata } from "next";
import Link from "next/link";
import { SearchX, Shirt } from "lucide-react";

import { ClosetFilterBar } from "@/components/closet/closet-filters";
import { ItemGrid } from "@/components/closet/item-grid";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { hasActiveFilters, parseClosetFilters } from "@/lib/items/filters";
import { listClosetItems } from "@/lib/items/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Closet" };

export default async function ClosetPage({ searchParams }: PageProps<"/closet">) {
  const filters = parseClosetFilters(await searchParams);
  const supabase = await createClient();
  const items = await listClosetItems(supabase, filters);
  const filtered = hasActiveFilters(filters);

  if (!filtered && items.length === 0) {
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
          Add about 10 pieces (tops, bottoms, shoes, a jacket) and your stylist can start putting
          outfits together.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Closet"
        title="Everything you own"
        description={`${items.length} ${items.length === 1 ? "piece" : "pieces"}${filtered ? " match" : ""}`}
      />
      <ClosetFilterBar filters={filters} />
      {items.length > 0 ? (
        <ItemGrid items={items} />
      ) : (
        <EmptyState
          icon={SearchX}
          title="Nothing matches"
          action={
            <Button asChild variant="outline">
              <Link href="/closet">Clear filters</Link>
            </Button>
          }
        >
          Try fewer filters, or a different search.
        </EmptyState>
      )}
    </div>
  );
}
