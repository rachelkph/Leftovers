// Packages the built site + the scan function in Vercel's Build Output API format
// (https://vercel.com/docs/build-output-api). Run after `vite build`: `npm run build:vercel`.
//
//   .vercel/output/static/                 ← dist/ (the website)
//   .vercel/output/functions/api/scan.func ← server/vercelScan.ts, bundled
//   .vercel/output/config.json             ← routing: files, then /api, then the app for every other path
import { build } from 'esbuild';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

const OUT = '.vercel/output';
const FN = `${OUT}/functions/api/scan.func`;

await rm(OUT, { recursive: true, force: true });
await mkdir(FN, { recursive: true });

// 1. The website.
await cp('dist', `${OUT}/static`, { recursive: true });

// 2. The scan function: one self-contained ES module.
await build({
  entryPoints: ['server/vercelScan.ts'],
  outfile: `${FN}/index.mjs`,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // Lets bundled CommonJS dependencies call require() inside an ES module.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: 'warning',
});
await writeFile(
  `${FN}/.vc-config.json`,
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 120 }, null, 2),
);

// 3. Routing. Real files and the function first; unknown /api paths 404; everything else is the app
//    (it uses page addresses like /fridge, which must load index.html on refresh).
await writeFile(
  `${OUT}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/assets/(.*)$', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true },
        { handle: 'filesystem' },
        { src: '^/api/.*$', status: 404 },
        { src: '^/(.*)$', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);

console.log('✓ Vercel output written to .vercel/output');
