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
					asset.code =
						`(function(){try{var s=document.createElement('style');` +
						`s.textContent=${JSON.stringify(css)};` +
						`document.head.appendChild(s);}catch(e){}})();\n` + asset.code;
				}
			}
		},
	};
}

function mirrorToOut(): Plugin {
	return {
		name: 'walkcroach-mirror-settings-to-out',
		apply: 'build',
		async closeBundle() {
			try {
				await access(join(vscodeRoot, 'out'));
			} catch {
				return;
			}
			await mkdir(mediaOutDir, { recursive: true });
			await copyFile(join(mediaSrcDir, 'settings-ui.js'), join(mediaOutDir, 'settings-ui.js'));
		},
	};
}

export default defineConfig({
	plugins: [react(), tailwindcss(), inlineCss(), mirrorToOut()],
	define: {
		'process.env.NODE_ENV': JSON.stringify('production'),
		'process.env': JSON.stringify({ NODE_ENV: 'production' }),
	},
	build: {
		outDir: mediaSrcDir,
		emptyOutDir: false,
		target: 'chrome128',
		minify: 'esbuild',
		cssCodeSplit: false,
		sourcemap: false,
		lib: {
			entry: 'src/settings/main.tsx',
			formats: ['iife'],
			name: 'WalkCroachSettingsUI',
			fileName: () => 'settings-ui.js',
		},
		rollupOptions: {
			output: {
				assetFileNames: 'settings-ui.[ext]',
				inlineDynamicImports: true,
			},
		},
	},
});
