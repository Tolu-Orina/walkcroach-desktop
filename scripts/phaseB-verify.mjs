#!/usr/bin/env node
/**
 * Phase B exit verification (structural + desktop-agent tests).
 * Full Desktop Electron compile remains disk-gated (see docs/phase-A/COMPILE.md).
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
  'packages/desktop-agent/package.json',
  'packages/desktop-agent/src/desktopHostAdapter.ts',
  'packages/desktop-agent/src/session.ts',
  'packages/desktop-agent/src/ideClient.ts',
  'docs/phase-B/ENGINE_BRIDGE.md',
  'docs/phase-B/EXIT.md',
  'vscode/src/vs/workbench/contrib/walkcroach/browser/walkcroach.contribution.ts',
  'vscode/src/vs/workbench/contrib/walkcroach/browser/walkcroachAgentService.ts',
  'vscode/src/vs/workbench/contrib/walkcroach/browser/chat/walkcroachChatViewPane.ts',
  'vscode/src/vs/workbench/contrib/walkcroach/browser/approval/walkcroachApprovalController.ts',
  'vscode/src/vs/workbench/contrib/walkcroach/browser/diff/walkcroachDiffCommentary.ts',
  'vscode/src/vs/workbench/contrib/walkcroach/browser/walkcroach.actions.ts',
  'vscode/src/vs/workbench/contrib/walkcroach/common/engineBridge.ts',
  'vscode/src/vs/workbench/contrib/walkcroach/common/ideApi.ts',
];

let docsOk = true;
for (const rel of required) {
  if (!existsSync(join(root, rel))) {
    console.error('missing', rel);
    docsOk = false;
  }
}
results.push({ label: 'phaseB-artifacts', ok: docsOk, status: docsOk ? 0 : 1 });

const contrib = readFileSync(
  join(root, 'vscode/src/vs/workbench/contrib/walkcroach/browser/walkcroach.contribution.ts'),
  'utf8',
);
const contribOk =
  contrib.includes('registerSingleton') &&
  contrib.includes('WALK_CROACH_CHAT_VIEW_ID') &&
  contrib.includes('WalkCroachApprovalController') &&
  contrib.includes('status.walkcroach.cache');
results.push({ label: 'contrib-wired', ok: contribOk, status: contribOk ? 0 : 1 });

const agentSvc = readFileSync(
  join(root, 'vscode/src/vs/workbench/contrib/walkcroach/browser/walkcroachAgentService.ts'),
  'utf8',
);
const surfaceOk = agentSvc.includes('source_surface=desktop') || agentSvc.includes('desktop');
const ideApi = readFileSync(
  join(root, 'vscode/src/vs/workbench/contrib/walkcroach/common/ideApi.ts'),
  'utf8',
);
const desktopMirror =
  ideApi.includes('DESKTOP_SOURCE_SURFACE') && ideApi.includes('sourceSurface');
results.push({
  label: 'desktop-source-surface',
  ok: surfaceOk && desktopMirror,
  status: surfaceOk && desktopMirror ? 0 : 1,
});

const actions = readFileSync(
  join(root, 'vscode/src/vs/workbench/contrib/walkcroach/browser/walkcroach.actions.ts'),
  'utf8',
);
const terminalOk = actions.includes('WALK_CROACH_TERMINAL_OVERLAY_CMD');
const onboardOk = actions.includes('WALK_CROACH_ONBOARDING_CMD');
results.push({ label: 'terminal-overlay', ok: terminalOk, status: terminalOk ? 0 : 1 });
results.push({ label: 'onboarding', ok: onboardOk, status: onboardOk ? 0 : 1 });

// Keep Phase A gates green
run('phaseA:verify', 'node', ['scripts/phaseA-verify.mjs']);

// desktop-agent install + test (targeted; avoid vscode npm ci)
const agentDir = join(root, 'packages/desktop-agent');
const enginePkg = join(root, '../walkcroach/packages/agent-engine/package.json');
if (!existsSync(enginePkg)) {
  console.error('missing agent-engine at', enginePkg);
  results.push({ label: 'agent-engine-present', ok: false, status: 1 });
} else {
  results.push({ label: 'agent-engine-present', ok: true, status: 0 });
  // Ensure engine dist exists for dependency resolution
  const engineDist = join(root, '../walkcroach/packages/agent-engine/dist/index.js');
  if (!existsSync(engineDist)) {
    run('agent-engine:build', 'npm', ['run', 'build'], join(root, '../walkcroach/packages/agent-engine'));
  }
  if (!existsSync(join(agentDir, 'node_modules'))) {
    run('desktop-agent:npm-install', 'npm', ['install'], agentDir);
  }
  run('desktop-agent:test', 'npm', ['test'], agentDir);
  run('desktop-agent:build', 'npm', ['run', 'build'], agentDir);
}

console.log('\n=== Phase B verify summary ===');
console.table(results);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`Phase B verify FAILED (${failed.length})`);
  process.exit(1);
}
console.log(
  'Phase B verify PASSED (structural + desktop-agent). Full Desktop compile / Bedrock bridge: see docs/phase-B/ENGINE_BRIDGE.md',
);
