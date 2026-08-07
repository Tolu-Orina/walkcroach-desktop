#!/usr/bin/env node
/**
 * D6.0 — Orchestrate engine-bundle build from desktop root.
 * Ensures agent-engine is built first (file: dependency).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const engineRoot = join(root, '..', 'walkcroach', 'packages', 'agent-engine');
const agentRoot = join(root, 'packages', 'desktop-agent');

function run(cwd, args) {
  console.log(`\n==> (${cwd}) npm ${args.join(' ')}`);
  const r = spawnSync('npm', args, { cwd, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

if (!existsSync(join(engineRoot, 'package.json'))) {
  console.error('Missing sibling walkcroach/packages/agent-engine');
  process.exit(1);
}

run(engineRoot, ['run', 'build']);
run(agentRoot, ['install']);
run(agentRoot, ['run', 'build:bundle']);
console.log('\n[package-engine-bundle] ok');
