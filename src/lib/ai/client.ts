import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/** The default model for every AI feature (see docs/PLAN.md for costs). */
export const MODEL = "claude-opus-5-5";

/**
 * Beta for `fallbacks: "default"`: re-runs a refused request on a suitable
 * model inside the same API call. Send both on every request.
 */
export const REFUSAL_FALLBACK_BETA = "server-side-fallback-2026-07-01";

export class MissingApiKeyError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set. Add it as a Cloudflare Worker secret (or to .env.local).");
    this.name = "MissingApiKeyError";
  }
}

let client: Anthropic | undefined;

/** Shared Anthropic client. Server-only: the key never reaches the browser. */
export function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new MissingApiKeyError();
  client ??= new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 });
  return client;
}
