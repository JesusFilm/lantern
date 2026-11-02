const MAX_BYTES = 128_000;
const SEVERITIES = ['blocker', 'major', 'minor'];

export function parseVerdict(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_BYTES) throw new Error('Invalid verdict: missing or oversized response');
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  let value;
  try { value = JSON.parse(cleaned); } catch { throw new Error('Invalid verdict: response is not a single JSON object'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid verdict: expected an object');
  if (!['approve', 'request_changes'].includes(value.decision)) throw new Error('Invalid verdict: decision must be approve or request_changes');
  if (typeof value.summary !== 'string' || !value.summary.trim()) throw new Error('Invalid verdict: summary required');
  if (!Array.isArray(value.findings)) throw new Error('Invalid verdict: findings must be an array');
  const findings = value.findings.map(finding => {
    if (!finding || !SEVERITIES.includes(finding.severity) || typeof finding.message !== 'string' || !finding.message.trim()) throw new Error('Invalid verdict: finding needs severity and message');
    if (finding.file !== undefined && typeof finding.file !== 'string') throw new Error('Invalid verdict: finding file must be a string');
    if (finding.line !== undefined && !(Number.isInteger(finding.line) && finding.line > 0)) throw new Error('Invalid verdict: finding line must be a positive integer');
    return { severity: finding.severity, message: finding.message.trim(), file: finding.file, line: finding.line };
  });
  return { decision: value.decision, summary: value.summary.trim(), findings };
}

export function decide(verdict) {
  const blocking = verdict.findings.filter(finding => finding.severity !== 'minor');
  const pass = verdict.decision === 'approve' && blocking.length === 0;
  return { conclusion: pass ? 'success' : 'failure', blocking };
}
