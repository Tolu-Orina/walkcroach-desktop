#!/usr/bin/env node
/**
 * Guard PROTOCOL_VERSION alignment between:
 *   walkcroach/packages/agent-protocol/src/index.ts  (canonical)
 *   vscode/.../chat/walkcroachAgentProtocol.ts       (workbench mirror)
 *   packages/agent-ui (re-exports package — version must match)
 *
 * Usage: node scripts/sync-agent-protocol.mjs
 * Exit 1 on drift.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const canonical = join(root, '..', 'walkcroach', 'packages', 'agent-protocol', 'src', 'index.ts');
const mirror = join(
  root,
  'vscode',
  'src',
  'vs',
  'workbench',
  'contrib',
  'walkcroach',
  'browser',
  'chat',
  'walkcroachAgentProtocol.ts',
);

function readVersion(path) {
  if (!existsSync(path)) {
    throw new Error(`missing ${path}`);
  }
  const src = readFileSync(path, 'utf8');
  const m = src.match(/export const PROTOCOL_VERSION\s*=\s*(\d+)/);
  if (!m) {
    throw new Error(`PROTOCOL_VERSION not found in ${path}`);
  }
  return Number(m[1]);
}

function mustInclude(path, needles, label) {
  const src = readFileSync(path, 'utf8');
  const missing = needles.filter((n) => !src.includes(n));
  if (missing.length) {
    throw new Error(`${label} missing: ${missing.join(', ')}`);
  }
}

const vCanonical = readVersion(canonical);
const vMirror = readVersion(mirror);

if (vCanonical !== vMirror) {
  console.error(
    `sync-agent-protocol FAILED: PROTOCOL_VERSION drift canonical=${vCanonical} mirror=${vMirror}`,
  );
  process.exit(1);
}

mustInclude(canonical, ['openDiff', 'before', 'after'], 'agent-protocol');
mustInclude(mirror, ['openDiff', 'before', 'after', 'PROTOCOL_VERSION'], 'workbench mirror');

console.log(`ok    sync-agent-protocol (PROTOCOL_VERSION=${vCanonical})`);
