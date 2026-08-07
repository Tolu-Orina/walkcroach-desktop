/*---------------------------------------------------------------------------------------------
 *  Copyright (c) WalkCroach contributors. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { AnimatePresence, motion } from 'motion/react';
import { Check, Palette } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import type { BrandColors } from './protocol';

/**
 * Brand palette picker (spec §10.5).
 *
 * Roles are fixed, values are configurable: `signal` always means
 * action/focus/approval, `teal` always means memory/provenance and nothing else,
 * `ember` always means destructive/decline. A user changes what hex `teal` *is*;
 * they cannot make `ember` mean memory. That invariant is what keeps the
 * provenance chip legible under any palette.
 *
 * Custom values are checked live and shown failing — not silently blocked, and
 * not silently allowed through.
 */

export interface Preset {
	readonly id: string;
	readonly label: string;
	readonly brand: BrandColors;
}

/**
 * Presets keep `teal` inside the same recognisable blue family used by Web,
 * Chrome and the IDE extension, so switching preset doesn't fracture the
 * cross-surface brand.
 */
export const PRESETS: readonly Preset[] = [
	{ id: 'amber', label: 'Amber', brand: { signal: '#F0B429', teal: '#6B9EFF', ember: '#F07167' } },
	{ id: 'cool-gold', label: 'Cool Gold', brand: { signal: '#E8C468', teal: '#7FB0FF', ember: '#EF8A80' } },
	{ id: 'high-contrast', label: 'High Contrast', brand: { signal: '#FFD24A', teal: '#9CC3FF', ember: '#FF9A90' } },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

/** WCAG 2.x relative luminance. */
function luminance(hex: string): number {
	const n = parseInt(hex.slice(1), 16);
	const srgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
		const c = v / 255;
		return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	}) as [number, number, number];
	return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

/** WCAG contrast ratio between two opaque hex colours. */
export function contrast(a: string, b: string): number {
	const la = luminance(a);
	const lb = luminance(b);
	const [hi, lo] = la > lb ? [la, lb] : [lb, la];
	return (hi + 0.05) / (lo + 0.05);
}

/**
 * These accents are never body text — they are UI components, large text and
 * focus indicators, whose WCAG AA floor is 3:1, not the 4.5:1 body threshold.
 * Using 4.5 here would fail colours that are genuinely conformant for their
 * actual use and push users toward a washed-out palette for no accessibility
 * gain.
 */
const AA_UI = 3;

/** Graphite Lumen surfaces the accents actually sit on. */
const SURFACES: readonly { id: string; label: string; hex: string }[] = [
	{ id: 'canvas', label: 'canvas', hex: '#14161B' },
	{ id: 'raised', label: 'raised', hex: '#1C1F26' },
];

const ROLES: readonly { key: keyof BrandColors; label: string; meaning: string }[] = [
	{ key: 'signal', label: 'Signal', meaning: 'actions, focus, approvals' },
	{ key: 'teal', label: 'Teal', meaning: 'memory & provenance only' },
	{ key: 'ember', label: 'Ember', meaning: 'destructive & decline' },
];

function Swatch({ hex, onChange }: { hex: string; onChange: (v: string) => void }) {
	const valid = HEX.test(hex);
	const worst = valid
		? Math.min(...SURFACES.map(s => contrast(hex, s.hex)))
		: 0;
	const passes = valid && worst >= AA_UI;

	return (
		<div className="flex items-center gap-2">
			<label className="relative size-6 shrink-0 overflow-hidden rounded-sm border border-line">
				<input
					type="color"
					value={valid ? hex : '#000000'}
					onChange={e => onChange(e.target.value.toUpperCase())}
					className="absolute -inset-2 size-[200%] cursor-pointer border-0 bg-transparent p-0"
					aria-label="Pick colour"
				/>
			</label>
			<input
				type="text"
				value={hex}
				spellCheck={false}
				onChange={e => onChange(e.target.value.toUpperCase())}
				className={clsx(
					'w-[86px] rounded-sm border bg-raised px-1.5 py-1 font-mono text-meta text-paper outline-none',
					valid ? 'border-line' : 'border-ember',
				)}
			/>
			{/* Shown failing, in the same interface — never silently blocked. */}
			<span
				className={clsx('text-meta tabular-nums', passes ? 'text-mist' : 'text-ember')}
				title={`Lowest contrast against ${SURFACES.map(s => s.label).join(' / ')}. AA floor for UI components is ${AA_UI}:1.`}
			>
				{valid ? `${worst.toFixed(1)}:1 ${passes ? '' : '· below AA'}` : 'invalid hex'}
			</span>
		</div>
	);
}

