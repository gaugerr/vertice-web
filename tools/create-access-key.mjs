// Never upload .secrets or include its contents in build artifacts.
import { generateKeyPair, exportJWK } from 'jose';
import { mkdir, writeFile, access } from 'node:fs/promises';
const target = '.secrets/license.env';
try {
  await access(target);
  throw new Error('Signing key already exists. Rotate keys deliberately.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
await mkdir('.secrets', { recursive: true, mode: 0o700 });
await writeFile(target, `LICENSE_SIGNING_JWK=${JSON.stringify(await exportJWK(privateKey))}\n`, {
  mode: 0o600,
});
await writeFile(
  'src/access/license-public-key.json',
  JSON.stringify(await exportJWK(publicKey), null, 2) + '\n',
);
console.log(
  'Private key saved to .secrets/license.env. Upload as a Supabase secret, never to GitHub. Public key updated; rebuild the app.',
);
