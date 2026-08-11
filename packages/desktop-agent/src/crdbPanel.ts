/**
 * Phase C — CockroachDB panel session (Node).
 * Wraps Managed MCP + skills + ccloud with hard write/ccloud gates and session audit.
 * Workbench UI talks through electron-main bridge; tests / offline use demo fixtures.
 */
import {
  CockroachMcpClient,
  isMcpWriteTool,
  SkillsRegistry,
  TelemetrySink,
  emptyTelemetry,
  ensureJsonOutput,
  isInfraCommand,
  type McpConfig,
  type TelemetryCounters,
  type SkillMeta,
  type SkillFull,
} from '@walkcroach/agent-engine';

export type CrdbAuditEntry = {
  id: string;
  ts: number;
  kind: 'mcp' | 'ccloud' | 'skill' | 'memory' | 'system';
  action: string;
  detail: string;
  outcome: 'ok' | 'rejected' | 'error';
};

export type CrdbSchemaNode = {
  name: string;
  kind: 'database' | 'table' | 'column';
  children?: CrdbSchemaNode[];
  detail?: string;
};

export type CrdbPanelDeps = {
  /** Always required for ccloud / MCP writes — no autonomy exception (FR-F11 / NFR-F08). */
  confirm: (prompt: {
    title: string;
    detail: string;
    kind: 'mcp_write' | 'ccloud';
  }) => Promise<'approve' | 'reject'>;
  getMcpConfig?: () => Promise<McpConfig | null>;
  getCcloudApiKey?: () => Promise<string | undefined>;
  /** When true (default), use in-memory demo schema/query without network. */
  demoMode?: boolean;
  runCcloudFn?: (
    args: string[],
    opts?: { apiKey?: string },
  ) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
};

export type CrdbPanelCounters = TelemetryCounters & {
  recalls_by_surface: Record<string, number>;
};

const DEMO_SCHEMA: CrdbSchemaNode[] = [
  {
    name: 'defaultdb',
    kind: 'database',
    children: [
      {
        name: 'memory_entries',
        kind: 'table',
        detail: 'WalkCroach cross-surface memory',
        children: [
          { name: 'id', kind: 'column', detail: 'UUID PK' },
          { name: 'project_id', kind: 'column', detail: 'UUID' },
          { name: 'source_surface', kind: 'column', detail: 'STRING' },
          { name: 'kind', kind: 'column', detail: 'STRING' },
          { name: 'text', kind: 'column', detail: 'STRING' },
        ],
      },
      {
        name: 'ide_links',
        kind: 'table',
        detail: 'Desktop/IDE project links',
        children: [
          { name: 'id', kind: 'column', detail: 'UUID PK' },
          { name: 'project_id', kind: 'column', detail: 'UUID' },
          { name: 'local_repo_key', kind: 'column', detail: 'STRING' },
        ],
      },
    ],
  },
];

export class CrdbPanelSession {
  private mcp: CockroachMcpClient | null = null;
  private readonly skills = new SkillsRegistry();
  private readonly telemetry = new TelemetrySink();
  private readonly recallsBySurface: Record<string, number> = {};
  private readonly audit: CrdbAuditEntry[] = [];
  private skillsReady = false;
  private readonly demoMode: boolean;

  constructor(private readonly deps: CrdbPanelDeps) {
    this.demoMode = deps.demoMode !== false;
  }

  getCounters(): CrdbPanelCounters {
    return {
      ...this.telemetry.counters,
      recalls_by_surface: { ...this.recallsBySurface },
    };
  }

  getAuditLog(): readonly CrdbAuditEntry[] {
    return this.audit;
  }

  private pushAudit(
    partial: Omit<CrdbAuditEntry, 'id' | 'ts'>,
  ): void {
    this.audit.unshift({
      id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ts: Date.now(),
      ...partial,
    });
    if (this.audit.length > 200) this.audit.length = 200;
  }

  async ensureSkills(): Promise<SkillMeta[]> {
    if (!this.skillsReady) {
      await this.skills.init([]);
      this.skillsReady = true;
    }
    return this.skills.listMeta();
  }

  async loadSkill(name: string): Promise<SkillFull> {
    await this.ensureSkills();
    const full = this.skills.load(name);
    if (!full) {
      this.pushAudit({
        kind: 'skill',
        action: 'load_skill',
        detail: name,
        outcome: 'error',
      });
      throw new Error(`Unknown skill "${name}"`);
    }
    this.telemetry.bump('skill_loaded');
    this.telemetry.bump('skill_invoked');
    this.pushAudit({
      kind: 'skill',
      action: 'load_skill',
      detail: name,
      outcome: 'ok',
    });
    return full;
  }

