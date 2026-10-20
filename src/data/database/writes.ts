const pending = new Set<Promise<unknown>>();
export async function trackWrite<T>(action: () => Promise<T>): Promise<T> {
  const task = action();
  pending.add(task);
  try {
    return await task;
  } finally {
    pending.delete(task);
  }
}
export function hasPendingWrites(): boolean {
  return pending.size > 0;
}
export async function waitForWrites(): Promise<void> {
  await Promise.allSettled([...pending]);
}
