import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { describe, expect, it, vi } from "vitest";

import { ItemTagsSchema, type ItemTags } from "@/lib/items/tags";
import { MODEL } from "./client";
import { TaggingError, tagItemImage, type TaggerClient } from "./tag-item";

const TAGS: ItemTags = {
  is_clothing: true,
  category: "shoes",
  subcategory: "ankle boots",
  colors: ["black"],
  pattern: "solid",
  material: "leather",
  formality: 3,
  warmth: 3,
  seasons: ["autumn", "winter"],
  style_tags: ["classic"],
  description: "Black leather ankle boots",
  brand: null,
};

function fakeClient(response: unknown) {
  const parse = vi.fn().mockResolvedValue(response);
  const client = { beta: { messages: { parse } } } as unknown as TaggerClient;
  return { client, parse };
}

describe("tagItemImage", () => {
  it("sends the photo by URL with the house settings", async () => {
    const { client, parse } = fakeClient({ stop_reason: "end_turn", parsed_output: TAGS });
    await tagItemImage("https://storage.example/signed.jpg", client);

    const params = parse.mock.calls[0][0];
    expect(params.model).toBe(MODEL);
    expect(params.fallbacks).toBe("default");
    expect(params.betas).toContain("server-side-fallback-2026-07-01");
    expect(params.output_config.effort).toBe("low");
    expect(params.output_config.format).toBeDefined();
    expect(params.messages[0].content[0]).toEqual({
      type: "image",
      source: { type: "url", url: "https://storage.example/signed.jpg" },
    });
  });

  it("returns the tags", async () => {
    const { client } = fakeClient({ stop_reason: "end_turn", parsed_output: TAGS });
    await expect(tagItemImage("https://x", client)).resolves.toEqual({ kind: "tagged", tags: TAGS });
  });

  it("reports photos that aren't clothing", async () => {
    const { client } = fakeClient({
      stop_reason: "end_turn",
      parsed_output: { ...TAGS, is_clothing: false },
    });
    await expect(tagItemImage("https://x", client)).resolves.toEqual({ kind: "not_clothing" });
  });

  it("checks for a refusal before reading the output", async () => {
    const { client } = fakeClient({ stop_reason: "refusal", parsed_output: null });
    await expect(tagItemImage("https://x", client)).resolves.toEqual({ kind: "refused" });
  });

  it("treats a cut-off or empty response as a failure", async () => {
    const cutOff = fakeClient({ stop_reason: "max_tokens", parsed_output: null }).client;
    const empty = fakeClient({ stop_reason: "end_turn", parsed_output: null }).client;
    await expect(tagItemImage("https://x", cutOff)).rejects.toBeInstanceOf(TaggingError);
    await expect(tagItemImage("https://x", empty)).rejects.toBeInstanceOf(TaggingError);
  });

  it("wraps API and parse errors", async () => {
    const parse = vi.fn().mockRejectedValue(new Error("Failed to parse structured output"));
    const client = { beta: { messages: { parse } } } as unknown as TaggerClient;
    await expect(tagItemImage("https://x", client)).rejects.toBeInstanceOf(TaggingError);
  });
});

describe("ItemTagsSchema as a structured-output format", () => {
  it("converts to a JSON schema the SDK accepts", () => {
    const format = betaZodOutputFormat(ItemTagsSchema);
    expect(format.type).toBe("json_schema");
    expect(JSON.stringify(format.schema)).toContain("is_clothing");
  });
});
