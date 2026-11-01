const MAX_RESPONSE_BYTES = 128_000;

export async function callModel({ fetch, baseUrl, apiKey, model, system, user, maxTokens = 4000 }) {
  if (!baseUrl.startsWith('https://')) throw new Error('Gateway base URL must use https');
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/v1/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!response.ok) throw new Error(`Review gateway returned status ${response.status}`);
  const raw = await response.text();
  if (Buffer.byteLength(raw) > MAX_RESPONSE_BYTES) throw new Error('Review gateway response too large');
  let body;
  try { body = JSON.parse(raw); } catch { throw new Error('Review gateway returned invalid JSON'); }
  if (body.stop_reason === 'max_tokens') throw new Error('Review gateway response was truncated');
  const text = (body.content ?? []).filter(part => part.type === 'text').map(part => part.text).join('');
  if (!text.trim()) throw new Error('Review gateway returned no text');
  return text;
}
