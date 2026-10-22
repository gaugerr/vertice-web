// Public configuration only. OAuth and signing secrets stay in Supabase.
import { execFileSync } from 'node:child_process';
const preview =
  process.env.VERCEL_ENV === 'preview' &&
  process.env.VERCEL_GIT_COMMIT_REF === 'feat/google-access';
const production =
  process.env.VERCEL_ENV === 'production' && process.env.VERCEL_GIT_COMMIT_REF === 'main';
if (preview || production) {
  process.env.VITE_ACCESS_MODE = 'enforced';
  process.env.VITE_SUPABASE_URL ||= 'https://wqutcsjdozcukwxvkbtc.supabase.co';
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||= 'sb_publishable_na1zSXjXeXTF0RzGkpplhA__XR1-0Sl';
}
execFileSync('npm', ['run', 'build'], { env: process.env, stdio: 'inherit' });
