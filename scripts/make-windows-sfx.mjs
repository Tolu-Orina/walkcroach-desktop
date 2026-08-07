#!/usr/bin/env node
/**
 * Build an unsigned Windows self-extracting installer (.exe) from the gulp
 * package folder using 7-Zip SFX (7z.sfx + config + .7z archive).
 *
 * Requires 7-Zip on PATH or at the default install location, with 7z.sfx
 * available next to 7z.exe (or copied to packaging/sfx/7z.sfx).
 *
 * Usage (usually called from package-windows-portable.mjs):
 *   node scripts/make-windows-sfx.mjs <packageRoot> <outExePath>
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = process.argv[2];
const outExe = process.argv[3];

if (!packageRoot || !outExe) {
  console.error('Usage: node scripts/make-windows-sfx.mjs <packageRoot> <outExePath>');
  process.exit(1);
}
if (!existsSync(packageRoot)) {
  console.error(`packageRoot missing: ${packageRoot}`);
  process.exit(1);
}

function find7z() {
  const candidates = [
    process.env.SEVEN_ZIP,
    process.env.SEVENZ,
    '7z',
    '7z.exe',
    'C:\\\\Program Files\\\\7-Zip\\\\7z.exe',
    'C:\\\\Program Files (x86)\\\\7-Zip\\\\7z.exe',
  ].filter(Boolean);

  for (const bin of candidates) {
    const r = spawnSync(bin, ['--help'], { encoding: 'utf8', shell: true });
    // 7z returns non-zero on --help sometimes; check stdout/stderr for "7-Zip"
    const text = `${r.stdout || ''}${r.stderr || ''}`;
    if (text.includes('7-Zip') || r.status === 0) {
      return bin;
    }
  }
  return null;
}

function findSfxModule(sevenZipBin) {
  const vendored = join(root, 'packaging', 'sfx', '7z.sfx');
  if (existsSync(vendored)) return vendored;

  if (sevenZipBin.includes('Program Files')) {
    const beside = join(dirname(sevenZipBin), '7z.sfx');
    if (existsSync(beside)) return beside;
  }

  // Resolve 7z from PATH via where.exe
  const where = spawnSync('where.exe', ['7z'], { encoding: 'utf8', shell: true });
  const first = (where.stdout || '').split(/\r?\n/).map((s) => s.trim()).find(Boolean);
  if (first) {
    const beside = join(dirname(first), '7z.sfx');
    if (existsSync(beside)) return beside;
  }

  return null;
}

const sevenZip = find7z();
if (!sevenZip) {
  console.error(`
[make-windows-sfx] 7-Zip not found.
Install from https://www.7-zip.org/ and ensure 7z.exe is on PATH,
or set SEVEN_ZIP to the full path of 7z.exe.
`);
  process.exit(1);
}

const sfx = findSfxModule(sevenZip);
if (!sfx) {
  console.error(`
[make-windows-sfx] 7z.sfx not found.
Copy it from your 7-Zip install folder next to 7z.exe into:
  packaging/sfx/7z.sfx
(The SFX module is redistributable with 7-Zip.)
`);
  process.exit(1);
}

const work = join(tmpdir(), `wc-sfx-${randomBytes(6).toString('hex')}`);
mkdirSync(work, { recursive: true });
const archive7z = join(work, 'payload.7z');
const configPath = join(work, 'config.txt');

// Archive folder *contents* so extract root has WalkCroach.exe at top level.
console.log(`==> 7z archive from ${packageRoot}`);
const a = spawnSync(
  sevenZip,
  ['a', '-t7z', '-mx=7', '-m0=lzma2', archive7z, join(packageRoot, '*')],
  { stdio: 'inherit', shell: true },
);
if (a.status !== 0) {
  console.error('7z archive failed');
  process.exit(a.status ?? 1);
}

const exeName = existsSync(join(packageRoot, 'WalkCroach.exe'))
  ? 'WalkCroach.exe'
  : existsSync(join(packageRoot, 'Code.exe'))
    ? 'Code.exe'
    : `${basename(packageRoot)}.exe`;

const config = `;!@Install@!UTF-8!
Title="WalkCroach Desktop IDE"
BeginPrompt="Extract WalkCroach Desktop IDE?\\n\\nUnsigned Windows preview — SmartScreen may warn."
ExtractTitle="Extracting WalkCroach Desktop IDE…"
ExtractDialogText="Please wait"
GUIFlags="8+32+64+256+4096"
InstallPath="%LOCALAPPDATA%\\Programs\\WalkCroach"
RunProgram="${exeName}"
;!@InstallEnd@!
`;
writeFileSync(configPath, config, 'utf8');

mkdirSync(dirname(outExe), { recursive: true });
if (existsSync(outExe)) unlinkSync(outExe);

// copy /b 7z.sfx + config.txt + archive.7z → Setup.exe
const parts = [sfx, configPath, archive7z];
const buffers = parts.map((p) => readFileSync(p));
writeFileSync(outExe, Buffer.concat(buffers));

console.log(`[make-windows-sfx] ${outExe}`);
console.log(`[make-windows-sfx] extract → %LOCALAPPDATA%\\Programs\\WalkCroach then run ${exeName}`);
