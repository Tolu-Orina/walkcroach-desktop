/*---------------------------------------------------------------------------------------------
 *  Copyright (c) WalkCroach contributors. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { AnimatePresence, motion } from 'motion/react';
import {
	AlertTriangle,
	Check,
	ChevronDown,
	ChevronRight,
	Chrome,
	Code2,
	Globe,
	Mic,
	Monitor,
	Paperclip,
	Terminal,
	X,
} from 'lucide-react';
import { memo, useEffect, useRef, useState, type FocusEvent, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { StreamingMarkdown } from './markdown';
import type {
	AgentMode,
	AgentPhase,
	ApprovalRequest,
	AuthState,
	MemorySurface,
	Provenance,
	Turn,
} from './protocol';

const MODES: readonly { id: AgentMode; label: string; hint: string; eyebrow: string }[] = [
	{ id: 'chat', label: 'Chat', hint: 'Ask a question (read-only)…', eyebrow: 'Ask a question' },
	{ id: 'plan', label: 'Plan', hint: 'Describe what to build — get a plan first…', eyebrow: 'Describe what to build' },
	{ id: 'agent', label: 'Agent', hint: 'Give an instruction…', eyebrow: 'Give an instruction' },
];

/** Display models until the host exposes a real catalog (D3). */
const MODELS: readonly string[] = ['Nova Pro', 'Nova Lite', 'Nova'];

export const MODE_HINT: Record<AgentMode, string> = {
	chat: MODES[0]!.hint,
	plan: MODES[1]!.hint,
	agent: MODES[2]!.hint,
};

export const MODE_EMPTY: Record<AgentMode, string> = {
	chat: 'Ask about this codebase. Read-only — nothing will be modified.',
	plan: 'Describe what you want built. WalkCroach proposes a plan before touching anything.',
	agent: 'Give an instruction. Destructive actions always ask first.',
};

const MODE_LABEL: Record<AgentMode, string> = {
	chat: 'Chat',
	plan: 'Plan',
	agent: 'Agent',
};

/* ============================================================================
 * Shared dropdown — mode + model pickers share one visual language.
 * ========================================================================= */

function Dropdown<T extends string>({
	value,
	options,
	ariaLabel,
	onChange,
}: {
	value: T;
	options: readonly { id: T; label: string }[];
	ariaLabel: string;
	onChange: (v: T) => void;
}) {
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const label = options.find(o => o.id === value)?.label ?? value;

	useEffect(() => {
		if (!open) { return; }
		const onDocDown = (e: MouseEvent) => {
			if (!rootRef.current?.contains(e.target as Node)) { setOpen(false); }
		};
		const onEsc = (e: KeyboardEvent) => {
			if (e.key === 'Escape') { setOpen(false); }
		};
		document.addEventListener('mousedown', onDocDown);
		document.addEventListener('keydown', onEsc);
		return () => {
			document.removeEventListener('mousedown', onDocDown);
			document.removeEventListener('keydown', onEsc);
		};
	}, [open]);

	return (
		<div ref={rootRef} className="relative">
			<button
				type="button"
				aria-label={ariaLabel}
				aria-haspopup="listbox"
				aria-expanded={open}
				onClick={() => setOpen(v => !v)}
				className="inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-meta text-paper transition-colors hover:bg-paper/8"
			>
				{label}
				<ChevronDown size={12} strokeWidth={2} aria-hidden />
			</button>

			<AnimatePresence>
				{open && (
					<motion.ul
						role="listbox"
						aria-label={ariaLabel}
						initial={{ opacity: 0, y: 4, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 4, scale: 0.98 }}
						transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
						className="absolute bottom-full left-0 z-20 mb-1 min-w-36 overflow-hidden rounded-md border border-line bg-raised shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
					>
						{options.map(o => (
							<li key={o.id}>
								<button
									type="button"
									role="option"
									aria-selected={o.id === value}
									onClick={() => { onChange(o.id); setOpen(false); }}
									className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[13px] text-paper transition-colors hover:bg-paper/8"
								>
									<Check
										size={12}
										aria-hidden
										className={clsx('shrink-0', o.id === value ? 'text-signal' : 'invisible')}
									/>
									{o.label}
								</button>
							</li>
						))}
					</motion.ul>
				)}
			</AnimatePresence>
		</div>
	);
}

export function ModePicker({
	mode,
	onChange,
}: {
	mode: AgentMode;
	onChange: (m: AgentMode) => void;
}) {
	return (
		<Dropdown
			ariaLabel="Agent mode"
			value={mode}
			options={MODES.map(m => ({ id: m.id, label: m.label }))}
			onChange={onChange}
		/>
	);
}

