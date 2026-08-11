#!/usr/bin/env node
/**
 * Remove payload from a packaged WalkCroach folder that the shipped product
 * does not need. Runs after inject, before zip/Setup.
 *
 * Deliberately conservative: every removal here is either provably dead
 * (test extensions, icons nothing references) or English-only product policy
 * (Chromium locale paks). Anything with a plausible runtime consumer —
 * swiftshader, ffmpeg, ANGLE — is NOT touched. Those are measurable in the
 * census and can be revisited with evidence.
 *
 * Usage:
 *   node scripts/trim-package.mjs <packageRoot> [--dry-run] [--keep-locales]
 */
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const packageRoot = argv.find((a) => !a.startsWith('--'));
const dryRun = flags.has('--dry-run');
const keepLocales = flags.has('--keep-locales');

if (!packageRoot || !existsSync(packageRoot)) {
  console.error(`Usage: node scripts/trim-package.mjs <packageRoot> [--dry-run] [--keep-locales]
packageRoot missing: ${packageRoot ?? '(not given)'}`);
  process.exit(1);
}

const MIB = 1024 * 1024;
const fmt = (b) => `${(b / MIB).toFixed(2)} MiB`;
const results = [];

function sizeOf(target) {
  let total = 0;
  const stack = [target];
  while (stack.length) {
    const current = stack.pop();
    let st;
    try {
      st = statSync(current);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      for (const e of readdirSync(current)) stack.push(join(current, e));
    } else {
      total += st.size;
    }
  }
  return total;
}

function remove(target, label) {
  if (!existsSync(target)) return 0;
  const bytes = sizeOf(target);
  if (!dryRun) {
    rmSync(target, { recursive: true, force: true });
  }
  console.log(`  ${dryRun ? 'would remove' : 'removed'} ${fmt(bytes).padStart(10)}  ${label}`);
  return bytes;
}

function walkFiles(dir, predicate, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, predicate, out);
    else if (predicate(full)) out.push(full);
  }
  return out;
}

const appDir = join(packageRoot, 'resources', 'app');

// --- 1. Test extensions -----------------------------------------------------
// gulp's packaging path should not compile these, but a stale .build/extensions
// from an earlier full build can leak them in. Cheap to assert.
console.log('\n== test extensions ==');
let freedTests = 0;
for (const name of [
  'vscode-api-tests',
  'vscode-colorize-tests',
  'vscode-colorize-perf-tests',
  'vscode-test-resolver',
]) {
  freedTests += remove(join(appDir, 'extensions', name), `extensions/${name}`);
}
if (freedTests === 0) console.log('  (none present — gulp already excluded them)');
results.push(['test extensions', freedTests]);

// --- 1b. GitHub Copilot ------------------------------------------------------
// Excluded at build time (gulpfile.vscode.ts: includeCopilot). This is a safety
// net for a stale .build/extensions tree or an upstream sync that reintroduces
// it — WalkCroach ships its own agent and must not bundle Copilot silently.
console.log('\n== github copilot ==');
let freedCopilot = remove(join(appDir, 'extensions', 'copilot'), 'extensions/copilot');
for (const modRoot of [join(appDir, 'node_modules', '@github'), join(appDir, 'node_modules.asar.unpacked', '@github')]) {
  if (!existsSync(modRoot)) continue;
  for (const name of readdirSync(modRoot)) {
    if (name.startsWith('copilot')) {
      freedCopilot += remove(join(modRoot, name), `node_modules/@github/${name}`);
    }
  }
}
if (freedCopilot === 0) console.log('  (none present — build already excluded it)');
results.push(['github copilot', freedCopilot]);

// --- 2. Source maps ---------------------------------------------------------
// Belt-and-braces: gulp strips these when CI is set. If the build ran without
// it, they are still here and are pure weight — nothing loads a .map at runtime.
console.log('\n== source maps ==');
const maps = walkFiles(packageRoot, (p) => /\.(js|css)\.map$/i.test(p));
let freedMaps = 0;
for (const m of maps) {
  freedMaps += sizeOf(m);
  if (!dryRun) rmSync(m, { force: true });
}
console.log(
  maps.length
    ? `  ${dryRun ? 'would remove' : 'removed'} ${fmt(freedMaps).padStart(10)}  ${maps.length} .map files`
    : '  (none present — build already stripped them)',
);
results.push(['source maps', freedMaps]);

// --- 3. Chromium locale paks ------------------------------------------------
// The wizard and product ship English only; these are Chromium's own UI strings.
console.log('\n== chromium locales ==');
let freedLocales = 0;
if (keepLocales) {
  console.log('  (skipped — --keep-locales)');
} else {
  const localesDir = join(packageRoot, 'locales');
  const keep = new Set(['en-US.pak']);
  if (existsSync(localesDir)) {
    const paks = readdirSync(localesDir).filter((f) => f.endsWith('.pak'));
    const removing = paks.filter((f) => !keep.has(f));
    if (!paks.some((f) => keep.has(f))) {
      // Never strip everything: Electron needs its fallback pak to boot.
      console.error(`  ABORT: en-US.pak not found in ${localesDir} — refusing to strip locales`);
      process.exit(1);
    }
    for (const f of removing) freedLocales += remove(join(localesDir, f), `locales/${f}`);
    console.log(`  kept en-US.pak, removed ${removing.length} of ${paks.length}`);
  } else {
    console.log('  (no locales/ directory)');
  }
}
results.push(['chromium locales', freedLocales]);

// --- 4. Unreferenced file-type icons ---------------------------------------
// file-associations.json is the source of truth for which .ico the installer
// registers; anything else in resources/win32 is dead weight.
console.log('\n== unreferenced icons ==');
const assocPath = join(root, 'packaging', 'inno', 'file-associations.json');
let freedIcons = 0;
if (existsSync(assocPath)) {
  const { associations } = JSON.parse(readFileSync(assocPath, 'utf8'));
  // default.ico and code.ico are referenced by the installer's generic handler
  // and the app itself, not by any single association.
  const keep = new Set(['default', 'code', ...associations.map((a) => a.icon)]);
  const win32Dir = join(appDir, 'resources', 'win32');
  if (existsSync(win32Dir)) {
    const icons = readdirSync(win32Dir).filter((f) => f.endsWith('.ico'));
    const removing = icons.filter((f) => !keep.has(f.replace(/\.ico$/, '')));
    for (const f of removing) freedIcons += remove(join(win32Dir, f), `resources/win32/${f}`);
    console.log(`  kept ${icons.length - removing.length}, removed ${removing.length}`);
  } else {
    console.log(`  (no ${win32Dir})`);
  }
} else {
  console.log(`  (missing ${assocPath} — skipping)`);
}
results.push(['unreferenced icons', freedIcons]);

// --- summary ----------------------------------------------------------------
const totalFreed = results.reduce((n, [, b]) => n + b, 0);
console.log(`\n[trim-package] ${dryRun ? 'would free' : 'freed'} ${fmt(totalFreed)} total`);
for (const [label, bytes] of results) {
  if (bytes > 0) console.log(`  ${fmt(bytes).padStart(10)}  ${label}`);
}
if (dryRun) console.log('[trim-package] dry run — nothing was deleted');
