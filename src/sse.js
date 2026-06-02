// Minimal Server-Sent-Events / streaming-body reader.
// Reads a fetch() Response body, parses `data:` lines, and calls onData with
// each event payload (parsed as JSON when possible, otherwise the raw string).
// Stops cleanly on `[DONE]`. Works for OpenAI, Anthropic, and generic SSE.

export async function readSSE(response, onData) {
  if (!response.body || !response.body.getReader) {
    // No streaming support in this environment: fall back to whole text.
    const text = await response.text();
    if (text) onData(text);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let dataLines = [];

  const flush = () => {
    if (!dataLines.length) return;
    const payload = dataLines.join('\n');
    dataLines = [];
    if (payload === '[DONE]') return;
    let parsed = payload;
    try { parsed = JSON.parse(payload); } catch { /* keep raw string */ }
    onData(parsed);
  };

  const handleLine = (rawLine) => {
    let line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line === '') { flush(); return; }          // event boundary
    if (line.startsWith(':')) return;              // comment / keep-alive
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''));
    }
    // event:, id:, retry: are ignored — payload type is inferred from JSON.
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      handleLine(buffer.slice(0, nl));
      buffer = buffer.slice(nl + 1);
    }
  }
  // Trailing data with no final newline.
  if (buffer.length) handleLine(buffer);
  flush();
}
