#!/usr/bin/env node
/**
 * Phase A exit verification.
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
  'vscode/.git',
  'vscode/product.json',
  'vscode/src/vs/workbench/contrib/walkcroach/browser/walkcroach.contribution.ts',
  'product/recommendations.curated.json',
  'product/surface-area-allowlist.txt',
  'scripts/sync-upstream.sh',
  'cadence/records',
  '.github/workflows/upstream-sync.yml',
  '.github/ISSUE_TEMPLATE/bug_report.yml',
];

let docsOk = true;
for (const rel of required) {
  if (!existsSync(join(root, rel))) {
    console.error('missing', rel);
    docsOk = false;
  }
}
results.push({ label: 'phaseA-artifacts', ok: docsOk, status: docsOk ? 0 : 1 });

// Pin commit check
const head = spawnSync('git', ['rev-parse', 'HEAD'], {
  cwd: join(root, 'vscode'),
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
const commit = (head.stdout || '').trim();
const pinOk = commit === '125df4672b8a6a34975303c6b0baa124e560a4f7';
results.push({ label: 'upstream-pin', ok: pinOk, status: pinOk ? 0 : 1 });
if (!pinOk) console.error('unexpected HEAD', commit);

run('apply:product', 'node', ['scripts/apply-product.mjs']);
run('audit:product', 'node', ['scripts/audit-product-json.mjs']);

// Verify applied vscode/product.json gallery
const product = JSON.parse(readFileSync(join(root, 'vscode/product.json'), 'utf8'));
const galleryOk =
  product.enableTelemetry === false &&
  String(product.extensionsGallery?.serviceUrl ?? '').includes('open-vsx.org') &&
  product.nameShort === 'WalkCroach' &&
  !/marketplace\.visualstudio\.com/i.test(JSON.stringify(product.extensionsGallery));
results.push({ label: 'vscode-product-applied', ok: galleryOk, status: galleryOk ? 0 : 1 });

const commonMain = readFileSync(
  join(root, 'vscode/src/vs/workbench/workbench.common.main.ts'),
  'utf8',
);
const hookOk = commonMain.includes("contrib/walkcroach/browser/walkcroach.contribution");
results.push({ label: 'contrib-registration-hook', ok: hookOk, status: hookOk ? 0 : 1 });

run('audit:recommendations', 'node', ['scripts/audit-recommendations.mjs']);
run('audit:surface-area', 'node', ['scripts/audit-surface-area.mjs']);
run('sync:upstream:dry', 'bash', ['scripts/sync-upstream.sh', '--dry-run']);

const curated = JSON.parse(
  readFileSync(join(root, 'product/recommendations.curated.json'), 'utf8'),
);
const curatedOk = Array.isArray(curated);
results.push({ label: 'curated-recommendations-array', ok: curatedOk, status: curatedOk ? 0 : 1 });
// NFR-F09: non-empty lists must pass live Open VSX audit (already run above).
// Empty list remains valid for early bootstrap; Phase D ships a verified non-empty set.

console.log('\n=== Phase A verify summary ===');
console.table(results);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`Phase A verify FAILED (${failed.length})`);
  process.exit(1);
}
console.log('Phase A verify PASSED (structural). Full gulp compile is separate — see docs/phase-A/COMPILE.md');
