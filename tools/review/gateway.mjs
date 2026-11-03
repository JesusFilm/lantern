const MAX_RESPONSE_BYTES = 128_000;

export async function callModel({ timeoutMs = 60_000, ...options }) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      requestModel({ ...options, signal: controller.signal }),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Review gateway timed out')); }, timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

async function requestModel({ fetch, baseUrl, apiKey, model, system, user, maxTokens = 4000, signal, onResponse = () => {} }) {
  if (!baseUrl.startsWith('https://')) throw new Error('Gateway base URL must use https');
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/v1/messages`, {
    method: 'POST', signal,
    headers: { Authorization: `Bearer ${apiKey}`, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!response.ok) throw new Error(`Review gateway returned status ${response.status}`);
  const raw = await response.text();
  if (Buffer.byteLength(raw) > MAX_RESPONSE_BYTES) throw new Error('Review gateway response too large');
  let body;
  try { body = JSON.parse(raw); } catch { throw new Error('Review gateway returned invalid JSON'); }
  onResponse({
    stopReason: ['end_turn', 'max_tokens', 'stop_sequence', 'tool_use', 'pause_turn', 'refusal'].includes(body.stop_reason) ? body.stop_reason : 'other',
    textBlocks: Array.isArray(body.content) ? body.content.filter(part => part.type === 'text').length : 0,
    ...(Number.isSafeInteger(body.usage?.output_tokens) && body.usage.output_tokens >= 0 ? { outputTokens: body.usage.output_tokens } : {}),
  });
  if (body.stop_reason === 'max_tokens') throw new Error('Review gateway response was truncated');
  const text = (body.content ?? []).filter(part => part.type === 'text').map(part => part.text).join('');
  if (!text.trim()) throw new Error('Review gateway returned no text');
  return text;
}
