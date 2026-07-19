/**
 * Phase B session runner — wraps @walkcroach/agent-engine runAgentLoop.
 * source_surface for mirrored memory is always `desktop`.
 */
import {
  runAgentLoop,
  TokenDeltaCoalescer,
  loadMcpConfigFromSecrets,
  SECRET_KEYS,
  normalizeLocalRepoKey,
  type AgentEvent,
  type ProjectMemoryBridge,
  type RunLoopParams,
} from '@walkcroach/agent-engine';
import { DesktopHostAdapter, type DesktopHostDeps } from './desktopHostAdapter.js';
import {
  createDesktopMemoryBridge,
  type DesktopIdeClient,
} from './ideClient.js';

export const DESKTOP_SOURCE_SURFACE = 'desktop' as const;

export type SessionOptions = {
  prompt: string;
  mode?: RunLoopParams['mode'];
  signal?: AbortSignal;
  ide?: {
    client: DesktopIdeClient;
    getToken: () => Promise<string | undefined>;
    projectId?: string;
    projectName?: string;
  };
  onEvent?: (ev: AgentEvent) => void;
  coalesceMs?: number;
};

export type SessionHandle = {
  host: DesktopHostAdapter;
  abort: AbortController;
  done: Promise<void>;
  getCacheMetrics: () => {
    cacheReadInputTokens: number;
    cacheWriteInputTokens: number;
  };
};

export function createDesktopHost(deps: DesktopHostDeps): DesktopHostAdapter {
  return new DesktopHostAdapter(deps);
}

/**
 * Build a host whose emit is coalesced for token_delta (PB.2 / PB.10).
 */
export function createSessionHost(
  base: Omit<DesktopHostDeps, 'emit'> & {
    onEvent?: (ev: AgentEvent) => void;
    coalesceMs?: number;
  },
): {
  host: DesktopHostAdapter;
  getCacheMetrics: () => {
    cacheReadInputTokens: number;
    cacheWriteInputTokens: number;
  };
} {
  let cacheRead = 0;
  let cacheWrite = 0;
  const coalescer = new TokenDeltaCoalescer((text) => {
    base.onEvent?.({ type: 'token_delta', text });
  }, base.coalesceMs ?? 16);

  const host = new DesktopHostAdapter({
    getWorkspaceRoot: base.getWorkspaceRoot,
    isTrustedWorkspace: base.isTrustedWorkspace,
    secrets: base.secrets,
    log: base.log,
    emit: (ev) => {
      if (ev.type === 'token_delta') {
        coalescer.push(ev.text);
        return;
      }
      if (ev.type === 'cache_usage') {
        cacheRead += ev.cacheReadInputTokens;
        cacheWrite += ev.cacheWriteInputTokens;
      }
      if (ev.type === 'done' || ev.type === 'error') {
        coalescer.flushNow();
      }
      base.onEvent?.(ev);
    },
  });

  return {
    host,
    getCacheMetrics: () => ({
      cacheReadInputTokens: cacheRead,
      cacheWriteInputTokens: cacheWrite,
    }),
  };
}

export function startDesktopSession(
  host: DesktopHostAdapter,
  opts: SessionOptions,
): SessionHandle {
  const abort = new AbortController();
  if (opts.signal) {
    if (opts.signal.aborted) abort.abort();
    else {
      opts.signal.addEventListener('abort', () => abort.abort(), {
        once: true,
      });
    }
  }
  host.setRunSignal(abort.signal);

  const metrics = { cacheReadInputTokens: 0, cacheWriteInputTokens: 0 };
  const prevEmit = host.emit.bind(host);
  const coalescer = new TokenDeltaCoalescer((text) => {
    opts.onEvent?.({ type: 'token_delta', text });
  }, opts.coalesceMs ?? 16);

  host.emit = (ev) => {
    prevEmit(ev);
    if (ev.type === 'token_delta') {
      coalescer.push(ev.text);
      return;
    }
    if (ev.type === 'cache_usage') {
      metrics.cacheReadInputTokens += ev.cacheReadInputTokens;
      metrics.cacheWriteInputTokens += ev.cacheWriteInputTokens;
    }
    if (ev.type === 'done' || ev.type === 'error') coalescer.flushNow();
    opts.onEvent?.(ev);
  };

  const done = (async () => {
    const mcpConfig = await loadMcpConfigFromSecrets((k) =>
      host.secrets.get(k),
    );
    const ccloudApiKey = await host.secrets.get(SECRET_KEYS.ccloudApiKey);

    let projectMemory: ProjectMemoryBridge | null = null;
    if (opts.ide?.projectId) {
      projectMemory = createDesktopMemoryBridge({
        client: opts.ide.client,
        getToken: opts.ide.getToken,
        projectId: opts.ide.projectId,
        projectName: opts.ide.projectName,
      });
    }

    await runAgentLoop({
      host,
      prompt: opts.prompt,
      signal: abort.signal,
      mode: opts.mode,
      mcpConfig,
      ccloudApiKey: ccloudApiKey || undefined,
      projectMemory,
      includePhaseB: true,
    });
  })();

  return {
    host,
    abort,
    done,
    getCacheMetrics: () => ({ ...metrics }),
  };
}

export { normalizeLocalRepoKey, SECRET_KEYS };
