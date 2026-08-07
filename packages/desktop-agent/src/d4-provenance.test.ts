/**
 * D4 — provenance mapping helpers (pure; mirrors workbench protocol).
 */
import { describe, expect, it } from 'vitest';

type MemorySurface = 'web' | 'chrome' | 'ide' | 'cli' | 'desktop';

function normalizeMemorySurface(raw: string | undefined): MemorySurface {
  const s = (raw ?? 'unknown').toLowerCase();
  if (s === 'web' || s === 'chrome' || s === 'ide' || s === 'cli' || s === 'desktop') {
    return s;
  }
  return 'ide';
}

function hitsToProvenance(
  hits: Array<{ sourceSurface?: string; text: string; createdAt?: string }>,
): Array<{ surface: MemorySurface; ts: number; label: string }> {
  return hits.map((h) => ({
    surface: normalizeMemorySurface(h.sourceSurface),
    ts: h.createdAt ? Date.parse(h.createdAt) || Date.now() : Date.now(),
    label: h.text.slice(0, 80),
  }));
}

describe('D4 provenance mapping', () => {
  it('maps chrome and desktop surfaces for chips', () => {
    const chips = hitsToProvenance([
      { sourceSurface: 'chrome', text: 'Prefer UUID', createdAt: '2026-08-01T12:00:00.000Z' },
      { sourceSurface: 'desktop', text: 'Desktop convention', createdAt: '2026-08-02T12:00:00.000Z' },
    ]);
    expect(chips[0]?.surface).toBe('chrome');
    expect(chips[1]?.surface).toBe('desktop');
    expect(chips[0]?.ts).toBe(Date.parse('2026-08-01T12:00:00.000Z'));
  });

  it('normalizes unknown surfaces to ide', () => {
    expect(normalizeMemorySurface('weird')).toBe('ide');
  });
});
