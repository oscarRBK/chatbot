import { ChatbotElement } from './chatbot-element.js';

const TAG = 'chat-bot';

/** Register the <chat-bot> custom element (idempotent, SSR-safe). */
export function define(tag = TAG) {
  if (typeof customElements !== 'undefined' && !customElements.get(tag)) {
    customElements.define(tag, ChatbotElement);
  }
}

function resolveTarget(target) {
  if (!target) return document.body;
  if (typeof target === 'string') return document.querySelector(target) || document.body;
  if (target instanceof Element) return target;
  return document.body;
}

export const Chatbot = {
  version: '0.1.0',
  tag: TAG,
  define,

  /**
   * Create, configure and mount a widget instance.
   * @returns the <chat-bot> element, which exposes
   *          open/close/toggle/sendMessage/clear/destroy/on().
   */
  init(config = {}) {
    define();
    const el = document.createElement(TAG);
    el.configure(config); // configure before connecting -> single build pass
    resolveTarget(config.target).appendChild(el);
    return el;
  },
};

// Auto-register so declarative <chat-bot ...> works without calling init().
define();

export { ChatbotElement };
export default Chatbot;
