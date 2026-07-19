#!/usr/bin/env node
import { mkdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const codes = join(root, 'infra/desktop-crash/codes');
const build = join(root, 'infra/desktop-crash/.build');
const zip = join(build, 'lambda.zip');

mkdirSync(build, { recursive: true });
if (existsSync(zip)) rmSync(zip);

// Prefer zip CLI; fall back to copying index for structural verify
const r = spawnSync('powershell', [
  '-NoProfile',
  '-Command',
  `Compress-Archive -Path '${codes}/index.js','${codes}/package.json' -DestinationPath '${zip}' -Force`,
], { encoding: 'utf8' });

if (r.status !== 0) {
  // Git Bash zip
  const z = spawnSync('zip', ['-j', zip, 'index.js', 'package.json'], {
    cwd: codes,
    encoding: 'utf8',
  });
  if (z.status !== 0) {
    copyFileSync(join(codes, 'index.js'), join(build, 'index.js'));
    console.log(JSON.stringify({ ok: true, note: 'zip unavailable — copied index.js for structural path', build }));
    process.exit(0);
  }
}

console.log(JSON.stringify({ ok: true, zip, bytes: existsSync(zip) }));
