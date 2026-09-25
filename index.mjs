import http from 'node:http';

/**
 * @cortex/app-sdk — the app side of the Cortex host bridge.
 *
 * Two rules shape this module:
 *
 *  1. `connectHost()` returns null when there is no host. An App Store app must
 *     run standalone, so "Cortex is not here" is an ordinary state to branch on,
 *     not an error to crash on.
 *  2. It never reads anything about the host except the three variables Cortex
 *     hands it. There is no discovery, no scanning, no fallback endpoint.
 */

const ENDPOINT_VAR = 'CORTEX_HOST_ENDPOINT';
const TOKEN_VAR = 'CORTEX_HOST_TOKEN';
const APP_ID_VAR = 'CORTEX_APP_ID';
const CALL_PATH = '/v1/call';
const DEFAULT_TIMEOUT_MS = 30_000;

export class HostError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'HostError';
    this.code = code;
    this.status = status;
  }
}

function parseEndpoint(raw) {
  const match = /^(unix|npipe):(.+)$/.exec(raw || '');
  if (!match) return null;
  return match[2];
}

function request(socketPath, token, method, params, timeoutMs) {
  const payload = JSON.stringify({ method, params: params ?? {} });
  return new Promise((resolve, reject) => {
    const call = http.request(
      {
        socketPath,
        path: CALL_PATH,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
          'x-cortex-host-token': token,
        },
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let body;
          try {
            body = JSON.parse(text);
          } catch {
            reject(new HostError('The host sent an unreadable response.', 'bad_response', response.statusCode));
            return;
          }
          if (body && body.ok === true) {
            resolve(body.result);
            return;
          }
          const error = (body && body.error) || {};
          reject(new HostError(
            error.message || 'The host refused the call.',
            error.code || 'host_error',
            response.statusCode,
          ));
        });
      },
    );
    call.setTimeout(timeoutMs, () => {
      call.destroy(new HostError('The host did not respond in time.', 'timeout', 504));
    });
    call.on('error', (error) => {
      reject(error instanceof HostError
        ? error
        : new HostError(`The host is unreachable: ${error.message}`, 'unreachable', 503));
    });
    call.end(payload);
  });
}

/**
 * Connect to the Cortex host.
 *
 * @returns {Promise<Host|null>} null when this process was not started by
 *   Cortex — the standalone path.
 */
export async function connectHost(options = {}) {
  const socketPath = parseEndpoint(process.env[ENDPOINT_VAR]);
  const token = process.env[TOKEN_VAR];
  const appId = process.env[APP_ID_VAR];
  if (!socketPath || !token || !appId) return null;

  const timeoutMs = Number.isInteger(options.timeoutMs) ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  const call = (method, params) => request(socketPath, token, method, params, timeoutMs);

  return {
    appId,

    settings: {
      get: async (key) => (await call('settings.get', { key })).value,
      has: async (key) => (await call('settings.get', { key })).present,
      list: async () => (await call('settings.list', {})).settings,
      /** Passing null removes the key. */
      set: (key, value) => call('settings.set', { key, value }),
    },

    llm: {
      complete: (params) => call('llm.complete', params),
    },

    session: {
      startTurn: (params) => call('session.startTurn', params),
    },

    approvals: {
      request: (params) => call('approvals.request', params),
    },

    events: {
      next: (params = {}) => call('events.next', params),
    },

    models: {
      ensure: (modelId) => call('models.ensure', { modelId }),
      status: (modelId) => call('models.status', { modelId }),
    },

    ollama: {
      lease: () => call('ollama.lease', {}),
      release: (leaseId) => call('ollama.release', { leaseId }),
    },

    notify: (params) => call('notify', params),

    /** API 1.12: heartbeat a long-running program's status to the user. */
    program: {
      status: (params) => call('program.status', params),
    },

    /** Escape hatch for methods added after this SDK version. */
    call,
  };
}

export default { connectHost, HostError };
