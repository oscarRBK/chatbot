// Entry for the IIFE/global build (<script src="chatbot.iife.js">).
// Exposes window.Chatbot with .init(), .define(), .Element.
import Chatbot, { ChatbotElement } from './index.js';

Chatbot.Element = ChatbotElement;

if (typeof window !== 'undefined') {
  window.Chatbot = Chatbot;
}

export default Chatbot;
