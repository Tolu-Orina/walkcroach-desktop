/**
 * Phase 0.5 — Desktop can import @walkcroach/agent-engine (path dependency).
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  createFakeHost,
  runAgentLoop,
  DEFAULT_MAX_ITERATIONS,
} from '@walkcroach/agent-engine';

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveEngineRoot() {
  // file: link → node_modules/@walkcroach/agent-engine → real package root
  const linked = join(__dirname, '../node_modules/@walkcroach/agent-engine');
  const pkgJson = join(linked, 'package.json');
  assert.ok(existsSync(pkgJson), `expected engine at ${linked}`);
  return linked;
}

test('resolves @walkcroach/agent-engine package name via path dependency', () => {
  const root = resolveEngineRoot();
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.name, '@walkcroach/agent-engine');
  assert.equal(pkg.private, true);
  assert.equal(pkg.type, 'module');
  // exports must expose "." only (no accidental vscode peer)
  assert.ok(pkg.exports?.['.']);
  assert.equal(pkg.exports?.['./package.json'], undefined);
});

test('engine package has no vscode dependency and dist entry loads', async () => {
  const root = resolveEngineRoot();
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  };
  assert.equal(allDeps.vscode, undefined);
  assert.equal(allDeps['@types/vscode'], undefined);

  const entry = join(root, 'dist', 'index.js');
  assert.ok(existsSync(entry), 'engine must be built (dist/index.js)');
  const mod = await import(pathToFileURL(entry).href);
  assert.equal(typeof mod.runAgentLoop, 'function');
  assert.equal(typeof mod.createFakeHost, 'function');
});

test('createFakeHost implements HostAdapter surface', async () => {
  assert.equal(typeof runAgentLoop, 'function');
  assert.ok(DEFAULT_MAX_ITERATIONS > 0);
  const host = createFakeHost({ workspaceRoot: process.cwd() });
  assert.equal(typeof host.readFile, 'function');
  assert.equal(typeof host.writeFile, 'function');
  assert.equal(typeof host.runTerminal, 'function');
  assert.equal(typeof host.emit, 'function');
  assert.equal(typeof host.secrets.get, 'function');
  assert.equal(host.isTrustedWorkspace(), true);
});

test('import.meta.resolve points at engine dist entry', async () => {
  const resolved = await import.meta.resolve('@walkcroach/agent-engine');
  assert.ok(resolved.includes('agent-engine'));
  assert.ok(resolved.includes('dist') || resolved.endsWith('index.js'));
});
