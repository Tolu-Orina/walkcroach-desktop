#!/usr/bin/env node
/**
 * PF.2 / NFR-F12 — Cadence KPI from cadence/records/*.md
 * Fail if days since last sync attempt > 14 (during verify; warn-only with --warn).
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const recordsDir = join(root, 'cadence/records');
const warnOnly = process.argv.includes('--warn');
const MAX_DAYS = 14;

function parseDateFromName(name) {
  const m = name.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

if (!existsSync(recordsDir)) {
  console.error('missing cadence/records');
  process.exit(1);
}

const files = readdirSync(recordsDir)
  .filter((f) => f.endsWith('.md'))
  .map((f) => ({ f, date: parseDateFromName(f) }))
  .filter((x) => x.date)
  .sort((a, b) => a.date.localeCompare(b.date));

if (!files.length) {
  console.error('no dated cadence records');
  process.exit(1);
}

const last = files[files.length - 1];
const lastDate = new Date(`${last.date}T00:00:00Z`);
const now = new Date();
const days = Math.floor((now - lastDate) / (86400 * 1000));

// Adherence: fraction of consecutive gaps ≤ 14 days
let gapsOk = 0;
let gaps = 0;
for (let i = 1; i < files.length; i++) {
  const prev = new Date(`${files[i - 1].date}T00:00:00Z`);
  const cur = new Date(`${files[i].date}T00:00:00Z`);
  const d = Math.floor((cur - prev) / (86400 * 1000));
  gaps += 1;
  if (d <= MAX_DAYS) gapsOk += 1;
}
const adherencePct = gaps === 0 ? 100 : Math.round((100 * gapsOk) / gaps);

const payload = {
  ok: days <= MAX_DAYS,
  audit: 'cadence-kpi',
  lastRecord: last.f,
  lastDate: last.date,
  daysSinceLastAttempt: days,
  maxAllowedDays: MAX_DAYS,
  recordCount: files.length,
  adherencePct,
  note:
    days > MAX_DAYS
      ? 'P0: Void-class freeze risk — run sync dry-run and write a cadence record today'
      : 'within biweekly budget',
};

console.log(JSON.stringify(payload, null, 2));

if (!payload.ok && !warnOnly) {
  process.exit(1);
}
