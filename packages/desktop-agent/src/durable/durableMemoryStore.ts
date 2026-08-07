/**
 * D3.5 — durable-tier write-ahead buffer + local cache.
 *
 * Code chunks stay in `.walkcroach/index/` (engine local-index) — never synced.
 * Episodic stays local/TTL (not implemented as CRDB upload).
 * Durable (decisions/conventions) buffers here with client-generated ids, then
 * replays to `/ide` on reconnect with supersede semantics (idempotent).
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { DESKTOP_SOURCE_SURFACE } from '../ideClient.js';

export const DURABLE_DIR_REL = '.walkcroach/durable';
export const DURABLE_BUFFER_FILE = 'buffer.jsonl';
export const DURABLE_CACHE_FILE = 'cache.json';
export const DURABLE_WATERMARK_FILE = 'pull-watermark.json';

export type DurableEntry = {
  /** Client-generated id — replay-safe idempotency key. */
  id: string;
  kind: string;
  text: string;
  projectId: string;
  sourceSurface: typeof DESKTOP_SOURCE_SURFACE;
  createdAt: string;
  /** Set when successfully pushed to CockroachDB via /ide. */
  syncedAt?: string;
  /** Soft-fail count for backoff. */
  attempts?: number;
};

export type DurableCacheEntry = {
  id: string;
  kind: string;
  text: string;
  sourceSurface?: string;
  updatedAt: string;
};

export type DurableMemoryStoreDeps = {
  workspaceRoot: string;
  /** Push one buffered write to the BFF. Must be idempotent on `entry.id`. */
  pushEntry: (entry: DurableEntry, token: string) => Promise<void>;
  /** Pull durable entries updated since watermark. */
  pullSince?: (
    token: string,
    projectId: string,
    sinceIso: string | undefined,
  ) => Promise<DurableCacheEntry[]>;
  log?: (msg: string) => void;
};

type Watermark = { projectId: string; updatedSince: string };

export class DurableMemoryStore {
  constructor(private readonly deps: DurableMemoryStoreDeps) {}

  private dir(): string {
    return join(this.deps.workspaceRoot, DURABLE_DIR_REL);
  }

  private bufferPath(): string {
    return join(this.dir(), DURABLE_BUFFER_FILE);
  }

  private cachePath(): string {
    return join(this.dir(), DURABLE_CACHE_FILE);
  }

  private watermarkPath(): string {
    return join(this.dir(), DURABLE_WATERMARK_FILE);
  }

  /** Stage a durable write locally before (or without) network. */
  async bufferWrite(input: {
    kind: string;
    text: string;
    projectId: string;
    id?: string;
  }): Promise<DurableEntry> {
    const entry: DurableEntry = {
      id: input.id ?? randomUUID(),
      kind: input.kind,
      text: input.text,
      projectId: input.projectId,
      sourceSurface: DESKTOP_SOURCE_SURFACE,
      createdAt: new Date().toISOString(),
      attempts: 0,
    };
    await mkdir(this.dir(), { recursive: true });
    await appendJsonl(this.bufferPath(), entry);
    // Optimistic local cache so recall works offline.
    await this.upsertCache({
      id: entry.id,
      kind: entry.kind,
      text: entry.text,
      sourceSurface: entry.sourceSurface,
      updatedAt: entry.createdAt,
    });
    return entry;
  }

  async listPending(): Promise<DurableEntry[]> {
    const rows = await readJsonl<DurableEntry>(this.bufferPath());
    return rows.filter((r) => !r.syncedAt);
  }

  /**
   * Replay unsynced buffer entries. Each id is pushed at most once successfully;
   * retries keep the same id so a flaky reconnect cannot duplicate rows.
   */
  async flush(token: string): Promise<{ pushed: number; failed: number }> {
    const rows = await readJsonl<DurableEntry>(this.bufferPath());
    let pushed = 0;
    let failed = 0;
    const next: DurableEntry[] = [];
    for (const row of rows) {
      if (row.syncedAt) {
        next.push(row);
        continue;
      }
      try {
        await this.deps.pushEntry(row, token);
        next.push({ ...row, syncedAt: new Date().toISOString(), attempts: (row.attempts ?? 0) + 1 });
        pushed++;
      } catch (err) {
        failed++;
        next.push({ ...row, attempts: (row.attempts ?? 0) + 1 });
        this.deps.log?.(
          `[durable] flush failed id=${row.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    await writeJsonl(this.bufferPath(), next);
    return { pushed, failed };
  }

  async pullAndCache(token: string, projectId: string): Promise<number> {
    if (!this.deps.pullSince) return 0;
    const wm = await this.readWatermark(projectId);
    const remote = await this.deps.pullSince(token, projectId, wm?.updatedSince);
    let maxUpdated = wm?.updatedSince;
    for (const e of remote) {
      await this.upsertCache(e);
      if (!maxUpdated || e.updatedAt > maxUpdated) maxUpdated = e.updatedAt;
    }
    if (maxUpdated) {
      await this.writeWatermark({ projectId, updatedSince: maxUpdated });
    }
    return remote.length;
  }

  async recallLocal(query: string, limit = 8): Promise<DurableCacheEntry[]> {
    const cache = await this.readCache();
    const q = query.trim().toLowerCase();
    if (!q) return cache.slice(0, limit);
    const scored = cache
      .map((e) => ({
        e,
        score:
          (e.text.toLowerCase().includes(q) ? 2 : 0) +
          (e.kind.toLowerCase().includes(q) ? 1 : 0) +
          tokenOverlap(q, e.text.toLowerCase()),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.e.updatedAt.localeCompare(a.e.updatedAt));
    return scored.slice(0, limit).map((x) => x.e);
  }

  private async upsertCache(entry: DurableCacheEntry): Promise<void> {
    const cache = await this.readCache();
    const idx = cache.findIndex((c) => c.id === entry.id);
    if (idx >= 0) cache[idx] = entry;
    else cache.push(entry);
    await mkdir(this.dir(), { recursive: true });
    await writeFile(this.cachePath(), JSON.stringify(cache, null, 2), 'utf8');
  }

  private async readCache(): Promise<DurableCacheEntry[]> {
    try {
      const text = await readFile(this.cachePath(), 'utf8');
      const parsed = JSON.parse(text) as DurableCacheEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async readWatermark(projectId: string): Promise<Watermark | undefined> {
    try {
      const text = await readFile(this.watermarkPath(), 'utf8');
      const parsed = JSON.parse(text) as Watermark;
      if (parsed?.projectId === projectId) return parsed;
    } catch {
      // none
    }
    return undefined;
  }

  private async writeWatermark(wm: Watermark): Promise<void> {
    await mkdir(this.dir(), { recursive: true });
    await writeFile(this.watermarkPath(), JSON.stringify(wm, null, 2), 'utf8');
  }
}

function tokenOverlap(q: string, text: string): number {
  const tokens = q.split(/\s+/).filter((t) => t.length > 2);
  if (!tokens.length) return 0;
  let n = 0;
  for (const t of tokens) if (text.includes(t)) n++;
  return n / tokens.length;
}

async function appendJsonl(path: string, row: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const line = JSON.stringify(row) + '\n';
  const { appendFile } = await import('node:fs/promises');
  await appendFile(path, line, 'utf8');
}

async function readJsonl<T>(path: string): Promise<T[]> {
  try {
    const text = await readFile(path, 'utf8');
    return text
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as T);
  } catch {
    return [];
  }
}

async function writeJsonl(path: string, rows: unknown[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''), 'utf8');
}
