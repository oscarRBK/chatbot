import { STYLES } from './styles.js';
import { ICONS } from './icons.js';
import { mdLite } from './md.js';
import { resolveAdapter } from './adapters.js';

const TEMPLATE = `
<button class="cb-launcher" type="button" aria-haspopup="dialog" aria-expanded="false" aria-label="Open chat">
  <span class="cb-icon cb-icon-open"></span>
  <span class="cb-icon cb-icon-close"></span>
  <span class="cb-launcher-text"></span>
</button>
<section class="cb-panel" role="dialog" aria-label="Chat" aria-modal="false">
  <header class="cb-header">
    <div class="cb-brand">
      <span class="cb-logo"></span>
      <div class="cb-titles">
        <span class="cb-title"></span>
        <span class="cb-subtitle"></span>
      </div>
    </div>
    <button class="cb-close" type="button" aria-label="Close chat"></button>
  </header>
  <div class="cb-messages" role="log" aria-live="polite"></div>
  <form class="cb-input">
    <textarea class="cb-textarea" rows="1" aria-label="Message"></textarea>
    <button class="cb-send" type="submit" aria-label="Send message"></button>
  </form>
  <div class="cb-footer"><span class="cb-footer-text"></span></div>
</section>
`;

function safeUrl(u) {
  return String(u).replace(/["'<>]/g, encodeURIComponent);
}

export class ChatbotElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._cfg = {};
    this._messages = [];
    this._open = false;
    this._busy = false;
    this._built = false;
    this._configured = false;
    this._historyLoaded = false;
    this._abort = null;
    this._typingRow = null;
    this._el = {};
  }

  // ------------------------------------------------------------------ lifecycle
  connectedCallback() {
    if (!this._configured) {
      // Declarative usage: <chat-bot endpoint="..." title="...">
      this.configure(this._configFromAttributes());
      return;
    }
    this._build();
    this._ensureHistory();
    this._applyConfig();
    if (this._cfg.startOpen) this.open();
  }

  disconnectedCallback() {
    if (this._abort) this._abort.abort();
  }

  // -------------------------------------------------------------------- public
  /** Set or update configuration. Safe to call multiple times. */
  configure(cfg = {}) {
    const base = this._defaults();
    this._cfg = {
      ...base,
      ...this._cfg,
      ...cfg,
      theme: { ...(this._cfg.theme || {}), ...(cfg.theme || {}) },
    };
    this._configured = true;
    try {
      this._adapter = resolveAdapter(this._cfg);
      this._adapterError = null;
    } catch (e) {
      this._adapter = null;
      this._adapterError = e;
    }
    if (this.isConnected) {
      this._build();
      this._ensureHistory();
      this._applyConfig();
      if (this._cfg.startOpen && !this._open) this.open();
    }
    return this;
  }

  open() {
    if (!this._built) this._build();
    this._open = true;
    this.setAttribute('data-open', '');
    this._el.launcher.setAttribute('aria-expanded', 'true');
    this._scrollToBottom();
    setTimeout(() => this._focusInput(), 60);
    this._emit('open');
  }

  close() {
    this._open = false;
    this.removeAttribute('data-open');
    if (this._el.launcher) {
      this._el.launcher.setAttribute('aria-expanded', 'false');
      this._el.launcher.focus({ preventScroll: true });
    }
    this._emit('close');
  }

  toggle() {
    this._open ? this.close() : this.open();
  }

  /** Programmatically send a message as the user. */
  sendMessage(text) {
    return this._send(text);
  }

  /** Wipe the conversation (and persisted history); re-seeds the welcome message. */
  clear() {
    this._messages = [];
    this._persist();
    if (this._el.messages) this._el.messages.innerHTML = '';
    if (this._cfg.welcomeMessage) {
      this._messages.push({ role: 'assistant', content: this._cfg.welcomeMessage });
      this._renderAll();
    }
    return this;
  }

  /** Remove the widget from the page. */
  destroy() {
    if (this._abort) this._abort.abort();
    this.remove();
  }

  /** Sugar over addEventListener for cb:* events. Returns this for chaining. */
  on(event, handler) {
    this.addEventListener(event.startsWith('cb:') ? event : 'cb:' + event, handler);
    return this;
  }

  get messages() {
    return this._messages.slice();
  }

  // ------------------------------------------------------------------ internals
  _defaults() {
    return {
      target: undefined,
      position: 'bottom-right',
      title: 'Chat',
      subtitle: '',
      launcherText: '',
      logo: null,
      mascot: null,
      launcherIcon: null,
      welcomeMessage: '',
      placeholder: 'Type a message…',
      footer: '',
      systemPrompt: '',
      startOpen: false,
      keepLauncherOpen: false,
      persist: false,
      storageKey: 'provider-chatbot:history',
      theme: {},
    };
  }

  _build() {
    if (this._built) return;
    const root = this.shadowRoot;
    root.innerHTML = `<style>${STYLES}</style>${TEMPLATE}`;

    this._el = {
      launcher: root.querySelector('.cb-launcher'),
      iconOpen: root.querySelector('.cb-icon-open'),
      iconClose: root.querySelector('.cb-icon-close'),
      launcherText: root.querySelector('.cb-launcher-text'),
      panel: root.querySelector('.cb-panel'),
      logo: root.querySelector('.cb-logo'),
      title: root.querySelector('.cb-title'),
      subtitle: root.querySelector('.cb-subtitle'),
      close: root.querySelector('.cb-close'),
      messages: root.querySelector('.cb-messages'),
      form: root.querySelector('.cb-input'),
      textarea: root.querySelector('.cb-textarea'),
      send: root.querySelector('.cb-send'),
      footer: root.querySelector('.cb-footer-text'),
    };

    this._el.close.innerHTML = ICONS.close;
    this._el.send.innerHTML = ICONS.send;

    // events
    this._el.launcher.addEventListener('click', () => this.toggle());
    this._el.close.addEventListener('click', () => this.close());
    this._el.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this._submit();
    });
    this._el.textarea.addEventListener('input', () => {
      this._autosize();
      this._updateSendEnabled();
    });
    this._el.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        if (!this._busy) this._submit();
      }
    });
    this._el.panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });

    this._built = true;
  }

  _applyConfig() {
    const c = this._cfg;
    this.setAttribute('data-position', c.position || 'bottom-right');
    this.toggleAttribute('data-keep-launcher', !!c.keepLauncherOpen);
    this._applyTheme(c.theme);

    this._el.title.textContent = c.title || '';
    this._el.subtitle.textContent = c.subtitle || '';
    this._el.footer.textContent = c.footer || '';
    this._el.textarea.placeholder = c.placeholder || '';
    this._el.launcherText.textContent = c.launcherText || '';
    this._el.launcher.setAttribute('aria-label', c.title ? `Open ${c.title}` : 'Open chat');

    this._renderLauncherIcon();
    this._renderLogo();

    // Seed welcome message once when there is no history.
    if (!this._messages.length && c.welcomeMessage) {
      this._messages.push({ role: 'assistant', content: c.welcomeMessage });
    }
    this._renderAll();
    this._updateSendEnabled();
  }

  _applyTheme(theme = {}) {
    const map = {
      primary: '--cb-primary',
      onPrimary: '--cb-on-primary',
      background: '--cb-bg',
      surface: '--cb-surface',
      text: '--cb-text',
      textMuted: '--cb-text-muted',
      border: '--cb-border',
      userBubble: '--cb-user-bubble',
      userText: '--cb-user-text',
      botBubble: '--cb-bot-bubble',
      botText: '--cb-bot-text',
      radius: '--cb-radius',
      radiusSmall: '--cb-radius-sm',
      font: '--cb-font',
      fontFamily: '--cb-font',
      shadow: '--cb-shadow',
      launcherSize: '--cb-launcher-size',
      width: '--cb-width',
      height: '--cb-height',
      offset: '--cb-offset',
      zIndex: '--cb-z',
    };
    for (const [key, val] of Object.entries(theme)) {
      const name = map[key];
      if (name && val != null) this.style.setProperty(name, String(val));
    }
  }

  _renderLauncherIcon() {
    const c = this._cfg;
    const img = c.launcherIcon || c.mascot;
    this._el.iconOpen.innerHTML = img
      ? `<img class="cb-launcher-img" src="${safeUrl(img)}" alt="">`
      : ICONS.chat;
    this._el.iconClose.innerHTML = ICONS.close;
  }

  _renderLogo() {
    const c = this._cfg;
    const img = c.logo || c.mascot;
    this._el.logo.innerHTML = img ? `<img src="${safeUrl(img)}" alt="">` : ICONS.bot;
  }

  _avatarHTML() {
    return this._cfg.mascot ? `<img src="${safeUrl(this._cfg.mascot)}" alt="">` : ICONS.bot;
  }

  _renderAll() {
    const list = this._el.messages;
    list.innerHTML = '';
    for (const m of this._messages) this._appendRow(m.role, m.content);
    this._scrollToBottom();
  }

  _appendRow(role, content) {
    const cssRole = role === 'user' ? 'user' : role === 'error' ? 'bot error' : 'bot';
    const row = document.createElement('div');
    row.className = 'cb-row ' + cssRole;
    if (role !== 'user') {
      const av = document.createElement('span');
      av.className = 'cb-avatar';
      av.innerHTML = this._avatarHTML();
      row.appendChild(av);
    }
    const bubble = document.createElement('div');
    bubble.className = 'cb-bubble';
    bubble.innerHTML = mdLite(content);
    row.appendChild(bubble);
    this._el.messages.appendChild(row);
    this._scrollToBottom();
    return bubble;
  }

  _showTyping() {
    if (this._typingRow) return;
    const row = document.createElement('div');
    row.className = 'cb-row bot';
    const av = document.createElement('span');
    av.className = 'cb-avatar';
    av.innerHTML = this._avatarHTML();
    const t = document.createElement('div');
    t.className = 'cb-typing show';
    t.innerHTML = '<span></span><span></span><span></span>';
    row.append(av, t);
    this._el.messages.appendChild(row);
    this._typingRow = row;
    this._scrollToBottom();
  }

  _hideTyping() {
    if (this._typingRow) {
      this._typingRow.remove();
      this._typingRow = null;
    }
  }

  _submit() {
    if (this._busy) {
      if (this._abort) this._abort.abort();
      return;
    }
    this._send(this._el.textarea.value);
  }

  async _send(text) {
    text = (text || '').trim();
    if (!text || this._busy) return;

    if (this._adapterError || !this._adapter) {
      this._appendRow('error', (this._adapterError && this._adapterError.message) || '[chatbot] No transport configured.');
      return;
    }

    this._addMessage('user', text);
    this._emit('message', { role: 'user', content: text });
    this._clearInput();

    this._busy = true;
    this._setBusyUI(true);
    this._showTyping();
    this._abort = new AbortController();

    let bubble = null;
    let acc = '';
    const onToken = (chunk) => {
      if (!bubble) {
        this._hideTyping();
        bubble = this._appendRow('assistant', '');
      }
      acc += chunk;
      bubble.innerHTML = mdLite(acc);
      this._scrollToBottom();
    };

    try {
      const reply = await this._adapter(this._apiMessages(), {
        onToken,
        signal: this._abort.signal,
      });
      this._hideTyping();

      let finalText = acc;
      if (typeof reply === 'string' && reply.length > acc.length) finalText = reply;
      finalText = (finalText || '').trim();

      if (bubble) {
        if (finalText !== acc) bubble.innerHTML = mdLite(finalText);
      } else {
        this._appendRow('assistant', finalText || '…');
      }
      this._messages.push({ role: 'assistant', content: finalText });
      this._persist();
      this._emit('response', { role: 'assistant', content: finalText });
    } catch (err) {
      this._hideTyping();
      if (err && err.name === 'AbortError') {
        if (acc) {
          this._messages.push({ role: 'assistant', content: acc });
          this._persist();
        }
      } else {
        this._appendRow('error', (err && err.message) || 'Something went wrong.');
        this._emit('error', { error: err });
      }
    } finally {
      this._busy = false;
      this._setBusyUI(false);
      this._abort = null;
      this._focusInput();
    }
  }

  _addMessage(role, content) {
    this._messages.push({ role, content });
    this._appendRow(role, content);
    this._persist();
  }

  _apiMessages() {
    const msgs = this._messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }));
    if (this._cfg.systemPrompt) msgs.unshift({ role: 'system', content: this._cfg.systemPrompt });
    return msgs;
  }

  _setBusyUI(busy) {
    const s = this._el.send;
    if (busy) {
      s.innerHTML = ICONS.close;
      s.setAttribute('aria-label', 'Stop');
      s.disabled = false;
    } else {
      s.innerHTML = ICONS.send;
      s.setAttribute('aria-label', 'Send message');
      this._updateSendEnabled();
    }
  }

  _updateSendEnabled() {
    if (this._busy) return;
    this._el.send.disabled = !this._el.textarea.value.trim();
  }

  _autosize() {
    const ta = this._el.textarea;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }

  _clearInput() {
    this._el.textarea.value = '';
    this._autosize();
    this._updateSendEnabled();
  }

  _focusInput() {
    if (this._open && this._el.textarea) this._el.textarea.focus({ preventScroll: true });
  }

  _scrollToBottom() {
    const list = this._el.messages;
    if (!list) return;
    requestAnimationFrame(() => {
      list.scrollTop = list.scrollHeight;
    });
  }

  _ensureHistory() {
    if (this._historyLoaded) return;
    this._historyLoaded = true;
    if (!this._cfg.persist) return;
    try {
      const raw = localStorage.getItem(this._cfg.storageKey);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) this._messages = arr;
      }
    } catch {
      /* ignore storage errors */
    }
  }

  _persist() {
    if (!this._cfg.persist) return;
    try {
      localStorage.setItem(this._cfg.storageKey, JSON.stringify(this._messages));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }

  _emit(name, detail = {}) {
    this.dispatchEvent(new CustomEvent('cb:' + name, { detail, bubbles: true, composed: true }));
    const key = 'on' + name.charAt(0).toUpperCase() + name.slice(1);
    const cb = this._cfg[key];
    if (typeof cb === 'function') {
      try {
        cb(detail, this);
      } catch (e) {
        console.error('[chatbot] callback error:', e);
      }
    }
  }

  _configFromAttributes() {
    const a = (n) => this.getAttribute(n);
    const bool = (n) => this.hasAttribute(n) && a(n) !== 'false';
    const cfg = {};
    const text = {
      title: 'title',
      subtitle: 'subtitle',
      placeholder: 'placeholder',
      welcomeMessage: 'welcome',
      launcherText: 'launcher-text',
      footer: 'footer',
      systemPrompt: 'system-prompt',
      logo: 'logo',
      mascot: 'mascot',
      launcherIcon: 'launcher-icon',
      position: 'position',
      storageKey: 'storage-key',
      provider: 'provider',
      endpoint: 'endpoint',
      model: 'model',
      baseURL: 'base-url',
      apiKey: 'api-key',
    };
    for (const [k, attr] of Object.entries(text)) {
      if (this.hasAttribute(attr)) cfg[k] = a(attr);
    }
    if (this.hasAttribute('stream')) cfg.stream = bool('stream');
    if (bool('persist')) cfg.persist = true;
    if (bool('start-open')) cfg.startOpen = true;
    if (bool('keep-launcher')) cfg.keepLauncherOpen = true;

    const theme = {};
    if (this.hasAttribute('primary-color')) theme.primary = a('primary-color');
    if (this.hasAttribute('on-primary-color')) theme.onPrimary = a('on-primary-color');
    if (Object.keys(theme).length) cfg.theme = theme;
    return cfg;
  }
}
