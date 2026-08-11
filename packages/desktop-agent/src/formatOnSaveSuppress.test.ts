import { describe, expect, it, vi } from 'vitest';
import {
  beginFormatOnSaveSuppress,
  withFormatOnSaveSuppressed,
  type FormatOnSaveAccess,
} from './formatOnSaveSuppress.js';

describe('formatOnSaveSuppress', () => {
  it('snapshots, forces false, restores prior', async () => {
    let formatOnSave: boolean | undefined = true;
    let formatOnSaveMode: string | undefined = 'file';
    const access: FormatOnSaveAccess = {
      get: () => ({ formatOnSave, formatOnSaveMode }),
      set: (next) => {
        formatOnSave = next.formatOnSave;
        if (next.formatOnSaveMode !== undefined) {
          formatOnSaveMode = next.formatOnSaveMode;
        }
      },
    };
    const sawSuppressed = await withFormatOnSaveSuppressed(access, async () => {
      expect(formatOnSave).toBe(false);
      return 'ok';
    });
    expect(sawSuppressed).toBe('ok');
    expect(formatOnSave).toBe(true);
    expect(formatOnSaveMode).toBe('file');
  });

  it('no-ops when access is missing', async () => {
    const fn = vi.fn(async () => 1);
    await expect(withFormatOnSaveSuppressed(undefined, fn)).resolves.toBe(1);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('beginFormatOnSaveSuppress returns restore callback', async () => {
    let formatOnSave: boolean | undefined = true;
    const access: FormatOnSaveAccess = {
      get: () => ({ formatOnSave, formatOnSaveMode: undefined }),
      set: (next) => {
        formatOnSave = next.formatOnSave;
      },
    };
    const restore = await beginFormatOnSaveSuppress(access);
    expect(formatOnSave).toBe(false);
    await restore();
    expect(formatOnSave).toBe(true);
  });
});
