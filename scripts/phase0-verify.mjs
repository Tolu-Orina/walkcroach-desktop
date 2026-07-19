#!/usr/bin/env node
/**
 * Phase 0 exit verification runner.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];

function run(label, command, args, cwd) {
  console.log(`\n==> ${label}`);
  const r = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: '0' },
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  const ok = r.status === 0;
  results.push({ label, ok, status: r.status });
  if (!ok) {
    console.error(`FAILED: ${label} (exit ${r.status})`);
  }
  return ok;
}

const requiredDocs = [
  'docs/phase-0/UPSTREAM_PIN.md',
  'docs/phase-0/OPEN_VSX_GALLERY.md',
  'docs/phase-0/SIGNING_PROCUREMENT.md',
  'docs/phase-0/ENGINE_PACKAGING.md',
  'docs/phase-0/LEGAL_PASS.md',
  'cadence/OWNER.md',
  'cadence/CHECKLIST.md',
  'product/product.walkcroach.json',
];

let docsOk = true;
for (const rel of requiredDocs) {
  const p = join(root, rel);
  if (!existsSync(p)) {
    console.error('missing', rel);
    docsOk = false;
  }
}
results.push({ label: 'phase0-docs', ok: docsOk, status: docsOk ? 0 : 1 });

run('audit:product', 'node', ['scripts/audit-product-json.mjs'], root);

const enginePkg = join(root, '../walkcroach/packages/agent-engine');
run('agent-engine build', 'npm', ['run', 'build'], enginePkg);

const engineSpike = join(root, 'spike/engine-import');
if (!existsSync(join(engineSpike, 'node_modules'))) {
  run('engine-import npm install', 'npm', ['install'], engineSpike);
}
run('engine-import test', 'npm', ['test'], engineSpike);

const branded = join(root, 'spike/branded-window');
if (!existsSync(join(branded, 'node_modules'))) {
  run('branded-window npm install', 'npm', ['install'], branded);
}
run(
  'branded-window smoke',
  'npm',
  ['run', 'start:headless-smoke'],
  branded,
);

console.log('\n=== Phase 0 verify summary ===');
console.table(results);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`Phase 0 verify FAILED (${failed.length} checks)`);
  process.exit(1);
}
console.log('Phase 0 verify PASSED');
