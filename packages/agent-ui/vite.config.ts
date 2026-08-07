import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { copyFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const pkgRoot = dirname(fileURLToPath(import.meta.url));
const vscodeRoot = join(pkgRoot, '..', '..', 'vscode');
const mediaSrcDir = join(vscodeRoot, 'src', 'vs', 'workbench', 'contrib', 'walkcroach', 'browser', 'media');
const mediaOutDir = join(vscodeRoot, 'out', 'vs', 'workbench', 'contrib', 'walkcroach', 'browser', 'media');

/**
 * Emits ONE self-contained file:
 *   vscode/src/vs/workbench/contrib/walkcroach/browser/media/agent-ui.js
 *
 * Two hard constraints from the fork's build, both verified rather than assumed:
 *
 * 1. `build/stylelint.ts` lints `src/**\/*.css` with NO ignore mechanism, and its
 *    variable checker rejects any custom property outside
 *    `vscode-known-variables.json`. Tailwind v4 emits `--tw-*` everywhere, so a
 *    real `.css` file under `src/` would fail the lint against a clean baseline.
 *    => CSS is inlined into the JS bundle by `inlineCss` below; no .css is
 *       written, so stylelint never sees it.
 *
 * 2. The VS Code build copies media assets (svg/png/mp3/json/...) from
 *    `src/**\/media/` to `out/`, but there is ZERO precedent for a prebuilt `.js`
 *    asset under `src/`. If the copy turns out to skip `.js`, the fallback is to
 *    emit a generated `.ts` exporting the bundle as a string — a change to this
 *    file only, not to any component code.
 */

/** Folds the emitted stylesheet into the JS bundle as a runtime <style> inject. */
function inlineCss(): Plugin {
	return {
		name: 'walkcroach-inline-css',
		apply: 'build',
		enforce: 'post',
		generateBundle(_options, bundle) {
			let css = '';
			for (const [fileName, asset] of Object.entries(bundle)) {
				if (asset.type === 'asset' && fileName.endsWith('.css')) {
					css += String(asset.source);
					delete bundle[fileName];
				}
			}
			if (!css) {
				return;
			}
			for (const asset of Object.values(bundle)) {
				if (asset.type === 'chunk' && asset.isEntry) {
					// Prepended so styles exist before React's first paint,
					// avoiding a flash of unstyled content in the webview.
					asset.code =
						`(function(){try{var s=document.createElement('style');` +
						`s.textContent=${JSON.stringify(css)};` +
						`document.head.appendChild(s);}catch(e){}})();\n` + asset.code;
				}
			}
		},
	};
}

/**
 * Dev launches load the bundle from `out/…/media/`, not `src/…/media/`.
 * Vite writes to `src/` (the allowlisted media tree). Mirror into `out/` when
 * present so `npm run build` in this package is enough to refresh a running
 * `scripts/code.bat` session after a window reload.
 */
function mirrorToOut(): Plugin {
	return {
		name: 'walkcroach-mirror-to-out',
		apply: 'build',
		async closeBundle() {
			try {
				await access(join(vscodeRoot, 'out'));
			} catch {
				return;
			}
			await mkdir(mediaOutDir, { recursive: true });
			await copyFile(join(mediaSrcDir, 'agent-ui.js'), join(mediaOutDir, 'agent-ui.js'));
		},
	};
}

export default defineConfig({
	plugins: [react(), tailwindcss(), inlineCss(), mirrorToOut()],
	/**
	 * Library mode deliberately leaves `process.env.*` in the bundle so
	 * package consumers can override NODE_ENV
	 * (https://vite.dev/guide/build.html#library-mode). That is wrong for us:
	 * this IIFE runs inside a VS Code webview iframe with no Node globals.
	 * React / Motion then crash on first paint with
	 * `Uncaught ReferenceError: process is not defined`.
	 *
	 * Static-replace the exact expressions deps emit. Prefer the precise
	 * `process.env.NODE_ENV` key over a full `process` polyfill — recreating
	 * Node globals in a webview is the wrong model.
	 */
	define: {
		'process.env.NODE_ENV': JSON.stringify('production'),
		// Optional-chaining form used by Motion (`process.env?.NODE_ENV`).
		'process.env': JSON.stringify({ NODE_ENV: 'production' }),
	},
	build: {
		outDir: mediaSrcDir,
		// walkcroach.css and walkcroach-icon.svg live here and must survive.
		emptyOutDir: false,
		target: 'chrome128',
		minify: 'esbuild',
		cssCodeSplit: false,
		sourcemap: false,
		lib: {
			entry: 'src/main.tsx',
			formats: ['iife'],
			name: 'WalkCroachAgentUI',
			fileName: () => 'agent-ui.js',
		},
		rollupOptions: {
			output: {
				// No hashing: the fork references this path literally.
				assetFileNames: 'agent-ui.[ext]',
				inlineDynamicImports: true,
			},
		},
	},
});
