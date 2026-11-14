"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { parseEditForm } from "@/lib/items/edit";
import { isUuid } from "@/lib/items/ids";
import { ITEM_STATUSES, type ItemStatus } from "@/lib/items/vocabulary";
import { createClient } from "@/lib/supabase/server";

export type EditState = { status: "idle" | "saved" | "error"; message?: string };

/** Saves edited tags. A manual edit also clears "needs a look". */
export async function saveItemTags(
  itemId: string,
  _previous: EditState,
  form: FormData,
): Promise<EditState> {
  if (!isUuid(itemId)) return { status: "error", message: "Item not found." };
  const parsed = parseEditForm(form);
  if (!parsed.ok) return { status: "error", message: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .update({ ...parsed.columns, tag_status: "done" })
    .eq("id", itemId)
    .select("id");
  if (error) return { status: "error", message: "Couldn't save. Try again." };
  if (!data.length) return { status: "error", message: "Item not found." };

  refresh();
  return { status: "saved" };
}

export async function setItemStatus(itemId: string, status: ItemStatus) {
  if (!isUuid(itemId) || !ITEM_STATUSES.includes(status)) return;
  const supabase = await createClient();
  await supabase.from("items").update({ status }).eq("id", itemId);
  refresh();
}

/** Deletes the item and both of its photos, then returns to the closet. */
export async function deleteItem(itemId: string) {
  if (!isUuid(itemId)) return;
  await removeItem(await createClient(), itemId);
  redirect("/closet");
}

const DUPLICATE_ANSWERS = ["same", "similar", "different"] as const;

/**
 * Answers "Looks like you already own this". Same item deletes this (newer)
 * one and opens the original; the other answers keep both.
 */
export async function answerDuplicate(itemId: string, answer: (typeof DUPLICATE_ANSWERS)[number]) {
  if (!isUuid(itemId) || !DUPLICATE_ANSWERS.includes(answer)) return;
  const supabase = await createClient();
  if (answer === "same") {
    const original = await removeItem(supabase, itemId);
    redirect(original ? `/closet/${original}` : "/closet");
  }
  await supabase.from("items").update({ duplicate_status: answer }).eq("id", itemId);
  refresh();
}

/** Deletes an item's photos and row. Returns the item it was a duplicate of, if any. */
async function removeItem(supabase: Awaited<ReturnType<typeof createClient>>, itemId: string) {
  const { data: item } = await supabase
    .from("items")
    .select("image_path, thumb_path, duplicate_of")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return null;
  await supabase.storage.from("closet").remove([item.image_path, item.thumb_path]);
  await supabase.from("items").delete().eq("id", itemId);
  return item.duplicate_of as string | null;
}
