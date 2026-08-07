#!/usr/bin/env node
/**
 * Validate product.walkcroach.json Open VSX + telemetry + pin fields.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const product = JSON.parse(
  readFileSync(join(root, 'product/product.walkcroach.json'), 'utf8'),
);

const errors = [];

if (product.nameShort !== 'WalkCroach') errors.push('nameShort');
if (product.enableTelemetry !== false) errors.push('enableTelemetry must be false');
if (product.walkcroach?.marketplaceProxy !== false) {
  errors.push('marketplaceProxy must be false');
}
if (!product.walkcroach?.curatedRecommendationsFile) {
  errors.push('curatedRecommendationsFile required');
}
if (!product.walkcroach?.proprietaryIncompatiblesFile) {
  errors.push('proprietaryIncompatiblesFile required');
}
/**
 * Pin expectations come from product/product.walkcroach.json (single source of truth).
 * SHIPPING.md mirrors the same table for humans.
 */
const expectTag = product.walkcroach?.upstreamTag;
const expectCommit = product.walkcroach?.upstreamCommit;
const expectElectron = product.walkcroach?.electron;

if (!expectTag || !expectCommit || !expectElectron) {
  errors.push('product.walkcroach.json missing upstreamTag / upstreamCommit / electron');
} else if (!/^[0-9a-f]{40}$/i.test(String(expectCommit))) {
  errors.push(`upstreamCommit must be 40-char sha, got ${expectCommit}`);
} else if (!/^\d+\.\d+\.\d+/.test(String(expectElectron))) {
  errors.push(`electron pin looks invalid: ${expectElectron}`);
}

const g = product.extensionsGallery ?? {};
const required = {
  serviceUrl: 'https://open-vsx.org/vscode/gallery',
  itemUrl: 'https://open-vsx.org/vscode/item',
  latestUrlTemplate:
    'https://open-vsx.org/vscode/gallery/{publisher}/{name}/latest',
  controlUrl:
    'https://raw.githubusercontent.com/EclipseFdn/publish-extensions/refs/heads/master/extension-control/extensions.json',
};
for (const [k, v] of Object.entries(required)) {
  if (g[k] !== v) errors.push(`extensionsGallery.${k}`);
}

const blob = JSON.stringify(product.extensionsGallery);
if (/marketplace\.visualstudio\.com/i.test(blob)) {
  errors.push('Microsoft Marketplace URL present');
}

if (errors.length) {
  console.error('audit:product FAILED');
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}

console.log(
  JSON.stringify({
    ok: true,
    audit: 'product',
    nameLong: product.nameLong,
    upstream: product.walkcroach.upstreamTag,
    commit: product.walkcroach.upstreamCommit,
    gallery: g.serviceUrl,
  }),
);
