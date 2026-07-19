/**
 * In-memory secrets for tests / unlinked local mode.
 */
import type { HostSecrets } from '@walkcroach/agent-engine';

export class MemorySecrets implements HostSecrets {
  private readonly map = new Map<string, string>();

  async get(key: string): Promise<string | undefined> {
    return this.map.get(key);
  }

  async store(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
}
