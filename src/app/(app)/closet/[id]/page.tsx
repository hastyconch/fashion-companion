import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Shirt } from "lucide-react";

import { isUuid } from "@/lib/items/ids";
import { getItem } from "@/lib/items/queries";
import { createClient } from "@/lib/supabase/server";
import { DeleteItem, RetryTagging, StatusControl } from "./item-controls";
import { TagEditor } from "./tag-editor";

export const metadata: Metadata = { title: "Item" };

export default async function ItemPage({ params }: PageProps<"/closet/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const item = await getItem(supabase, id);
  if (!item) notFound();

  const wornText =
    item.wear_count > 0
      ? `Worn ${item.wear_count} ${item.wear_count === 1 ? "time" : "times"}`
      : "Not worn yet";

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/closet"
        className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start rounded-full px-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Closet
      </Link>

      <div className="grid gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-start">
        <div className="flex flex-col gap-4 md:sticky md:top-8">
          <div className="aspect-[4/5] overflow-hidden rounded-3xl bg-muted">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imageUrl}
                alt={item.description ?? "Closet item"}
                className="size-full object-contain"
              />
            ) : (
              <span className="flex size-full items-center justify-center">
                <Shirt className="size-10 text-muted-foreground" />
              </span>
            )}
          </div>
          <div className="space-y-1">
            <h1 className="font-display text-2xl leading-tight md:text-3xl">
              {item.description ?? "Untitled item"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {wornText} · Added{" "}
              {new Date(item.created_at).toLocaleDateString("en", { month: "short", day: "numeric" })}
            </p>
          </div>
          <StatusControl itemId={item.id} status={item.status} />
        </div>

        <div className="flex flex-col gap-6">
          {item.tag_status !== "done" && (
            <RetryTagging itemId={item.id} tagStatus={item.tag_status} />
          )}
          <TagEditor key={`${item.id}-${item.tag_status}`} item={item} />
          <DeleteItem itemId={item.id} />
        </div>
      </div>
    </div>
  );
}
