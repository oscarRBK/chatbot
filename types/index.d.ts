// Type definitions for provider-chatbot

export type Role = 'system' | 'user' | 'assistant';

export interface Message {
  role: Role;
  content: string;
}

export interface SendOptions {
  /** Called for each streamed token. */
  onToken?: (chunk: string) => void;
  /** Aborts the in-flight request when the user cancels. */
  signal?: AbortSignal;
}

/** Canonical transport. Every provider/adapter normalizes to this. */
export type Adapter = (messages: Message[], options: SendOptions) => Promise<string>;

export type Position = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export type Provider =
  | 'openai'
  | 'openai-compatible'
  | 'azure'
  | 'azure-openai'
  | 'ollama'
  | 'anthropic'
  | 'claude';

export interface ThemeConfig {
  primary?: string;
  onPrimary?: string;
  background?: string;
  surface?: string;
  text?: string;
  textMuted?: string;
  border?: string;
  userBubble?: string;
  userText?: string;
  botBubble?: string;
  botText?: string;
  radius?: string;
  radiusSmall?: string;
  font?: string;
  fontFamily?: string;
  shadow?: string;
  launcherSize?: string;
  width?: string;
  height?: string;
  offset?: string;
  zIndex?: string | number;
}

export interface BaseConfig {
  /** Where to mount. Defaults to document.body. */
  target?: Element | string;
  position?: Position;
  title?: string;
  subtitle?: string;
  welcomeMessage?: string;
  placeholder?: string;
  footer?: string;
  launcherText?: string;
  logo?: string | null;
  mascot?: string | null;
  launcherIcon?: string | null;
  theme?: ThemeConfig;
  /** Prepended to every request as a `system` message. */
  systemPrompt?: string;
  startOpen?: boolean;
  keepLauncherOpen?: boolean;
  /** Persist conversation to localStorage. */
  persist?: boolean;
  storageKey?: string;

  // lifecycle callbacks (mirror the cb:* events)
  onOpen?: (detail: Record<string, never>, instance: ChatbotElement) => void;
  onClose?: (detail: Record<string, never>, instance: ChatbotElement) => void;
  onMessage?: (detail: { role: 'user'; content: string }, instance: ChatbotElement) => void;
  onResponse?: (detail: { role: 'assistant'; content: string }, instance: ChatbotElement) => void;
  onError?: (detail: { error: Error }, instance: ChatbotElement) => void;
}

/** Transport 1: fully custom send function. */
export interface CustomTransport {
  send: Adapter;
}

/** Transport 2: your own HTTP endpoint (recommended for production). */
export interface EndpointTransport {
  endpoint: string;
  stream?: boolean;
  method?: string;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  buildBody?: (messages: Message[]) => unknown;
  parseResponse?: (data: any) => string;
  parseChunk?: (data: any) => string;
}

/** Transport 3: a built-in provider preset (key visible in browser — prototypes only). */
export interface ProviderTransport {
  provider: Provider;
  apiKey?: string;
  baseURL?: string;
  model?: string;
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  version?: string;
  system?: string;
  headers?: Record<string, string>;
  extraBody?: Record<string, unknown>;
}

export type ChatbotConfig = BaseConfig &
  Partial<CustomTransport> &
  Partial<EndpointTransport> &
  Partial<ProviderTransport>;

export interface CbEventMap {
  'cb:open': CustomEvent<Record<string, never>>;
  'cb:close': CustomEvent<Record<string, never>>;
  'cb:message': CustomEvent<{ role: 'user'; content: string }>;
  'cb:response': CustomEvent<{ role: 'assistant'; content: string }>;
  'cb:error': CustomEvent<{ error: Error }>;
}

export declare class ChatbotElement extends HTMLElement {
  configure(config: ChatbotConfig): this;
  open(): void;
  close(): void;
  toggle(): void;
  sendMessage(text: string): Promise<void>;
  clear(): this;
  destroy(): void;
  on<K extends keyof CbEventMap>(event: K, handler: (e: CbEventMap[K]) => void): this;
  on(event: string, handler: (e: Event) => void): this;
  readonly messages: Message[];
}

export interface ChatbotStatic {
  version: string;
  tag: string;
  /** Register the <chat-bot> element (idempotent). */
  define(tag?: string): void;
  /** Create, configure and mount a widget. Returns the instance. */
  init(config?: ChatbotConfig): ChatbotElement;
  Element?: typeof ChatbotElement;
}

export declare const Chatbot: ChatbotStatic;
export declare function define(tag?: string): void;
export default Chatbot;

declare global {
  interface HTMLElementTagNameMap {
    'chat-bot': ChatbotElement;
  }
  interface Window {
    Chatbot: ChatbotStatic;
  }
}
