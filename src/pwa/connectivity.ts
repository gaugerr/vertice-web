export function observeConnectivity(onChange: (online: boolean) => void): () => void {
  let current: AbortController | undefined;
  async function check() {
    current?.abort();
    const request = new AbortController();
    current = request;
    const timer = setTimeout(() => request.abort(), 4000);
    let online = false;
    try {
      const response = await fetch(`/online.txt?t=${Date.now()}`, {
        cache: 'no-store',
        signal: request.signal,
      });
      online = response.ok && (await response.text()).trim() === 'vertice-online-v1';
    } catch {
      /* Losing connectivity is expected; records stay in IndexedDB. */
    } finally {
      clearTimeout(timer);
    }
    if (current === request) onChange(online);
  }
  const offline = () => {
    current?.abort();
    current = undefined;
    onChange(false);
  };
  const visible = () => {
    if (document.visibilityState === 'visible') void check();
  };
  window.addEventListener('online', check);
  window.addEventListener('offline', offline);
  window.addEventListener('focus', visible);
  document.addEventListener('visibilitychange', visible);
  const interval = setInterval(visible, 60000);
  void check();
  return () => {
    current?.abort();
    clearInterval(interval);
    window.removeEventListener('online', check);
    window.removeEventListener('offline', offline);
    window.removeEventListener('focus', visible);
    document.removeEventListener('visibilitychange', visible);
  };
}
