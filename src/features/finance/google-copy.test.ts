import { describe, expect, it } from 'vitest';
import { googleCopyHref } from './google-copy';

const url = 'https://docs.google.com/spreadsheets/d/modelo/copy';

describe('abertura da cópia Google', () => {
  it('direciona Android ao Chrome e preserva o destino HTTPS completo no fallback', () => {
    const result = googleCopyHref(url, 'Mozilla/5.0 (Linux; Android 14)');
    expect(result).toBe(
      `intent://docs.google.com/spreadsheets/d/modelo/copy#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`,
    );
  });
  it.each([
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
    'Mozilla/5.0 (Windows NT 10.0)',
  ])('preserva HTTPS em outros sistemas (%s)', (agent) => {
    expect(googleCopyHref(url, agent)).toBe(url);
  });
});
