#!/usr/bin/env node
/**
 * PD.2 / PD.7 / NFR-F09 — Fail closed.
 * Every curated recommendation MUST exist on Open VSX under a verified publisher.
 * Empty list still passes (nothing to namesquat) but Phase D ships a non-empty curated set.
 * Also refuses any curated id that appears in incompatibles.proprietary.json.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const curatedPath = join(root, 'product/recommendations.curated.json');
const incompatPath = join(root, 'product/incompatibles.proprietary.json');

/** @typedef {{ id: string, publisher?: string, reason?: string }} Rec */

const raw = JSON.parse(readFileSync(curatedPath, 'utf8'));
/** @type {Rec[]} */
const list = Array.isArray(raw)
  ? raw.map((x) => (typeof x === 'string' ? { id: x } : x))
  : [];

/** @type {Set<string>} */
const proprietary = new Set();
if (existsSync(incompatPath)) {
  const inc = JSON.parse(readFileSync(incompatPath, 'utf8'));
  for (const row of Array.isArray(inc) ? inc : []) {
    if (row?.id) proprietary.add(String(row.id).toLowerCase());
  }
}

if (list.length === 0) {
  console.log(
    JSON.stringify({
      ok: true,
      audit: 'recommendations',
      count: 0,
      note: 'empty curated list — NFR-F09 satisfied (nothing to namesquat)',
    }),
  );
  process.exit(0);
}

const failures = [];
const okIds = [];

for (const rec of list) {
  const id = String(rec.id || '').trim();
  if (!id || !id.includes('.')) {
    failures.push({ id, error: 'id must be publisher.name' });
    continue;
  }
  if (proprietary.has(id.toLowerCase())) {
    failures.push({
      id,
      error: 'id is listed in incompatibles.proprietary.json — cannot recommend',
    });
    continue;
  }

  const [publisher, name] = id.split('.');
  if (rec.publisher && rec.publisher !== publisher) {
    failures.push({
      id,
      error: `publisher field "${rec.publisher}" != id namespace "${publisher}"`,
    });
    continue;
  }

  const url = `https://open-vsx.org/api/${encodeURIComponent(publisher)}/${encodeURIComponent(name)}/latest`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      failures.push({ id, error: `Open VSX HTTP ${res.status}`, url });
      continue;
    }
    const data = await res.json();
    if (data?.namespace && data.namespace !== publisher) {
      failures.push({ id, error: `namespace mismatch ${data.namespace}`, url });
      continue;
    }
    if (data?.deprecated === true) {
      failures.push({ id, error: 'extension is deprecated on Open VSX', url });
      continue;
    }
    // NFR-F09 — verified publisher required when the API exposes the flag.
    if (data?.verified !== true) {
      failures.push({
        id,
        error: `publisher not verified on Open VSX (verified=${String(data?.verified)})`,
        url,
      });
      continue;
    }
    okIds.push({ id, version: data.version, verified: true });
  } catch (e) {
    failures.push({ id, error: String(e), url });
  }
}

if (failures.length) {
  console.error('recommendations audit FAILED (fail closed)');
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify({
    ok: true,
    audit: 'recommendations',
    count: list.length,
    extensions: okIds,
  }),
);
