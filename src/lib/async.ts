/** Rejects if `promise` doesn't settle within `ms`, so a stalled request can never leave a button spinning forever. */
export function withTimeout<T>(promise: Promise<T>, ms: number, message = "The request timed out. Please try again."): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
