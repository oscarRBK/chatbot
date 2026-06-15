// Transport adapters. Every adapter has the same signature:
//
//   adapter(messages, { onToken, signal }) => Promise<string>
//
//   messages : [{ role: 'system'|'user'|'assistant', content: string }]
//   onToken  : (chunk: string) => void   // called per streamed token (optional)
//   signal   : AbortSignal                // to cancel in-flight requests
//   returns  : the full assistant reply text
//
// The widget core never imports a specific provider — it only ever calls the
// resolved adapter. That is what makes it provider-agnostic.

import { readSSE } from './sse.js';

async function safeText(res) {
  try {
    const t = await res.text();
    return t ? t.slice(0, 300) : '';
  } catch {
    return '';
  }
}

// Best-effort extraction of reply text from an arbitrary JSON response.
function pickText(data) {
  if (data == null) return '';
  if (typeof data === 'string') return data;
  if (typeof data !== 'object') return String(data);
  if (typeof data.reply === 'string') return data.reply;
  if (typeof data.text === 'string') return data.text;
  if (typeof data.content === 'string') return data.content;
  if (Array.isArray(data.content)) return data.content.map((b) => b?.text || '').join('');
  if (typeof data.message === 'string') return data.message;
  if (data.message && typeof data.message.content === 'string') return data.message.content;
  if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
  if (data.choices?.[0]?.text) return data.choices[0].text;
  if (data.delta?.text) return data.delta.text;
  return '';
}

// Best-effort extraction of a token from an arbitrary SSE event payload.
function pickChunk(data) {
  if (data == null) return '';
  if (typeof data === 'string') return data;
  const oa = data.choices?.[0]?.delta;
  if (oa && typeof oa.content === 'string') return oa.content;
  if (data.type === 'content_block_delta') return data.delta?.text || '';
  if (typeof data.text === 'string') return data.text;
  if (typeof data.content === 'string') return data.content;
  if (typeof data.delta === 'string') return data.delta;
  if (data.delta && typeof data.delta.text === 'string') return data.delta.text;
  return '';
}

/**
 * Generic adapter: POST messages to your own endpoint.
 * Handles both a JSON response and an SSE token stream.
 * Customize with: method, headers, credentials, stream, buildBody,
 * parseResponse, parseChunk.
 */
export function genericAdapter(cfg) {
  const {
    endpoint,
    method = 'POST',
    headers = {},
    credentials,
    stream = false,
    buildBody = (messages) => ({ messages, stream }),
    parseResponse = pickText,
    parseChunk = pickChunk,
  } = cfg;

  if (!endpoint) throw new Error('[chatbot] genericAdapter requires `endpoint`.');

  return async (messages, { onToken, signal } = {}) => {
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: method === 'GET' ? undefined : JSON.stringify(buildBody(messages)),
      credentials,
      signal,
    });
    if (!res.ok) {
      throw new Error(`[chatbot] Request failed ${res.status} ${res.statusText}: ${await safeText(res)}`);
    }

    const ctype = res.headers.get('content-type') || '';
    const isStream = stream || ctype.includes('text/event-stream');
    if (isStream) {
      let full = '';
      await readSSE(res, (data) => {
        const piece = parseChunk(data);
        if (piece) {
          full += piece;
          onToken && onToken(piece);
        }
      });
      return full;
    }
    if (ctype.includes('application/json')) return parseResponse(await res.json());
    return await res.text();
  };
}

/**
 * OpenAI-compatible adapter (OpenAI, Azure OpenAI, Ollama, LM Studio, vLLM, ...).
 * NOTE: putting `apiKey` in the browser exposes it. Use only for prototypes;
 * in production proxy through your backend and use `genericAdapter`/`endpoint`.
 */
