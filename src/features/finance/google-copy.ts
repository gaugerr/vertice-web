// An explicit user-clicked Android intent can target Chrome instead of Sheets.
// HTTPS fallback preserves access when the browser cannot resolve that intent.
export function googleCopyHref(url: string, userAgent: string): string {
  if (!/Android/i.test(userAgent)) return url;
  return `intent://${url.replace(/^https:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
}
