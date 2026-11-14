import type { NextRequest } from "next/server";

import { checkDuplicate } from "@/lib/ai/check-duplicate";
import { tagItemImage } from "@/lib/ai/tag-item";
import { findDuplicate } from "@/lib/items/duplicate-flow";
import { isUuid } from "@/lib/items/ids";
import { runItemTagging } from "@/lib/items/tag-flow";
import { createClient } from "@/lib/supabase/server";

/**
 * Tags one item with AI, then checks whether it's something the user already
 * owns. A Route Handler rather than a Server Action because the add screen
 * tags several items in parallel, and Server Actions run one at a time.
 */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/items/[id]/tag">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return Response.json({ error: "Item not found." }, { status: 404 });

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return Response.json({ error: "Sign in again." }, { status: 401 });

  const result = await runItemTagging(id, { supabase, tag: (url) => tagItemImage(url) });
  if ("status" in result.body && result.body.status === "done") {
    // Needs the new tags to pick lookalikes, so it runs after tagging. It never fails the request.
    const duplicate = await findDuplicate(id, { supabase, check: (url, candidates) => checkDuplicate(url, candidates) });
    return Response.json({ ...result.body, duplicate }, { status: result.httpStatus });
  }
  return Response.json(result.body, { status: result.httpStatus });
}
