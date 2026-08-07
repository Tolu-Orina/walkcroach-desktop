#!/usr/bin/env node
/**
 * Upload Desktop Setup.exe (+ checksums) to the stable CloudFront origin.
 *
 * Prerequisites:
 *   npm run package:windows-portable
 *   aws CLI credentials for the account that owns infra-web
 *   Terraform applied so bucket /walkcroach/{env}/web/desktop_download_url exists
 *
 * Env:
 *   WC_ENV              — dev | test | prod (default: dev)
 *   WC_DESKTOP_BUCKET   — override bucket name (else from SSM / terraform naming)
 *   WC_CF_DISTRIBUTION  — CloudFront distribution id (for invalidation)
 *
 * Usage:
 *   npm run publish:desktop-cdn
 *   npm run publish:desktop-cdn -- --env=prod
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'packaging', 'dist');

const argv = process.argv.slice(2);
const envArg = argv.find((a) => a.startsWith('--env='));
const env = envArg?.slice('--env='.length) || process.env.WC_ENV || 'dev';
const project = process.env.WC_PROJECT || 'walkcroach';

if (!existsSync(distDir)) {
  console.error('packaging/dist missing — run npm run package:windows-portable first');
  process.exit(1);
}

const setupExe = readdirSync(distDir).find(
  (n) => n.startsWith('WalkCroach-Setup-') && n.endsWith('.exe'),
);
if (!setupExe) {
  console.error('No WalkCroach-Setup-*.exe in packaging/dist — packaging SFX step failed?');
  process.exit(1);
}

const sums = existsSync(join(distDir, 'SHA512SUMS')) ? 'SHA512SUMS' : null;
const zip = readdirSync(distDir).find(
  (n) => n.startsWith('WalkCroach-win32-') && n.endsWith('.zip'),
);

function aws(args) {
  const r = spawnSync('aws', args, { stdio: 'inherit', shell: true, env: process.env });
  if (r.status !== 0) {
    throw new Error(`aws ${args.join(' ')} failed (${r.status})`);
  }
}

function awsOut(args) {
  const r = spawnSync('aws', args, { encoding: 'utf8', shell: true, env: process.env });
  if (r.status !== 0) {
    throw new Error(`aws ${args.join(' ')} failed (${r.status}): ${r.stderr}`);
  }
  return (r.stdout || '').trim();
}

const bucket =
  process.env.WC_DESKTOP_BUCKET || `${project}-desktop-releases-${env}`;
const latestKey = 'desktop/preview/latest/WalkCroach-Setup.exe';
const versionedKey = `desktop/preview/versions/${setupExe}`;

console.log(`\n==> upload ${setupExe} → s3://${bucket}/${latestKey}`);
aws([
  's3',
  'cp',
  join(distDir, setupExe),
  `s3://${bucket}/${latestKey}`,
  '--content-type',
  'application/vnd.microsoft.portable-executable',
  '--cache-control',
  'public, max-age=300',
]);

console.log(`==> versioned copy → s3://${bucket}/${versionedKey}`);
aws([
  's3',
  'cp',
  join(distDir, setupExe),
  `s3://${bucket}/${versionedKey}`,
  '--content-type',
  'application/vnd.microsoft.portable-executable',
  '--cache-control',
  'public, max-age=604800, immutable',
]);

if (sums) {
  aws([
    's3',
    'cp',
    join(distDir, sums),
    `s3://${bucket}/desktop/preview/latest/SHA512SUMS`,
    '--content-type',
    'text/plain',
    '--cache-control',
    'public, max-age=300',
  ]);
}

if (zip) {
  aws([
    's3',
    'cp',
    join(distDir, zip),
    `s3://${bucket}/desktop/preview/latest/${zip}`,
    '--content-type',
    'application/zip',
    '--cache-control',
    'public, max-age=300',
  ]);
}

let distributionId = process.env.WC_CF_DISTRIBUTION || '';
if (!distributionId) {
  try {
    distributionId = awsOut([
      'ssm',
      'get-parameter',
      '--name',
      `/${project}/${env}/web/desktop_cf_distribution_id`,
      '--query',
      'Parameter.Value',
      '--output',
      'text',
    ]);
  } catch {
    // optional — invalidate if we have it
  }
}

if (distributionId) {
  console.log(`==> invalidate CloudFront ${distributionId} /desktop/preview/latest/*`);
  aws([
    'cloudfront',
    'create-invalidation',
    '--distribution-id',
    distributionId,
    '--paths',
    '/desktop/preview/latest/*',
  ]);
} else {
  console.warn(
    'No WC_CF_DISTRIBUTION / SSM desktop_cf_distribution_id — skip invalidation (wait for TTL or set env).',
  );
}

let downloadUrl = '';
try {
  downloadUrl = awsOut([
    'ssm',
    'get-parameter',
    '--name',
    `/${project}/${env}/web/desktop_download_url`,
    '--query',
    'Parameter.Value',
    '--output',
    'text',
  ]);
} catch {
  downloadUrl = `(set after infra-web apply) s3://${bucket}/${latestKey}`;
}

console.log(`\nPublished. Landing CTA URL:\n  ${downloadUrl}`);
console.log('Set VITE_DESKTOP_DOWNLOAD_URL to that value (web buildspec reads SSM).');
