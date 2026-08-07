/**
 * Thin /ide BFF client for Desktop. Memory uses `@walkcroach/sdk` → `/v1`
 * with source_surface=desktop (Phase P2).
 */
import type { ProjectMemoryBridge } from '@walkcroach/agent-engine';
import { createHostMemoryBridge } from '@walkcroach/sdk';

export const DESKTOP_SOURCE_SURFACE = 'desktop';

export type IdeProject = {
  id: string;
  name: string;
  status: string;
  updated_at: string;
};

export type IdeLink = {
  id: string;
  projectId: string;
  projectName?: string | null;
  localRepoKey: string;
  localRepoDisplay?: string | null;
};

export type DesktopIdeClient = {
  baseUrl: string;
};

async function ideFetch(
  client: DesktopIdeClient,
  path: string,
  opts: {
    method?: string;
    token: string;
    body?: unknown;
    query?: Record<string, string | undefined>;
  },
): Promise<Response> {
  const url = new URL(
    `${client.baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`,
  );
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }
  return fetch(url, {
    method: opts.method ?? 'GET',
    headers: {
      authorization: `Bearer ${opts.token}`,
      accept: 'application/json',
      ...(opts.body !== undefined
        ? { 'content-type': 'application/json' }
        : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`IDE API non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const err =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: string }).error)
        : `IDE API ${res.status}`;
    throw new Error(err);
  }
  return data as T;
}

export async function ideHealth(
  client: DesktopIdeClient,
): Promise<{ ok: boolean; surface?: string }> {
  const res = await fetch(
    `${client.baseUrl.replace(/\/$/, '')}/ide/v1/health`,
  );
  return readJson(res);
}

export async function ideMe(
  client: DesktopIdeClient,
  token: string,
  localRepoKey?: string,
) {
  const res = await ideFetch(client, '/ide/v1/me', {
    token,
    query: localRepoKey ? { local_repo_key: localRepoKey } : undefined,
  });
  return readJson<{
    ownerId: string;
    link: IdeLink | null;
    linkCount: number;
  }>(res);
}

export async function listMyProjects(
  client: DesktopIdeClient,
  token: string,
): Promise<IdeProject[]> {
  const res = await ideFetch(client, '/ide/v1/me/projects', { token });
  const data = await readJson<{ projects: IdeProject[] }>(res);
  return data.projects ?? [];
}

export async function createLink(
  client: DesktopIdeClient,
  token: string,
  body: {
    projectId: string;
    gitRemoteUrl?: string;
    workspacePath?: string;
    localRepoDisplay?: string;
  },
): Promise<IdeLink> {
  const res = await ideFetch(client, '/ide/v1/links', {
    method: 'POST',
    token,
    body,
  });
  const data = await readJson<{ link: IdeLink }>(res);
  return data.link;
}

export async function deleteLink(
  client: DesktopIdeClient,
  token: string,
  linkId: string,
): Promise<void> {
  const res = await ideFetch(client, `/ide/v1/links/${linkId}`, {
    method: 'DELETE',
    token,
  });
  await readJson(res);
}

export function createDesktopMemoryBridge(params: {
  client: DesktopIdeClient;
  getToken: () => Promise<string | undefined>;
  projectId: string;
  projectName?: string;
}): ProjectMemoryBridge {
  const { client, getToken, projectId, projectName } = params;
  return createHostMemoryBridge({
    getAccessToken: getToken,
    projectId,
    projectName,
    surface: DESKTOP_SOURCE_SURFACE,
    getBaseUrl: () => client.baseUrl.replace(/\/$/, ''),
  }) as ProjectMemoryBridge;
}
