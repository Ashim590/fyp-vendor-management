/**
 * Unique labels for console.time / console.timeEnd so concurrent requests don't collide.
 */
export function perfLabel(prefix: string): string {
  return `${prefix}:${process.hrtime.bigint()}`;
}

/** Measure async work; always calls timeEnd in finally (even on throw). */
export async function timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  console.time(label);
  try {
    return await fn();
  } finally {
    console.timeEnd(label);
  }
}
