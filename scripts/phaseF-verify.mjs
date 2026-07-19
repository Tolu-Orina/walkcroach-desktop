#!/usr/bin/env node
/**
 * Phase F exit verification — sustainability tooling (structural + cadence KPI).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];

function run(label, command, args, cwd = root) {
  console.log(`\n==> ${label}`);
  const r = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  const ok = r.status === 0;
  results.push({ label, ok, status: r.status });
  return ok;
}

const required = [
  'docs/phase-E/INTERIM_DISTRIBUTION.md',
  'docs/phase-F/EXIT.md',
  'docs/decisions/README.md',
  'docs/decisions/DEC-2026-07-19-windows-portable-interim.md',
  'docs/upstream/README.md',
  'docs/upstream/SECURITY_PATCH.md',
  'docs/surface-area/QUARTERLY.md',
  'scripts/cadence-kpi.mjs',
  'cadence/OWNER.md',
  'cadence/CHECKLIST.md',
  '.github/LABELS.md',
  '.github/workflows/label-upstream-candidate.yml',
  '.github/ISSUE_TEMPLATE/bug_report.yml',
  '.github/workflows/upstream-sync.yml',
];

let docsOk = true;
for (const rel of required) {
  if (!existsSync(join(root, rel))) {
    console.error('missing', rel);
    docsOk = false;
  }
}
results.push({ label: 'phaseF-artifacts', ok: docsOk, status: docsOk ? 0 : 1 });

const interim = readFileSync(join(root, 'docs/phase-E/INTERIM_DISTRIBUTION.md'), 'utf8');
const interimOk =
  /Windows portable/i.test(interim) &&
  /\.zip/i.test(interim) &&
  /NFR-F05/i.test(interim) &&
  /not/i.test(interim) &&
  /code-signed/i.test(interim);
results.push({ label: 'interim-windows-doc', ok: interimOk, status: interimOk ? 0 : 1 });

const syncSh = readFileSync(join(root, 'scripts/sync-upstream.sh'), 'utf8');
const conflictOk = syncSh.includes('docs/upstream') && syncSh.includes('conflicts.md');
results.push({ label: 'sync-writes-conflict-log', ok: conflictOk, status: conflictOk ? 0 : 1 });

const bugYml = readFileSync(join(root, '.github/ISSUE_TEMPLATE/bug_report.yml'), 'utf8');
const triageOk = /VSCodium/i.test(bugYml) && /upstream-candidate/i.test(readFileSync(join(root, '.github/LABELS.md'), 'utf8'));
results.push({ label: 'upstream-triage', ok: triageOk, status: triageOk ? 0 : 1 });

run('cadence-kpi', 'node', ['scripts/cadence-kpi.mjs']);
run('sync:upstream:dry', 'bash', ['scripts/sync-upstream.sh', '--dry-run']);
run('audit:surface-area', 'node', ['scripts/audit-surface-area.mjs']);
run('phaseE:verify', 'node', ['scripts/phaseE-verify.mjs']);

console.log('\n=== Phase F verify summary ===');
console.table(results);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`Phase F verify FAILED (${failed.length})`);
  process.exit(1);
}
console.log('Phase F verify PASSED (sustainability tooling + cadence KPI). Continuous: re-run biweekly.');
