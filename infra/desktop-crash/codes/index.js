/**
 * WalkCroach Desktop crash ingest (PE.9 / NFR-F17).
 * Accepts minimal metadata only — rejects prompt/token/sql fields.
 */
const ALLOWED = new Set([
  'appVersion',
  'electronVersion',
  'os',
  'arch',
  'channel',
  'stackHash',
  'message',
  'timestamp',
]);

const FORBIDDEN = /prompt|token|password|authorization|sql|query|secret|cognito|api[_-]?key/i;

exports.handler = async (event) => {
  const headers = {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
  };

  try {
    const raw = event?.body || '{}';
    const body = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!body || typeof body !== 'object') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid body' }) };
    }

    for (const key of Object.keys(body)) {
      if (FORBIDDEN.test(key)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `forbidden field: ${key}` }),
        };
      }
      if (!ALLOWED.has(key)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `unknown field: ${key}` }),
        };
      }
    }

    if (typeof body.message === 'string' && body.message.length > 2000) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'message too long' }) };
    }

    console.log(
      JSON.stringify({
        type: 'desktop.crash',
        appVersion: body.appVersion,
        os: body.os,
        arch: body.arch,
        channel: body.channel,
        stackHash: body.stackHash,
        message: body.message ? String(body.message).slice(0, 500) : undefined,
        ts: body.timestamp || new Date().toISOString(),
      }),
    );

    return { statusCode: 204, headers, body: '' };
  } catch (e) {
    console.error('crash ingest error', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'internal' }) };
  }
};