export function openaiAdapter(cfg) {
  const {
    apiKey,
    baseURL = 'https://api.openai.com/v1',
    model = 'gpt-4o-mini',
    stream = true,
    temperature,
    headers = {},
    extraBody = {},
  } = cfg;
  const url = baseURL.replace(/\/+$/, '') + '/chat/completions';

  return async (messages, { onToken, signal } = {}) => {
    const body = {
      model,
      messages: messages.map(({ role, content }) => ({ role, content })),
      stream,
      ...extraBody,
    };
    if (temperature != null) body.temperature = temperature;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...headers,
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) throw new Error(`[chatbot] OpenAI request failed ${res.status}: ${await safeText(res)}`);

    if (stream) {
      let full = '';
      await readSSE(res, (data) => {
        const piece = data?.choices?.[0]?.delta?.content || '';
        if (piece) {
          full += piece;
          onToken && onToken(piece);
        }
      });
      return full;
    }
    const json = await res.json();
    return json?.choices?.[0]?.message?.content || '';
  };
}

/**
 * Anthropic Messages API adapter.
 * Same browser-key caveat as openaiAdapter — proxy in production.
 */
export function anthropicAdapter(cfg) {
  const {
    apiKey,
    baseURL = 'https://api.anthropic.com',
    model = 'claude-3-5-sonnet-latest',
    stream = true,
    maxTokens = 1024,
    version = '2023-06-01',
    system,
    headers = {},
    extraBody = {},
  } = cfg;
  const url = baseURL.replace(/\/+$/, '') + '/v1/messages';

  return async (messages, { onToken, signal } = {}) => {
    // Anthropic takes the system prompt as a separate top-level field.
    const sys = [system, ...messages.filter((m) => m.role === 'system').map((m) => m.content)]
      .filter(Boolean)
      .join('\n\n');
    const convo = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map(({ role, content }) => ({ role, content }));

    const body = {
      model,
      max_tokens: maxTokens,
      messages: convo,
      stream,
      ...(sys ? { system: sys } : {}),
      ...extraBody,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': version,
        'anthropic-dangerous-direct-browser-access': 'true',
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
        ...headers,
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) throw new Error(`[chatbot] Anthropic request failed ${res.status}: ${await safeText(res)}`);

    if (stream) {
      let full = '';
      await readSSE(res, (data) => {
        if (data?.type === 'content_block_delta') {
          const piece = data.delta?.text || '';
          if (piece) {
            full += piece;
            onToken && onToken(piece);
          }
        }
      });
      return full;
    }
    const json = await res.json();
    return Array.isArray(json?.content) ? json.content.map((b) => b?.text || '').join('') : '';
  };
}

// ---- Make.com webhook (rubrika.es) helpers ----------------------------------

function browserValue(get) {
  try {
    return get() || '';
  } catch {
    return '';
  }
}

function randomId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return 'v-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Stable per-browser visitor id (survives across sessions) kept in localStorage.
function ensureVisitorId(explicit, storageKey) {
  if (explicit) return explicit;
  try {
    if (typeof localStorage === 'undefined') return randomId();
    let id = localStorage.getItem(storageKey);
    if (!id) {
      id = randomId();
      localStorage.setItem(storageKey, id);
    }
    return id;
  } catch {
    return randomId();
  }
}

// session_id lives in sessionStorage: per-tab, gone on tab close — like a session.
function readSession(key) {
  try {
    return (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) || null;
  } catch {
    return null;
  }
}
function writeSession(key, val) {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, val);
  } catch {
    /* ignore */
  }
}

// Explicit cfg value wins; otherwise read utm_* from the current page query string.
function readUtm(cfg) {
  let params = null;
  if (typeof location !== 'undefined') {
    try {
      params = new URLSearchParams(location.search);
    } catch {
      params = null;
    }
  }
  const utm = cfg.utm || {};
  const pick = (explicit, key) =>
    explicit != null ? explicit : params ? params.get(key) || '' : '';
  return {
    source: pick(cfg.utmSource ?? utm.source, 'utm_source'),
    medium: pick(cfg.utmMedium ?? utm.medium, 'utm_medium'),
    campaign: pick(cfg.utmCampaign ?? utm.campaign, 'utm_campaign'),
  };
}