export function ModelPicker({
	model,
	onChange,
}: {
	model: string;
	onChange: (m: string) => void;
}) {
	const options = MODELS.includes(model)
		? MODELS.map(id => ({ id, label: id }))
		: [{ id: model, label: model }, ...MODELS.map(id => ({ id, label: id }))];
	return (
		<Dropdown
			ariaLabel="Model"
			value={model}
			options={options}
			onChange={onChange}
		/>
	);
}

/* ============================================================================
 * Provenance chip — the differentiator.
 * ========================================================================= */

const SURFACE_ICON: Record<MemorySurface, typeof Globe> = {
	web: Globe,
	chrome: Chrome,
	ide: Code2,
	cli: Terminal,
	desktop: Monitor,
};

const SURFACE_LABEL: Record<MemorySurface, string> = {
	web: 'Web',
	chrome: 'Chrome',
	ide: 'IDE',
	cli: 'CLI',
	desktop: 'Desktop',
};

/** Coarse relative age — precision here would be false confidence. */
export function formatAge(ts: number, now = Date.now()): string {
	const ms = Math.max(0, now - ts);
	const min = Math.floor(ms / 60_000);
	if (min < 1) { return 'just now'; }
	if (min < 60) { return `${min}m ago`; }
	const hr = Math.floor(min / 60);
	if (hr < 24) { return `${hr}h ago`; }
	const day = Math.floor(hr / 24);
	if (day < 30) { return `${day}d ago`; }
	return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ProvenanceChip({ p, onOpen }: { p: Provenance; onOpen?: () => void }) {
	const Icon = SURFACE_ICON[p.surface];
	const text = p.label ?? `from ${SURFACE_LABEL[p.surface]} · ${formatAge(p.ts)}`;
	return (
		<motion.button
			type="button"
			initial={{ opacity: 0, y: -2 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.18 }}
			onClick={onOpen}
			title={text}
			className="mb-1 inline-flex max-w-full items-center gap-1 truncate rounded-sm bg-teal/12 px-1.5 py-0.5 text-meta text-teal ring-1 ring-inset ring-teal/20 transition-colors hover:bg-teal/20"
		>
			<Icon size={12} className="shrink-0" aria-hidden />
			<span className="truncate">{text}</span>
		</motion.button>
	);
}

/* ============================================================================
 * Turn
 * ========================================================================= */

export const TurnView = memo(function TurnView({
	turn,
	onOpenProvenance,
}: {
	turn: Turn;
	onOpenProvenance?: (p: Provenance) => void;
}) {
	if (turn.role === 'user') {
		return (
			<motion.div
				initial={{ opacity: 0, y: 4 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
				className="mb-3 ml-8 rounded-md border border-line/50 bg-raised px-3 py-2 text-paper"
			>
				{turn.text}
			</motion.div>
		);
	}

	if (turn.role === 'system' || turn.role === 'tool') {
		return (
			<div className="mb-2 flex items-start gap-1.5 font-mono text-meta text-mist">
				<ChevronRight size={12} className="mt-0.5 shrink-0 opacity-70" aria-hidden />
				<span>{turn.text}</span>
			</div>
		);
	}

	return (
		<motion.div
			initial={{ opacity: 0, y: 4 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
			className="mb-3"
		>
			{turn.provenance?.map((p, i) => (
				<ProvenanceChip key={i} p={p} onOpen={onOpenProvenance ? () => onOpenProvenance(p) : undefined} />
			))}
			<StreamingMarkdown text={turn.text} streaming={turn.streaming} />
		</motion.div>
	);
});

/* ============================================================================
 * Approval card — the one component with real elevation and weight.
 * ========================================================================= */

const APPROVAL_UI = {
	pending: { Icon: AlertTriangle, label: 'Requires approval', tone: 'text-signal' },
	approved: { Icon: Check, label: 'Approved', tone: 'text-teal' },
	declined: { Icon: X, label: 'Declined', tone: 'text-ember' },
	failed: { Icon: X, label: 'Failed', tone: 'text-ember' },
} as const;

export function ApprovalCard({
	req,
	onDecide,
	onOpenDiff,
}: {
	req: ApprovalRequest;
	onDecide: (d: 'approve' | 'reject') => void;
	onOpenDiff?: () => void;
}) {
	const { Icon, label, tone } = APPROVAL_UI[req.state];
	const detail = req.cmd ?? req.path ?? req.detail;
	const showDiff = req.kind === 'diff' && (req.before !== undefined || req.after !== undefined);
	const truncate = (s: string, n = 2400) => (s.length > n ? `${s.slice(0, n)}\n…` : s);
	return (
		<motion.div
			layout
			role="alertdialog"
			aria-label={req.title}
			initial={{ opacity: 0, scale: 0.98, y: 6 }}
			animate={{ opacity: 1, scale: 1, y: 0 }}
			transition={{ type: 'spring', stiffness: 320, damping: 26 }}
			className="my-3 overflow-hidden rounded-md border border-line bg-raised"
		>
			<div className="p-3">
				<div className={clsx('mb-2 inline-flex items-center gap-1.5 text-meta tracking-wide', tone)}>
					<Icon size={14} aria-hidden />
					<span className="font-medium">{label}</span>
				</div>
				{detail && !showDiff && (
					<pre className="mb-2 overflow-x-auto rounded-sm bg-canvas px-2.5 py-2 font-mono text-meta whitespace-pre-wrap text-paper">
						{detail}
					</pre>
				)}
				{showDiff && (
					<div className="mb-2 grid gap-2">
						{req.path ? (
							<div className="font-mono text-meta text-mist">{req.path}</div>
						) : null}
						<div className="grid gap-2 sm:grid-cols-2">
							<div>
								<div className="mb-1 text-meta uppercase tracking-wide text-mist">Before</div>
								<pre className="max-h-40 overflow-auto rounded-sm bg-canvas px-2.5 py-2 font-mono text-meta whitespace-pre-wrap text-paper">
									{truncate(req.before ?? '')}
								</pre>
							</div>
							<div>
								<div className="mb-1 text-meta uppercase tracking-wide text-mist">After</div>
								<pre className="max-h-40 overflow-auto rounded-sm bg-canvas px-2.5 py-2 font-mono text-meta whitespace-pre-wrap text-paper">
									{truncate(req.after ?? '')}
								</pre>
							</div>
						</div>
					</div>
				)}
				<div className="mb-3 text-meta leading-relaxed text-mist">
					{req.detail || (req.kind === 'command'
						? 'Requires approval — runs a command on this machine and cannot be auto-approved at any autonomy setting.'
						: 'Requires approval — modifies files in this workspace and cannot be auto-approved at any autonomy setting.')}
				</div>
				{req.state === 'pending' && (
					<div className="flex flex-wrap items-center gap-2">
						<Button variant="primary" onClick={() => onDecide('approve')}>Approve</Button>
						<Button variant="outline" onClick={() => onDecide('reject')}>Decline</Button>
						{onOpenDiff ? (
							<Button variant="ghost" onClick={onOpenDiff}>Open diff</Button>
						) : null}
					</div>
				)}
			</div>
		</motion.div>
	);
}

/* ============================================================================
 * Primitives
 * ========================================================================= */

export function Button({
	children,
	onClick,
	variant = 'ghost',
	type = 'button',
	title,
	disabled,
	className,
}: {
	children: ReactNode;
	onClick?: () => void;
	variant?: 'ghost' | 'primary' | 'danger' | 'outline' | 'run';
	type?: 'button' | 'submit';
	title?: string;
	disabled?: boolean;
	className?: string;
}) {
	return (
		<motion.button
			type={type}
			title={title}
			disabled={disabled}
			onClick={onClick}
			whileTap={disabled ? undefined : { scale: 0.97 }}
			className={clsx(
				'inline-flex items-center justify-center gap-1 rounded-sm text-meta leading-none transition-colors disabled:opacity-40',
				variant === 'primary' &&
					'bg-signal px-3 py-2 text-[13px] font-medium text-ink hover:brightness-110',
				variant === 'danger' && 'px-2 py-1.5 text-ember hover:bg-ember/10',
				variant === 'outline' &&
					'border border-line bg-transparent px-3 py-2 text-[13px] text-paper hover:bg-paper/6',
				variant === 'run' &&
					'border border-line/80 bg-canvas px-2.5 py-1.5 text-meta text-paper hover:border-mist/50 hover:bg-paper/6',
				variant === 'ghost' && 'px-2 py-1.5 text-mist hover:bg-paper/8 hover:text-paper',
				className,
			)}
		>
			{children}
		</motion.button>
	);
}

export function StatusLine({
	mode,
	phase,
	auth,
	ahpSession,
}: {
	mode: AgentMode;
	phase: AgentPhase;
	auth: AuthState;
	ahpSession?: string;
}) {
	const phaseLabel = phase === 'idle' ? 'idle' : 'running';
	const authLabel = auth.signedIn ? 'signed in' : 'signed out';
	const link = auth.linkedProjectName || auth.linkedProjectId
		? `linked to ${auth.linkedProjectName || auth.linkedProjectId}`
		: 'unlinked';
	const text = `${MODE_LABEL[mode]} · ${phaseLabel} · ${authLabel} · ${link}`;
	const full = ahpSession ? `${text} · AHP ${ahpSession}` : text;
	return (
		<div title={full} className="truncate text-meta text-mist">
			{phase !== 'idle' && (
				<span className="mr-1.5 inline-block size-1.5 rounded-full bg-signal align-middle motion-safe:animate-pulse" />
			)}
			{text}
		</div>
	);
}

export function EmptyState({ mode }: { mode: AgentMode }) {
	// Sign-in lives in the workbench title bar only — do not duplicate it here.
	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			className="py-2 text-mist"
		>
			<div className="leading-relaxed">{MODE_EMPTY[mode]}</div>
		</motion.div>
	);
}

/* ============================================================================
 * Composer — mode + model live INSIDE the input surface (mockup / §10.3).
 * ========================================================================= */

export function Composer({
	mode,
	phase,
	isMac,
	model,
	onSubmit,
	onCancel,
	onChangeMode,
	onChangeModel,
}: {
	mode: AgentMode;
	phase: AgentPhase;
	isMac: boolean;
	model?: string;
	onSubmit: (text: string) => void;
	onCancel: () => void;
	onChangeMode: (m: AgentMode) => void;
	onChangeModel?: (m: string) => void;
}) {
	const [value, setValue] = useState('');
	const [focused, setFocused] = useState(false);
	const shellRef = useRef<HTMLDivElement>(null);
	const ref = useRef<HTMLTextAreaElement>(null);
	const busy = phase !== 'idle';
	const active = focused || busy;
	const activeModel = model && model.trim() ? model : 'Nova Pro';
	const eyebrow = MODES.find(m => m.id === mode)?.eyebrow ?? 'Give an instruction';
	const runHint = isMac ? '⌘↵' : 'Ctrl+↵';

	useEffect(() => {
		const el = ref.current;
		if (!el) { return; }
		el.style.height = 'auto';
		el.style.height = `${Math.min(Math.max(el.scrollHeight, 52), 200)}px`;
	}, [value]);

	const submit = () => {
		const text = value.trim();
		if (!text || busy) { return; }
		setValue('');
		onSubmit(text);
	};

	/*
	 * Keep the ring alive while focus is anywhere inside the shell (mode /
	 * model menus, Run). Blurring to a child would otherwise kill it.
	 */
	const onShellFocus = () => setFocused(true);
	const onShellBlur = (e: FocusEvent<HTMLDivElement>) => {
		const next = e.relatedTarget as Node | null;
		if (next && shellRef.current?.contains(next)) {
			return;
		}
		setFocused(false);
	};

	return (
		<div className="shrink-0">
			<div className="mb-1.5 text-meta text-mist">{eyebrow}</div>

			<div
				ref={shellRef}
				className="wc-composer-shell"
				data-active={active ? 'true' : 'false'}
				onFocus={onShellFocus}
				onBlur={onShellBlur}
			>
				{/* Decorative flash — real DOM, not a pseudo (webview-safe). */}
				{/* Wrapped so the clipping that contains them does not also clip
				    the mode/model dropdowns, which open upward. */}
				<div className="wc-composer-fx" aria-hidden="true">
					<div className="wc-composer-spark" />
					<div className="wc-composer-glow" />
				</div>

				<div className="wc-composer">
					<textarea
						ref={ref}
						value={value}
						rows={2}
						placeholder={MODE_HINT[mode]}
						aria-label={eyebrow}
						onChange={e => setValue(e.target.value)}
						onKeyDown={e => {
							if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
								e.preventDefault();
								submit();
							} else if (e.key === 'Escape' && busy) {
								e.preventDefault();
								onCancel();
							}
						}}
						className="block w-full resize-none bg-transparent px-3 pt-3 pb-1 font-sans text-[13px] leading-relaxed text-paper outline-none placeholder:text-mist/80"
					/>

					{/* Toolbar lives inside the same bordered surface as the textarea. */}
					<div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
						<div className="flex min-w-0 items-center gap-0.5">
							<ModePicker mode={mode} onChange={onChangeMode} />
							<span className="px-0.5 text-meta text-mist/70" aria-hidden>·</span>
							<ModelPicker
								model={activeModel}
								onChange={m => onChangeModel?.(m)}
							/>
						</div>

						<div className="flex shrink-0 items-center gap-0.5">
							<button
								type="button"
								title="Attach file (coming soon)"
								aria-label="Attach file"
								disabled
								className="inline-flex size-7 items-center justify-center rounded-sm text-mist opacity-45"
							>
								<Paperclip size={14} aria-hidden />
							</button>
							<button
								type="button"
								title="Voice input (coming soon)"
								aria-label="Voice input"
								disabled
								className="inline-flex size-7 items-center justify-center rounded-sm text-mist opacity-45"
							>
								<Mic size={14} aria-hidden />
							</button>

							<AnimatePresence mode="wait" initial={false}>
								{busy ? (
									<motion.div
										key="cancel"
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
									>
										<Button variant="outline" onClick={onCancel} title="Esc to cancel">
											Cancel
										</Button>
									</motion.div>
								) : (
									<motion.div
										key="run"
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
									>
										<Button
											variant="run"
											onClick={submit}
											disabled={!value.trim()}
											title={`${runHint} to run`}
										>
											{runHint} Run
										</Button>
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
