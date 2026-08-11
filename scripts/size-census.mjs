#!/usr/bin/env node
/**
 * Measure what a packaged WalkCroach folder is actually made of.
 *
 * Size work without a census is guesswork: the interesting weight hides in
 * per-extension and per-dependency subtrees, not in the top-level listing.
 *
 * Usage:
 *   node scripts/size-census.mjs <packageRoot> [--json <out>] [--baseline <prev.json>] [--top N]
 *
 * Flags:
 *   --json <path>      write the census (machine-readable, diffable)
 *   --baseline <path>  diff against an earlier census and show deltas
 *   --top N            rows per section (default 20)
 */
import { existsSync, readdirSync, statSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

const argv = process.argv.slice(2);
function flagValue(name, fallback = null) {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
}
const positional = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const packageRoot = positional[0];
const jsonOut = flagValue('--json');
const baselinePath = flagValue('--baseline');
const topN = Number(flagValue('--top', '20'));

if (!packageRoot || !existsSync(packageRoot)) {
  console.error(`Usage: node scripts/size-census.mjs <packageRoot> [--json out] [--baseline prev.json]
packageRoot missing: ${packageRoot ?? '(not given)'}`);
  process.exit(1);
}

const MIB = 1024 * 1024;
const mib = (bytes) => bytes / MIB;
const fmt = (bytes) => `${mib(bytes).toFixed(1)} MiB`;

/** Walk once; everything else is derived from this. */
function walk(dir) {
  const files = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue; // unreadable dir — skip rather than abort the census
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        try {
          files.push({ path: full, size: statSync(full).size });
        } catch {
          /* vanished mid-walk */
        }
      }
    }
  }
  return files;
}

console.log(`==> census ${packageRoot}`);
const files = walk(packageRoot);
const total = files.reduce((n, f) => n + f.size, 0);

/** Sum sizes of files whose relative path starts with a given prefix. */
function sizeUnder(prefix) {
  const p = prefix.split('/').join(sep);
  let sum = 0;
  for (const f of files) {
    const rel = relative(packageRoot, f.path);
    if (rel === p || rel.startsWith(p + sep)) sum += f.size;
  }
  return sum;
}

/** Group immediate children of a directory (each child dir = one bucket). */
function breakdown(relDir) {
  const base = join(packageRoot, relDir.split('/').join(sep));
  if (!existsSync(base)) return [];
  const buckets = new Map();
  for (const f of files) {
    const rel = relative(base, f.path);
    if (rel.startsWith('..') || rel === '') continue;
    const name = rel.split(sep)[0];
    buckets.set(name, (buckets.get(name) || 0) + f.size);
  }
  return [...buckets].map(([name, size]) => ({ name, size })).sort((a, b) => b.size - a.size);
}

/** Aggregate by file extension — surfaces cross-cutting weight like .map/.pak. */
function byExtension() {
  const buckets = new Map();
  for (const f of files) {
    const base = f.path.split(sep).pop();
    const m = base.match(/(\.[^.]+(?:\.map)?)$/);
    const ext = m ? m[1].toLowerCase() : '(none)';
    buckets.set(ext, (buckets.get(ext) || 0) + f.size);
  }
  return [...buckets].map(([name, size]) => ({ name, size })).sort((a, b) => b.size - a.size);
}

const sections = {
  top: breakdown('.'),
  extensions: breakdown('resources/app/extensions'),
  nodeModules: breakdown('resources/app/node_modules'),
  out: breakdown('resources/app/out'),
  locales: breakdown('locales'),
  win32Resources: breakdown('resources/app/resources/win32'),
  extension: byExtension(),
};

const notable = {
  sourceMaps: files.filter((f) => /\.(js|css)\.map$/i.test(f.path)).reduce((n, f) => n + f.size, 0),
  localePaks: sizeUnder('locales'),
  icons: files.filter((f) => /\.ico$/i.test(f.path)).reduce((n, f) => n + f.size, 0),
  extensionsTotal: sizeUnder('resources/app/extensions'),
  nodeModulesTotal: sizeUnder('resources/app/node_modules'),
  outTotal: sizeUnder('resources/app/out'),
};

function printSection(title, rows) {
  if (!rows.length) return;
  console.log(`\n--- ${title} ---`);
  for (const r of rows.slice(0, topN)) {
    console.log(`  ${fmt(r.size).padStart(11)}  ${r.name}`);
  }
  if (rows.length > topN) {
    const rest = rows.slice(topN).reduce((n, r) => n + r.size, 0);
    console.log(`  ${fmt(rest).padStart(11)}  (+${rows.length - topN} more)`);
  }
}

console.log(`\nTOTAL ${fmt(total)} across ${files.length.toLocaleString()} files`);
printSection('top level', sections.top);
printSection('built-in extensions', sections.extensions);
printSection('node_modules', sections.nodeModules);
printSection('by file type', sections.extension);
printSection('locales', sections.locales);

console.log('\n--- notable ---');
for (const [k, v] of Object.entries(notable)) {
  console.log(`  ${fmt(v).padStart(11)}  ${k}`);
}

const census = {
  packageRoot,
  generatedAt: new Date().toISOString(),
  totalBytes: total,
  fileCount: files.length,
  notable,
  sections,
};

if (jsonOut) {
  mkdirSync(dirname(jsonOut), { recursive: true });
  writeFileSync(jsonOut, JSON.stringify(census, null, 2), 'utf8');
  console.log(`\n[size-census] wrote ${jsonOut}`);
}

if (baselinePath) {
  if (!existsSync(baselinePath)) {
    console.error(`[size-census] baseline not found: ${baselinePath}`);
    process.exit(1);
  }
  const base = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const delta = total - base.totalBytes;
  const sign = delta >= 0 ? '+' : '';
  console.log(`\n=== diff vs baseline (${base.generatedAt}) ===`);
  console.log(`  baseline ${fmt(base.totalBytes)}  ->  current ${fmt(total)}  (${sign}${mib(delta).toFixed(1)} MiB)`);

  const baseNotable = base.notable || {};
  for (const [k, v] of Object.entries(notable)) {
    const prev = baseNotable[k] ?? 0;
    const d = v - prev;
    if (Math.abs(d) > 0.05 * MIB) {
      console.log(`  ${k}: ${fmt(prev)} -> ${fmt(v)} (${d >= 0 ? '+' : ''}${mib(d).toFixed(1)} MiB)`);
    }
  }
}
