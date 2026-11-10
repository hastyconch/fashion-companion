import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { ClosetSession } from "./closet-session";

export const metadata: Metadata = { title: "Add" };

export default async function AddPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/login?next=/add");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Add"
        title="Add to your closet"
        description="Snap one item at a time. We'll tag each piece while you keep going."
      />
      <ClosetSession userId={userId} />
    </div>
  );
}
