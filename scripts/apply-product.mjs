#!/usr/bin/env node
/**
 * PA.2 — Merge product/product.walkcroach.json into vscode/product.json.
 * Preserves upstream OSS keys; overlays WalkCroach identity + Open VSX gallery.
 * Never writes Microsoft Marketplace URLs.
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vscodeProductPath = join(root, 'vscode/product.json');
const overlayPath = join(root, 'product/product.walkcroach.json');
const backupPath = join(root, 'vscode/product.json.oss.bak');

const base = JSON.parse(readFileSync(vscodeProductPath, 'utf8'));
const overlay = JSON.parse(readFileSync(overlayPath, 'utf8'));

if (!existsSync(backupPath)) {
  // Prefer backing up pristine OSS product if still Code - OSS branded
  if (base.nameShort === 'Code - OSS' || base.applicationName === 'code-oss') {
    copyFileSync(vscodeProductPath, backupPath);
  }
}

const identityKeys = [
  'nameShort',
  'nameLong',
  'applicationName',
  'dataFolderName',
  'urlProtocol',
  'quality',
  'serverApplicationName',
  'serverDataFolderName',
  'darwinBundleIdentifier',
  'linuxIconName',
  'win32AppUserModelId',
  'win32DirName',
  'win32MutexName',
  'win32NameVersion',
  'win32RegValueName',
  'win32ShellNameShort',
  'win32x64AppId',
  'win32arm64AppId',
  'win32x64UserAppId',
  'win32arm64UserAppId',
  'win32ContextMenu',
  'licenseUrl',
  'reportIssueUrl',
  'updateUrl',
  'downloadUrl',
  'linkProtectionTrustedDomains',
  'extensionsGallery',
  'enableTelemetry',
];

const merged = { ...base };
for (const k of identityKeys) {
  if (overlay[k] !== undefined) merged[k] = overlay[k];
}

// Explicitly strip recommendation surfaces (NFR-F09).
merged.extensionTips = {};
merged.extensionImportantTips = {};
merged.keymapExtensionTips = [];
merged.exeBasedExtensionTips = {};
merged.configBasedExtensionTips = {};
merged.extensionRecommendations = {};
merged.extensionRecommendationKeymaps = {};

merged.enableTelemetry = false;
merged.walkcroach = {
  ...(overlay.walkcroach ?? {}),
  phase: overlay.walkcroach?.phase ?? 'D',
  marketplaceProxy: false,
  curatedRecommendationsFile: 'product/recommendations.curated.json',
  proprietaryIncompatiblesFile: 'product/incompatibles.proprietary.json',
};

// Embed curated recommendation IDs for in-product surfacing (never inherit upstream tips).
try {
  const curated = JSON.parse(
    readFileSync(join(root, 'product/recommendations.curated.json'), 'utf8'),
  );
  const ids = (Array.isArray(curated) ? curated : [])
    .map((x) => (typeof x === 'string' ? x : x?.id))
    .filter(Boolean);
  merged.walkcroach.curatedRecommendationIds = ids;
} catch {
  merged.walkcroach.curatedRecommendationIds = [];
}

try {
  const incompat = JSON.parse(
    readFileSync(join(root, 'product/incompatibles.proprietary.json'), 'utf8'),
  );
  merged.walkcroach.proprietaryIncompatibles = Array.isArray(incompat) ? incompat : [];
} catch {
  merged.walkcroach.proprietaryIncompatibles = [];
}

const galleryBlob = JSON.stringify(merged.extensionsGallery ?? {});
if (/marketplace\.visualstudio\.com/i.test(galleryBlob)) {
  console.error('Refusing to write Microsoft Marketplace URL into product.json');
  process.exit(1);
}
if (!String(merged.extensionsGallery?.serviceUrl ?? '').includes('open-vsx.org')) {
  console.error('extensionsGallery.serviceUrl must be Open VSX');
  process.exit(1);
}

writeFileSync(vscodeProductPath, `${JSON.stringify(merged, null, '\t')}\n`);
console.log(
  JSON.stringify({
    ok: true,
    applied: 'product.json',
    nameLong: merged.nameLong,
    applicationName: merged.applicationName,
    gallery: merged.extensionsGallery.serviceUrl,
    enableTelemetry: merged.enableTelemetry,
    backup: existsSync(backupPath) ? 'vscode/product.json.oss.bak' : null,
  }),
);
