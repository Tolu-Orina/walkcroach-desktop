/**
 * Phase 0.3 — Empty branded WalkCroach Desktop window.
 * Proves product.json branding + Open VSX gallery shape on Windows Electron 42.6.0
 * (same Electron major/minor.target as microsoft/vscode@1.129.0).
 *
 * This is NOT a vscode compile. Full Code OSS fork compile is Phase A.
 */
import { app, BrowserWindow } from 'electron';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const productPath = join(__dirname, '../../product/product.walkcroach.json');
const product = JSON.parse(readFileSync(productPath, 'utf8'));

const smokeMs = (() => {
  const arg = process.argv.find((a) => a.startsWith('--smoke-exit-ms='));
  return arg ? Number(arg.split('=')[1]) : 0;
})();

function assertProductGuards(p) {
  if (p.enableTelemetry !== false) {
    throw new Error('Phase 0 guard: enableTelemetry must be false');
  }
  if (p.walkcroach?.marketplaceProxy !== false) {
    throw new Error('Phase 0 guard: marketplaceProxy must be false');
  }
  const gallery = p.extensionsGallery?.serviceUrl ?? '';
  if (!gallery.includes('open-vsx.org')) {
    throw new Error('Phase 0 guard: extensionsGallery.serviceUrl must be Open VSX');
  }
  if (/marketplace\.visualstudio\.com/i.test(JSON.stringify(p.extensionsGallery))) {
    throw new Error('Phase 0 guard: Microsoft Marketplace URL forbidden');
  }
}

assertProductGuards(product);

function createWindow() {
  const win = new BrowserWindow({
    width: 960,
    height: 640,
    title: product.nameLong,
    backgroundColor: '#0f1419',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;" />
  <title>${escapeHtml(product.nameLong)}</title>
  <style>
    :root {
      --bg: #0f1419;
      --fg: #e8eef4;
      --muted: #8b9aab;
      --accent: #3d9b6e;
      --line: #243041;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; height: 100%;
      background: radial-gradient(1200px 600px at 20% -10%, #1a2a22 0%, var(--bg) 55%);
      color: var(--fg);
      font-family: "Segoe UI", "IBM Plex Sans", system-ui, sans-serif;
    }
    main {
      min-height: 100%;
      display: grid;
      place-content: center;
      padding: 2rem;
      text-align: center;
      gap: 0.75rem;
    }
    .brand {
      font-size: clamp(2.5rem, 6vw, 4rem);
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.05;
    }
    .brand span { color: var(--accent); }
    .tag {
      color: var(--muted);
      font-size: 1.05rem;
      max-width: 36rem;
      margin: 0 auto;
    }
    .meta {
      margin-top: 1.5rem;
      display: inline-grid;
      gap: 0.35rem;
      padding: 0.9rem 1.1rem;
      border: 1px solid var(--line);
      border-radius: 8px;
      text-align: left;
      font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
      font-size: 0.78rem;
      color: var(--muted);
    }
    .meta strong { color: var(--fg); font-weight: 600; }
  </style>
</head>
<body>
  <main>
    <div class="brand">Walk<span>Croach</span></div>
    <p class="tag">Desktop Phase 0 branded spike — empty window, Open VSX gallery wired in product.json, telemetry off.</p>
    <div class="meta">
      <div><strong>nameLong</strong> ${escapeHtml(product.nameLong)}</div>
      <div><strong>applicationName</strong> ${escapeHtml(product.applicationName)}</div>
      <div><strong>urlProtocol</strong> ${escapeHtml(product.urlProtocol)}</div>
      <div><strong>gallery</strong> ${escapeHtml(product.extensionsGallery.serviceUrl)}</div>
      <div><strong>upstream</strong> ${escapeHtml(product.walkcroach.upstreamTag)} @ ${escapeHtml(product.walkcroach.upstreamCommit.slice(0, 12))}</div>
      <div><strong>electron</strong> ${escapeHtml(product.walkcroach.electron)}</div>
      <div><strong>enableTelemetry</strong> ${String(product.enableTelemetry)}</div>
      <div><strong>marketplaceProxy</strong> ${String(product.walkcroach.marketplaceProxy)}</div>
    </div>
  </main>
</body>
</html>`;

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  if (smokeMs > 0) {
    setTimeout(() => {
      console.log(
        JSON.stringify({
          ok: true,
          spike: 'branded-window',
          title: product.nameLong,
          electron: process.versions.electron,
          chrome: process.versions.chrome,
          node: process.versions.node,
          gallery: product.extensionsGallery.serviceUrl,
        }),
      );
      app.quit();
    }, smokeMs);
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
