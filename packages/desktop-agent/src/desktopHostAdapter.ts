/**
 * Desktop HostAdapter — same contract as ide/ VsCodeHostAdapter, without `vscode` imports.
 * Workspace root / trust / secrets are injected so electron-main or tests can supply them.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import type {
  HostAdapter,
  HostSecrets,
  SearchHit,
  TerminalChunk,
  ApprovalDecision,
  UserQuestionAnswer,
  BedrockMessage,
  PersistedChatTurn,
} from '@walkcroach/agent-engine';
import {
  ApprovalController,
  bindApprovals,
  clearActiveAgentSession,
  loadAgentSession,
  loadWorkspaceAgentConfig,
  persistAgentSession,
  newSessionId,
} from '@walkcroach/agent-engine';

/**
 * Optional workbench / Agent Host proxies (D3.1).
 * When a prefer* hook returns a value, Node fs/rg/spawn is skipped.
 * When it returns `undefined`, the adapter falls through to the Node path.
 */
export type DesktopWorkbenchHooks = {
  /** Prefer unsaved text-model content (via AHP client FS). */
  preferReadFile?: (rel: string) => Promise<string | undefined>;
  /** Prefer writing into an open text model when present. */
  preferWriteFile?: (rel: string, content: string) => Promise<boolean>;
  /** Prefer workbench `ISearchService` (renderer RPC). */
  preferSearch?: (
    pattern: string,
    opts?: { glob?: string; signal?: AbortSignal },
  ) => Promise<SearchHit[] | undefined>;
  /**
   * Prefer Agent Host integrated / headless terminal manager.
   * Return `undefined` to fall back to Node `spawn` (last resort).
   */
  preferRunTerminal?: (
    cmd: string,
    opts: { cwd: string; signal?: AbortSignal },
  ) => AsyncIterable<TerminalChunk> | undefined | Promise<AsyncIterable<TerminalChunk> | undefined>;
  /** Open workbench diff UI while the approval gate still owns the decision. */
  onDiffPreview?: (
    filePath: string,
    before: string,
    after: string,
    meta?: {
      toolName?: string;
      stepId?: string;
      input?: Record<string, unknown>;
    },
  ) => void;
  /**
   * Session-scoped formatOnSave suppress for the agent-run lifetime.
   * Prefer {@link DesktopWorkbenchHooks.suppressFormatOnSave} when the workbench
   * owns ConfigurationService; otherwise leave unset (Node FS writes skip formatters).
   */
  suppressFormatOnSave?: () => Promise<(() => Promise<void>) | void>;
};

export type DesktopHostDeps = {
  getWorkspaceRoot: () => string | undefined;
  isTrustedWorkspace: () => boolean;
  secrets: HostSecrets;
  emit: HostAdapter['emit'];
  log?: (msg: string) => void;
  workbench?: DesktopWorkbenchHooks;
  /**
   * Fleet session id (P3.2). When set, approval requests stamp sessionId and
   * resolveApproval ignores cross-session decisions.
   */
  sessionId?: string;
  /**
   * Optional top-level format suppress (Agent Host). Takes precedence over
   * workbench.suppressFormatOnSave when both are set.
   */
  suppressFormatOnSave?: () => Promise<(() => Promise<void>) | void>;
};

export class DesktopHostAdapter implements HostAdapter {
  private readonly gate: ApprovalController;
  private readonly approvals: ReturnType<typeof bindApprovals>;
  private runSignal: AbortSignal | undefined;
  /** D5.2 — when set, file/search/terminal tools resolve relative to this path. */
  private toolRootOverride: string | undefined;
  private activeWorktree:
    | { path: string; branch: string; repoRoot: string }
    | undefined;
  /** Stable Bedrock session id for disk resume (D5.1). */
  private engineSessionId: string | undefined;
  private engineSessionCreatedAt: string | undefined;

  constructor(private readonly deps: DesktopHostDeps) {
    this.gate = new ApprovalController(
      (req) => {
        this.deps.emit({ type: 'approval_request', request: req });
      },
      { sessionId: deps.sessionId },
    );
    this.approvals = bindApprovals(
      { emit: (e) => this.deps.emit(e) },
      this.gate,
      () => this.runSignal,
    );
  }

  emit: HostAdapter['emit'] = (event) => {
    this.deps.emit(event);
  };

  setRunSignal(signal?: AbortSignal): void {
    this.runSignal = signal;
    if (signal?.aborted) this.gate.cancelAll();
    signal?.addEventListener(
      'abort',
      () => {
        this.gate.cancelAll();
      },
      { once: true },
    );
  }

