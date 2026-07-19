#!/usr/bin/env node
/**
 * PD.3 — Validate proprietary incompatibles catalog shape + alternative IDs
 * (alternative.id, when set, must exist on Open VSX OR be explicitly null).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'product/incompatibles.proprietary.json');
const list = JSON.parse(readFileSync(path, 'utf8'));

if (!Array.isArray(list) || list.length === 0) {
  console.error('incompatibles list must be a non-empty array');
  process.exit(1);
}

const failures = [];
const required = ['ms-vsliveshare.vsliveshare', 'ms-vscode-remote.remote-ssh', 'ms-vscode.cpptools', 'ms-python.vscode-pylance'];

for (const id of required) {
  if (!list.some((r) => r.id === id)) {
    failures.push({ id, error: 'required proprietary id missing from catalog' });
  }
}

for (const row of list) {
  if (!row.id || !row.name || !row.reason || !row.alternative) {
    failures.push({ id: row.id, error: 'missing id|name|reason|alternative' });
    continue;
  }
  const altId = row.alternative.id;
  if (altId === null || altId === undefined) continue;
  if (typeof altId !== 'string' || !altId.includes('.')) {
    failures.push({ id: row.id, error: 'alternative.id must be publisher.name or null' });
    continue;
  }
  const [publisher, name] = altId.split('.');
  const url = `https://open-vsx.org/api/${encodeURIComponent(publisher)}/${encodeURIComponent(name)}/latest`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      failures.push({
        id: row.id,
        error: `alternative ${altId} not on Open VSX (HTTP ${res.status})`,
        url,
      });
    }
  } catch (e) {
    failures.push({ id: row.id, error: String(e), url });
  }
}

if (failures.length) {
  console.error('incompatibles audit FAILED');
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify({
    ok: true,
    audit: 'incompatibles',
    count: list.length,
  }),
);
