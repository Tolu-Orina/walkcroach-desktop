/**
 * D5 — session persist (HostAdapter) + worktree helpers.
 */
import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  enterGitWorktree,
  exitGitWorktree,
  loadAgentSession,
  newSessionId,
} from '@walkcroach/agent-engine';
import { DesktopHostAdapter } from './desktopHostAdapter.js';

describe('D5.1 DesktopHostAdapter session persist', () => {
  it('persistAgentSession / loadAgentSession round-trip under workspace root', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wc-d5-sess-'));
    try {
      const host = new DesktopHostAdapter({
        getWorkspaceRoot: () => root,
        isTrustedWorkspace: () => true,
        secrets: { get: async () => undefined, store: async () => {} },
        emit: () => {},
      });
      const sessionId = newSessionId();
      const messages = [
        { role: 'user' as const, content: [{ text: 'hello d5' }] },
        { role: 'assistant' as const, content: [{ text: 'hi' }] },
      ];
      const saved = await host.persistAgentSession({
        sessionId,
        messages,
        createdAt: '2026-08-05T00:00:00.000Z',
      });
      expect(saved.sessionId).toBe(sessionId);

      const loaded = await host.loadAgentSession();
      expect(loaded?.sessionId).toBe(sessionId);
      expect(loaded?.messages.length).toBe(2);
      expect(loaded?.messages[0]?.role).toBe('user');

      const raw = await loadAgentSession(root);
      expect(raw?.sessionId).toBe(sessionId);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('setToolRoot scopes resolvePath / getWorkspaceRoot', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wc-d5-root-'));
    const wt = path.join(root, '.walkcroach', 'worktrees', 'feat');
    await fs.mkdir(wt, { recursive: true });
    await fs.writeFile(path.join(wt, 'note.txt'), 'in-wt', 'utf8');
    try {
      const host = new DesktopHostAdapter({
        getWorkspaceRoot: () => root,
        isTrustedWorkspace: () => true,
        secrets: { get: async () => undefined, store: async () => {} },
        emit: () => {},
      });
      expect(host.getRepoRoot()).toBe(root);
      host.setToolRoot(wt);
      expect(host.getWorkspaceRoot()).toBe(wt);
      expect(host.getToolRoot()).toBe(wt);
      const body = await host.readFile('note.txt');
      expect(body).toBe('in-wt');
      host.setToolRoot(undefined);
      expect(host.getWorkspaceRoot()).toBe(root);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

describe('D5.2 enterGitWorktree / exitGitWorktree', () => {
  it('creates and discards a worktree in a temp git repo', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wc-d5-git-'));
    try {
      await run(root, ['git', 'init']);
      await run(root, ['git', 'config', 'user.email', 'd5@test']);
      await run(root, ['git', 'config', 'user.name', 'D5 Test']);
      await fs.writeFile(path.join(root, 'README.md'), '# d5\n', 'utf8');
      await run(root, ['git', 'add', '.']);
      await run(root, ['git', 'commit', '-m', 'init']);

      const entered = await enterGitWorktree(root, 'agent/d5-feature');
      expect(entered.branch).toBe('agent/d5-feature');
      expect(entered.path).toContain(path.join('.walkcroach', 'worktrees'));
      await fs.access(entered.path);

      await exitGitWorktree(root, entered.path, entered.branch, 'discard');
      await expect(fs.access(entered.path)).rejects.toThrow();
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  }, 60_000);
});

function run(cwd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(args[0]!, args.slice(1), { cwd, shell: false });
    let err = '';
    child.stderr?.on('data', (b: Buffer) => {
      err += b.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${args.join(' ')} failed: ${err}`));
    });
  });
}
