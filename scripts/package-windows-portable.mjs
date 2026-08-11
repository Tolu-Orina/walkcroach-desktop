#!/usr/bin/env node
/**
 * D6.0 — Build unsigned Windows portable zip + self-extracting .exe + SHA512SUMS.
 *
 * Prerequisites:
 * - Nested vscode/ with WalkCroach fork code
 * - Sibling ../walkcroach for @walkcroach/agent-engine + @walkcroach/sdk
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
 *   --package-only     gulp vscode-win32-*-ci (reuse out-vscode; skip extension/esbuild rebuild)
 *   --sfx              force 7-Zip SFX instead of Inno Setup
 *   --skip-ui          do not rebuild agent-ui
 *   --skip-zip         skip portable .zip (Setup.exe only — saves disk/time)
 *   --enforce-size     fail if Setup.exe exceeds size budget
 *   --size-budget-mib=N  absolute Setup.exe budget when --enforce-size (default 100)
 *   --no-minify        build the unminified gulp target (debugging only — ~2x larger)
 *   --skip-trim        keep locale paks / unreferenced icons / source maps
 */
import { spawnSync } from 'node:child_process';
import {
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

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vscodeRoot = join(root, 'vscode');
const distDir = join(root, 'packaging', 'dist');

const args = new Set(process.argv.slice(2));
const archArg = [...args].find((a) => a.startsWith('--arch='));
const arch = archArg
  ? archArg.slice('--arch='.length)
  : process.arch === 'arm64'
    ? 'arm64'
    : 'x64';
const skipGulp = args.has('--skip-gulp');
const skipUi = args.has('--skip-ui');
const forceSfx = args.has('--sfx');
const skipZip = args.has('--skip-zip');
const enforceSize = args.has('--enforce-size');
const noMinify = args.has('--no-minify');
const skipTrim = args.has('--skip-trim');
const budgetArg = [...args].find((a) => a.startsWith('--size-budget-mib='));
/**
 * Regression guard for the shipped Setup.exe, set just above the measured
 * arm64 size (118.2 MiB as of 2026-08-09) rather than at an aspirational
 * target — a budget that fails every build teaches people to pass --no-enforce.
 *
 * Getting materially below this needs a product decision, not a build flag:
 * mermaid-markdown-features alone is 58.5 MiB of the package (7x the next
 * largest extension). See docs/SHIPPING.md "Installer size".
 */
const sizeBudgetMiB = budgetArg
  ? Number(budgetArg.slice('--size-budget-mib='.length))
  : Number(process.env.WALK_CROACH_SETUP_BUDGET_MIB || 125);

function run(label, command, argv, cwd = root, extraEnv = {}) {
  console.log(`\n==> ${label}`);
  const r = spawnSync(command, argv, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...extraEnv },
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

/** Code OSS patchWin32DependenciesTask needs signtool.exe (Windows SDK). Prefer arch match. */
function ensureSignToolOnPath() {
  try {
    const which = spawnSync('where', ['signtool.exe'], {
      encoding: 'utf8',
      shell: true,
      env: process.env,
    });
    if (which.status === 0 && which.stdout?.trim()) {
      return;
    }
  } catch {
    /* fall through */
  }

  const kitsRoot = join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Windows Kits', '10', 'bin');
  if (!existsSync(kitsRoot)) {
    console.warn('[package] Windows Kits not found — gulp may fail at patchWin32DependenciesTask (signtool ENOENT)');
    return;
  }

  const versions = readdirSync(kitsRoot)
    .filter((d) => /^\d+\.\d+\.\d+\.\d+$/.test(d))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  const archDirs = gulpArch === 'arm64' ? ['arm64', 'x64'] : ['x64', 'arm64', 'x86'];

  for (const ver of versions) {
    for (const a of archDirs) {
      const bin = join(kitsRoot, ver, a);
      if (existsSync(join(bin, 'signtool.exe'))) {
        process.env.PATH = `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH || ''}`;
        console.log(`[package] prepended Windows SDK to PATH: ${bin}`);
        return;
      }
    }
  }
  console.warn('[package] signtool.exe not found under Windows Kits — unsigned patch step may fail');
}

if (!existsSync(vscodeRoot)) {
  console.error('vscode/ missing — clone/pin nested microsoft/vscode with WalkCroach fork code.');
  process.exit(1);
}

/**
 * The nested vscode build executes .ts entrypoints directly (gulpfile.mjs does
 * `import './build/gulpfile.ts'`), which needs a Node with type stripping on by
 * default. Too old a Node fails ~3 minutes in with a bare ERR_UNKNOWN_FILE_EXTENSION,
 * so check up front against the version the checkout itself pins.
 */
function checkNodeVersion() {
  const nvmrc = join(vscodeRoot, '.nvmrc');
  if (!existsSync(nvmrc)) return;
  const required = readFileSync(nvmrc, 'utf8').trim().replace(/^v/, '');
  const [reqMajor] = required.split('.').map(Number);
  const current = process.versions.node;
  const [curMajor, curMinor] = current.split('.').map(Number);

  // Type stripping is on by default from 22.18 and in 23.6+/24+.
  const ok = curMajor > 22 || (curMajor === 22 && curMinor >= 18);
  if (!ok) {
    console.error(
      `\n[package] Node ${current} cannot run this build.\n` +
        `vscode/.nvmrc pins ${required}; the build imports .ts entrypoints directly,\n` +
        'which needs Node >=22.18 (type stripping enabled by default).\n\n' +
        `Fix: fnm install ${required} && fnm use ${required}\n`,
    );
    process.exit(1);
  }
  if (curMajor !== reqMajor) {
    console.warn(
      `[package] Node ${current} differs from vscode/.nvmrc (${required}) — proceeding, but ${required} is the tested version.`,
    );
  }
}
checkNodeVersion();

const walkcroachPkgs = join(root, '..', 'walkcroach', 'packages');
const engineRoot = join(walkcroachPkgs, 'agent-engine');
const sdkRoot = join(walkcroachPkgs, 'sdk');
const protocolRoot = join(walkcroachPkgs, 'agent-protocol');
const desktopAgentRoot = join(root, 'packages', 'desktop-agent');
const agentUiRoot = join(root, 'packages', 'agent-ui');
if (!existsSync(join(engineRoot, 'package.json'))) {
  console.error('Sibling walkcroach/packages/agent-engine missing (required for engine-bundle).');
  process.exit(1);
}
if (!existsSync(join(sdkRoot, 'package.json'))) {
  console.error('Sibling walkcroach/packages/sdk missing (required for desktop-agent bundle).');
  process.exit(1);
}
if (!existsSync(join(protocolRoot, 'package.json'))) {
  console.error('Sibling walkcroach/packages/agent-protocol missing (required for agent-ui).');
  process.exit(1);
}

mkdirSync(distDir, { recursive: true });

// 1. Build dependencies (file: links need npm install when package.json deps change)
run('sdk:build', 'npm', ['run', 'build'], sdkRoot);
run('agent-engine:build', 'npm', ['run', 'build'], engineRoot);
run('agent-protocol:build', 'npm', ['run', 'build'], protocolRoot);
run('desktop-agent:npm-install', 'npm', ['install'], desktopAgentRoot);
run('desktop-agent:bundle', 'npm', ['run', 'build:bundle'], desktopAgentRoot);

if (!skipUi && existsSync(join(agentUiRoot, 'package.json'))) {
  run('agent-ui:npm-install', 'npm', ['install'], agentUiRoot);
  run('agent-ui:build', 'npm', ['run', 'build'], agentUiRoot);
}

run('apply:product', 'node', ['scripts/apply-product.mjs'], root);

// insider/stable win32 package requires AppX explorer DLL + Group Policy defs (Code OSS CI steps)
function prepWin32PackageAssets() {
  mkdirSync(join(vscodeRoot, '.build', 'win32', 'appx'), { recursive: true });
  mkdirSync(join(vscodeRoot, '.build', 'policies', 'win32'), { recursive: true });

  run('win32:policies', 'npm', ['run', 'copy-policy-dto', '--prefix', 'build'], vscodeRoot);
  run(
    'win32:policy-generator',
    'node',
    ['build/lib/policies/policyGenerator.ts', 'build/lib/policies/policyData.jsonc', 'win32'],
    vscodeRoot,
  );
  run(
    'win32:explorer-dll',
    'node',
    ['build/win32/explorer-dll-fetcher.ts', '.build/win32/appx'],
    vscodeRoot,
    { VSCODE_ARCH: gulpArch },
  );
}

// 2. Gulp package
prepWin32PackageAssets();
ensureSignToolOnPath();
if (!skipGulp) {
  // The minified target (out-vscode-min: mangled + minified) is what ships.
  // The unminified one roughly doubles the installer and exists for debugging.
  const minified = noMinify ? '' : '-min';
  const outVscode = join(vscodeRoot, `out-vscode${minified}`);
  const gulpTask =
    existsSync(outVscode) && args.has('--package-only')
      ? `vscode-win32-${gulpArch}${minified}-ci`
      : `vscode-win32-${gulpArch}${minified}`;

  // gulp only strips source maps (core + node_modules) and rewrites
  // sourceMappingURL to the CDN when it believes it is running in CI.
  // See vscode/build/gulpfile.vscode.ts: stripSourceMapsInPackagingTasks = isCI.
  run(`gulp ${gulpTask}`, 'npx', ['gulp', gulpTask], vscodeRoot, { CI: '1' });
} else if (!existsSync(packageRoot)) {
  console.error(`--skip-gulp set but ${packageRoot} not found`);
  process.exit(1);
}

// 3. Inject assets
run('inject-assets', 'node', ['scripts/inject-walkcroach-packaged-assets.mjs', packageRoot], root);

// 4. Trim dead payload, then record what the folder is made of. Census runs
// after trim so the JSON reflects what actually ships.
if (!skipTrim) {
  run('trim-package', 'node', ['scripts/trim-package.mjs', packageRoot], root);
} else {
  console.log('\n==> trim skipped (--skip-trim)');
}
run(
  'size-census',
  'node',
  ['scripts/size-census.mjs', packageRoot, '--json', join(distDir, 'size-census.json')],
  root,
);

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
// product.version is often already "1.131.0-insider" — don't double the quality token
const versionLabel = version.toLowerCase().includes(String(quality).toLowerCase())
  ? version
  : `${version}-${quality}`;
const zipName = `WalkCroach-win32-${gulpArch}-${versionLabel}-unsigned.zip`;
const zipPath = join(distDir, zipName);
const exeName = `WalkCroach-Setup-win32-${gulpArch}-${versionLabel}-unsigned.exe`;
const exePath = join(distDir, exeName);

if (existsSync(zipPath)) {
  rmSync(zipPath);
}
if (existsSync(exePath)) {
  rmSync(exePath);
}

function findWindowsTar() {
  const systemTar = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  if (existsSync(systemTar)) {
    return systemTar;
  }
  return null;
}

function findSevenZip() {
  const which = spawnSync('where', ['7z.exe'], { encoding: 'utf8', shell: true });
  if (which.status === 0 && which.stdout?.trim()) {
    return which.stdout.trim().split(/\r?\n/)[0];
  }
  const candidates = [
    join(process.env['ProgramFiles'] || 'C:\\Program Files', '7-Zip', '7z.exe'),
    join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', '7-Zip', '7z.exe'),
  ];
  return candidates.find((p) => existsSync(p)) || null;
}

/** MSYS tar treats `C:` as host:path — prefer System32 tar, then 7z, then PowerShell. */
function createPortableZip() {
  console.log(`\n==> zip ${zipName}`);
  const parent = dirname(packageRoot);
  const folder = basename(packageRoot);

  const winTar = findWindowsTar();
  if (winTar) {
    const r = spawnSync(
      winTar,
      ['-a', '-c', '-f', zipPath, '-C', parent, folder],
      { stdio: 'inherit', shell: false, env: process.env },
    );
    if (r.status === 0 && existsSync(zipPath)) {
      return;
    }
    console.warn('[package] Windows tar.zip failed; trying 7-Zip…');
  }

  const seven = findSevenZip();
  if (seven) {
    const r = spawnSync(
      seven,
      ['a', '-tzip', '-mx=9', zipPath, folder],
      { cwd: parent, stdio: 'inherit', shell: false, env: process.env },
    );
    if (r.status === 0 && existsSync(zipPath)) {
      return;
    }
    console.warn('[package] 7-Zip zip failed; trying PowerShell Compress-Archive…');
  }

  const ps = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Compress-Archive -LiteralPath '${packageRoot.replace(/'/g, "''")}' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
    ],
    { stdio: 'inherit', shell: false, env: process.env },
  );
  if (ps.status === 0 && existsSync(zipPath)) {
    return;
  }

  throw new Error(
    'Failed to create portable zip (Windows tar, 7-Zip, and Compress-Archive all failed).',
  );
}

