/**
 * Runs at most `concurrency` tasks at once; extra calls wait their turn.
 * Used to keep a phone from uploading or tagging 20 photos simultaneously.
 */
export function createLimiter(concurrency: number) {
  let active = 0;
  const waiting: (() => void)[] = [];

  // A finished task hands its slot straight to the next waiter.
  const release = () => {
    const wake = waiting.shift();
    if (wake) wake();
    else active--;
  };

  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active < concurrency) active++;
    else await new Promise<void>((resolve) => waiting.push(resolve));
    try {
      return await task();
    } finally {
      release();
    }
  };
}
