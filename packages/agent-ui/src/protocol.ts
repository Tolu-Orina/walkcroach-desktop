/*---------------------------------------------------------------------------------------------
 *  Copyright (c) WalkCroach contributors. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * The webview <-> workbench message contract.
 *
 * Canonical source: `@walkcroach/agent-protocol` (walkcroach/packages/agent-protocol).
 * Bump PROTOCOL_VERSION there on any breaking change — do not fork types here.
 */
export {
	PROTOCOL_VERSION,
	type AgentMode,
	type AgentPhase,
	type MemorySurface,
	type TurnRole,
	type ApprovalState,
	type FleetSessionStatus,
	type FleetLayout,
	type Provenance,
	type Turn,
	type ApprovalRequest,
	type AuthState,
	type BrandColors,
	type FleetSession,
	type SoftCapNotice,
	type AgentSnapshot,
	type HostMessage,
	type ViewMessage,
} from '@walkcroach/agent-protocol';
