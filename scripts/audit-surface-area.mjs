#!/usr/bin/env node
/**
 * PA.5 / NFR-F13 — Fail if vscode/ differs from upstream pin outside allowlist.
 *
 * Compares working tree + index against the pinned upstream commit for paths
 * outside product/surface-area-allowlist.txt (plus documented minimal hooks).
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vscodeDir = join(root, 'vscode');
const allowlistPath = join(root, 'product/surface-area-allowlist.txt');
const pinPath = join(root, 'docs/phase-0/UPSTREAM_PIN.md');

function loadPinCommit() {
  const md = readFileSync(pinPath, 'utf8');
  const m = md.match(/Commit SHA\s*\|\s*`([a-f0-9]{40})`/i);
  if (!m) throw new Error('Could not parse upstream commit from UPSTREAM_PIN.md');
  return m[1];
}

function loadAllowlist() {
  const lines = readFileSync(allowlistPath, 'utf8').split(/\r?\n/);
  const globs = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    globs.push(t.replace(/\\/g, '/'));
  }
  // Always allow our contrib tree even if file omitted
  if (!globs.some((g) => g.includes('contrib/walkcroach'))) {
    globs.push('src/vs/workbench/contrib/walkcroach/**');
  }
  return globs;
}

function matchesAllowlist(file, globs) {
  const f = file.replace(/\\/g, '/');
  for (const g of globs) {
    if (g.endsWith('/**')) {
      const prefix = g.slice(0, -3);
      if (f === prefix.slice(0, -1) || f.startsWith(prefix)) return true;
    } else if (g.includes('*')) {
      const re = new RegExp('^' + g.replace(/\./g, '\\.').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
      if (re.test(f)) return true;
    } else if (f === g) {
      return true;
    }
  }
  return false;
}

if (!existsSync(join(vscodeDir, '.git'))) {
  console.error('vscode/ checkout missing');
  process.exit(1);
}

const pin = loadPinCommit();
const globs = loadAllowlist();

let diff;
try {
  diff = execSync(`git diff --name-only ${pin}`, {
    cwd: vscodeDir,
    encoding: 'utf8',
  });
} catch (e) {
  // Shallow clone may not have pin as ancestor name — use HEAD merge-base against itself for local mods
  diff = execSync('git diff --name-only HEAD', {
    cwd: vscodeDir,
    encoding: 'utf8',
  });
  console.warn('warn: diff vs pin failed (shallow?). Falling back to HEAD working tree diff.');
}

// Also include untracked under src/
let untracked = '';
try {
  untracked = execSync('git ls-files --others --exclude-standard', {
    cwd: vscodeDir,
    encoding: 'utf8',
  });
} catch {
  untracked = '';
}

const changed = [...new Set([...diff.split(/\r?\n/), ...untracked.split(/\r?\n/)].filter(Boolean))];
const violations = changed.filter((f) => !matchesAllowlist(f, globs));

if (violations.length) {
  console.error('surface-area budget FAILED — paths outside allowlist:');
  for (const v of violations) console.error(' -', v);
  console.error('\nAllowlist:', allowlistPath);
  process.exit(1);
}

console.log(
  JSON.stringify({
    ok: true,
    audit: 'surface-area',
    pin,
    changed: changed.length,
    files: changed,
  }),
);