if (!skipZip) {
  createPortableZip();
} else {
  console.log('\n==> zip skipped (--skip-zip)');
}

// Prefer unsigned Inno Setup (real wizard); fall back to 7-Zip SFX
console.log(`\n==> setup ${exeName}`);
const isccPath =
  (process.env.INNO_ISCC && existsSync(process.env.INNO_ISCC) && process.env.INNO_ISCC) ||
  (existsSync(join(vscodeRoot, 'node_modules', 'innosetup', 'bin', 'ISCC.exe'))
    ? join(vscodeRoot, 'node_modules', 'innosetup', 'bin', 'ISCC.exe')
    : null);

if (!forceSfx && isccPath) {
  run(
    'make-windows-inno',
    'node',
    ['scripts/make-windows-inno.mjs', packageRoot, exePath],
    root,
  );
} else {
  if (!forceSfx) {
    console.warn('[package] ISCC.exe not found — falling back to 7-Zip SFX');
  }
  run(
    'make-windows-sfx',
    'node',
    ['scripts/make-windows-sfx.mjs', packageRoot, exePath],
    root,
  );
}

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

const sizeMiB = existsSync(zipPath) ? (statSync(zipPath).size / (1024 * 1024)).toFixed(1) : null;
const exeBytes = statSync(exePath).size;
const exeMiB = (exeBytes / (1024 * 1024)).toFixed(1);
if (sizeMiB) {
  console.log(`\n[package-windows-portable] ${zipPath} (${sizeMiB} MiB)`);
}
console.log(`[package-windows-portable] ${exePath} (${exeMiB} MiB)`);
console.log(`[package-windows-portable] ${sumsPath}`);

