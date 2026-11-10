import Link from "next/link";
import { SearchX } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function ItemNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Item not found"
      action={
        <Button asChild>
          <Link href="/closet">Back to closet</Link>
        </Button>
      }
    >
      It may have been deleted.
    </EmptyState>
  );
}
