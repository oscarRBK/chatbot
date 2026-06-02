# provider-chatbot

*Read this in [English](./README.md).*

Un widget de chat diminuto, **agnóstico de proveedor** y **agnóstico de framework**.

- 🧩 **Un solo [Web Component](https://developer.mozilla.org/es/docs/Web/API/Web_components) en JS puro** (`<chat-bot>`) con **Shadow DOM** → el CSS de la página no puede romperlo y sus estilos nunca se filtran hacia afuera. Se integra en **React, Angular, WordPress o HTML plano** sin cambios.
- 🔌 **Agnóstico de proveedor** → apúntalo a tu propio backend (`endpoint`), a una API compatible con OpenAI, a Anthropic, o a una función `send()` totalmente personalizada. La interfaz nunca cambia.
- 🌊 Respuestas en **streaming** (SSE) y sin streaming, token a token.
- 🎨 **Tematización por producto** mediante variables CSS: colores, logo, mascota, textos, posición.
- 📦 Se distribuye como **ESM** (`import`) para bundlers y como **IIFE** (`<script>` → `window.Chatbot`) para WordPress/CDN.
- 0 dependencias en tiempo de ejecución.

---

## Instalación

```bash
npm install provider-chatbot
```

o vía CDN / `<script>` (sin paso de compilación):

```html
<script src="https://cdn.jsdelivr.net/npm/provider-chatbot/dist/chatbot.iife.js"></script>
```

---

## Dos modos de uso

El widget se publica en **dos formatos** desde el mismo código fuente. Elige según cómo cargues JavaScript en tu proyecto.

### Modo A — ESM (`import`) · para frameworks con bundler

Para **React, Angular, Vue, Svelte** o cualquier proyecto con Vite/webpack/Rollup. Importas el módulo y llamas a `init()`.

```js
import { Chatbot } from 'provider-chatbot';
// o:  import Chatbot from 'provider-chatbot';   (export por defecto)

const bot = Chatbot.init({
  title: 'Soporte',
  endpoint: '/api/chat',
  stream: true,
});
```

- Soporta *tree-shaking* y tipos TypeScript incluidos.
- Archivo: `dist/chatbot.es.js`.
- Importaciones disponibles: `{ Chatbot }`, `default`, `{ ChatbotElement, define }`.

### Modo B — IIFE / global (`<script>`) · para WordPress y HTML plano

Para entornos **sin bundler**: WordPress, HTML estático, o cuando solo quieres una etiqueta `<script>`. Expone `window.Chatbot`.

```html
<script src="dist/chatbot.iife.js"></script>
<script>
  var bot = Chatbot.init({
    title: 'Soporte',
    endpoint: '/api/chat',
    stream: true
  });
</script>
```

- No requiere `npm`, ni `import`, ni compilación.
- Archivo: `dist/chatbot.iife.js`.
- Global disponible: `window.Chatbot` con `.init()`, `.define()`, `.Element`.

> **Ambos modos comparten el mismo componente.** La diferencia es solo *cómo se carga*: `import` (Modo A) frente a etiqueta `<script>` global (Modo B). Las opciones de configuración, el tema y la API son idénticos.

### Modo declarativo (extra, sin JS)

Como es un Web Component estándar, también puedes usar la etiqueta directamente (funciona tanto si cargaste el ESM como el IIFE):

```html
<chat-bot title="Soporte" endpoint="/api/chat" stream primary-color="#16a34a" welcome="¡Hola!"></chat-bot>
```

---

## Inicio rápido

```js
import { Chatbot } from 'provider-chatbot';

const bot = Chatbot.init({
  title: 'Soporte',
  endpoint: '/api/chat', // tu backend
  stream: true,
  theme: { primary: '#4f46e5' },
});
```

`init()` devuelve la instancia: `bot.open()`, `bot.close()`, `bot.toggle()`, `bot.sendMessage(texto)`, `bot.clear()`, `bot.destroy()`.

---

## Uso por framework

### React (Modo A — ESM)

```jsx
import { useEffect, useRef } from 'react';
import { Chatbot } from 'provider-chatbot';

export function ChatSoporte() {
  const ref = useRef(null);
  useEffect(() => {
    ref.current = Chatbot.init({ title: 'Soporte', endpoint: '/api/chat', stream: true });
    return () => ref.current?.destroy(); // limpieza al desmontar
  }, []);
  return null; // el widget se monta solo en <body>
}
```

### Angular (Modo A — ESM)

```ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Chatbot } from 'provider-chatbot';

@Component({ selector: 'app-chat-soporte', template: '' })
export class ChatSoporteComponent implements OnInit, OnDestroy {
  private bot: any;
  ngOnInit() { this.bot = Chatbot.init({ title: 'Soporte', endpoint: '/api/chat', stream: true }); }
  ngOnDestroy() { this.bot?.destroy(); }
}
```

> ¿Usas la etiqueta `<chat-bot>` directamente en una plantilla de Angular? Añade `CUSTOM_ELEMENTS_SCHEMA` al módulo/componente para que Angular permita el elemento personalizado.

### WordPress (Modo B — IIFE)

Encola el build IIFE y llama a `init()` en el footer. En el `functions.php` de tu tema:

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
        title: 'Soporte',
        endpoint: '" . esc_url(rest_url('myplugin/v1/chat')) . "',
        stream: true
      });
    });
  ");
});
```

### HTML plano (Modo B — IIFE)

```html
<script src="dist/chatbot.iife.js"></script>
<script>
  Chatbot.init({ title: 'Soporte', endpoint: '/api/chat', stream: true });