if (enforceSize) {
  const exeMiBNum = exeBytes / (1024 * 1024);
  if (!Number.isFinite(sizeBudgetMiB) || sizeBudgetMiB <= 0) {
    throw new Error(`Invalid --size-budget-mib / WALK_CROACH_SETUP_BUDGET_MIB: ${sizeBudgetMiB}`);
  }
  console.log(`[package-windows-portable] size budget ${sizeBudgetMiB} MiB (Setup.exe)`);
  if (exeMiBNum > sizeBudgetMiB) {
    throw new Error(
      `Setup.exe ${exeMiBNum.toFixed(1)} MiB exceeds budget ${sizeBudgetMiB} MiB.\n` +
        `See ${join(distDir, 'size-census.json')} for the breakdown. Common causes:\n` +
        '  - built without minification (--no-minify, or a stale out-vscode reused via --package-only)\n' +
        '  - trim skipped (--skip-trim)\n' +
        '  - source maps present: gulp only strips them when CI=1 is set\n' +
        '  - a newly added built-in extension or bundled dependency',
    );
  }
  console.log('[package-windows-portable] size budget OK');
}

console.log('\nPreview — unsigned. See docs/SHIPPING.md');
console.log('CDN:     npm run publish:desktop-cdn');
console.log('GitHub:  npm run release:windows-portable -- --tag desktop-vX.Y.Z-preview.N');
