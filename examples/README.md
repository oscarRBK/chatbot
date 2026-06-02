# Examples

Backend proxies so your provider API key stays on the server (never shipped to the browser).

| File | Stack | Streaming | Widget config |
|---|---|---|---|
| `proxy-express.mjs` | Node + Express | ✅ SSE pass-through | `Chatbot.init({ endpoint:'/api/chat', stream:true })` |
| `wordpress-proxy.php` | WordPress REST | ❌ JSON reply | `Chatbot.init({ endpoint:'/wp-json/myplugin/v1/chat' })` |

## Express

```bash
npm i express
OPENAI_API_KEY=sk-... node examples/proxy-express.mjs
# or
PROVIDER=anthropic ANTHROPIC_API_KEY=sk-ant-... node examples/proxy-express.mjs
```

The widget POSTs `{ messages, stream }`; the proxy forwards to the provider with the
server key and pipes the SSE stream back. The generic adapter already parses
OpenAI/Anthropic stream shapes, so nothing else is required.

## WordPress

Paste `wordpress-proxy.php` into your theme's `functions.php` (or a small plugin),
set `OPENAI_API_KEY` in `wp-config.php`, then point the widget at the REST route.
Returns `{ "reply": "..." }` — the widget reads it automatically.
