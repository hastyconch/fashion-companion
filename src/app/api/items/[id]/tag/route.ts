import type { NextRequest } from "next/server";

import { tagItemImage } from "@/lib/ai/tag-item";
import { isUuid } from "@/lib/items/ids";
import { runItemTagging } from "@/lib/items/tag-flow";
import { createClient } from "@/lib/supabase/server";

/**
 * Tags one item with AI. A Route Handler rather than a Server Action because
 * the add screen tags several items in parallel, and Server Actions run one
 * at a time.
 */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/items/[id]/tag">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return Response.json({ error: "Item not found." }, { status: 404 });

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return Response.json({ error: "Sign in again." }, { status: 401 });

  const result = await runItemTagging(id, { supabase, tag: (url) => tagItemImage(url) });
  return Response.json(result.body, { status: result.httpStatus });
}
