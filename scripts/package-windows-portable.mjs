#!/usr/bin/env node
/**
 * D6.0 — Build unsigned Windows portable zip + self-extracting .exe + SHA512SUMS.
 *
 * Prerequisites:
 * - Nested vscode/ with WalkCroach fork code
 * - Sibling ../walkcroach for @walkcroach/agent-engine
 * - ≥15GB free for full gulp (unless --skip-gulp and VSCode-win32-* already exists)
 * - 7-Zip installed (for .exe SFX) — see packaging/sfx/README.md
 *
 * Steps:
 * 1. Build agent-engine + desktop-agent engine-bundle (+ agent-ui if present)
 * 2. apply-product
 * 3. gulp vscode-win32-{arch} (unless --skip-gulp)
 * 4. inject WalkCroach media
 * 5. zip → packaging/dist/WalkCroach-win32-{arch}-{version}-unsigned.zip
 * 6. SFX → packaging/dist/WalkCroach-Setup-win32-{arch}-{version}-unsigned.exe
 * 7. SHA512SUMS
 *
 * Flags:
 *   --arch=x64|arm64   (default: process.arch mapped)
 *   --skip-gulp        reuse existing VSCode-win32-* folder
 *   --skip-ui          do not rebuild agent-ui
 */
import { spawnSync } from 'node:child_process';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vscodeRoot = join(root, 'vscode');
const distDir = join(root, 'packaging', 'dist');
const require = createRequire(import.meta.url);

const args = new Set(process.argv.slice(2));
const archArg = [...args].find((a) => a.startsWith('--arch='));
const arch = archArg
  ? archArg.slice('--arch='.length)
  : process.arch === 'arm64'
    ? 'arm64'
    : 'x64';
const skipGulp = args.has('--skip-gulp');
const skipUi = args.has('--skip-ui');

function run(label, command, argv, cwd = root) {
  console.log(`\n==> ${label}`);
  const r = spawnSync(command, argv, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  if (r.status !== 0) {
    throw new Error(`${label} failed (status ${r.status})`);
  }
}

function mapArchToGulp(a) {
  if (a === 'x64' || a === 'arm64') {
    return a;
  }
  throw new Error(`Unsupported arch: ${a}`);
}

const gulpArch = mapArchToGulp(arch);
const packageFolderName = `VSCode-win32-${gulpArch}`;
const packageRoot = join(dirname(vscodeRoot), packageFolderName);

if (!existsSync(vscodeRoot)) {
  console.error('vscode/ missing — clone/pin nested microsoft/vscode with WalkCroach fork code.');
  process.exit(1);
}

const engineRoot = join(root, '..', 'walkcroach', 'packages', 'agent-engine');
if (!existsSync(join(engineRoot, 'package.json'))) {
  console.error('Sibling walkcroach/packages/agent-engine missing (required for engine-bundle).');
  process.exit(1);
}

mkdirSync(distDir, { recursive: true });

// 1. Build dependencies
run('agent-engine:build', 'npm', ['run', 'build'], engineRoot);
run('desktop-agent:bundle', 'npm', ['run', 'build:bundle'], join(root, 'packages', 'desktop-agent'));

if (!skipUi && existsSync(join(root, 'packages', 'agent-ui', 'package.json'))) {
  run('agent-ui:build', 'npm', ['run', 'build'], join(root, 'packages', 'agent-ui'));
}

run('apply:product', 'node', ['scripts/apply-product.mjs'], root);

// 2. Gulp package
if (!skipGulp) {
  run(
    `gulp vscode-win32-${gulpArch}`,
    'npx',
    ['gulp', `vscode-win32-${gulpArch}`],
    vscodeRoot,
  );
} else if (!existsSync(packageRoot)) {
  console.error(`--skip-gulp set but ${packageRoot} not found`);
  process.exit(1);
}

// 3. Inject assets
run('inject-assets', 'node', ['scripts/inject-walkcroach-packaged-assets.mjs', packageRoot], root);

// Version stamp from product.json
function readProductVersion(pkgRoot) {
  const candidates = [
    join(pkgRoot, 'resources', 'app', 'product.json'),
    join(pkgRoot, 'product.json'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, 'utf8'));
    }
  }
  throw new Error(`product.json not found under ${pkgRoot}`);
}

const product = readProductVersion(packageRoot);
const version = String(product.version || '0.0.0').replace(/[^\w.+-]/g, '_');
const quality = product.quality || 'insider';
const zipName = `WalkCroach-win32-${gulpArch}-${version}-${quality}-unsigned.zip`;
const zipPath = join(distDir, zipName);
const exeName = `WalkCroach-Setup-win32-${gulpArch}-${version}-${quality}-unsigned.exe`;
const exePath = join(distDir, exeName);

if (existsSync(zipPath)) {
  rmSync(zipPath);
}
if (existsSync(exePath)) {
  rmSync(exePath);
}

// Prefer system tar (Windows 10+ / Git Bash) for portable zip without extra deps.
console.log(`\n==> zip ${zipName}`);
const tar = spawnSync(
  'tar',
  ['-a', '-c', '-f', zipPath, '-C', dirname(packageRoot), basename(packageRoot)],
  { stdio: 'inherit', shell: true },
);
if (tar.status !== 0) {
  // Fallback: npm package `archiver` if present; else fail with clear message.
  let archiver;
  try {
    archiver = require('archiver');
  } catch {
    console.error('zip failed (tar) and archiver not installed. Install zip tooling or fix tar.');
    process.exit(1);
  }
  await new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(packageRoot, basename(packageRoot));
    archive.finalize();
  });
}

// Self-extracting installer (.exe) via 7-Zip SFX
console.log(`\n==> sfx ${exeName}`);
run(
  'make-windows-sfx',
  'node',
  ['scripts/make-windows-sfx.mjs', packageRoot, exePath],
  root,
);

function sha512File(filePath) {
  const hash = createHash('sha512');
  hash.update(readFileSync(filePath));
  return hash.digest('hex');
}

const sumsPath = join(distDir, 'SHA512SUMS');
const lines = [];
for (const name of readdirSync(distDir).filter(
  (n) => n.endsWith('.zip') || n.endsWith('.exe'),
)) {
  const full = join(distDir, name);
  lines.push(`${sha512File(full)}  ${name}`);
}
writeFileSync(sumsPath, lines.join('\n') + '\n', 'utf8');

const sizeMiB = (statSync(zipPath).size / (1024 * 1024)).toFixed(1);
const exeMiB = (statSync(exePath).size / (1024 * 1024)).toFixed(1);
console.log(`\n[package-windows-portable] ${zipPath} (${sizeMiB} MiB)`);
console.log(`[package-windows-portable] ${exePath} (${exeMiB} MiB)`);
console.log(`[package-windows-portable] ${sumsPath}`);
console.log('\nPreview — unsigned. See docs/SHIPPING.md');
console.log('CDN:     npm run publish:desktop-cdn');
console.log('GitHub:  npm run release:windows-portable -- --tag desktop-vX.Y.Z-preview.N');
