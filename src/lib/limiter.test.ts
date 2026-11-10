import { describe, expect, it } from "vitest";

import { createLimiter } from "./limiter";

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe("createLimiter", () => {
  it("never runs more than the limit at once, and runs everything", async () => {
    const run = createLimiter(2);
    let active = 0;
    let peak = 0;
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        run(async () => {
          active++;
          peak = Math.max(peak, active);
          await tick();
          active--;
          return n * 10;
        }),
      ),
    );
    expect(peak).toBe(2);
    expect(results).toEqual([10, 20, 30, 40, 50]);
  });

  it("keeps going after a task fails", async () => {
    const run = createLimiter(1);
    const failed = run(async () => {
      throw new Error("boom");
    });
    await expect(failed).rejects.toThrow("boom");
    await expect(run(async () => "ok")).resolves.toBe("ok");
  });
});