/**
 * Make.com webhook adapter (rubrika.es chatbot).
 *
 * Request body:
 *   { session_id?, visitor_id, message, page_url, referrer,
 *     utm_source, utm_medium, utm_campaign, consent, timestamp }
 * Response body:
 *   { ok, answer, session_id, conversation_id }
 *
 * Session flow: the FIRST request carries no `session_id`; the webhook returns
 * one and every following request reuses it so the backend keeps context. The
 * id is held in this closure and mirrored to sessionStorage so it survives a
 * reload within the same tab. `visitor_id` is a stable per-browser id.
 *
 * NOTE: the webhook currently returns HTTP 500 when `session_id` is absent (its
 * new-session branch). Until that is fixed server-side, the first message will
 * surface that error. Seed `sessionId` to work around it if needed.
 */
export function makeAdapter(cfg) {
  const {
    endpoint,
    visitorId,
    pageUrl,
    referrer,
    consent = true,
    headers = {},
    credentials,
    sessionId: seedSession = null,
    visitorStorageKey = 'provider-chatbot:visitor',
    sessionStorageKey = 'provider-chatbot:session',
    onSession,
    parseResponse,
  } = cfg;

  if (!endpoint) {
    throw new Error('[chatbot] makeAdapter requires `endpoint` (the Make.com webhook URL).');
  }

  let sessionId = seedSession || readSession(sessionStorageKey);
  let conversationId = null;

  return async (messages, { signal } = {}) => {
    // The backend keeps context via session_id, so we send only the last turn.
    const last = [...messages].reverse().find((m) => m.role === 'user');
    const utm = readUtm(cfg);

    const body = {
      ...(sessionId ? { session_id: sessionId } : {}),
      visitor_id: ensureVisitorId(visitorId, visitorStorageKey),
      message: last ? last.content : '',
      page_url: pageUrl != null ? pageUrl : browserValue(() => location.href),
      referrer: referrer != null ? referrer : browserValue(() => document.referrer),
      utm_source: utm.source,
      utm_medium: utm.medium,
      utm_campaign: utm.campaign,
      consent: !!consent,
      timestamp: new Date().toISOString(),
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      credentials,
      signal,
    });
    if (!res.ok) {
      throw new Error(
        `[chatbot] Make request failed ${res.status} ${res.statusText}: ${await safeText(res)}`
      );
    }

    const data = await res.json().catch(() => null);
    if (!data || data.ok === false) {
      throw new Error(`[chatbot] Make webhook error${data && data.error ? ': ' + data.error : ''}`);
    }

    if (data.session_id && data.session_id !== sessionId) {
      sessionId = data.session_id;
      writeSession(sessionStorageKey, sessionId);
    }
    if (data.conversation_id) conversationId = data.conversation_id;
    if (typeof onSession === 'function') {
      try {
        onSession({ sessionId, conversationId });
      } catch {
        /* ignore consumer callback errors */
      }
    }

    return parseResponse
      ? parseResponse(data)
      : typeof data.answer === 'string'
        ? data.answer
        : pickText(data);
  };
}

/** Pick the right adapter from user config. */
export function resolveAdapter(cfg = {}) {
  if (typeof cfg.send === 'function') return cfg.send;

  const provider = (cfg.provider || '').toLowerCase();
  if (['openai', 'openai-compatible', 'azure', 'azure-openai', 'ollama'].includes(provider)) {
    return openaiAdapter(cfg);
  }
  if (['anthropic', 'claude'].includes(provider)) {
    return anthropicAdapter(cfg);
  }
  if (['make', 'make.com', 'makecom', 'webhook'].includes(provider)) {
    return makeAdapter(cfg);
  }
  if (cfg.endpoint) return genericAdapter(cfg);

  throw new Error(
    '[chatbot] No transport configured. Provide one of: ' +
      '`send(messages,{onToken,signal})`, `endpoint`, or `provider` ("openai" | "anthropic" | "make").'
  );
}
