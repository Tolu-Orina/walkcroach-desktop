/*---------------------------------------------------------------------------------------------
 *  Copyright (c) WalkCroach contributors. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
	onHostMessage,
	postToHost,
	SETTINGS_PROTOCOL_VERSION,
	type WalkCroachSettingsTab,
	type WalkCroachSettingsValues,
} from './protocol';
import './settings.css';

const NAV: Array<{ id: WalkCroachSettingsTab; label: string; hint?: string }> = [
	{ id: 'general', label: 'General' },
	{ id: 'agent', label: 'Agent' },
	{ id: 'memory', label: 'Memory' },
	{ id: 'theme', label: 'Theme' },
	{ id: 'telemetry', label: 'Telemetry' },
	{ id: 'updates', label: 'Updates' },
	{ id: 'vscode', label: 'VS Code Settings', hint: 'external' },
];

const EMPTY: WalkCroachSettingsValues = {
	apiBaseUrl: '',
	webAppUrl: '',
	crashReports: false,
	crashEndpoint: '',
	updateChannel: 'stable',
	agentAutonomy: 'strict',
	themeSignal: '#F0B429',
	themeTeal: '#6B9EFF',
	themeEmber: '#F07167',
	signedIn: false,
	authPhase: 'idle',
};

export function SettingsApp() {
	const [tab, setTab] = useState<WalkCroachSettingsTab>('general');
	const [values, setValues] = useState<WalkCroachSettingsValues>(EMPTY);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		const dispose = onHostMessage(msg => {
			if (msg.type === 'ready') {
				setReady(true);
				return;
			}
			if (msg.type === 'snapshot') {
				setValues(msg.values);
				if (msg.tab) {
					setTab(msg.tab);
				}
				setReady(true);
			}
		});
		postToHost({ type: 'ready', protocolVersion: SETTINGS_PROTOCOL_VERSION });
		return dispose;
	}, []);

	useEffect(() => {
		document.documentElement.style.setProperty('--color-signal', values.themeSignal);
		document.documentElement.style.setProperty('--color-teal', values.themeTeal);
		document.documentElement.style.setProperty('--color-ember', values.themeEmber);
	}, [values.themeSignal, values.themeTeal, values.themeEmber]);

	const selectTab = (next: WalkCroachSettingsTab) => {
		if (next === 'vscode') {
			postToHost({ type: 'openVscodeSettings' });
			return;
		}
		setTab(next);
		postToHost({ type: 'selectTab', tab: next });
	};

	const set = (key: keyof WalkCroachSettingsValues, value: string | boolean) => {
		setValues(v => ({ ...v, [key]: value } as WalkCroachSettingsValues));
		postToHost({ type: 'setValue', key, value });
	};

	return (
		<div className="wc-settings" data-ready={ready}>
			<aside className="wc-settings-nav" aria-label="WalkCroach Settings">
				<div className="wc-settings-brand">
					<span className="wc-settings-mark" aria-hidden />
					<div>
						<div className="wc-settings-title">WalkCroach</div>
						<div className="wc-settings-subtitle">Settings</div>
					</div>
				</div>
				<nav className="wc-settings-nav-list">
					{NAV.map(item => (
						<button
							key={item.id}
							type="button"
							className="wc-settings-nav-item"
							data-active={tab === item.id}
							data-external={item.hint === 'external' || undefined}
							onClick={() => selectTab(item.id)}
						>
							{item.label}
							{item.hint === 'external' ? <span className="wc-settings-ext" aria-hidden>↗</span> : null}
						</button>
					))}
				</nav>
			</aside>

			<main className="wc-settings-main">
				<AnimatePresence mode="wait">
					<motion.div
						key={tab}
						className="wc-settings-panel"
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -6 }}
						transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
					>
						{tab === 'general' && <GeneralSection values={values} set={set} />}
						{tab === 'agent' && <AgentSection values={values} set={set} />}
						{tab === 'memory' && <MemorySection values={values} />}
						{tab === 'theme' && <ThemeSection values={values} set={set} />}
						{tab === 'telemetry' && <TelemetrySection values={values} set={set} />}
						{tab === 'updates' && <UpdatesSection values={values} set={set} />}
					</motion.div>
				</AnimatePresence>
			</main>
		</div>
	);
}

function SectionHeader({ title, body }: { title: string; body: string }) {
	return (
		<header className="wc-settings-header">
			<h1>{title}</h1>
			<p>{body}</p>
		</header>
	);
}

function Field({
	label,
	hint,
	children,
}: {
	label: string;
	hint?: string;
	children: ReactNode;
}) {
	return (
		<label className="wc-settings-field">
			<span className="wc-settings-label">{label}</span>
			{children}
			{hint ? <span className="wc-settings-hint">{hint}</span> : null}
		</label>
	);
}

function GeneralSection({
	values,
	set,
}: {
	values: WalkCroachSettingsValues;
	set: (k: keyof WalkCroachSettingsValues, v: string | boolean) => void;
}) {
	const statusLabel =
		values.authPhase === 'signedIn' || values.signedIn
			? `Signed in${values.linkedProjectName ? ` · ${values.linkedProjectName}` : values.linkedProjectId ? ` · ${values.linkedProjectId}` : ''}`
			: values.authPhase === 'connecting'
				? 'Connecting — finish sign-in in the browser…'
				: values.authPhase === 'error'
					? (values.authError ?? 'Sign-in failed')
					: 'Not signed in';

	return (
		<>
			<SectionHeader
				title="General"
				body="Connect your WalkCroach account and the shared /ide BFF. Secrets stay in OS keychain — never in settings.json."
			/>
			<div className="wc-settings-stack">
				<Field label="API base URL" hint="No trailing slash. Default http://localhost:3003">
					<input
						className="wc-settings-input"
						value={values.apiBaseUrl}
						onChange={e => set('apiBaseUrl', e.target.value)}
						spellCheck={false}
					/>
				</Field>
				<Field label="Web app URL" hint="Used for Connect (PKCE). Example https://app.walkcroach.dev">
					<input
						className="wc-settings-input"
						value={values.webAppUrl}
						onChange={e => set('webAppUrl', e.target.value)}
						spellCheck={false}
						placeholder="https://app.walkcroach.dev"
					/>
				</Field>
				<div className="wc-settings-account" data-phase={values.authPhase}>
					<div className="wc-settings-account-status" role="status">
						{statusLabel}
					</div>
					{values.authPhase === 'error' && values.authError ? (
						<p className="wc-settings-hint wc-settings-error">{values.authError}</p>
					) : null}
					<div className="wc-settings-actions">
						<button
							type="button"
							className="wc-settings-btn primary"
							disabled={values.authPhase === 'connecting'}
							onClick={() => postToHost({ type: 'runCommand', commandId: 'walkcroach.auth.signIn' })}
						>
							{values.authPhase === 'connecting' ? 'Connecting…' : 'Connect'}
						</button>
						<button
							type="button"
							className="wc-settings-btn ghost"
							onClick={() => postToHost({ type: 'runCommand', commandId: 'walkcroach.auth.pasteToken' })}
						>
							Paste token
						</button>
						{(values.signedIn || values.authPhase === 'signedIn') ? (
							<button
								type="button"
								className="wc-settings-btn ghost"
								onClick={() => postToHost({ type: 'runCommand', commandId: 'walkcroach.auth.signOut' })}
							>
								Sign out
							</button>
						) : null}
					</div>
				</div>
			</div>
		</>
	);
}

function AgentSection({
	values,
	set,
}: {
	values: WalkCroachSettingsValues;
	set: (k: keyof WalkCroachSettingsValues, v: string | boolean) => void;
}) {
	return (
		<>
			<SectionHeader
				title="Agent"
				body="Autonomy gates tool approvals. Tier 3 destructive / ccloud actions always require confirmation. Chat · Plan · Agent modes live in the Agent sidebar."
			/>
			<div className="wc-settings-stack">
				<Field label="Autonomy">
					<select
						className="wc-settings-input"
						value={values.agentAutonomy}
						onChange={e => set('agentAutonomy', e.target.value)}
					>
						<option value="strict">Strict — approve every edit</option>
						<option value="low_friction">Low friction — narrow edits only</option>
					</select>
				</Field>
			</div>
		</>
	);
}

function MemorySection({ values }: { values: WalkCroachSettingsValues }) {
	return (
		<>
			<SectionHeader
				title="Memory · Agent"
				body="Cross-surface recall uses source_surface=desktop via the SDK /v1/memory contract. Cockroach Managed MCP and ccloud credentials unlock Schema/Query panels and agent tools."
			/>
			<div className="wc-settings-stack">
				<p className="wc-settings-hint">
					{values.linkedProjectId
						? `Linked to ${values.linkedProjectName ?? values.linkedProjectId}`
						: 'No linked project — recall stays local until you link.'}
				</p>
				<div className="wc-settings-actions">
					<button type="button" className="wc-settings-btn" onClick={() => postToHost({ type: 'runCommand', commandId: 'walkcroach.project.link' })}>
						Link project
					</button>
					<button type="button" className="wc-settings-btn primary" onClick={() => postToHost({ type: 'runCommand', commandId: 'walkcroach.crdb.configure' })}>
						Configure CockroachDB
					</button>
				</div>
			</div>
		</>
	);
}

function ThemeSection({
	values,
	set,
}: {
	values: WalkCroachSettingsValues;
	set: (k: keyof WalkCroachSettingsValues, v: string | boolean) => void;
}) {
	return (
		<>
			<SectionHeader
				title="Theme"
				body="Brand accents only. Roles are fixed: signal = action, teal = memory, ember = destructive."
			/>
			<div className="wc-settings-stack wc-settings-swatches">
				<ColorField label="Signal" value={values.themeSignal} onChange={v => set('themeSignal', v)} />
				<ColorField label="Teal (memory)" value={values.themeTeal} onChange={v => set('themeTeal', v)} />
				<ColorField label="Ember" value={values.themeEmber} onChange={v => set('themeEmber', v)} />
			</div>
		</>
	);
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
	return (
		<label className="wc-settings-field">
			<span className="wc-settings-label">{label}</span>
			<div className="wc-settings-color-row">
				<input type="color" value={value} onChange={e => onChange(e.target.value)} aria-label={label} />
				<input
					className="wc-settings-input"
					value={value}
					onChange={e => onChange(e.target.value)}
					spellCheck={false}
				/>
			</div>
		</label>
	);
}

function TelemetrySection({
	values,
	set,
}: {
	values: WalkCroachSettingsValues;
	set: (k: keyof WalkCroachSettingsValues, v: string | boolean) => void;
}) {
	return (
		<>
			<SectionHeader
				title="Telemetry"
				body="Crash reports are opt-in and independent of product telemetry (NFR-F17)."
			/>
			<div className="wc-settings-stack">
				<label className="wc-settings-toggle">
					<input
						type="checkbox"
						checked={values.crashReports}
						onChange={e => set('crashReports', e.target.checked)}
					/>
					<span>Send crash reports (metadata only)</span>
				</label>
				<Field label="Crash endpoint" hint="POST URL for desktop crash ingest">
					<input
						className="wc-settings-input"
						value={values.crashEndpoint}
						onChange={e => set('crashEndpoint', e.target.value)}
						spellCheck={false}
						disabled={!values.crashReports}
					/>
				</Field>
			</div>
		</>
	);
}

function UpdatesSection({
	values,
	set,
}: {
	values: WalkCroachSettingsValues;
	set: (k: keyof WalkCroachSettingsValues, v: string | boolean) => void;
}) {
	return (
		<>
			<SectionHeader
				title="Updates"
				body="Maps to updates.walkcroach.dev/desktop/{channel}/ when distribution is wired (D6)."
			/>
			<div className="wc-settings-stack">
				<Field label="Channel">
					<select
						className="wc-settings-input"
						value={values.updateChannel}
						onChange={e => set('updateChannel', e.target.value)}
					>
						<option value="stable">Stable</option>
						<option value="insiders">Insiders</option>
					</select>
				</Field>
			</div>
		</>
	);
}