</script>
```

---

## Conectar un proveedor

El núcleo solo llama a una función: `adapter(messages, { onToken, signal }) => textoCompleto`.
Tú eliges cómo se produce.

### 1. Tu propio backend (recomendado en producción)

```js
Chatbot.init({ endpoint: '/api/chat', stream: true });
```

Tu endpoint recibe `POST { messages: [{ role, content }], stream }` y devuelve:
- **JSON**: `{ "reply": "..." }` (también acepta `message`, `content`, `text` o el formato de OpenAI), o
- **Stream SSE** (`Content-Type: text/event-stream`): líneas `data: {"text":"token"}`, terminando con `data: [DONE]`.

Personaliza el formato:

```js
Chatbot.init({
  endpoint: '/api/chat',
  stream: true,
  headers: { Authorization: 'Bearer ' + token },
  credentials: 'include',
  buildBody: (messages) => ({ conversation: messages }),
  parseResponse: (json) => json.answer,   // sin streaming
  parseChunk: (data) => data.token,       // con streaming
});
```

### 2. OpenAI y compatibles — ChatGPT, Gemini, Groq, Mistral, Ollama, …

La mayoría de proveedores hablan el formato de OpenAI, así que es la misma llamada cambiando `baseURL` + `model`:

```js
Chatbot.init({
  provider: 'openai',
  baseURL: 'https://api.openai.com/v1', // cámbialo según la tabla
  model: 'gpt-4o-mini',
  apiKey: '...',   // ⚠️ visible en el navegador — solo prototipos; usa proxy en producción
  stream: true,
});
```

| Servicio | `baseURL` | `model` de ejemplo |
|---|---|---|
| OpenAI (ChatGPT) | `https://api.openai.com/v1` | `gpt-4o-mini` |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai/` | `gemini-2.0-flash` |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| Mistral | `https://api.mistral.ai/v1` | `mistral-large-latest` |
| OpenRouter | `https://openrouter.ai/api/v1` | `anthropic/claude-3.5-sonnet` |
| Together | `https://api.together.xyz/v1` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| Ollama (local) | `http://localhost:11434/v1` | `llama3.2` (`apiKey: 'ollama'`) |
| LM Studio (local) | `http://localhost:1234/v1` | (modelo cargado) |

> **Google:** Gemini expone un endpoint compatible con OpenAI, así que el preset `openai` funciona con una clave de Google AI Studio. **Vertex AI** (proyectos de gcloud) usa tokens OAuth de corta duración (`gcloud auth print-access-token`) y debe ir por proxy en el servidor — ver Seguridad más abajo.

**Azure OpenAI** usa otra URL + cabecera, así que usa `endpoint` (no el preset):

