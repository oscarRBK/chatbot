# provider-chatbot

*Léelo en [Español](./README.es.md).*

A tiny, **provider-agnostic** and **framework-agnostic** chat widget.

- 🧩 **One vanilla [Web Component](https://developer.mozilla.org/docs/Web/API/Web_components)** (`<chat-bot>`) with **Shadow DOM** → host page CSS can't break it, and its styles never leak out. Drops into **React, Angular, WordPress, or plain HTML** unchanged.
- 🔌 **Provider-agnostic** → point it at your own backend (`endpoint`), an OpenAI-compatible API, Anthropic, a session-based webhook (Make.com / n8n), or a fully custom `send()` function. The UI never changes.
- 🌊 **Streaming** (SSE) and non-streaming responses, token-by-token.
- 🎨 **Per-product theming** via CSS variables — colors, logo, mascot, labels, position.
- 📦 Ships **ESM** (`import`) for bundlers and **IIFE** (`<script>` → `window.Chatbot`) for WordPress/CDN.
- 0 runtime dependencies.

---

## Install

```bash
npm install provider-chatbot
```

or via CDN / `<script>` (no build step):

```html
<script src="https://cdn.jsdelivr.net/npm/provider-chatbot/dist/chatbot.iife.js"></script>
```

---

## Quick start

```js
import { Chatbot } from 'provider-chatbot';

const bot = Chatbot.init({
  title: 'Support',
  endpoint: '/api/chat', // your backend
  stream: true,
  theme: { primary: '#4f46e5' },
});
```

`init()` returns the element instance: `bot.open()`, `bot.close()`, `bot.toggle()`, `bot.sendMessage(text)`, `bot.clear()`, `bot.destroy()`.

---

## Framework usage

### React

```jsx
import { useEffect, useRef } from 'react';
import { Chatbot } from 'provider-chatbot';

export function SupportChat() {
  const ref = useRef(null);
  useEffect(() => {
    ref.current = Chatbot.init({ title: 'Support', endpoint: '/api/chat', stream: true });
    return () => ref.current?.destroy(); // cleanup on unmount
  }, []);
  return null; // the widget mounts itself to <body>
}
```

### Angular

```ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Chatbot } from 'provider-chatbot';

@Component({ selector: 'app-support-chat', template: '' })
export class SupportChatComponent implements OnInit, OnDestroy {
  private bot: any;
  ngOnInit() { this.bot = Chatbot.init({ title: 'Support', endpoint: '/api/chat', stream: true }); }
  ngOnDestroy() { this.bot?.destroy(); }
}
```

> Using the `<chat-bot>` tag directly in an Angular template? Add `CUSTOM_ELEMENTS_SCHEMA` to the module/component so Angular allows the custom element.

### WordPress

Enqueue the IIFE build, then init in the footer. In your theme's `functions.php`:

```php
add_action('wp_enqueue_scripts', function () {
  wp_enqueue_script(
    'provider-chatbot',
    get_template_directory_uri() . '/js/chatbot.iife.js',
    [], '0.1.0', true
  );
  wp_add_inline_script('provider-chatbot', "
    window.addEventListener('load', function () {
      Chatbot.init({
        title: 'Support',
        endpoint: '" . esc_url(rest_url('myplugin/v1/chat')) . "',
        stream: true
      });
    });
  ");
});
```

### Plain HTML (no build)

```html
<script src="dist/chatbot.iife.js"></script>
<script>
  Chatbot.init({ title: 'Support', endpoint: '/api/chat', stream: true });
</script>
```

Or fully declarative — no JS:

```html
<chat-bot title="Support" endpoint="/api/chat" stream primary-color="#16a34a" welcome="Hi there!"></chat-bot>
```

---

## Connecting a provider

The core only ever calls one function: `adapter(messages, { onToken, signal }) => fullText`.
You choose how it's produced.

### 1. Your own backend (recommended for production)

```js
Chatbot.init({ endpoint: '/api/chat', stream: true });
```

Your endpoint receives `POST { messages: [{ role, content }], stream }` and returns either:
- **JSON**: `{ "reply": "..." }` (also accepts `message`, `content`, `text`, or OpenAI shape), or
- **SSE stream** (`Content-Type: text/event-stream`): `data: {"text":"token"}` lines, ending with `data: [DONE]`.

Customize the wire format:

```js
Chatbot.init({
  endpoint: '/api/chat',
  stream: true,
  headers: { Authorization: 'Bearer ' + token },
  credentials: 'include',
  buildBody: (messages) => ({ conversation: messages }),
  parseResponse: (json) => json.answer,        // non-streaming
  parseChunk: (data) => data.token,            // streaming
});
```

### 2. OpenAI & OpenAI-compatible — ChatGPT, Gemini, Groq, Mistral, Ollama, …

Most providers speak OpenAI's wire format, so they're the same call with a different `baseURL` + `model`:

```js
Chatbot.init({
  provider: 'openai',
  baseURL: 'https://api.openai.com/v1', // swap per table below
  model: 'gpt-4o-mini',
  apiKey: '...',   // ⚠️ visible in the browser — prototypes only; proxy in prod
  stream: true,
});
```

| Service | `baseURL` | example `model` |
|---|---|---|
| OpenAI (ChatGPT) | `https://api.openai.com/v1` | `gpt-4o-mini` |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai/` | `gemini-2.0-flash` |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| Mistral | `https://api.mistral.ai/v1` | `mistral-large-latest` |
| OpenRouter | `https://openrouter.ai/api/v1` | `anthropic/claude-3.5-sonnet` |
| Together | `https://api.together.xyz/v1` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| Ollama (local) | `http://localhost:11434/v1` | `llama3.2` (`apiKey: 'ollama'`) |
| LM Studio (local) | `http://localhost:1234/v1` | (loaded model) |

> **Google:** Gemini exposes an OpenAI-compatible endpoint, so the `openai` preset works with a Google AI Studio key. **Vertex AI** (gcloud projects) uses short-lived OAuth tokens (`gcloud auth print-access-token`) and must be proxied server-side — see Security below.

**Azure OpenAI** uses a different URL + header, so use `endpoint` (not the preset):

```js
Chatbot.init({
  endpoint: 'https://RES.openai.azure.com/openai/deployments/DEP/chat/completions?api-version=2024-08-01-preview',
  headers: { 'api-key': 'AZURE_KEY' },
  stream: true,
  buildBody: (m) => ({ messages: m, stream: true }),
}); // default parser reads choices[0].message.content / delta
```

### 3. Anthropic

```js
Chatbot.init({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-latest',
  apiKey: '...',   // ⚠️ proxy in production
  maxTokens: 1024,
});
```

### 4. Fully custom `send()`

```js
Chatbot.init({
  send: async (messages, { onToken, signal }) => {
    const res = await fetch('/chat', { method: 'POST', body: JSON.stringify({ messages }), signal });
    const text = await res.text();
    onToken(text);   // optional: stream pieces as they arrive
    return text;     // return the full reply
  },
});
```

### 5. Make.com webhook (session-based backends)

For no-code backends (Make.com, n8n, Zapier…) that keep conversation state **server-side** by session id, instead of receiving the whole message history. The widget sends only the latest user turn plus a `session_id`; the backend returns the reply and the id to reuse.

```js
Chatbot.init({
  provider: 'make',
  endpoint: 'https://hook.eu1.make.com/xxxxxxxxxxxxxxxxxxxxxxxx',
  consent: true, // pass your real cookie/consent state
  onSession: ({ sessionId, conversationId }) => console.log(sessionId, conversationId),
});
```

**Request body** (sent on every turn):

```json
{
  "session_id": "abc123",          // omitted on the first message
  "visitor_id": "…",               // stable per-browser id, auto-generated
  "message": "y cuánto cuesta?",   // only the latest user turn
  "page_url": "…", "referrer": "…",
  "utm_source": "…", "utm_medium": "…", "utm_campaign": "…",
  "consent": true,
  "timestamp": "2026-06-15T10:30:00.000Z"
}
```

**Response body:** `{ "ok": true, "answer": "…", "session_id": "…", "conversation_id": "…" }` — the reply is read from `answer`.

Session handling is automatic: the **first** request omits `session_id`; the returned id is reused on every following request (kept in `sessionStorage`, so it survives a reload in the same tab) so the backend keeps context. `visitor_id` is a stable id kept in `localStorage`. `page_url`, `referrer` and `utm_*` are read from the current page unless you pass them explicitly.

| Option | Default | Notes |
|---|---|---|
| `visitorId` | auto | Stable per-browser id; generated + persisted if omitted. |
| `pageUrl` / `referrer` | page values | Override the auto-read values. |
| `utm` / `utmSource` / `utmMedium` / `utmCampaign` | URL query | Explicit value wins over the query string. |
| `consent` | `true` | Sent as `consent`. |
| `sessionId` | — | Seed an existing session to resume it. |
| `onSession` | — | Fires after each reply with the latest `{ sessionId, conversationId }`. |
| `parseResponse` | `d => d.answer` | Override reply extraction. |

A runnable example lives in [`examples/make-webhook.html`](./examples/make-webhook.html).

---

> **Security:** never ship real API keys to the browser in production. Use `endpoint`/`send` to proxy through your server. Ready-made proxies (Express, WordPress REST) live in [`examples/`](./examples). For **Google Vertex AI**, the proxy supplies a `gcloud auth print-access-token` bearer server-side so the OAuth token never reaches the browser.

---

## Theming

All visuals are CSS custom properties; override any subset via `theme`:

```js
Chatbot.init({
  theme: {
    primary: '#16a34a',
    onPrimary: '#ffffff',
    background: '#ffffff',
    surface: '#f4f4f6',
    text: '#18181b',
    botBubble: '#f1f1f4',
    userBubble: '#16a34a',
    radius: '18px',
    fontFamily: 'Inter, sans-serif',
    width: '400px',
    height: '600px',
    offset: '24px',
  },
});
```

Branding & placement:

```js
Chatbot.init({
  logo: '/brand/logo.svg',       // header
  mascot: '/brand/mascot.png',   // bot avatar + launcher fallback
  launcherIcon: '/brand/bubble.svg',
  launcherText: 'Chat with us',  // text label on the launcher tab
  position: 'bottom-left',       // bottom-right | bottom-left | top-right | top-left
});
```

You can also reach in from host CSS (variables pierce Shadow DOM):

```css
chat-bot { --cb-primary: #e11d48; --cb-radius: 24px; }
```

---

## Config reference

| Option | Type | Default | Notes |
|---|---|---|---|
| `target` | `Element \| string` | `document.body` | Where to mount. |
| `position` | string | `'bottom-right'` | Corner placement. |
| `title` / `subtitle` | string | `'Chat'` / `''` | Header text. |
| `welcomeMessage` | string | `''` | Seeded bot message. |
| `placeholder` | string | `'Type a message…'` | Input placeholder. |
| `footer` | string | `''` | Small footer line. |
| `launcherText` | string | `''` | Label beside launcher icon. |
| `logo` / `mascot` / `launcherIcon` | url | `null` | Branding images. |
| `theme` | object | `{}` | CSS-variable overrides. |
| `systemPrompt` | string | `''` | Prepended as a `system` message. |
| `startOpen` | bool | `false` | Open on load. |
| `keepLauncherOpen` | bool | `false` | Keep the launcher visible while open. |
| `persist` | bool | `false` | Save history to `localStorage`. |
| `storageKey` | string | `'provider-chatbot:history'` | Storage key. |
| **transport** | — | — | one of `send` / `endpoint` / `provider`. |

---

## Instance API & events

```js
const bot = Chatbot.init({ /* ... */ });

bot.open(); bot.close(); bot.toggle();
bot.sendMessage('Hi');
bot.clear();
bot.configure({ theme: { primary: '#e11d48' } }); // live re-config
bot.destroy();
bot.messages; // current [{ role, content }]

// events (also available as onOpen/onClose/onMessage/onResponse/onError config callbacks)
bot.on('message',  (e) => console.log('user:', e.detail.content));
bot.on('response', (e) => console.log('bot:', e.detail.content));
bot.on('error',    (e) => console.warn(e.detail.error));
```

---

## TypeScript

Types ship in the package ([`types/index.d.ts`](./types/index.d.ts)) and are picked up automatically.

```ts
import { Chatbot, type ChatbotConfig, type Message } from 'provider-chatbot';

const config: ChatbotConfig = { endpoint: '/api/chat', stream: true };
const bot = Chatbot.init(config); // bot: ChatbotElement
```

## Develop

```bash
npm install
npm run dev      # Vite dev server + live demo at /demo (simulated streaming)
npm run build    # -> dist/chatbot.es.js (ESM) + dist/chatbot.iife.js (global)
```

## License

MIT
