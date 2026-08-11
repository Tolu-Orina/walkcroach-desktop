import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  DesktopHostAdapter,
  isPathInsideWorkspace,
  MemorySecrets,
} from '../src/index.js';
import { isInfraCommand, shouldAutoApprove } from '@walkcroach/agent-engine';

describe('isPathInsideWorkspace', () => {
  it('accepts paths under root', () => {
    const root = path.resolve('/tmp/ws');
    expect(isPathInsideWorkspace(root, path.join(root, 'a.ts'))).toBe(true);
  });

  it('rejects escape', () => {
    const root = path.resolve('/tmp/ws');
    expect(isPathInsideWorkspace(root, path.resolve('/tmp/other'))).toBe(false);
  });
});

describe('DesktopHostAdapter trust + fs', () => {
  it('refuses tools when untrusted', async () => {
    const host = new DesktopHostAdapter({
      getWorkspaceRoot: () => '/tmp/ws',
      isTrustedWorkspace: () => false,
      secrets: new MemorySecrets(),
      emit: () => {},
    });
    await expect(host.readFile('x.ts')).rejects.toThrow(/not trusted/i);
  });

  it('reads/writes inside trusted workspace', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wc-desktop-'));
    const host = new DesktopHostAdapter({
      getWorkspaceRoot: () => dir,
      isTrustedWorkspace: () => true,
      secrets: new MemorySecrets(),
      emit: () => {},
    });
    await host.writeFile('hello.ts', 'export const n = 1;\n');
    expect(await host.readFile('hello.ts')).toContain('export const n');
    await expect(host.readFile('../escape.ts')).rejects.toThrow(/escapes/i);
  });

  it('getFileMtimeMs returns a number for an existing file', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wc-desktop-mtime-'));
    const host = new DesktopHostAdapter({
      getWorkspaceRoot: () => dir,
      isTrustedWorkspace: () => true,
      secrets: new MemorySecrets(),
      emit: () => {},
    });
    expect(host.supportsMtimeFreshness).toBe(true);
    await host.writeFile('stamp.ts', 'x\n');
    const mtime = await host.getFileMtimeMs('stamp.ts');
    expect(typeof mtime).toBe('number');
    expect(mtime).toBeGreaterThan(0);
    expect(await host.getFileMtimeMs('missing.ts')).toBeNull();
  });

  it('emits approval_request in strict mode', async () => {
    const events: string[] = [];
    const host = new DesktopHostAdapter({
      getWorkspaceRoot: () => '/tmp/ws',
      isTrustedWorkspace: () => true,
      secrets: new MemorySecrets(),
      emit: (e) => events.push(e.type),
    });
    host.setAutonomy('strict');
    const p = host.showDiffPreview('a.ts', 'a', 'b', {
      toolName: 'write_file',
      input: { path: 'a.ts' },
    });
    await Promise.resolve();
    expect(events).toContain('approval_request');
    const ac = new AbortController();
    host.setRunSignal(ac.signal);
    ac.abort();
    await expect(p).rejects.toThrow();
  });
});

describe('PB.9 hard infra gates (engine parity)', () => {
  it('never auto-approves ccloud', () => {
    expect(isInfraCommand('ccloud cluster create --name x')).toBe(true);
    expect(
      shouldAutoApprove({
        autonomy: 'low_friction',
        toolName: 'ccloud',
        input: { args: ['cluster', 'create'] },
      }),
    ).toBe(false);
  });
});