  /**
   * Begin session-scoped formatOnSave suppress. Returns restore fn (or undefined).
   * Prefer deps.suppressFormatOnSave, else workbench hook.
   */
  async beginFormatOnSaveSuppress(): Promise<(() => Promise<void>) | undefined> {
    const begin =
      this.deps.suppressFormatOnSave ??
      this.deps.workbench?.suppressFormatOnSave;
    if (!begin) return undefined;
    try {
      const restore = await begin();
      return restore ? restore : undefined;
    } catch (err) {
      this.deps.log?.(
        `[desktop-host] formatOnSave suppress failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return undefined;
    }
  }

  showDiffPreview(
    filePath: string,
    before: string,
    after: string,
    meta?: {
      toolName?: string;
      stepId?: string;
      input?: Record<string, unknown>;
    },
  ): Promise<ApprovalDecision> {
    try {
      this.deps.workbench?.onDiffPreview?.(filePath, before, after, meta);
    } catch (err) {
      this.deps.log?.(
        `[desktop-host] onDiffPreview failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return this.approvals.showDiffPreview(filePath, before, after, meta);
  }

  confirmCommand(
    cmd: string,
    meta?: { toolName?: string; stepId?: string },
  ): Promise<ApprovalDecision> {
    return this.approvals.confirmCommand(cmd, meta);
  }

  resolveApproval(
    stepId: string,
    decision: ApprovalDecision,
    sessionId?: string,
  ): void {
    this.approvals.resolveApproval(stepId, decision, sessionId);
  }

  askUser(params: {
    question: string;
    options: string[];
    allowFreeText?: boolean;
    stepId?: string;
  }) {
    return this.approvals.askUser(params);
  }

  resolveQuestion(
    stepId: string,
    answer: UserQuestionAnswer | 'reject',
    sessionId?: string,
  ): void {
    this.approvals.resolveQuestion(stepId, answer, sessionId);
  }

  getAutonomy() {
    return this.approvals.getAutonomy();
  }

  setAutonomy(level: 'strict' | 'low_friction') {
    this.approvals.setAutonomy(level);
  }

  getWorkspaceRoot(): string | undefined {
    return this.toolRootOverride ?? this.deps.getWorkspaceRoot();
  }

  getRepoRoot(): string | undefined {
    return this.deps.getWorkspaceRoot();
  }

  setToolRoot(absPath: string | undefined): void {
    this.toolRootOverride = absPath;
  }

  getToolRoot(): string | undefined {
    return this.toolRootOverride;
  }

  setActiveWorktree(
    meta: { path: string; branch: string; repoRoot: string } | undefined,
  ): void {
    this.activeWorktree = meta;
  }

  getActiveWorktree():
    | { path: string; branch: string; repoRoot: string }
    | undefined {
    return this.activeWorktree;
  }

  isTrustedWorkspace(): boolean {
    return this.deps.isTrustedWorkspace();
  }

  get secrets(): HostSecrets {
    return this.deps.secrets;
  }

  async persistAgentSession(snapshot: {
    sessionId: string;
    messages: BedrockMessage[];
    transcript?: string;
    uiTurns?: PersistedChatTurn[];
    createdAt?: string;
  }): Promise<{ sessionId: string }> {
    const root = this.getRepoRoot();
    if (!root) {
      return { sessionId: snapshot.sessionId };
    }
    try {
      const cfg = await loadWorkspaceAgentConfig(root);
      if (cfg.settings.session.persist === false) {
        return { sessionId: snapshot.sessionId };
      }
      const saved = await persistAgentSession(root, snapshot, {
        maxSessions: cfg.settings.session.maxSessions,
      });
      this.engineSessionId = saved.sessionId;
      this.engineSessionCreatedAt = saved.createdAt;
      return { sessionId: saved.sessionId };
    } catch (err) {
      this.deps.log?.(
        `[desktop-host] persistAgentSession failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { sessionId: snapshot.sessionId };
    }
  }

  async loadAgentSession() {
    const root = this.getRepoRoot();
    if (!root) return null;
    try {
      const snap = await loadAgentSession(root);
      if (snap) {
        this.engineSessionId = snap.sessionId;
        this.engineSessionCreatedAt = snap.createdAt;
      }
      return snap;
    } catch {
      return null;
    }
  }

  async clearAgentSession(): Promise<void> {
    const root = this.getRepoRoot();
    if (!root) return;
    this.engineSessionId = undefined;
    this.engineSessionCreatedAt = undefined;
    await clearActiveAgentSession(root);
  }

  /** Ensure a durable engine session id exists before the first persist. */
  ensureEngineSessionId(): { sessionId: string; createdAt: string } {
    if (!this.engineSessionId) {
      this.engineSessionId = newSessionId();
      this.engineSessionCreatedAt = new Date().toISOString();
    }
    return {
      sessionId: this.engineSessionId,
      createdAt: this.engineSessionCreatedAt ?? new Date().toISOString(),
    };
  }

  async readFile(rel: string): Promise<string> {
    this.assertTrustedTools();
    const preferred = await this.deps.workbench?.preferReadFile?.(rel);
    if (preferred !== undefined) {
      return preferred;
    }
    const abs = this.resolvePath(rel);
    return fs.readFile(abs, 'utf8');
  }

  async writeFile(rel: string, content: string): Promise<void> {
    this.assertTrustedTools();
    const handled = await this.deps.workbench?.preferWriteFile?.(rel, content);
    if (handled) {
      return;
    }
    const abs = this.resolvePath(rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf8');
  }

  /** Stale-read / content-hash freshness — parity with IDE/CLI hosts. */
  readonly supportsMtimeFreshness = true;

  async getFileMtimeMs(rel: string): Promise<number | null> {
    this.assertTrustedTools();
    try {
      const st = await fs.stat(this.resolvePath(rel));
      return st.mtimeMs;
    } catch {
      return null;
    }
  }

  async listDir(rel: string): Promise<string[]> {
    this.assertTrustedTools();
    const abs = this.resolvePath(rel || '.');
    const entries = await fs.readdir(abs, { withFileTypes: true });
    return entries
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
      .sort();
  }

  async deleteFile(rel: string): Promise<void> {
    this.assertTrustedTools();
    const abs = this.resolvePath(rel);
    await fs.unlink(abs);
  }

  async glob(
    pattern: string,
    opts?: { signal?: AbortSignal },
  ): Promise<string[]> {
    this.assertTrustedTools();
    const root = this.requireRoot();
    // Reuse ripgrep files listing when available; else walk.
    return listGlob(root, pattern, opts?.signal);
  }

  async search(
    pattern: string,
    opts?: { glob?: string; signal?: AbortSignal },
  ): Promise<SearchHit[]> {
    this.assertTrustedTools();
    const preferred = await this.deps.workbench?.preferSearch?.(pattern, opts);
    if (preferred) {
      return preferred;
    }
    const root = this.requireRoot();
    const rgHits = await tryRg(root, pattern, opts);
    if (rgHits) return rgHits;
    return fallbackSearch(root, pattern, opts?.glob, opts?.signal);
  }

  async *runTerminal(
    cmd: string,
    opts: { cwd: string; signal?: AbortSignal },
  ): AsyncIterable<TerminalChunk> {
    this.assertTrustedTools();
    const preferred = await this.deps.workbench?.preferRunTerminal?.(cmd, opts);
    if (preferred) {
      yield* preferred;
      return;
    }
    const child = spawn(cmd, {
      cwd: opts.cwd,
      shell: true,
      signal: opts.signal,
      env: process.env,
    });

    const queue: TerminalChunk[] = [];
    let done = false;
    let wake: (() => void) | undefined;
    const push = (c: TerminalChunk) => {
      queue.push(c);
      wake?.();
    };

    child.stdout?.on('data', (b: Buffer) => {
      push({ stream: 'stdout', text: b.toString('utf8') });
    });
    child.stderr?.on('data', (b: Buffer) => {
      push({ stream: 'stderr', text: b.toString('utf8') });
    });

    const finished = new Promise<number | null>((resolve, reject) => {
      child.on('error', reject);
      child.on('close', (code) => {
        done = true;
        wake?.();
        resolve(code);
      });
    });

    while (!done || queue.length) {
      if (!queue.length) {
        await new Promise<void>((r) => {
          wake = r;
        });
        continue;
      }
      yield queue.shift()!;
    }

    const code = await finished;
    if (code && code !== 0) {
      yield {
        stream: 'stderr',
        text: `\n[exit ${code}]\n`,
        exitCode: code,
      };
    } else {
      yield { stream: 'stdout', text: '', exitCode: code ?? 0 };
    }
  }

  async gatherMeta(
    signal?: AbortSignal,
  ): Promise<{ gitStatus?: string }> {
    const root = this.getWorkspaceRoot();
    if (!root) return {};
    try {
      let out = '';
      for await (const chunk of this.runTerminal('git status -sb', {
        cwd: root,
        signal,
      })) {
        out += chunk.text;
      }
      return { gitStatus: out.trim() };
    } catch {
      return {};
    }
  }

  private requireRoot(): string {
    const root = this.getWorkspaceRoot();
    if (!root) {
      throw new Error(
        'Open Folder (workspace root) before running the agent.',
      );
    }
    return root;
  }

  private resolvePath(rel: string): string {
    const root = this.requireRoot();
    const abs = path.resolve(root, rel);
    // Escape check against the active tool root (worktree or workspace).
    if (!isPathInsideWorkspace(root, abs)) {
      throw new Error(`Path escapes workspace: ${rel}`);
    }
    return abs;
  }

  private assertTrustedTools(): void {
    if (!this.isTrustedWorkspace()) {
      const msg =
        'Workspace is not trusted. Agentic file/terminal tools are disabled (NFR-D07).';
      this.deps.log?.(msg);
      throw new Error(msg);
    }
  }
}

export function isPathInsideWorkspace(root: string, abs: string): boolean {
  const rootRes = path.resolve(root);
  const absRes = path.resolve(abs);
  if (process.platform === 'win32') {
    const rel = path.relative(rootRes.toLowerCase(), absRes.toLowerCase());
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  }
  const rel = path.relative(rootRes, absRes);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

async function tryRg(
  root: string,
  pattern: string,
  opts?: { glob?: string; signal?: AbortSignal },
): Promise<SearchHit[] | null> {
  return new Promise((resolve) => {
    const args = ['--json', '--line-number', '--no-heading', pattern];
    if (opts?.glob) args.push('--glob', opts.glob);
    const child = spawn('rg', args, {
      cwd: root,
      shell: false,
      signal: opts?.signal,
    });
    let buf = '';
    let failed = false;
    child.on('error', () => {
      failed = true;
      resolve(null);
    });
    child.stdout?.on('data', (b: Buffer) => {
      buf += b.toString('utf8');
    });
    child.on('close', (code) => {
      if (failed) return;
      if (code !== 0 && code !== 1) {
        resolve(null);
        return;
      }
      const hits: SearchHit[] = [];
      for (const line of buf.split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          const row = JSON.parse(line) as {
            type?: string;
            data?: {
              path?: { text?: string };
              line_number?: number;
              lines?: { text?: string };
            };
          };
          if (row.type !== 'match' || !row.data) continue;
          hits.push({
            path: row.data.path?.text ?? '',
            line: row.data.line_number ?? 0,
            text: (row.data.lines?.text ?? '').replace(/\r?\n$/, ''),
          });
        } catch {
          // ignore
        }
      }
      resolve(hits.slice(0, 100));
    });
  });
}

async function fallbackSearch(
  root: string,
  pattern: string,
  glob?: string,
  signal?: AbortSignal,
): Promise<SearchHit[]> {
  const re = new RegExp(pattern, 'i');
  const hits: SearchHit[] = [];
  const skip = new Set(['node_modules', '.git', 'dist', 'build', '.next']);

  async function walk(dir: string): Promise<void> {
    if (signal?.aborted) return;
    if (hits.length >= 100) return;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (skip.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
        continue;
      }
      if (glob && !minimatchSimple(e.name, glob)) continue;
      try {
        const text = await fs.readFile(full, 'utf8');
        if (text.includes('\0')) continue;
        const rel = path.relative(root, full).replace(/\\/g, '/');
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] ?? '';
          if (re.test(line)) {
            hits.push({ path: rel, line: i + 1, text: line });
            if (hits.length >= 100) return;
          }
        }
      } catch {
        // skip
      }
    }
  }

  await walk(root);
  return hits;
}

async function listGlob(
  root: string,
  pattern: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const out: string[] = [];
  const skip = new Set(['node_modules', '.git', 'dist', 'build', '.next']);
  // Very small glob: `**/*.ext` or `*.ext` or exact relative path prefix.
  const starExt = pattern.match(/^\*\*\/\*(\.[A-Za-z0-9]+)$|^(\*\.[A-Za-z0-9]+)$/);
  const ext = starExt?.[1] ?? starExt?.[2]?.slice(1);

  async function walk(dir: string): Promise<void> {
    if (signal?.aborted || out.length >= 5000) return;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (skip.has(e.name)) continue;
      const full = path.join(dir, e.name);
      const rel = path.relative(root, full).replace(/\\/g, '/');
      if (e.isDirectory()) {
        await walk(full);
        continue;
      }
      if (ext) {
        if (e.name.endsWith(ext) || e.name.endsWith(ext.slice(1))) out.push(rel);
      } else if (minimatchSimple(e.name, pattern) || rel === pattern || rel.endsWith('/' + pattern)) {
        out.push(rel);
      }
    }
  }

  await walk(root);
  return out;
}

function minimatchSimple(name: string, glob: string): boolean {
  if (glob.startsWith('*.')) return name.endsWith(glob.slice(1));
  return name === glob;
}
