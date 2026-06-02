// All widget CSS, injected once into the Shadow DOM. Host page styles cannot
// leak in and these cannot leak out. Every visual is driven by a CSS custom
// property with a default, so theming = override variables (see configure()).

export const STYLES = `
:host {
  /* ---- theme tokens (override via config.theme) ---- */
  --cb-primary: #4f46e5;
  --cb-on-primary: #ffffff;
  --cb-bg: #ffffff;
  --cb-surface: #f4f4f6;
  --cb-text: #18181b;
  --cb-text-muted: #71717a;
  --cb-border: #e6e6ea;
  --cb-user-bubble: var(--cb-primary);
  --cb-user-text: var(--cb-on-primary);
  --cb-bot-bubble: #f1f1f4;
  --cb-bot-text: #18181b;
  --cb-radius: 18px;
  --cb-radius-sm: 14px;
  --cb-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", sans-serif;
  --cb-shadow: 0 16px 48px rgba(0, 0, 0, 0.18);
  --cb-launcher-size: 60px;
  --cb-width: 380px;
  --cb-height: 560px;
  --cb-offset: 24px;
  --cb-z: 2147483000;

  position: fixed;
  z-index: var(--cb-z);
  font-family: var(--cb-font);
  color: var(--cb-text);
  -webkit-font-smoothing: antialiased;
}

/* ---- placement ---- */
:host([data-position="bottom-right"]) { right: var(--cb-offset); bottom: var(--cb-offset); }
:host([data-position="bottom-left"])  { left:  var(--cb-offset); bottom: var(--cb-offset); }
:host([data-position="top-right"])    { right: var(--cb-offset); top:    var(--cb-offset); }
:host([data-position="top-left"])     { left:  var(--cb-offset); top:    var(--cb-offset); }

:host([hidden]) { display: none; }

*, *::before, *::after { box-sizing: border-box; }

button { font-family: inherit; cursor: pointer; border: none; background: none; }

/* ---- launcher ("the tab") ---- */
.cb-launcher {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: var(--cb-launcher-size);
  height: var(--cb-launcher-size);
  padding: 0 calc(var(--cb-launcher-size) / 4);
  border-radius: 999px;
  background: var(--cb-primary);
  color: var(--cb-on-primary);
  box-shadow: var(--cb-shadow);
  transition: transform .18s ease, box-shadow .18s ease, opacity .18s ease;
}
.cb-launcher:hover { transform: translateY(-2px); }
.cb-launcher:active { transform: translateY(0); }
.cb-launcher:focus-visible { outline: 3px solid color-mix(in srgb, var(--cb-primary) 40%, white); outline-offset: 2px; }

.cb-launcher .cb-icon { width: 26px; height: 26px; display: inline-flex; }
.cb-launcher .cb-icon svg, .cb-logo svg, .cb-avatar svg, .cb-send svg, .cb-close svg { width: 100%; height: 100%; display: block; }
.cb-launcher-img { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; }
.cb-launcher-text { font-size: 15px; font-weight: 600; white-space: nowrap; padding-right: 4px; }
.cb-launcher-text:empty { display: none; }

.cb-icon-close { display: none; }
:host([data-open]) .cb-launcher { opacity: 0; pointer-events: none; transform: scale(.6); }

/* host can be configured to keep launcher visible while open */
:host([data-keep-launcher][data-open]) .cb-launcher { opacity: 1; pointer-events: auto; transform: none; }
:host([data-keep-launcher][data-open]) .cb-icon-open { display: none; }
:host([data-keep-launcher][data-open]) .cb-icon-close { display: inline-flex; }

/* ---- panel ---- */
.cb-panel {
  position: absolute;
  bottom: 0;
  width: var(--cb-width);
  max-width: calc(100vw - 2 * var(--cb-offset));
  height: var(--cb-height);
  max-height: calc(100vh - 2 * var(--cb-offset));
  display: flex;
  flex-direction: column;
  background: var(--cb-bg);
  border: 1px solid var(--cb-border);
  border-radius: var(--cb-radius);
  box-shadow: var(--cb-shadow);
  overflow: hidden;
  opacity: 0;
  transform: translateY(16px) scale(.98);
  transform-origin: bottom right;
  pointer-events: none;
  transition: opacity .2s ease, transform .2s ease;
}
:host([data-position="bottom-right"]) .cb-panel,
:host([data-position="top-right"])    .cb-panel { right: 0; }
:host([data-position="bottom-left"])  .cb-panel,
:host([data-position="top-left"])     .cb-panel { left: 0; }
:host([data-position^="top"]) .cb-panel { bottom: auto; top: 0; transform-origin: top right; transform: translateY(-16px) scale(.98); }

:host([data-open]) .cb-panel { opacity: 1; transform: none; pointer-events: auto; }

/* ---- header ---- */
.cb-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--cb-primary);
  color: var(--cb-on-primary);
}
.cb-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
.cb-logo {
  width: 38px; height: 38px; flex: none;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--cb-on-primary) 18%, transparent);
  overflow: hidden;
}
.cb-logo img { width: 100%; height: 100%; object-fit: cover; }
.cb-logo svg { width: 22px; height: 22px; }
.cb-titles { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
.cb-title { font-size: 15px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cb-subtitle { font-size: 12px; opacity: .85; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cb-subtitle:empty { display: none; }
.cb-close {
  margin-left: auto; flex: none;
  width: 32px; height: 32px; color: inherit;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 8px; opacity: .85;
}
.cb-close:hover { opacity: 1; background: color-mix(in srgb, var(--cb-on-primary) 16%, transparent); }
.cb-close svg { width: 20px; height: 20px; }

/* ---- messages ---- */
.cb-messages {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--cb-bg);
  scroll-behavior: smooth;
}
.cb-messages::-webkit-scrollbar { width: 8px; }
.cb-messages::-webkit-scrollbar-thumb { background: var(--cb-border); border-radius: 8px; }

.cb-row { display: flex; gap: 8px; align-items: flex-end; max-width: 88%; }
.cb-row.user { align-self: flex-end; flex-direction: row-reverse; }
.cb-row.bot { align-self: flex-start; }

.cb-avatar {
  width: 28px; height: 28px; flex: none; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--cb-surface); color: var(--cb-text-muted); overflow: hidden;
}
.cb-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cb-avatar svg { width: 18px; height: 18px; }
.cb-row.user .cb-avatar { display: none; }

.cb-bubble {
  padding: 10px 14px;
  border-radius: var(--cb-radius-sm);
  font-size: 14.5px;
  line-height: 1.5;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  white-space: normal;
}
.cb-row.user .cb-bubble {
  background: var(--cb-user-bubble);
  color: var(--cb-user-text);
  border-bottom-right-radius: 4px;
}
.cb-row.bot .cb-bubble {
  background: var(--cb-bot-bubble);
  color: var(--cb-bot-text);
  border-bottom-left-radius: 4px;
}
.cb-row.error .cb-bubble { background: #fee2e2; color: #991b1b; }

.cb-bubble a { color: inherit; text-decoration: underline; }
.cb-bubble code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: .9em;
  background: color-mix(in srgb, currentColor 12%, transparent);
  padding: .1em .35em; border-radius: 5px;
}
.cb-bubble pre {
  margin: 6px 0 0; padding: 10px;
  background: color-mix(in srgb, currentColor 10%, transparent);
  border-radius: 8px; overflow-x: auto;
}
.cb-bubble pre code { background: none; padding: 0; }

/* ---- typing indicator ---- */
.cb-typing { display: none; gap: 4px; padding: 4px 2px; }
.cb-typing.show { display: inline-flex; }
.cb-typing span {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--cb-text-muted); opacity: .5;
  animation: cb-bounce 1.2s infinite ease-in-out;
}
.cb-typing span:nth-child(2) { animation-delay: .15s; }
.cb-typing span:nth-child(3) { animation-delay: .3s; }
@keyframes cb-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: .4; } 30% { transform: translateY(-5px); opacity: 1; } }

/* ---- input ---- */
.cb-input {
  display: flex; align-items: flex-end; gap: 8px;
  padding: 12px; border-top: 1px solid var(--cb-border); background: var(--cb-bg);
}
.cb-textarea {
  flex: 1 1 auto;
  resize: none;
  max-height: 120px;
  min-height: 24px;
  padding: 10px 12px;
  font-family: inherit; font-size: 14.5px; line-height: 1.4;
  color: var(--cb-text);
  background: var(--cb-surface);
  border: 1px solid transparent;
  border-radius: 14px;
  outline: none;
}
.cb-textarea::placeholder { color: var(--cb-text-muted); }
.cb-textarea:focus { border-color: var(--cb-primary); background: var(--cb-bg); }

.cb-send {
  flex: none;
  width: 42px; height: 42px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: var(--cb-primary); color: var(--cb-on-primary);
  transition: transform .12s ease, opacity .12s ease;
}
.cb-send:hover { transform: scale(1.06); }
.cb-send:disabled { opacity: .45; cursor: default; transform: none; }
.cb-send svg { width: 20px; height: 20px; }

/* ---- footer ---- */
.cb-footer { padding: 0 12px 10px; text-align: center; background: var(--cb-bg); }
.cb-footer-text { font-size: 11px; color: var(--cb-text-muted); }
.cb-footer-text:empty { display: none; }

@media (max-width: 480px) {
  :host { --cb-offset: 12px; }
  .cb-panel { --cb-width: calc(100vw - 24px); --cb-height: calc(100vh - 24px); }
}

@media (prefers-reduced-motion: reduce) {
  .cb-panel, .cb-launcher, .cb-send { transition: none; }
  .cb-typing span { animation: none; }
  .cb-messages { scroll-behavior: auto; }
}
`;
