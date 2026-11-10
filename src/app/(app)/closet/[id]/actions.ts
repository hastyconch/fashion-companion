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
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("items")
    .select("image_path, thumb_path")
    .eq("id", itemId)
    .maybeSingle();
  if (item) {
    await supabase.storage.from("closet").remove([item.image_path, item.thumb_path]);
    await supabase.from("items").delete().eq("id", itemId);
  }
  redirect("/closet");
}
