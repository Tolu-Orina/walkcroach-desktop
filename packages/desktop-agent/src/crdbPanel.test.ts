import { describe, expect, it } from 'vitest';
import { isMcpWriteTool } from '@walkcroach/agent-engine';
import { CrdbPanelSession } from './crdbPanel.js';

describe('CrdbPanelSession Phase C', () => {
  it('lists demo schema and bumps mcp_call', async () => {
    const session = new CrdbPanelSession({
      confirm: async () => 'approve',
      demoMode: true,
    });
    const schema = await session.listSchema();
    expect(schema[0]?.name).toBe('defaultdb');
    expect(session.getCounters().mcp_call).toBeGreaterThan(0);
    expect(session.getAuditLog().length).toBeGreaterThan(0);
  });

  it('runs read-only select without confirm', async () => {
    const confirms: string[] = [];
    const session = new CrdbPanelSession({
      confirm: async (p) => {
        confirms.push(p.kind);
        return 'approve';
      },
      demoMode: true,
    });
    const out = await session.runQuery(
      'SELECT source_surface, text FROM memory_entries LIMIT 5',
    );
    expect(out).toContain('web');
    expect(confirms).toHaveLength(0);
  });

  it('blocks writes unless allowWrite + confirm', async () => {
    const session = new CrdbPanelSession({
      confirm: async () => 'approve',
      demoMode: true,
    });
    await expect(
      session.runQuery('DELETE FROM memory_entries WHERE false'),
    ).rejects.toThrow(/opt-in/i);

    const rejected = new CrdbPanelSession({
      confirm: async () => 'reject',
      demoMode: true,
    });
    await expect(
      rejected.runQuery('DELETE FROM memory_entries WHERE false', {
        allowWrite: true,
      }),
    ).rejects.toThrow(/rejected/i);
  });

  it('always confirms ccloud (no autonomy exception)', async () => {
    let seen = false;
    const session = new CrdbPanelSession({
      confirm: async (p) => {
        seen = p.kind === 'ccloud';
        return 'approve';
      },
      demoMode: true,
    });
    const out = await session.runCcloud(['cluster', 'list'], { dryRun: true });
    expect(seen).toBe(true);
    expect(out).toContain('dryRun');
    expect(session.getCounters().ccloud_action).toBe(1);
  });

  it('rejects ccloud when user declines', async () => {
    const session = new CrdbPanelSession({
      confirm: async () => 'reject',
      demoMode: true,
    });
    await expect(
      session.runCcloud(['cluster', 'create', '--name', 'x'], { dryRun: true }),
    ).rejects.toThrow(/rejected/i);
    expect(session.getAuditLog()[0]?.outcome).toBe('rejected');
  });

  it('loads skills progressively', async () => {
    const session = new CrdbPanelSession({
      confirm: async () => 'approve',
      demoMode: true,
    });
    const metas = await session.ensureSkills();
    expect(metas.length).toBeGreaterThan(0);
    const schemaSkill =
      metas.find((m) => /schema/i.test(m.name)) ?? metas[0]!;
    const full = await session.loadSkill(schemaSkill.name);
    expect(full.body.length).toBeGreaterThan(10);
    expect(session.getCounters().skill_invoked).toBe(1);
  });

  it('tracks recalls_by_surface', () => {
    const session = new CrdbPanelSession({
      confirm: async () => 'approve',
      demoMode: true,
    });
    session.recordMemoryRecall([
      { sourceSurface: 'web' },
      { sourceSurface: 'web' },
      { sourceSurface: 'desktop' },
    ]);
    const c = session.getCounters();
    expect(c.memory_recall).toBe(1);
    expect(c.recalls_by_surface.web).toBe(2);
    expect(c.recalls_by_surface.desktop).toBe(1);
  });

  it('treats unknown MCP tools as writes (engine parity)', () => {
    expect(isMcpWriteTool('select_query')).toBe(false);
    expect(isMcpWriteTool('execute_sql')).toBe(true);
  });
});
