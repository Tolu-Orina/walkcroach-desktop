#!/usr/bin/env node
/**
 * PE.8 — Release notes must separate Upstream absorbed vs WalkCroach-specific (FR-F19).
 * Validates packaging/RELEASE_NOTES.TEMPLATE.md and any docs/releases/*.md
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const template = join(root, 'packaging/RELEASE_NOTES.TEMPLATE.md');
const releasesDir = join(root, 'docs/releases');

function check(md, label) {
  const errors = [];
  if (!/## Upstream absorbed/i.test(md)) errors.push(`${label}: missing "## Upstream absorbed"`);
  if (!/## WalkCroach-specific/i.test(md)) errors.push(`${label}: missing "## WalkCroach-specific"`);
  return errors;
}

const errors = [];
if (!existsSync(template)) {
  errors.push('missing packaging/RELEASE_NOTES.TEMPLATE.md');
} else {
  errors.push(...check(readFileSync(template, 'utf8'), 'template'));
}

if (existsSync(releasesDir)) {
  for (const f of readdirSync(releasesDir)) {
    if (!f.endsWith('.md')) continue;
    errors.push(...check(readFileSync(join(releasesDir, f), 'utf8'), f));
  }
}

if (errors.length) {
  console.error('release-notes audit FAILED');
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, audit: 'release-notes' }));
