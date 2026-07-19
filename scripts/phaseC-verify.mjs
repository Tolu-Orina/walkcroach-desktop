#!/usr/bin/env node
/**
 * Phase C exit verification (structural + desktop-agent CRDB tests).
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
  'docs/phase-C/EXIT.md',
  'docs/phase-C/DEMO.md',
  'packages/desktop-agent/src/crdbPanel.ts',
  'packages/desktop-agent/src/crdbPanel.test.ts',
  'vscode/src/vs/workbench/contrib/walkcroach/common/crdbService.ts',
  'vscode/src/vs/workbench/contrib/walkcroach/browser/crdb/walkcroachCrdbService.ts',
  'vscode/src/vs/workbench/contrib/walkcroach/browser/crdb/walkcroachCrdbViews.ts',
  'vscode/src/vs/workbench/contrib/walkcroach/browser/crdb/walkcroachCrdbConfirm.ts',
];

let docsOk = true;
for (const rel of required) {
  if (!existsSync(join(root, rel))) {
    console.error('missing', rel);
    docsOk = false;
  }
}
results.push({ label: 'phaseC-artifacts', ok: docsOk, status: docsOk ? 0 : 1 });

const contrib = readFileSync(
  join(root, 'vscode/src/vs/workbench/contrib/walkcroach/browser/walkcroach.contribution.ts'),
  'utf8',
);
const wired =
  contrib.includes('WALK_CROACH_CRDB_CONTAINER_ID') &&
  contrib.includes('WalkCroachSchemaViewPane') &&
  contrib.includes('WalkCroachMemoryViewPane') &&
  contrib.includes('WalkCroachCcloudViewPane') &&
  contrib.includes('WalkCroachCrdbConfirmController') &&
  contrib.includes('WALK_CROACH_DEMO_CMD') &&
  contrib.includes('IWalkCroachCrdbService');
results.push({ label: 'crdb-contrib-wired', ok: wired, status: wired ? 0 : 1 });

const crdbSvc = readFileSync(
  join(root, 'vscode/src/vs/workbench/contrib/walkcroach/browser/crdb/walkcroachCrdbService.ts'),
  'utf8',
);
const gates =
  crdbSvc.includes('opt-in') &&
  crdbSvc.includes("kind: 'ccloud'") &&
  crdbSvc.includes('sourceSurface');
results.push({ label: 'write-and-ccloud-gates', ok: gates, status: gates ? 0 : 1 });

const panel = readFileSync(
  join(root, 'packages/desktop-agent/src/crdbPanel.ts'),
  'utf8',
);
const panelOk =
  panel.includes('recalls_by_surface') &&
  panel.includes('FR-F11') &&
  panel.includes('isMcpWriteTool');
results.push({ label: 'desktop-agent-crdb', ok: panelOk, status: panelOk ? 0 : 1 });

run('phaseB:verify', 'node', ['scripts/phaseB-verify.mjs']);

console.log('\n=== Phase C verify summary ===');
console.table(results);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`Phase C verify FAILED (${failed.length})`);
  process.exit(1);
}
console.log('Phase C verify PASSED (structural + prior phases). See docs/phase-C/DEMO.md');
