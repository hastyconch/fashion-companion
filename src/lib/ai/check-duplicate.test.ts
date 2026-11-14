import { describe, expect, it, vi } from "vitest";

import { checkDuplicate } from "./check-duplicate";
import { AiError, MODEL, type AiClient } from "./client";

function fakeClient(response: unknown) {
  const parse = vi.fn().mockResolvedValue(response);
  return { client: { beta: { messages: { parse } } } as unknown as AiClient, parse };
}

const CANDIDATES = [
  { ref: "c1", imageUrl: "https://signed/a.jpg", description: "Navy tee" },
  { ref: "c2", imageUrl: "https://signed/b.jpg", description: null },
];

describe("checkDuplicate", () => {
  it("labels each closet photo with its ref, after the new photo", async () => {
    const verdict = { verdict: "same", match: "c1", reason: "Same pocket." };
    const { client, parse } = fakeClient({ stop_reason: "end_turn", parsed_output: verdict });
    expect(await checkDuplicate("https://signed/new.jpg", CANDIDATES, client)).toEqual(verdict);

    const params = parse.mock.calls[0][0];
    expect(params.model).toBe(MODEL);
    expect(params.fallbacks).toBe("default");
    expect(params.output_config.effort).toBe("low");
    const content = params.messages[0].content;
    expect(content.map((b: { type: string; text?: string; source?: { url: string } }) => b.text ?? b.source?.url)).toEqual([
      "New item:",
      "https://signed/new.jpg",
      "Already in the closet:",
      "c1: Navy tee",
      "https://signed/a.jpg",
      "c2: untitled item",
      "https://signed/b.jpg",
      "Is the new item one of these?",
    ]);
  });

  it("reports refusals, and errors on cut-off or missing answers", async () => {
    expect(await checkDuplicate("u", CANDIDATES, fakeClient({ stop_reason: "refusal" }).client)).toEqual({ refused: true });
    await expect(checkDuplicate("u", CANDIDATES, fakeClient({ stop_reason: "max_tokens" }).client)).rejects.toThrow(AiError);
    await expect(checkDuplicate("u", CANDIDATES, fakeClient({ stop_reason: "end_turn" }).client)).rejects.toThrow(AiError);
  });
});
