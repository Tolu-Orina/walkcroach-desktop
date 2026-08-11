#!/usr/bin/env node
/**
 * WalkCroach Desktop — single product verifier.
 *
 * Replaces the old phase0–F cascade. Checks the whole IDE surface as it exists
 * today: docs, product overlay, allowlist, feature wiring, packaging readiness,
 * and unit tests.
 *
 * Usage:
 *   npm run verify           # full gate
 *   npm run verify -- --fast # skip tests + upstream dry-run
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fast = process.argv.includes('--fast');
const results = [];

function check(label, ok, detail) {
  results.push({ label, ok, status: ok ? 0 : 1 });
  if (!ok) {
    console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`ok    ${label}`);
  }
  return ok;
}

function run(label, command, args, cwd = root) {
  console.log(`\n==> ${label}`);
  const r = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return check(label, r.status === 0, `exit ${r.status}`);
}

function mustExist(rels) {
  const missing = rels.filter((rel) => !existsSync(join(root, rel)));
  return check(
    'artifacts',
    missing.length === 0,
    missing.length ? missing.join(', ') : undefined,
  );
}

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

console.log('WalkCroach Desktop verify' + (fast ? ' (--fast)' : '') + '\n');

// ── Docs (consolidated trio) ───────────────────────────────────────────────
mustExist(['docs/ARCHITECTURE.md', 'docs/STATUS.md', 'docs/SHIPPING.md']);
{
  const arch = read('docs/ARCHITECTURE.md');
  const status = read('docs/STATUS.md');
  const shipping = read('docs/SHIPPING.md');
  check(
    'docs-substance',
    /Agent Host/i.test(arch) &&
      /Path B/i.test(arch) &&
      /engine-bundle\.cjs/i.test(status) &&
      /unsigned/i.test(shipping) &&
      /SmartScreen/i.test(shipping) &&
      /1\.131\.0/.test(shipping),
  );
}

// ── Product overlay ────────────────────────────────────────────────────────
{
  const product = JSON.parse(read('product/product.walkcroach.json'));
  const g = product.extensionsGallery ?? {};
  check(
    'product-overlay',
    product.nameShort === 'WalkCroach' &&
      product.enableTelemetry === false &&
      product.quality === 'insider' &&
      product.walkcroach?.marketplaceProxy === false &&
      product.walkcroach?.interimDistribution === 'windows-portable' &&
      String(product.updateUrl || '').includes('updates.walkcroach.dev') &&
      String(g.serviceUrl || '').includes('open-vsx.org') &&
      !/marketplace\.visualstudio\.com/i.test(JSON.stringify(g)) &&
      /^[0-9a-f]{40}$/i.test(String(product.walkcroach?.upstreamCommit || '')),
  );
}

// ── Feature wiring (vscode present) ────────────────────────────────────────
const hasVscode = existsSync(join(root, 'vscode', '.git'));
check('vscode-checkout', hasVscode, 'nested vscode/ missing — feature wiring skipped');

if (hasVscode) {
  mustExist([
    'vscode/src/vs/workbench/contrib/walkcroach/browser/walkcroach.contribution.ts',
    'vscode/src/vs/workbench/contrib/walkcroach/browser/walkcroachAgentService.ts',
    'vscode/src/vs/workbench/contrib/walkcroach/browser/agentBridge.ts',
    'vscode/src/vs/workbench/contrib/walkcroach/browser/chat/walkcroachAgentWebviewPane.ts',
    'vscode/src/vs/workbench/contrib/walkcroach/browser/agents/walkcroachAgents.contribution.ts',
    'vscode/src/vs/workbench/contrib/walkcroach/browser/settings/walkcroachSettings.contribution.ts',
    'vscode/src/vs/workbench/contrib/walkcroach/browser/walkcroachTitleBar.contribution.ts',
    'vscode/src/vs/workbench/contrib/walkcroach/browser/crash/walkcroachCrashReporter.ts',
    'vscode/src/vs/workbench/contrib/walkcroach/common/fleet.ts',
    'vscode/src/vs/platform/agentHost/node/walkcroach/walkcroachAgent.ts',
    'vscode/src/vs/platform/agentHost/node/walkcroach/walkcroachEngineRuntime.ts',
    'vscode/src/vs/platform/agentHost/common/walkcroachTurnMeta.ts',
    'vscode/src/vs/workbench/workbench.common.main.ts',
  ]);

  const contrib = read('vscode/src/vs/workbench/contrib/walkcroach/browser/walkcroach.contribution.ts');
  check(
    'contrib-agent-memory-crdb',
    contrib.includes('WalkCroachAgentWebviewPane') &&
      contrib.includes('WALK_CROACH_MEMORY_VIEW_ID') &&
      contrib.includes('WALK_CROACH_CRDB_CONTAINER_ID') &&
      contrib.includes('WalkCroachSchemaViewPane') &&
      contrib.includes('WalkCroachCrashReporter') &&
      contrib.includes('IWalkCroachAgentService') &&
      !contrib.includes('P3_CRDB_PANES_DEREGISTERED'),
  );
  check(
    'p2-diff-and-pkce',
    contrib.includes('WALK_CROACH_DIFF_OPEN_CMD') &&
      contrib.includes('WalkCroachAuthUrlHandler') &&
      contrib.includes('webAppUrl') &&
      !contrib.includes('WALK_CROACH_DEMO_CMD'),
  );
  check(
    'live-crdb-mcp',
    contrib.includes('WALK_CROACH_CONFIGURE_CRDB_CMD') ||
      read('vscode/src/vs/workbench/contrib/walkcroach/browser/walkcroach.actions.ts').includes(
        'WALK_CROACH_CONFIGURE_CRDB_CMD',
      ),
  );
  check(
    'live-crdb-rpc',
    read('vscode/src/vs/platform/agentHost/common/walkcroachRpc.ts').includes('WC_CRDB_RPC_PREFIX') &&
      read('vscode/src/vs/platform/agentHost/node/walkcroach/walkcroachEngineRuntime.ts').includes(
        'getOrCreateCrdbPanel',
      ) &&
      read('vscode/src/vs/workbench/contrib/walkcroach/browser/crdb/walkcroachCrdbService.ts').includes(
        'invokeCrdbRpc',
      ) &&
      !read('vscode/src/vs/workbench/contrib/walkcroach/browser/crdb/walkcroachCrdbService.ts').includes(
        'DEMO_SCHEMA',
      ),
  );

  check(
    'dead-native-chat-removed',
    !existsSync(
      join(root, 'vscode/src/vs/workbench/contrib/walkcroach/browser/chat/walkcroachChatViewPane.ts'),
    ) &&
      !existsSync(
        join(root, 'vscode/src/vs/workbench/contrib/walkcroach/browser/chat/walkcroachAgentComponents.ts'),
      ),
  );

  const main = read('vscode/src/vs/workbench/workbench.common.main.ts');
  check('contrib-registration-hook', main.includes('contrib/walkcroach/browser/walkcroach.contribution'));

  const hostMain = read('vscode/src/vs/platform/agentHost/node/agentHostMain.ts');
  check('agent-host-provider', hostMain.includes('WalkCroachAgent'));

  const runtime = read('vscode/src/vs/platform/agentHost/node/walkcroach/walkcroachEngineRuntime.ts');
  check(
    'engine-load-path',
    /engine-bundle\.cjs/.test(runtime) &&
      /isEngineBundlePath/.test(runtime) &&
      /createSessionHost/.test(runtime),
  );

  const titleBar = read(
    'vscode/src/vs/workbench/contrib/walkcroach/browser/walkcroachTitleBar.contribution.ts',
  );
  check(
    'title-bar-triad',
    titleBar.includes('WALK_CROACH_OPEN_SETTINGS_CMD') &&
      titleBar.includes('WALK_CROACH_TOGGLE_AGENT_CMD') &&
      titleBar.includes('WALK_CROACH_OPEN_AGENTS_WINDOW_CMD') &&
      titleBar.includes('MenuId.TitleBar'),
  );

  const fleet = read('vscode/src/vs/workbench/contrib/walkcroach/common/fleet.ts');
  check('fleet-soft-cap', fleet.includes('6') && /force/i.test(fleet));

  // Pin: overlay commit is HEAD or ancestor
  const overlay = JSON.parse(read('product/product.walkcroach.json'));
  const pinSha = String(overlay.walkcroach?.upstreamCommit || '');
  const head = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: join(root, 'vscode'),
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const commit = (head.stdout || '').trim();
  let pinOk = Boolean(pinSha) && commit === pinSha;
  if (!pinOk && pinSha && commit) {
    const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', pinSha, commit], {
      cwd: join(root, 'vscode'),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    pinOk = ancestor.status === 0;
  }
  check('upstream-pin', pinOk, `HEAD=${commit} pin=${pinSha}`);
}

// ── Packages ───────────────────────────────────────────────────────────────
mustExist([
  'packages/desktop-agent/src/desktopHostAdapter.ts',
  'packages/desktop-agent/src/session.ts',
  'packages/desktop-agent/scripts/bundle-engine.mjs',
  'packages/agent-ui/package.json',
  'product/surface-area-allowlist.txt',
  'product/recommendations.curated.json',
  'product/incompatibles.proprietary.json',
]);

{
  const bundle = read('packages/desktop-agent/scripts/bundle-engine.mjs');
  check('engine-bundle-script', /esbuild/.test(bundle) && /engine-bundle\.cjs/.test(bundle));
}

// ── Packaging / infra readiness ────────────────────────────────────────────
mustExist([
  'scripts/package-engine-bundle.mjs',
  'scripts/package-windows-portable.mjs',
  'scripts/make-windows-sfx.mjs',
  'scripts/publish-desktop-cdn.mjs',
  'scripts/inject-walkcroach-packaged-assets.mjs',
  'scripts/release-windows-portable.mjs',
  'packaging/RELEASE_NOTES.preview.md',
  'packaging/sfx/README.md',
  'packaging/entitlements.mac.plist',
  'infra/desktop-update/main.tf',
  'infra/desktop-crash/main.tf',
  'infra/desktop-crash/codes/index.js',
  '.github/workflows/release-windows-portable.yml',
  'cadence/OWNER.md',
  'cadence/upstream/README.md',
]);

{
  const tfUpdate = read('infra/desktop-update/main.tf');
  const tfCrash = read('infra/desktop-crash/main.tf');
  check(
    'infra-modules',
    tfUpdate.includes('aws_s3_bucket') &&
      tfCrash.includes('aws_lambda_function') &&
      tfCrash.includes('/desktop/v1/crash'),
  );
}

// ── Audits (precise, fail-closed) ──────────────────────────────────────────
run('audit:product', 'node', ['scripts/audit-product-json.mjs']);
run('audit:recommendations', 'node', ['scripts/audit-recommendations.mjs']);
run('audit:incompatibles', 'node', ['scripts/audit-incompatibles.mjs']);
run('audit:release-notes', 'node', ['scripts/audit-release-notes.mjs']);
if (hasVscode) {
  run('audit:surface-area', 'node', ['scripts/audit-surface-area.mjs']);
  run('sync:agent-protocol', 'node', ['scripts/sync-agent-protocol.mjs']);
}

// ── Tests ──────────────────────────────────────────────────────────────────
if (!fast) {
  run('test:desktop-agent', 'npm', ['test'], join(root, 'packages', 'desktop-agent'));
  run('test:crash-lambda', 'node', ['--test', 'test.mjs'], join(root, 'infra/desktop-crash/codes'));

  const engineRoot = join(root, '..', 'walkcroach', 'packages', 'agent-engine');
  if (existsSync(join(engineRoot, 'package.json'))) {
    run('test:agent-engine', 'npm', ['test'], engineRoot);
  } else {
    check('test:agent-engine', false, 'sibling walkcroach/packages/agent-engine missing');
  }

  run('cadence:kpi', 'node', ['scripts/cadence-kpi.mjs']);
  run('sync:upstream:dry', 'bash', ['scripts/sync-upstream.sh', '--dry-run']);
}

console.log('\n=== verify summary ===');
console.table(results);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`verify FAILED (${failed.length})`);
  process.exit(1);
}
console.log('verify PASSED — Desktop product gate green');
