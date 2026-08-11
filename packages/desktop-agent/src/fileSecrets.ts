/**
 * File-backed HostSecrets with optional encrypt/decrypt hooks (Electron safeStorage).
 *
 * Without hooks, values are stored as UTF-8 JSON (dev only). Production profiles
 * refuse plaintext writes unless `allowPlaintext` is explicitly true or encrypt
 * hooks are provided (P3.7).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { HostSecrets } from '@walkcroach/agent-engine';

export type FileSecretsOpts = {
  filePath: string;
  encrypt?: (plain: string) => Promise<string> | string;
  decrypt?: (cipher: string) => Promise<string> | string;
  /**
   * When false (default in production), store() without encrypt throws.
   * Dev/tests pass true or omit (defaults from WALKCROACH_PROFILE).
   */
  allowPlaintext?: boolean;
};

type StoreShape = { version: 1; entries: Record<string, string> };

export class PlaintextFileSecretsRefusedError extends Error {
  readonly code = 'PLAINTEXT_FILE_SECRETS_REFUSED';
  constructor() {
    super(
      'FileSecrets refused plaintext write: pass encrypt/decrypt (Electron safeStorage) or set allowPlaintext: true for non-production profiles.',
    );
    this.name = 'PlaintextFileSecretsRefusedError';
  }
}

function defaultAllowPlaintext(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.WALKCROACH_ALLOW_PLAINTEXT_SECRETS === '1') return true;
  if (env.VITEST || env.NODE_ENV === 'test') return true;
  const profile = (
    env.WALKCROACH_PROFILE ||
    env.WALKCROACH_ENV ||
    ''
  ).toLowerCase();
  if (profile === 'production' || profile === 'prod') return false;
  return true;
}

export class FileSecrets implements HostSecrets {
  private cache: StoreShape | undefined;
  private writeChain: Promise<void> = Promise.resolve();
  private readonly allowPlaintext: boolean;

  constructor(private readonly opts: FileSecretsOpts) {
    this.allowPlaintext =
      opts.allowPlaintext ?? defaultAllowPlaintext();
  }

  async get(key: string): Promise<string | undefined> {
    const store = await this.load();
    const raw = store.entries[key];
    if (raw === undefined) return undefined;
    if (!this.opts.decrypt) return raw;
    try {
      return await this.opts.decrypt(raw);
    } catch {
      // Legacy plaintext written before encryption was wired.
      return raw;
    }
  }

  async store(key: string, value: string): Promise<void> {
    if (!this.opts.encrypt && !this.allowPlaintext) {
      throw new PlaintextFileSecretsRefusedError();
    }
    const store = await this.load();
    store.entries[key] = this.opts.encrypt
      ? await this.opts.encrypt(value)
      : value;
    await this.persist(store);
  }

  async delete(key: string): Promise<void> {
    const store = await this.load();
    if (!(key in store.entries)) return;
    delete store.entries[key];
    await this.persist(store);
  }

  private async load(): Promise<StoreShape> {
    if (this.cache) return this.cache;
    try {
      const text = await readFile(this.opts.filePath, 'utf8');
      const parsed = JSON.parse(text) as StoreShape;
      if (parsed?.version === 1 && parsed.entries && typeof parsed.entries === 'object') {
        this.cache = parsed;
        return parsed;
      }
    } catch {
      // missing or corrupt → empty
    }
    this.cache = { version: 1, entries: {} };
    return this.cache;
  }

  private async persist(store: StoreShape): Promise<void> {
    this.cache = store;
    this.writeChain = this.writeChain.then(async () => {
      await mkdir(dirname(this.opts.filePath), { recursive: true });
      await writeFile(this.opts.filePath, JSON.stringify(store, null, 2), 'utf8');
    });
    await this.writeChain;
  }
}
