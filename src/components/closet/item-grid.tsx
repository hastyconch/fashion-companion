import Link from "next/link";
import { Shirt } from "lucide-react";

import type { ClosetCard } from "@/lib/items/queries";
import { cn } from "@/lib/utils";

export function ItemGrid({ items }: { items: ClosetCard[] }) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/closet/${item.id}`}
            className="group relative block aspect-square overflow-hidden rounded-2xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {item.thumbUrl ? (
              // Signed Storage URLs; Next's image optimizer isn't used on Workers.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.thumbUrl}
                alt={item.description ?? "Closet item"}
                loading="lazy"
                decoding="async"
                className={cn(
                  "size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]",
                  item.status === "archived" && "opacity-50 grayscale",
                )}
              />
            ) : (
              <span className="flex size-full items-center justify-center">
                <Shirt className="size-6 text-muted-foreground" />
              </span>
            )}
            <Badge item={item} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Badge({ item }: { item: ClosetCard }) {
  let label: string | null = null;
  const attention = item.tag_status !== "done" || item.possibleDuplicate;
  if (item.tag_status === "pending") label = "Tagging…";
  else if (item.tag_status !== "done") label = "Needs a look";
  else if (item.possibleDuplicate) label = "Duplicate?";
  else if (item.status === "laundry") label = "Laundry";
  if (!label) return null;

  return (
    <span
      className={cn(
        "absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium backdrop-blur",
        attention ? "bg-accent/90 text-accent-foreground" : "bg-background/85 text-foreground",
      )}
    >
      {label}
    </span>
  );
}
