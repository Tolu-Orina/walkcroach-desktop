/**
 * D5.3 — fleet soft-cap gate (mirrors walkcroach/common/fleet.ts evaluateFleetSoftCap).
 * Kept here so desktop-agent vitest can assert Path B cap without compiling vscode/.
 */
import { describe, expect, it } from 'vitest';

const SOFT_CAP = 6;

function evaluateFleetSoftCap(
  currentCount: number,
  force?: boolean,
  cap: number = SOFT_CAP,
): { ok: true } | { ok: false; reason: 'soft_cap'; count: number; cap: number } {
  if (force || currentCount < cap) {
    return { ok: true };
  }
  return { ok: false, reason: 'soft_cap', count: currentCount, cap };
}

describe('D5.3 fleet soft cap', () => {
  it('allows creates under the soft cap', () => {
    expect(evaluateFleetSoftCap(0).ok).toBe(true);
    expect(evaluateFleetSoftCap(5).ok).toBe(true);
  });

  it('blocks at the soft cap without force', () => {
    const r = evaluateFleetSoftCap(6);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('soft_cap');
      expect(r.cap).toBe(6);
      expect(r.count).toBe(6);
    }
  });

  it('allows override with force', () => {
    expect(evaluateFleetSoftCap(6, true).ok).toBe(true);
    expect(evaluateFleetSoftCap(20, true).ok).toBe(true);
  });
});
