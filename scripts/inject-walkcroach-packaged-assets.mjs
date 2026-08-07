#!/usr/bin/env node
/**
 * D6.0 — After gulp vscode-win32-*, copy WalkCroach prebuilt media into the
 * packaged app tree. Gulp's vscodeResourceIncludes do not list our .js bundles,
 * and webviews / Agent Host resolve them under resources/app/out/...
 *
 * Usage:
 *   node scripts/inject-walkcroach-packaged-assets.mjs [path-to-VSCode-win32-arch]
 * Default: ../VSCode-win32-x64 then ../VSCode-win32-arm64 relative to vscode/.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vscodeRoot = join(root, 'vscode');

const ASSETS = [
  {
    src: join(
      vscodeRoot,
      'src/vs/platform/agentHost/node/walkcroach/media/engine-bundle.cjs',
    ),
    altSrc: join(root, 'packages/desktop-agent/dist-bundle/engine-bundle.cjs'),
    destRel: 'out/vs/platform/agentHost/node/walkcroach/media/engine-bundle.cjs',
    required: true,
  },
  {
    src: join(vscodeRoot, 'src/vs/workbench/contrib/walkcroach/browser/media/agent-ui.js'),
    destRel: 'out/vs/workbench/contrib/walkcroach/browser/media/agent-ui.js',
    required: true,
  },
  {
    src: join(vscodeRoot, 'src/vs/workbench/contrib/walkcroach/browser/media/settings-ui.js'),
    destRel: 'out/vs/workbench/contrib/walkcroach/browser/media/settings-ui.js',
    required: true,
  },
  {
    src: join(vscodeRoot, 'src/vs/workbench/contrib/walkcroach/browser/media/walkcroach-icon.svg'),
    destRel: 'out/vs/workbench/contrib/walkcroach/browser/media/walkcroach-icon.svg',
    required: false,
  },
  {
    src: join(vscodeRoot, 'src/vs/workbench/contrib/walkcroach/browser/media/walkcroach.css'),
    destRel: 'out/vs/workbench/contrib/walkcroach/browser/media/walkcroach.css',
    required: false,
  },
];

function resolvePackageRoot(explicit) {
  if (explicit) {
    if (!existsSync(explicit)) {
      throw new Error(`Packaged folder not found: ${explicit}`);
    }
    return explicit;
  }
  const parent = dirname(vscodeRoot);
  const candidates = ['VSCode-win32-x64', 'VSCode-win32-arm64'].map((n) => join(parent, n));
  for (const c of candidates) {
    if (existsSync(c)) {
      return c;
    }
  }
  throw new Error(
    `No VSCode-win32-* folder beside vscode/. Pass an explicit path.\nTried:\n${candidates.join('\n')}`,
  );
}

function appRootOf(packageRoot) {
  const withResources = join(packageRoot, 'resources', 'app');
  if (existsSync(withResources)) {
    return withResources;
  }
  if (existsSync(join(packageRoot, 'out')) || existsSync(join(packageRoot, 'product.json'))) {
    return packageRoot;
  }
  throw new Error(`Cannot locate resources/app under ${packageRoot}`);
}

const packageRoot = resolvePackageRoot(process.argv[2]);
const appRoot = appRootOf(packageRoot);
console.log(`[inject] package=${packageRoot}`);
console.log(`[inject] appRoot=${appRoot}`);

let failed = false;
for (const asset of ASSETS) {
  const src = existsSync(asset.src) ? asset.src : asset.altSrc;
  if (!src || !existsSync(src)) {
    const msg = `[inject] missing source for ${asset.destRel}`;
    if (asset.required) {
      console.error(msg);
      failed = true;
    } else {
      console.warn(`${msg} (optional)`);
    }
    continue;
  }
  const dest = join(appRoot, asset.destRel);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  const kb = (statSync(dest).size / 1024).toFixed(1);
  console.log(`[inject] ${asset.destRel} (${kb} KiB)`);
}

if (failed) {
  process.exit(1);
}

for (const rel of [
  'out/vs/platform/agentHost/node/walkcroach/media',
  'out/vs/workbench/contrib/walkcroach/browser/media',
]) {
  const dir = join(appRoot, rel);
  if (existsSync(dir)) {
    console.log(`[inject] ${rel}: ${readdirSync(dir).join(', ')}`);
  }
}

console.log('[inject] done');
