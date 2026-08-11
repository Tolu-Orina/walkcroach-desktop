/**
 * Session-scoped editor.formatOnSave suppress for agent runs.
 * Pure snapshot/restore helper — hosts supply get/set against their config service.
 */

export type FormatOnSaveSnapshot = {
  formatOnSave: boolean | undefined;
  formatOnSaveMode: string | undefined;
};

export type FormatOnSaveAccess = {
  get: () => FormatOnSaveSnapshot | Promise<FormatOnSaveSnapshot>;
  /** Apply values; pass `undefined` mode to leave mode untouched when suppressing. */
  set: (next: {
    formatOnSave: boolean;
    formatOnSaveMode?: string | undefined;
  }) => void | Promise<void>;
};

/**
 * Snapshot formatOnSave settings, force false for the duration of `fn`, then restore.
 */
export async function withFormatOnSaveSuppressed<T>(
  access: FormatOnSaveAccess | undefined | null,
  fn: () => Promise<T>,
): Promise<T> {
  if (!access) {
    return fn();
  }
  const prior = await access.get();
  try {
    await access.set({ formatOnSave: false });
    return await fn();
  } finally {
    await access.set({
      formatOnSave: prior.formatOnSave ?? true,
      formatOnSaveMode: prior.formatOnSaveMode,
    });
  }
}

/**
 * Build a restore callback from snapshot + set (for hook-style hosts).
 */
export async function beginFormatOnSaveSuppress(
  access: FormatOnSaveAccess,
): Promise<() => Promise<void>> {
  const prior = await access.get();
  await access.set({ formatOnSave: false });
  return async () => {
    await access.set({
      formatOnSave: prior.formatOnSave ?? true,
      formatOnSaveMode: prior.formatOnSaveMode,
    });
  };
}
