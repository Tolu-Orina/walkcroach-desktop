/*---------------------------------------------------------------------------------------------
 *  Copyright (c) WalkCroach contributors. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * Protocol mirror of contrib/.../walkcroachSettingsProtocol.ts
 * Keep in sync — webview cannot import workbench modules.
 */

export const SETTINGS_PROTOCOL_VERSION = 1 as const;

export type WalkCroachSettingsTab =
	| 'general'
	| 'agent'
	| 'memory'
	| 'theme'
	| 'telemetry'
	| 'updates'
	| 'vscode';

export type WalkCroachSettingsValues = {
	apiBaseUrl: string;
	cognitoHostedUiUrl: string;
	cognitoClientId: string;
	crashReports: boolean;
	crashEndpoint: string;
	updateChannel: 'stable' | 'insiders';
	agentAutonomy: 'strict' | 'low_friction';
	themeSignal: string;
	themeTeal: string;
	themeEmber: string;
	signedIn: boolean;
	linkedProjectId?: string;
	linkedProjectName?: string;
};

export type SettingsHostMessage =
	| { readonly type: 'ready'; readonly protocolVersion: number }
	| { readonly type: 'snapshot'; readonly protocolVersion: number; readonly values: WalkCroachSettingsValues; readonly tab?: WalkCroachSettingsTab };

export type SettingsViewMessage =
	| { readonly type: 'ready'; readonly protocolVersion: number }
	| { readonly type: 'setValue'; readonly key: keyof WalkCroachSettingsValues; readonly value: string | boolean }
	| { readonly type: 'openVscodeSettings' }
	| { readonly type: 'runCommand'; readonly commandId: string }
	| { readonly type: 'selectTab'; readonly tab: WalkCroachSettingsTab };

declare function acquireVsCodeApi(): {
	postMessage(msg: SettingsViewMessage): void;
	getState(): unknown;
	setState(state: unknown): void;
};

let api: ReturnType<typeof acquireVsCodeApi> | undefined;
try {
	api = acquireVsCodeApi();
} catch {
	api = undefined;
}

export function postToHost(msg: SettingsViewMessage): void {
	api?.postMessage(msg);
}

export function onHostMessage(handler: (msg: SettingsHostMessage) => void): () => void {
	const listener = (event: MessageEvent) => {
		const data = event.data as SettingsHostMessage;
		if (data && typeof data === 'object' && 'type' in data) {
			handler(data);
		}
	};
	window.addEventListener('message', listener);
	return () => window.removeEventListener('message', listener);
}
