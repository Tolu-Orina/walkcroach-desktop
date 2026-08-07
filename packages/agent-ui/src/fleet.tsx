/*---------------------------------------------------------------------------------------------
 *  Copyright (c) WalkCroach contributors. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { LayoutGrid, LayoutList, Plus, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useState } from 'react';
import { Button } from './components';
import type { FleetLayout, FleetSession, SoftCapNotice } from './protocol';

const PHASE_LABEL: Record<FleetSession['phase'], string> = {
	idle: 'idle',
	gather: 'gather',
	act: 'act',
	verify: 'verify',
};

const STATUS_DOT: Record<FleetSession['status'], string> = {
	idle: 'bg-mist',
	running: 'bg-signal motion-safe:animate-pulse',
	error: 'bg-ember',
};

export function FleetTabBar({
	sessions,
	activeId,
	onSelect,
	onNew,
	onKill,
}: {
	sessions: readonly FleetSession[];
	activeId?: string;
	onSelect: (id: string) => void;
	onNew: () => void;
	onKill: (id: string) => void;
}) {
	if (sessions.length < 1) {
		return null;
	}

	const active = sessions.find(s => s.id === activeId) ?? sessions[0];

	return (
		<div
			className="flex items-center gap-1 overflow-x-auto border-b border-line pb-1"
			role="tablist"
			aria-label="Agent sessions"
		>
			{sessions.map(s => {
				const selected = s.id === active?.id;
				return (
					<button
						key={s.id}
						type="button"
						role="tab"
						aria-selected={selected}
						onClick={() => onSelect(s.id)}
						className={clsx(
							'inline-flex max-w-40 shrink-0 items-center gap-1.5 rounded-sm px-2 py-1 text-meta transition-colors',
							selected
								? 'bg-raised text-paper ring-1 ring-inset ring-line'
								: 'text-mist hover:bg-paper/6 hover:text-paper',
						)}
					>
						<span className={clsx('size-1.5 shrink-0 rounded-full', STATUS_DOT[s.status])} aria-hidden />
						<span className="truncate">{s.title}</span>
					</button>
				);
			})}
			<button
				type="button"
				onClick={onNew}
				aria-label="New agent session"
				className="inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-mist transition-colors hover:bg-paper/8 hover:text-paper"
			>
				<Plus size={14} aria-hidden />
			</button>
			{active && sessions.length > 1 && (
				<button
					type="button"
					onClick={() => onKill(active.id)}
					aria-label={`Close ${active.title}`}
					className="ml-auto inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-mist transition-colors hover:bg-ember/10 hover:text-ember"
				>
					<X size={14} aria-hidden />
				</button>
			)}
		</div>
	);
}

export function FleetSessionCard({
	session,
	selected,
	onSelect,
	onKill,
}: {
	session: FleetSession;
	selected: boolean;
	onSelect: () => void;
	onKill: () => void;
}) {
	const provenanceReady = Boolean(session.ahpSession);
	return (
		<div
			role="button"
			tabIndex={0}
			onClick={onSelect}
			onKeyDown={e => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onSelect();
				}
			}}
			className={clsx(
				'flex flex-col gap-2 rounded-md border bg-raised p-3 text-left transition-colors',
				selected ? 'border-signal/40 ring-1 ring-inset ring-signal/20' : 'border-line hover:border-mist/40',
			)}
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<div className="flex items-center gap-1.5">
						<span className={clsx('size-1.5 shrink-0 rounded-full', STATUS_DOT[session.status])} aria-hidden />
						<span className="truncate text-[13px] font-medium text-paper">{session.title}</span>
					</div>
					<div className="mt-1 text-meta text-mist">
						{PHASE_LABEL[session.phase]}
						{session.worktreeBranch ? ` · ${session.worktreeBranch}` : ''}
					</div>
				</div>
				<button
					type="button"
					onClick={e => {
						e.stopPropagation();
						onKill();
					}}
					aria-label={`Close ${session.title}`}
					className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-mist hover:bg-ember/10 hover:text-ember"
				>
					<X size={12} aria-hidden />
				</button>
			</div>
			{session.preview && (
				<p className="line-clamp-2 text-meta leading-relaxed text-mist">{session.preview}</p>
			)}
			<div className="text-meta">
				{provenanceReady ? (
					<span className="text-teal">provenance ready</span>
				) : (
					<span className="text-mist">awaiting session</span>
				)}
			</div>
		</div>
	);
}

export function FleetGrid({
	sessions,
	activeId,
	onSelect,
	onKill,
}: {
	sessions: readonly FleetSession[];
	activeId?: string;
	onSelect: (id: string) => void;
	onKill: (id: string) => void;
}) {
	return (
		<div className="grid grid-cols-2 gap-2" role="list" aria-label="Agent sessions">
			{sessions.map(s => (
				<FleetSessionCard
					key={s.id}
					session={s}
					selected={s.id === activeId}
					onSelect={() => onSelect(s.id)}
					onKill={() => onKill(s.id)}
				/>
			))}
		</div>
	);
}

export function FleetLayoutToggle({
	layout,
	onChange,
}: {
	layout: FleetLayout;
	onChange: (layout: FleetLayout) => void;
}) {
	return (
		<div className="inline-flex items-center rounded-sm border border-line p-0.5" role="group" aria-label="Fleet layout">
			<button
				type="button"
				aria-pressed={layout === 'tabs'}
				onClick={() => onChange('tabs')}
				className={clsx(
					'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-meta transition-colors',
					layout === 'tabs' ? 'bg-raised text-paper' : 'text-mist hover:text-paper',
				)}
			>
				<LayoutList size={12} aria-hidden />
				Tabs
			</button>
			<button
				type="button"
				aria-pressed={layout === 'grid'}
				onClick={() => onChange('grid')}
				className={clsx(
					'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-meta transition-colors',
					layout === 'grid' ? 'bg-raised text-paper' : 'text-mist hover:text-paper',
				)}
			>
				<LayoutGrid size={12} aria-hidden />
				Grid
			</button>
		</div>
	);
}

type LaunchTask = { title: string; prompt: string; isolate?: boolean };

function parseTasks(raw: string): LaunchTask[] {
	return raw
		.split('\n')
		.map(line => line.trim())
		.filter(Boolean)
		.map(line => {
			const pipe = line.indexOf('|');
			if (pipe >= 0) {
				const title = line.slice(0, pipe).trim();
				const prompt = line.slice(pipe + 1).trim();
				return { title: title || prompt.slice(0, 40) || 'Task', prompt: prompt || title };
			}
			return { title: line.slice(0, 40) || 'Task', prompt: line };
		});
}

export function LaunchFleetPanel({
	softCapNotice,
	onLaunch,
	onForceLaunch,
}: {
	softCapNotice?: SoftCapNotice;
	onLaunch: (tasks: LaunchTask[], isolate: boolean) => void;
	onForceLaunch: (tasks: LaunchTask[], isolate: boolean) => void;
}) {
	const [tasksText, setTasksText] = useState('');
	const [isolate, setIsolate] = useState(true);

	const parsed = () => parseTasks(tasksText);

	const submit = (force: boolean) => {
		const tasks = parsed();
		if (!tasks.length) {
			return;
		}
		if (force) {
			onForceLaunch(tasks, isolate);
		} else {
			onLaunch(tasks, isolate);
		}
	};

	const showSoftCap = softCapNotice && softCapNotice.remaining > 0;

	return (
		<div className="rounded-md border border-line bg-raised/50 p-3">
			<div className="mb-2 text-meta font-medium text-paper">Launch fleet</div>
			<p className="mb-2 text-meta text-mist">
				One task per line. Use <code className="text-paper">title | prompt</code> or just a prompt.
			</p>
			<textarea
				value={tasksText}
				onChange={e => setTasksText(e.target.value)}
				rows={4}
				placeholder={'Fix auth bug | Investigate login timeout\nAdd unit tests for fleet cap'}
				aria-label="Fleet tasks"
				className="mb-2 w-full resize-y rounded-sm border border-line bg-canvas px-2.5 py-2 font-mono text-meta text-paper outline-none placeholder:text-mist/70 focus:border-signal/40"
			/>
			<label className="mb-3 flex items-center gap-2 text-meta text-mist">
				<input
					type="checkbox"
					checked={isolate}
					onChange={e => setIsolate(e.target.checked)}
					className="accent-signal"
				/>
				Isolate each task in its own worktree
			</label>
			<div className="flex flex-wrap items-center gap-2">
				<Button
					variant="primary"
					onClick={() => submit(false)}
					disabled={!tasksText.trim()}
				>
					Launch
				</Button>
				{showSoftCap && (
					<>
						<span className="text-meta text-mist">
							{softCapNotice.count}/{softCapNotice.cap} sessions — {softCapNotice.remaining} task
							{softCapNotice.remaining === 1 ? '' : 's'} blocked
						</span>
						<Button variant="outline" onClick={() => submit(true)} disabled={!tasksText.trim()}>
							Run more anyway
						</Button>
					</>
				)}
			</div>
		</div>
	);
}
