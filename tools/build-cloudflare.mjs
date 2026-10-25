// Public configuration only. OAuth and signing secrets stay in Supabase.
import { execFileSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';

process.env.VITE_ACCESS_MODE = 'enforced';
process.env.VITE_SUPABASE_URL ||= 'https://wqutcsjdozcukwxvkbtc.supabase.co';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||= 'sb_publishable_na1zSXjXeXTF0RzGkpplhA__XR1-0Sl';
execFileSync('npm', ['run', 'build'], { env: process.env, stdio: 'inherit' });
// Disable Pages' implicit SPA fallback so missing assets return a real 404.
// Known application routes are rewritten by public/_redirects instead.
copyFileSync('dist/index.html', 'dist/404.html');
// Pages canonicalizes index.html to /. Use a distinct HTML shell for rewrites
// so direct application routes (including the OAuth callback) keep their URL.
copyFileSync('dist/index.html', 'dist/app-shell.html');
