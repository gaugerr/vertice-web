export async function boundedFetch(input, options = {}) {
  const controller = new AbortController();
  const signal = options.signal
    ? AbortSignal.any([controller.signal, options.signal])
    : controller.signal;
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    return await fetch(input, { ...options, signal });
  } finally {
    clearTimeout(timer);
  }
}
