import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { HealthResponse } from '../shared/health.js';

function App() {
  const [message, setMessage] = useState('Checking database…');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setMessage('Checking database…');
    async function checkHealth() {
      try {
        const response = await fetch('/health', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const health: HealthResponse = await response.json();
        if (!controller.signal.aborted) {
          setMessage(response.ok && health.status === 'ok'
            ? 'Database: OK (HTTP 200)'
            : `Database: unavailable (HTTP ${response.status})`);
        }
      } catch {
        if (!controller.signal.aborted) setMessage('Health check could not be reached.');
      }
    }
    void checkHealth();
    return () => controller.abort();
  }, [attempt]);

  return (
    <main>
      <h1>Lantern</h1>
      <p>Website: reachable</p>
      <p role="status">{message}</p>
      <button type="button" onClick={() => setAttempt((value) => value + 1)}>Check again</button>
      <p><a href="/health">View health response</a></p>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('The page is missing its root element.');
createRoot(root).render(<StrictMode><App /></StrictMode>);
