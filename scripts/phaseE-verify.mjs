#!/usr/bin/env node
/**
 * Phase E exit verification — distribution / signing / update / crash (structural).
 * Live signed installers require human cert enrollment (Phase 0 SIGNING_PROCUREMENT).
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
  'docs/phase-E/ARCHITECTURE.md',
  'docs/phase-E/SIGNING.md',
  'docs/phase-E/ROLLBACK.md',
  'docs/phase-E/PACKAGING.md',
  'docs/phase-E/EXIT.md',
  'packaging/entitlements.mac.plist',
  'packaging/RELEASE_NOTES.TEMPLATE.md',
  'infra/desktop-update/main.tf',
  'infra/desktop-crash/main.tf',
  'infra/desktop-crash/codes/index.js',
  'infra/desktop-crash/codes/test.mjs',
  '.github/workflows/package-matrix.yml',
  'vscode/src/vs/workbench/contrib/walkcroach/browser/crash/walkcroachCrashReporter.ts',
];

let docsOk = true;
for (const rel of required) {
  if (!existsSync(join(root, rel))) {
    console.error('missing', rel);
    docsOk = false;
  }
}
results.push({ label: 'phaseE-artifacts', ok: docsOk, status: docsOk ? 0 : 1 });

const product = JSON.parse(
  readFileSync(join(root, 'product/product.walkcroach.json'), 'utf8'),
);
const updateOk =
  String(product.updateUrl || '').includes('updates.walkcroach.dev') &&
  product.walkcroach?.marketplaceProxy === false &&
  product.enableTelemetry === false;
results.push({ label: 'updateUrl-product', ok: updateOk, status: updateOk ? 0 : 1 });

const arch = readFileSync(join(root, 'docs/phase-E/ARCHITECTURE.md'), 'utf8');
const channelsOk = /stable/.test(arch) && /insiders/.test(arch) && /blockmap/i.test(arch);
results.push({ label: 'channels-differential', ok: channelsOk, status: channelsOk ? 0 : 1 });

const rollback = readFileSync(join(root, 'docs/phase-E/ROLLBACK.md'), 'utf8');
const rollbackOk = /NFR-F10/i.test(rollback) && /Verify before apply/i.test(rollback);
results.push({ label: 'rollback-doc', ok: rollbackOk, status: rollbackOk ? 0 : 1 });

const contrib = readFileSync(
  join(root, 'vscode/src/vs/workbench/contrib/walkcroach/browser/walkcroach.contribution.ts'),
  'utf8',
);
const crashWired =
  contrib.includes('WalkCroachCrashReporter') &&
  contrib.includes('WALK_CROACH_CONFIG.crashReports');
results.push({ label: 'crash-client-wired', ok: crashWired, status: crashWired ? 0 : 1 });

const tfUpdate = readFileSync(join(root, 'infra/desktop-update/main.tf'), 'utf8');
const tfCrash = readFileSync(join(root, 'infra/desktop-crash/main.tf'), 'utf8');
const tfOk =
  tfUpdate.includes('aws_s3_bucket') &&
  tfUpdate.includes('desktop/stable') &&
  tfCrash.includes('aws_lambda_function') &&
  tfCrash.includes('/desktop/v1/crash');
results.push({ label: 'terraform-modules', ok: tfOk, status: tfOk ? 0 : 1 });

run('audit:release-notes', 'node', ['scripts/audit-release-notes.mjs']);
run('crash-lambda:test', 'node', ['--test', 'test.mjs'], join(root, 'infra/desktop-crash/codes'));
run('crash-lambda:package', 'node', ['scripts/package-crash-lambda.mjs']);
run('phaseD:verify', 'node', ['scripts/phaseD-verify.mjs']);

console.log('\n=== Phase E verify summary ===');
console.table(results);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`Phase E verify FAILED (${failed.length})`);
  process.exit(1);
}
console.log(
  'Phase E verify PASSED (structural). Signed public releases await cert enrollment — docs/phase-E/SIGNING.md',
);
