export { DesktopHostAdapter, isPathInsideWorkspace } from './desktopHostAdapter.js';
export type { DesktopHostDeps } from './desktopHostAdapter.js';
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
