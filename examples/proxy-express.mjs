// Minimal streaming proxy so your API key never reaches the browser.
//
//   npm i express
//   OPENAI_API_KEY=sk-... node examples/proxy-express.mjs
//   # or: PROVIDER=anthropic ANTHROPIC_API_KEY=sk-ant-... node examples/proxy-express.mjs
//
// Widget side:
//   Chatbot.init({ endpoint: 'http://localhost:3000/api/chat', stream: true });
//
// The widget POSTs { messages:[{role,content}], stream }. We forward to the
// provider with the server-side key and pipe the SSE stream straight back.
// provider-chatbot's generic adapter already understands OpenAI and Anthropic
// SSE shapes, so no transformation is needed.

import express from 'express';

const app = express();
app.use(express.json());

const PROVIDER = process.env.PROVIDER || 'openai';
const PORT = process.env.PORT || 3000;

// CORS — only needed if the widget is served from a different origin.
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.post('/api/chat', async (req, res) => {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  try {
    const upstream =
      PROVIDER === 'anthropic'
        ? await callAnthropic(messages)
        : await callOpenAI(messages);

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => '');
      return res.status(upstream.status || 502).json({ error: detail || 'upstream error' });
    }
    await pipeStream(upstream, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err?.message || err) });
  }
});

function callOpenAI(messages) {
  return fetch((process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1') + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      stream: true,
      messages,
    }),
  });
}

function callAnthropic(messages) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const convo = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
      max_tokens: 1024,
      stream: true,
      ...(system ? { system } : {}),
      messages: convo,
    }),
  });
}

async function pipeStream(upstream, res) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    res.write(decoder.decode(value, { stream: true }));
  }
  res.end();
}

app.listen(PORT, () => console.log(`chat proxy (${PROVIDER}) on http://localhost:${PORT}`));
