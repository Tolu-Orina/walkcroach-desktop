import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { handler } = require('./index.js');

describe('desktop crash lambda', () => {
  it('accepts metadata-only payload', async () => {
    const res = await handler({
      body: JSON.stringify({
        appVersion: '0.1.0',
        os: 'win32',
        arch: 'x64',
        channel: 'stable',
        stackHash: 'abc',
        message: 'boom',
      }),
    });
    assert.equal(res.statusCode, 204);
  });

  it('rejects prompt field', async () => {
    const res = await handler({
      body: JSON.stringify({ appVersion: '1', prompt: 'secret' }),
    });
    assert.equal(res.statusCode, 400);
  });

  it('rejects unknown fields', async () => {
    const res = await handler({
      body: JSON.stringify({ appVersion: '1', sql: 'select 1' }),
    });
    assert.equal(res.statusCode, 400);
  });
});
