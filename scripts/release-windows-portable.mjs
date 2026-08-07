#!/usr/bin/env node
/**
 * D6.0 — Publish packaging/dist Windows portable artifacts to GitHub Releases.
 *
 * Usage:
 *   npm run release:windows-portable -- --tag desktop-v0.1.0-preview.1
 *   npm run release:windows-portable -- --tag desktop-v0.1.0-preview.1 --draft
 *
 * Requires: gh CLI authenticated to the walkcroach-desktop repo.
 * Does not claim signed/notarized. Title includes "Preview (unsigned)".
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'packaging', 'dist');

const argv = process.argv.slice(2);
const tagArg = argv.find((a) => a.startsWith('--tag=')) || (argv.includes('--tag') ? `--tag=${argv[argv.indexOf('--tag') + 1]}` : null);
const tag = tagArg?.replace(/^--tag=/, '');
const draft = argv.includes('--draft');

if (!tag || !/^desktop-v[\w.+-]+$/i.test(tag)) {
  console.error('Usage: npm run release:windows-portable -- --tag desktop-v0.1.0-preview.1 [--draft]');
  process.exit(1);
}

if (!existsSync(distDir)) {
  console.error('packaging/dist missing — run npm run package:windows-portable first');
  process.exit(1);
}

const assets = readdirSync(distDir)
  .filter((n) => n.endsWith('.zip') || n.endsWith('.exe') || n === 'SHA512SUMS')
  .map((n) => join(distDir, n));

if (!assets.some((p) => p.endsWith('.exe')) && !assets.some((p) => p.endsWith('.zip'))) {
  console.error('No .exe or .zip in packaging/dist');
  process.exit(1);
}

const notesPath = join(root, 'packaging', 'RELEASE_NOTES.preview.md');
const notesFile = existsSync(notesPath)
  ? notesPath
  : join(root, 'packaging', 'RELEASE_NOTES.TEMPLATE.md');

const title = `${tag} — Preview (unsigned Windows Setup.exe)`;
const ghArgs = [
  'release',
  'create',
  tag,
  ...assets,
  '--title',
  title,
  '--notes-file',
  notesFile,
];
if (draft) {
  ghArgs.push('--draft');
}

console.log('gh', ghArgs.join(' '));
const r = spawnSync('gh', ghArgs, { cwd: root, stdio: 'inherit', shell: true });
if (r.status !== 0) {
  // If release exists, upload assets instead
  console.warn('create failed — attempting upload to existing release…');
  const up = spawnSync('gh', ['release', 'upload', tag, ...assets, '--clobber'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  if (up.status !== 0) {
    process.exit(up.status ?? 1);
  }
}

console.log(`\nPublished ${tag}. Remind users: docs/SHIPPING.md §5 (SmartScreen).`);
void readFileSync;