  /** Schema browser — MCP list_tables / get_table_schema. Fail-closed when live and unconfigured. */
  async listSchema(): Promise<CrdbSchemaNode[]> {
    if (this.demoMode) {
      this.pushAudit({
        kind: 'mcp',
        action: 'list_schema',
        detail: 'demo fixtures',
        outcome: 'ok',
      });
      this.telemetry.bump('mcp_call');
      return DEMO_SCHEMA;
    }
    if (!(await this.tryConnectMcp())) {
      this.pushAudit({
        kind: 'mcp',
        action: 'list_schema',
        detail: 'MCP not configured',
        outcome: 'error',
      });
      throw new Error(
        'CockroachDB MCP is not configured. Run WalkCroach: Configure CockroachDB.',
      );
    }

    const tablesRaw = await this.mcp!.callTool('list_tables', {});
    this.telemetry.bump('mcp_call');
    this.pushAudit({
      kind: 'mcp',
      action: 'list_tables',
      detail: tablesRaw.slice(0, 200),
      outcome: 'ok',
    });
    return [
      {
        name: 'cluster',
        kind: 'database',
        detail: 'Live MCP',
        children: tablesRaw
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(0, 50)
          .map((name) => ({ name, kind: 'table' as const })),
      },
    ];
  }

  async getTableSchema(table: string): Promise<string> {
    if (this.demoMode) {
      const hit = findTable(DEMO_SCHEMA, table);
      this.telemetry.bump('mcp_call');
      const text = hit
        ? JSON.stringify(hit, null, 2)
        : `Table "${table}" not in demo schema.`;
      this.pushAudit({
        kind: 'mcp',
        action: 'get_table_schema',
        detail: table,
        outcome: hit ? 'ok' : 'error',
      });
      return text;
    }
    if (!(await this.tryConnectMcp())) {
      throw new Error(
        'CockroachDB MCP is not configured. Run WalkCroach: Configure CockroachDB.',
      );
    }
    const out = await this.mcp!.callTool('get_table_schema', { table });
    this.telemetry.bump('mcp_call');
    this.pushAudit({
      kind: 'mcp',
      action: 'get_table_schema',
      detail: table,
      outcome: 'ok',
    });
    return out;
  }

  /**
   * Query runner — read-only select_query by default.
   * Write/mutating tools require explicit confirm (never auto).
   */
  async runQuery(
    sql: string,
    opts?: { allowWrite?: boolean; tool?: string },
  ): Promise<string> {
    const tool = opts?.tool ?? 'select_query';
    const trimmed = sql.trim();
    if (!trimmed) throw new Error('SQL is required');

    const write =
      isMcpWriteTool(tool) ||
      /^\s*(insert|update|delete|upsert|create|drop|alter|truncate|grant|revoke)\b/i.test(
        trimmed,
      );

    if (write) {
      if (!opts?.allowWrite) {
        this.pushAudit({
          kind: 'mcp',
          action: tool,
          detail: 'write blocked (read-only default)',
          outcome: 'rejected',
        });
        throw new Error(
          'Write path is opt-in. Enable writes and confirm (FR-F09 / NFR-F08).',
        );
      }
      const decision = await this.deps.confirm({
        title: 'Confirm MCP write',
        detail: `${tool}\n${trimmed.slice(0, 500)}`,
        kind: 'mcp_write',
      });
      this.telemetry.bump('mcp_write_consent');
      if (decision !== 'approve') {
        this.pushAudit({
          kind: 'mcp',
          action: tool,
          detail: trimmed.slice(0, 120),
          outcome: 'rejected',
        });
        throw new Error('User rejected the MCP write.');
      }
    }

    if (this.demoMode) {
      this.telemetry.bump('mcp_call');
      if (write) {
        this.pushAudit({
          kind: 'mcp',
          action: tool,
          detail: 'demo write acknowledged (no network)',
          outcome: 'ok',
        });
        return JSON.stringify({
          ok: true,
          mode: 'demo',
          note: 'Write confirmed in demo mode — no live cluster mutation.',
          sql: trimmed,
        });
      }
      const rows = demoSelect(trimmed);
      this.pushAudit({
        kind: 'mcp',
        action: 'select_query',
        detail: trimmed.slice(0, 120),
        outcome: 'ok',
      });
      return JSON.stringify(rows, null, 2);
    }

    if (!(await this.tryConnectMcp())) {
      throw new Error(
        'CockroachDB MCP is not configured. Run WalkCroach: Configure CockroachDB.',
      );
    }

    const out = await this.mcp!.callTool(tool, {
      sql: trimmed,
      query: trimmed,
    });
    this.telemetry.bump('mcp_call');
    this.pushAudit({
      kind: 'mcp',
      action: tool,
      detail: trimmed.slice(0, 120),
      outcome: 'ok',
    });
    return out;
  }

