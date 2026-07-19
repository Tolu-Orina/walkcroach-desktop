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
if (product.walkcroach?.upstreamCommit !== '125df4672b8a6a34975303c6b0baa124e560a4f7') {
  errors.push('upstreamCommit pin mismatch');
}
if (product.walkcroach?.upstreamTag !== '1.129.0') errors.push('upstreamTag');
if (product.walkcroach?.electron !== '42.6.0') errors.push('electron pin');

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
