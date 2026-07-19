#!/usr/bin/env node
/**
 * Phase D exit verification — marketplace / recommendations / migration (structural).
 * Fail closed on Open VSX recommendation + incompatibles audits.
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
  'docs/phase-D/NO_MARKETPLACE_PROXY.md',
  'docs/phase-D/OPEN_VSX_PUBLISH.md',
  'docs/phase-D/EXIT.md',
  'product/recommendations.curated.json',
  'product/incompatibles.proprietary.json',
  'scripts/audit-incompatibles.mjs',
  'vscode/src/vs/workbench/contrib/walkcroach/common/migrationService.ts',
  'vscode/src/vs/workbench/contrib/walkcroach/browser/migration/walkcroachMigrationService.ts',
  'vscode/src/vs/workbench/contrib/walkcroach/browser/migration/walkcroachMigrationViews.ts',
];

let docsOk = true;
for (const rel of required) {
  if (!existsSync(join(root, rel))) {
    console.error('missing', rel);
    docsOk = false;
  }
}
results.push({ label: 'phaseD-artifacts', ok: docsOk, status: docsOk ? 0 : 1 });

const curated = JSON.parse(
  readFileSync(join(root, 'product/recommendations.curated.json'), 'utf8'),
);
const curatedNonEmpty = Array.isArray(curated) && curated.length > 0;
results.push({
  label: 'curated-nonempty',
  ok: curatedNonEmpty,
  status: curatedNonEmpty ? 0 : 1,
});

const proxyDoc = readFileSync(join(root, 'docs/phase-D/NO_MARKETPLACE_PROXY.md'), 'utf8');
const foreverOk =
  /NFR-F07/i.test(proxyDoc) &&
  /never/i.test(proxyDoc) &&
  /marketplace\.visualstudio\.com/i.test(proxyDoc);
results.push({ label: 'no-proxy-forever-doc', ok: foreverOk, status: foreverOk ? 0 : 1 });

const contrib = readFileSync(
  join(root, 'vscode/src/vs/workbench/contrib/walkcroach/browser/walkcroach.contribution.ts'),
  'utf8',
);
const migWired =
  contrib.includes('IWalkCroachMigrationService') &&
  contrib.includes('WALK_CROACH_MIGRATION_VIEW_ID') &&
  contrib.includes('WALK_CROACH_INCOMPAT_VIEW_ID') &&
  contrib.includes('WALK_CROACH_IMPORT_CMD');
results.push({ label: 'migration-contrib-wired', ok: migWired, status: migWired ? 0 : 1 });

const product = JSON.parse(
  readFileSync(join(root, 'product/product.walkcroach.json'), 'utf8'),
);
const galleryOk =
  product.walkcroach?.marketplaceProxy === false &&
  String(product.extensionsGallery?.serviceUrl ?? '').includes('open-vsx.org') &&
  !/marketplace\.visualstudio\.com/i.test(JSON.stringify(product.extensionsGallery));
results.push({ label: 'openvsx-only-product', ok: galleryOk, status: galleryOk ? 0 : 1 });

run('audit:product', 'node', ['scripts/audit-product-json.mjs']);
run('audit:recommendations', 'node', ['scripts/audit-recommendations.mjs']);
run('audit:incompatibles', 'node', ['scripts/audit-incompatibles.mjs']);
run('apply:product', 'node', ['scripts/apply-product.mjs']);

// Confirm applied vscode product embeds curated ids + incompatibles
if (existsSync(join(root, 'vscode/product.json'))) {
  const applied = JSON.parse(readFileSync(join(root, 'vscode/product.json'), 'utf8'));
  const embedded =
    Array.isArray(applied.walkcroach?.curatedRecommendationIds) &&
    applied.walkcroach.curatedRecommendationIds.length > 0 &&
    Array.isArray(applied.walkcroach?.proprietaryIncompatibles) &&
    applied.walkcroach.proprietaryIncompatibles.length > 0 &&
    applied.walkcroach?.marketplaceProxy === false;
  results.push({ label: 'product-embed-phaseD', ok: embedded, status: embedded ? 0 : 1 });
}

run('phaseC:verify', 'node', ['scripts/phaseC-verify.mjs']);

console.log('\n=== Phase D verify summary ===');
console.table(results);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`Phase D verify FAILED (${failed.length})`);
  process.exit(1);
}
console.log('Phase D verify PASSED (Open VSX-only + curated + migration structural).');
