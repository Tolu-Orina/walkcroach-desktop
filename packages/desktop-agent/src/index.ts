export { DesktopHostAdapter, isPathInsideWorkspace } from './desktopHostAdapter.js';
export type { DesktopHostDeps, DesktopWorkbenchHooks } from './desktopHostAdapter.js';
export {
  withFormatOnSaveSuppressed,
  beginFormatOnSaveSuppress,
} from './formatOnSaveSuppress.js';
export type {
  FormatOnSaveSnapshot,
  FormatOnSaveAccess,
} from './formatOnSaveSuppress.js';
export {
  createDesktopHost,
  createSessionHost,
  startDesktopSession,
  DESKTOP_SOURCE_SURFACE,
  normalizeLocalRepoKey,
  SECRET_KEYS,
} from './session.js';
export type { SessionOptions, SessionHandle } from './session.js';
export {
  createDesktopMemoryBridge,
  ideHealth,
  ideMe,
  listMyProjects,
  createLink,
  deleteLink,
} from './ideClient.js';
export type {
  DesktopIdeClient,
  IdeLink,
  IdeProject,
} from './ideClient.js';
export { MemorySecrets } from './memorySecrets.js';
export { FileSecrets } from './fileSecrets.js';
export type { FileSecretsOpts } from './fileSecrets.js';
export {
  DurableMemoryStore,
  DURABLE_DIR_REL,
} from './durable/durableMemoryStore.js';
export type {
  DurableEntry,
  DurableCacheEntry,
  DurableMemoryStoreDeps,
} from './durable/durableMemoryStore.js';
export {
  CrdbPanelSession,
  DEMO_SCHEMA,
} from './crdbPanel.js';
export type {
  CrdbAuditEntry,
  CrdbSchemaNode,
  CrdbPanelDeps,
  CrdbPanelCounters,
} from './crdbPanel.js';

/** Re-export for Agent Host CRDB panel wiring (live MCP + ccloud). */
export {
  runCcloud,
  loadMcpConfigFromSecrets,
  DEFAULT_MCP_URL,
} from '@walkcroach/agent-engine';
