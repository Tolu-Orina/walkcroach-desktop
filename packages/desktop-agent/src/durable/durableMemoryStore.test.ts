import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DurableMemoryStore } from './durableMemoryStore.js';

describe('DurableMemoryStore', () => {
  let root: string;

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  it('buffers with client id and flushes exactly once per id', async () => {
    root = await mkdtemp(join(tmpdir(), 'wc-durable-'));
    const pushed: string[] = [];
    const store = new DurableMemoryStore({
      workspaceRoot: root,
      pushEntry: async (entry) => {
        pushed.push(entry.id);
      },
    });

    const a = await store.bufferWrite({
      kind: 'decision',
      text: 'Use FileSecrets for Agent Host secrets',
      projectId: 'p1',
      id: 'fixed-id-1',
    });
    expect(a.id).toBe('fixed-id-1');
    expect(a.sourceSurface).toBe('desktop');

    const first = await store.flush('tok');
    expect(first.pushed).toBe(1);
    expect(pushed).toEqual(['fixed-id-1']);

    const second = await store.flush('tok');
    expect(second.pushed).toBe(0);
    expect(pushed).toEqual(['fixed-id-1']);

    const local = await store.recallLocal('FileSecrets');
    expect(local[0]?.id).toBe('fixed-id-1');
  });

  it('keeps same id on failed flush for idempotent retry', async () => {
    root = await mkdtemp(join(tmpdir(), 'wc-durable-'));
    let fail = true;
    const store = new DurableMemoryStore({
      workspaceRoot: root,
      pushEntry: async () => {
        if (fail) throw new Error('offline');
      },
    });
    await store.bufferWrite({
      kind: 'decision',
      text: 'retry me',
      projectId: 'p1',
      id: 'id-retry',
    });
    const failed = await store.flush('tok');
    expect(failed.failed).toBe(1);
    fail = false;
    const ok = await store.flush('tok');
    expect(ok.pushed).toBe(1);
    const buf = await readFile(join(root, '.walkcroach/durable/buffer.jsonl'), 'utf8');
    expect(buf).toContain('"id":"id-retry"');
    expect(buf).toContain('"syncedAt"');
  });
});
