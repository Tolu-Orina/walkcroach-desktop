/*---------------------------------------------------------------------------------------------
 *  Copyright (c) WalkCroach contributors. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { memo, useMemo, type ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Streaming-safe markdown.
 *
 * ## Why this isn't just `<Markdown>{text}</Markdown>`
 *
 * `react-markdown` re-parses its ENTIRE input on every render. Feeding it a
 * growing stream token-by-token is quadratic: an N-token response does N parses
 * over an average of N/2 characters. It is fine for a finished message and
 * visibly janky for a long streaming one.
 *
 * Two fixes, both here:
 *
 * 1. **Block memoisation.** The text is split into top-level blocks. Every block
 *    except the last is complete and immutable, so it is memoised on its own
 *    content and never re-parses again. Only the final, still-growing block is
 *    re-parsed as tokens arrive — turning O(n^2) over the whole document into
 *    O(n^2) over one small block.
 *
 * 2. **Fence repair.** Mid-stream the text often ends inside an unterminated
 *    ``` fence or a half-written table. Passed raw, the parser emits literal
 *    backticks that suddenly reflow into a code block when the fence closes,
 *    which reads as flickering. `repairForStreaming` closes open constructs for
 *    rendering only; the underlying text is untouched.
 */

/** Splits markdown into top-level blocks without breaking fenced code. */
export function splitBlocks(src: string): string[] {
	const lines = src.split('\n');
	const blocks: string[] = [];
	let current: string[] = [];
	let fence: string | undefined;

	const flush = () => {
		if (current.length) {
			blocks.push(current.join('\n'));
			current = [];
		}
	};

	for (const line of lines) {
		const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
		if (fenceMatch) {
			const marker = fenceMatch[1]!;
			if (!fence) {
				fence = marker[0];
			} else if (marker[0] === fence) {
				current.push(line);
				fence = undefined;
				flush();
				continue;
			}
		}

		// A blank line ends a block only outside a fence.
		if (!fence && line.trim() === '') {
			flush();
			continue;
		}
		current.push(line);
	}
	flush();
	return blocks;
}

/** Closes constructs left open by a mid-stream cut, for rendering only. */
export function repairForStreaming(src: string): string {
	let out = src;

	// Unterminated fenced code block.
	const fences = out.match(/^\s{0,3}(`{3,}|~{3,})/gm);
	if (fences && fences.length % 2 === 1) {
		out += '\n```';
	}

	// A trailing unmatched inline-code backtick makes the rest of the line
	// render as code and then snap back; drop it until its partner arrives.
	const ticks = (out.match(/(?<!`)`(?!`)/g) ?? []).length;
	if (ticks % 2 === 1) {
		out = out.replace(/`([^`]*)$/, '$1');
	}

	return out;
}

const components = {
	p: ({ children }: { children?: ReactNode }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
	a: ({ children, href }: { children?: ReactNode; href?: string }) => (
		<a href={href} className="text-teal underline underline-offset-2 hover:no-underline">
			{children}
		</a>
	),
	ul: ({ children }: { children?: ReactNode }) => <ul className="my-1.5 list-disc pl-4">{children}</ul>,
	ol: ({ children }: { children?: ReactNode }) => <ol className="my-1.5 list-decimal pl-4">{children}</ol>,
	li: ({ children }: { children?: ReactNode }) => <li className="my-0.5">{children}</li>,
	h1: ({ children }: { children?: ReactNode }) => <h1 className="mt-3 mb-1.5 font-semibold">{children}</h1>,
	h2: ({ children }: { children?: ReactNode }) => <h2 className="mt-3 mb-1.5 font-semibold">{children}</h2>,
	h3: ({ children }: { children?: ReactNode }) => <h3 className="mt-3 mb-1.5 font-semibold">{children}</h3>,
	blockquote: ({ children }: { children?: ReactNode }) => (
		<blockquote className="my-1.5 border-l-2 border-line pl-2 text-mist">{children}</blockquote>
	),
	code: ({ children, className }: { children?: ReactNode; className?: string }) => {
		const isBlock = Boolean(className?.startsWith('language-'));
		if (!isBlock) {
			return (
				<code className="rounded-sm bg-raised px-1 font-mono text-[0.95em]">{children}</code>
			);
		}
		return <code className="font-mono">{children}</code>;
	},
	pre: ({ children }: { children?: ReactNode }) => (
		<pre className="my-2 overflow-x-auto rounded-md border border-line bg-raised/70 p-2 font-mono text-[12px] leading-relaxed">
			{children}
		</pre>
	),
	table: ({ children }: { children?: ReactNode }) => (
		<div className="my-2 overflow-x-auto">
			<table className="w-full border-collapse text-[12px]">{children}</table>
		</div>
	),
	th: ({ children }: { children?: ReactNode }) => (
		<th className="border border-line px-1.5 py-1 text-left font-semibold">{children}</th>
	),
	td: ({ children }: { children?: ReactNode }) => (
		<td className="border border-line px-1.5 py-1 align-top">{children}</td>
	),
};

/** One immutable block. Memoised on its text, so completed blocks never reparse. */
const Block = memo(function Block({ text }: { text: string }) {
	return (
		<Markdown remarkPlugins={[remarkGfm]} components={components}>
			{text}
		</Markdown>
	);
});

export const StreamingMarkdown = memo(function StreamingMarkdown({
	text,
	streaming = false,
}: {
	text: string;
	streaming?: boolean;
}) {
	const blocks = useMemo(() => splitBlocks(text), [text]);

	return (
		<div className="min-w-0">
			{blocks.map((block, i) => {
				const isLast = i === blocks.length - 1;
				// Only the tail is repaired — earlier blocks are already complete,
				// and repairing them would be wasted work on every token.
				const content = isLast && streaming ? repairForStreaming(block) : block;
				return <Block key={i} text={content} />;
			})}
			{streaming && (
				<span
					aria-hidden
					className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-signal align-text-bottom motion-safe:animate-pulse"
				/>
			)}
		</div>
	);
});