```js
Chatbot.init({
  endpoint: 'https://RES.openai.azure.com/openai/deployments/DEP/chat/completions?api-version=2024-08-01-preview',
  headers: { 'api-key': 'AZURE_KEY' },
  stream: true,
  buildBody: (m) => ({ messages: m, stream: true }),
}); // el parser por defecto lee choices[0].message.content / delta
```

### 3. Anthropic

```js
Chatbot.init({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-latest',
  apiKey: '...',   // ⚠️ usa proxy en producción
  maxTokens: 1024,
});
```

### 4. `send()` totalmente personalizado

```js
Chatbot.init({
  send: async (messages, { onToken, signal }) => {
    const res = await fetch('/chat', { method: 'POST', body: JSON.stringify({ messages }), signal });
    const text = await res.text();
    onToken(text);   // opcional: emite trozos según llegan
    return text;     // devuelve la respuesta completa
  },
});
```

> **Seguridad:** nunca envíes claves de API reales al navegador en producción. Usa `endpoint`/`send` para hacer proxy desde tu servidor. Ver ejemplos en [`examples/`](./examples). Para **Google Vertex AI**, el proxy aporta un bearer de `gcloud auth print-access-token` en el servidor, de modo que el token OAuth nunca llega al navegador.

---

## Tematización

Todo es variable CSS; sobrescribe el subconjunto que quieras con `theme`:

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

Marca y posición:

```js
Chatbot.init({
  logo: '/marca/logo.svg',        // cabecera
  mascot: '/marca/mascota.png',   // avatar del bot + fallback del lanzador
  launcherIcon: '/marca/burbuja.svg',
  launcherText: 'Chatea con nosotros',
  position: 'bottom-left',         // bottom-right | bottom-left | top-right | top-left
});
```

También puedes intervenir desde el CSS de la página (las variables atraviesan el Shadow DOM):

```css
chat-bot { --cb-primary: #e11d48; --cb-radius: 24px; }
```

---

## Referencia de configuración

| Opción | Tipo | Por defecto | Notas |
|---|---|---|---|
| `target` | `Element \| string` | `document.body` | Dónde montar. |
| `position` | string | `'bottom-right'` | Esquina. |
| `title` / `subtitle` | string | `'Chat'` / `''` | Texto de cabecera. |
| `welcomeMessage` | string | `''` | Mensaje inicial del bot. |
| `placeholder` | string | `'Type a message…'` | Texto del campo. |
| `footer` | string | `''` | Línea de pie. |
| `launcherText` | string | `''` | Etiqueta junto al icono lanzador. |
| `logo` / `mascot` / `launcherIcon` | url | `null` | Imágenes de marca. |
| `theme` | objeto | `{}` | Sobrescritura de variables CSS. |
| `systemPrompt` | string | `''` | Se antepone como mensaje `system`. |
| `startOpen` | bool | `false` | Abrir al cargar. |
| `keepLauncherOpen` | bool | `false` | Mantener visible el lanzador al abrir. |
| `persist` | bool | `false` | Guardar historial en `localStorage`. |
| `storageKey` | string | `'provider-chatbot:history'` | Clave de almacenamiento. |
| **transporte** | — | — | uno de `send` / `endpoint` / `provider`. |

---

## API de instancia y eventos

```js
const bot = Chatbot.init({ /* ... */ });

bot.open(); bot.close(); bot.toggle();
bot.sendMessage('Hola');
bot.clear();
bot.configure({ theme: { primary: '#e11d48' } }); // reconfiguración en vivo
bot.destroy();
bot.messages; // [{ role, content }] actual

// eventos (también como callbacks onOpen/onClose/onMessage/onResponse/onError)
bot.on('message',  (e) => console.log('usuario:', e.detail.content));
bot.on('response', (e) => console.log('bot:', e.detail.content));
bot.on('error',    (e) => console.warn(e.detail.error));
```

---

## Desarrollo

```bash
npm install
npm run dev      # servidor Vite + demo en /demo (streaming simulado)
npm run build    # -> dist/chatbot.es.js (ESM) + dist/chatbot.iife.js (global)
```

## Licencia

MIT
