/*---------------------------------------------------------------------------------------------
 *  Copyright (c) WalkCroach contributors. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { AnimatePresence } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
	ApprovalCard,
	Composer,
	EmptyState,
	StatusLine,
	TurnView,
} from './components';
import {
	FleetGrid,
	FleetLayoutToggle,
	FleetTabBar,
	LaunchFleetPanel,
} from './fleet';
import type { AgentSnapshot, HostMessage, ViewMessage } from './protocol';
import { PROTOCOL_VERSION } from './protocol';

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };

const vscode = acquireVsCodeApi();
const post = (msg: ViewMessage) => vscode.postMessage(msg);

const EMPTY: AgentSnapshot = {
	mode: 'chat',
	phase: 'idle',
	auth: { signedIn: false },
	turns: [],
	approvals: [],
	isMac: false,
	brand: { signal: '#F0B429', teal: '#6B9EFF', ember: '#F07167' },
};

export function App() {
	const [snapshot, setSnapshot] = useState<AgentSnapshot>(EMPTY);
	const scrollRef = useRef<HTMLDivElement>(null);
	const pinnedRef = useRef(true);

	useEffect(() => {
		const onMessage = (e: MessageEvent<HostMessage>) => {
			const msg = e.data;
			if (!msg || (msg.type !== 'init' && msg.type !== 'state')) {
				return;
			}
			if (msg.type === 'init' && msg.version !== PROTOCOL_VERSION) {
				// eslint-disable-next-line no-console
				console.error(
					`[walkcroach] protocol mismatch: host=${msg.version} ui=${PROTOCOL_VERSION}`,
				);
			}
			setSnapshot(msg.snapshot);
		};
		window.addEventListener('message', onMessage);
		post({ type: 'ready', version: PROTOCOL_VERSION });
		return () => window.removeEventListener('message', onMessage);
	}, []);

	const onScroll = () => {
		const el = scrollRef.current;
		if (!el) { return; }
		pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
	};

	useLayoutEffect(() => {
		const el = scrollRef.current;
		if (el && pinnedRef.current) {
			el.scrollTop = el.scrollHeight;
		}
	}, [snapshot.turns, snapshot.approvals]);

	const sessions = snapshot.fleetSessions ?? [];
	const activeId = snapshot.activeFleetId ?? sessions[0]?.id;
	const layout = snapshot.fleetLayout ?? 'tabs';
	const surface = snapshot.surface ?? 'aux';
	const isAgentsWindow = surface === 'agentsWindow';
	/** Aux stays lean: mode + transcript + composer + approvals. Fleet chrome lives in Agents Window. */
	const showFleetChrome = isAgentsWindow && sessions.length >= 1;
	const showGrid = isAgentsWindow && (layout === 'grid' || sessions.length > 1);
	const showLayoutToggle = isAgentsWindow;
	const showLaunchPanel = isAgentsWindow;
	const isEmpty = snapshot.turns.length === 0 && snapshot.approvals.length === 0;

	return (
		<div
			className="relative flex h-full flex-col gap-2 overflow-hidden p-2"
			style={{
				['--color-signal' as string]: snapshot.brand.signal,
				['--color-teal' as string]: snapshot.brand.teal,
				['--color-ember' as string]: snapshot.brand.ember,
			}}
		>
			<div className="relative z-20 flex items-center gap-2">
				<div className="min-w-0 flex-1">
					<StatusLine
						mode={snapshot.mode}
						phase={snapshot.phase}
						auth={snapshot.auth}
						ahpSession={snapshot.ahpSession}
					/>
				</div>
				{showLayoutToggle && (
					<FleetLayoutToggle
						layout={layout}
						onChange={l => post({ type: 'setFleetLayout', layout: l })}
					/>
				)}
				{surface === 'aux' && sessions.length > 1 && (
					<button
						type="button"
						onClick={() => post({ type: 'openAgentsWindow' })}
						className="shrink-0 rounded-sm px-2 py-1 text-meta text-mist transition-colors hover:bg-paper/8 hover:text-paper"
					>
						Agents Window
					</button>
				)}
			</div>

			{showLaunchPanel && (
				<div className="relative z-20">
					<LaunchFleetPanel
						softCapNotice={snapshot.softCapNotice}
						onLaunch={(tasks, isolate) =>
							post({
								type: 'launchFleet',
								tasks: tasks.map(t => ({ ...t, isolate })),
							})
						}
						onForceLaunch={(tasks, isolate) =>
							post({
								type: 'launchFleet',
								tasks: tasks.map(t => ({ ...t, isolate })),
								force: true,
							})
						}
					/>
				</div>
			)}

			{showFleetChrome && !showGrid && (
				<div className="relative z-20">
					<FleetTabBar
						sessions={sessions}
						activeId={activeId}
						onSelect={id => post({ type: 'selectFleetSession', id })}
						onNew={() => post({ type: 'newFleetSession' })}
						onKill={id => post({ type: 'killFleetSession', id })}
					/>
				</div>
			)}

			{showFleetChrome && showGrid && (
				<div className="relative z-20 max-h-48 shrink-0 overflow-y-auto">
					<FleetGrid
						sessions={sessions}
						activeId={activeId}
						onSelect={id => post({ type: 'selectFleetSession', id })}
						onKill={id => post({ type: 'killFleetSession', id })}
					/>
				</div>
			)}

			<div
				ref={scrollRef}
				onScroll={onScroll}
				role="log"
				aria-live="polite"
				aria-label="Conversation"
				className="relative z-10 min-h-0 flex-1 overflow-y-auto border-t border-line pt-2"
			>
				<div className="relative">
					{isEmpty ? (
						<EmptyState mode={snapshot.mode} />
					) : (
						<>
							{snapshot.turns.map(turn => (
								<TurnView
									key={turn.id}
									turn={turn}
									onOpenProvenance={p =>
										post({ type: 'openProvenance', surface: p.surface, ts: p.ts })
									}
								/>
							))}
							<AnimatePresence initial={false}>
								{snapshot.approvals.map(req => (
									<ApprovalCard
										key={req.stepId}
										req={req}
										onDecide={d =>
											post({
												type: 'resolveApproval',
												stepId: req.stepId,
												decision: d,
												sessionId: req.sessionId,
											})
										}
										onOpenDiff={
											req.kind === 'diff' && req.before !== undefined && req.after !== undefined && req.path
												? () =>
													post({
														type: 'openDiff',
														path: req.path!,
														before: req.before!,
														after: req.after!,
													})
												: undefined
										}
									/>
								))}
							</AnimatePresence>
						</>
					)}
				</div>
			</div>

			<div className="relative z-20 shrink-0 border-t border-line pt-2">
				<Composer
					mode={snapshot.mode}
					phase={snapshot.phase}
					isMac={snapshot.isMac}
					onSubmit={prompt => post({ type: 'submit', prompt })}
					onCancel={() => post({ type: 'cancel' })}
					onChangeMode={mode => post({ type: 'setMode', mode })}
					model={snapshot.model}
					onChangeModel={model => post({ type: 'setModel', model })}
				/>
			</div>
		</div>
	);
}
