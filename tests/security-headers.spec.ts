import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// vercel.json's headers (CSP, Permissions-Policy) are only ever served by
// the real Vercel deployment -- the local Playwright webServer (vite
// preview) does not apply them. These checks read the config file directly
// instead of relying on a running browser, so a regression here fails CI
// immediately instead of silently passing every other test in this suite.

const root = path.resolve(__dirname, '..');
const vercelConfig = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const headerRules = vercelConfig.headers[0].headers as { key: string; value: string }[];

function getHeader(key: string): string {
  const rule = headerRules.find((h) => h.key === key);
  if (!rule) throw new Error(`Header "${key}" not found in vercel.json`);
  return rule.value;
}

test('Permissions-Policy allows camera for same-origin use', () => {
  // camera=() with no allowlist blocks getUserMedia() everywhere, including
  // for the site itself -- this is exactly the bug that broke the selfie
  // feature even after the user granted browser permission.
  const value = getHeader('Permissions-Policy');
  expect(value).toMatch(/camera=\(\s*self\s*\)/);
});

test('CSP frame-ancestors blocks embedding (clickjacking protection for the admin panel)', () => {
  const csp = getHeader('Content-Security-Policy');
  expect(csp).toMatch(/frame-ancestors\s+'none'/);
});

test('CSP connect-src and img-src allow Supabase (data + selfie storage)', () => {
  const csp = getHeader('Content-Security-Policy');
  expect(csp).toMatch(/connect-src[^;]*supabase\.co/);
  expect(csp).toMatch(/img-src[^;]*supabase\.co/);
});