  /**
   * ccloud from panel — hard per-action confirmation, no autonomy exception (FR-F11).
   */
  async runCcloud(args: string[], opts?: { dryRun?: boolean }): Promise<string> {
    if (!args.length) throw new Error('ccloud requires args');
    const preview = `ccloud ${args.join(' ')}`;
    // Always confirm — even "read" ccloud from the panel (hard gate).
    const decision = await this.deps.confirm({
      title: 'Confirm ccloud action',
      detail: opts?.dryRun
        ? `[dry-run] ${preview}\n(No cluster mutation in dry-run.)`
        : preview,
      kind: 'ccloud',
    });
    if (decision !== 'approve') {
      this.pushAudit({
        kind: 'ccloud',
        action: preview,
        detail: 'rejected',
        outcome: 'rejected',
      });
      throw new Error('User rejected the ccloud action.');
    }

    if (opts?.dryRun || this.demoMode) {
      this.telemetry.bump('ccloud_action');
      const payload = {
        ok: true,
        dryRun: true,
        args: ensureJsonOutput(args),
        infra: isInfraCommand(preview),
        note: 'Dry-run / demo — ccloud binary not invoked.',
      };
      this.pushAudit({
        kind: 'ccloud',
        action: preview,
        detail: 'dry-run ok',
        outcome: 'ok',
      });
      return JSON.stringify(payload, null, 2);
    }

    const apiKey = (await this.deps.getCcloudApiKey?.()) || undefined;
    const runner = this.deps.runCcloudFn;
    if (!runner) {
      throw new Error('ccloud runner not wired (electron-main bridge). Use dry-run.');
    }
    const result = await runner(args, { apiKey });
    this.telemetry.bump('ccloud_action');
    const text =
      result.stdout ||
      result.stderr ||
      JSON.stringify({ exitCode: result.exitCode });
    this.pushAudit({
      kind: 'ccloud',
      action: preview,
      detail: text.slice(0, 200),
      outcome: result.exitCode === 0 ? 'ok' : 'error',
    });
    return text;
  }

  recordMemoryRecall(hits: Array<{ sourceSurface?: string }>): void {
    this.telemetry.bump('memory_recall');
    for (const h of hits) {
      const s = (h.sourceSurface || 'unknown').toLowerCase();
      this.recallsBySurface[s] = (this.recallsBySurface[s] ?? 0) + 1;
    }
    this.pushAudit({
      kind: 'memory',
      action: 'recall',
      detail: `${hits.length} hits`,
      outcome: 'ok',
    });
  }

  async isConfigured(): Promise<boolean> {
    if (this.demoMode) {
      return true;
    }
    const cfg = await this.deps.getMcpConfig?.();
    return Boolean(cfg?.clusterId && cfg?.apiKey);
  }

  private async tryConnectMcp(): Promise<boolean> {
    if (this.mcp?.connected) return true;
    const cfg = await this.deps.getMcpConfig?.();
    if (!cfg) return false;
    this.mcp = new CockroachMcpClient(cfg);
    await this.mcp.connect();
    return true;
  }
}

function findTable(
  nodes: CrdbSchemaNode[],
  name: string,
): CrdbSchemaNode | undefined {
  for (const n of nodes) {
    if (n.kind === 'table' && n.name === name) return n;
    if (n.children) {
      const hit = findTable(n.children, name);
      if (hit) return hit;
    }
  }
  return undefined;
}

function demoSelect(sql: string): unknown {
  if (/memory_entries/i.test(sql)) {
    return {
      columns: ['id', 'source_surface', 'kind', 'text'],
      rows: [
        [
          'demo-1',
          'web',
          'preference',
          'Prefer UUID primary keys',
        ],
        [
          'demo-2',
          'chrome',
          'decision',
          'Use Managed MCP read-only by default',
        ],
        [
          'demo-3',
          'desktop',
          'convention',
          'source_surface=desktop for Desktop mirrors',
        ],
      ],
    };
  }
  return {
    columns: ['ok'],
    rows: [[true]],
    note: 'Demo select_query — configure MCP secrets for live cluster.',
    sql,
  };
}

export { emptyTelemetry, DEMO_SCHEMA };