export function PalettePicker({
	brand,
	onApply,
}: {
	brand: BrandColors;
	onApply: (b: BrandColors) => void;
}) {
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState<BrandColors>(brand);
	const rootRef = useRef<HTMLDivElement>(null);

	// Re-seed whenever the host pushes new values, so an edit made in Settings
	// doesn't leave a stale draft here.
	useEffect(() => { setDraft(brand); }, [brand]);

	useEffect(() => {
		if (!open) { return; }
		const onDown = (e: MouseEvent) => {
			if (!rootRef.current?.contains(e.target as Node)) { setOpen(false); }
		};
		const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); } };
		document.addEventListener('mousedown', onDown);
		document.addEventListener('keydown', onEsc);
		return () => {
			document.removeEventListener('mousedown', onDown);
			document.removeEventListener('keydown', onEsc);
		};
	}, [open]);

	const allValid = ROLES.every(r => HEX.test(draft[r.key]));

	const set = (key: keyof BrandColors, value: string) =>
		setDraft(d => ({ ...d, [key]: value }));

	return (
		<div ref={rootRef} className="relative">
			<button
				type="button"
				aria-haspopup="dialog"
				aria-expanded={open}
				title="Brand colours"
				onClick={() => setOpen(v => !v)}
				className="rounded-sm p-1 text-mist transition-colors hover:bg-paper/8 hover:text-paper"
			>
				<Palette size={14} aria-hidden />
			</button>

			<AnimatePresence>
				{open && (
					<motion.div
						role="dialog"
						aria-label="Brand colours"
						initial={{ opacity: 0, y: -4, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: -4, scale: 0.98 }}
						transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
						className="absolute right-0 top-full z-30 mt-1 w-[292px] rounded-md border border-line bg-raised p-3 shadow-[0_8px_28px_rgba(0,0,0,0.55)]"
					>
						<div className="mb-2 text-meta tracking-wide text-mist uppercase">Presets</div>
						<div className="mb-3 flex gap-1">
							{PRESETS.map(p => {
								const active = ROLES.every(r => draft[r.key].toUpperCase() === p.brand[r.key].toUpperCase());
								return (
									<button
										key={p.id}
										type="button"
										onClick={() => setDraft(p.brand)}
										className={clsx(
											'flex flex-1 items-center gap-1 rounded-sm border px-1.5 py-1 text-meta transition-colors',
											active ? 'border-signal text-paper' : 'border-line text-mist hover:text-paper',
										)}
									>
										<span className="flex shrink-0 gap-0.5">
											<span className="size-2 rounded-full" style={{ background: p.brand.signal }} />
											<span className="size-2 rounded-full" style={{ background: p.brand.teal }} />
										</span>
										<span className="truncate">{p.label}</span>
									</button>
								);
							})}
						</div>

						<div className="mb-2 text-meta tracking-wide text-mist uppercase">Custom</div>
						<div className="flex flex-col gap-2">
							{ROLES.map(r => (
								<div key={r.key}>
									<div className="mb-1 text-meta text-mist">
										<span className="text-paper">{r.label}</span> — {r.meaning}
									</div>
									<Swatch hex={draft[r.key]} onChange={v => set(r.key, v)} />
								</div>
							))}
						</div>

						{/* Stated, not hidden: customisation has a cost. */}
						<p className="mt-3 text-meta leading-snug text-mist">
							Custom colours apply to Desktop only — they can diverge from WalkCroach
							branding on Web, Chrome and the IDE extension.
						</p>

						<div className="mt-3 flex items-center justify-end gap-2">
							<button
								type="button"
								onClick={() => setDraft(PRESETS[0]!.brand)}
								className="rounded-sm px-2 py-1 text-meta text-mist transition-colors hover:bg-paper/8 hover:text-paper"
							>
								Reset
							</button>
							<button
								type="button"
								disabled={!allValid}
								onClick={() => { onApply(draft); setOpen(false); }}
								className="inline-flex items-center gap-1 rounded-sm bg-signal px-2.5 py-1 text-meta font-medium text-ink transition-[filter] hover:brightness-110 disabled:cursor-default disabled:opacity-50"
							>
								<Check size={11} aria-hidden />
								Apply
							</button>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
