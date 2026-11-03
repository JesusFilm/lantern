import { loadFileContext } from './context.mjs';

// Model requests name repository files only; they never become URLs or commands.
export function createContextReader(options) {
  const cache = new Map();
  let totalBytes = 0;
  return async paths => {
    if (!Array.isArray(paths) || !paths.length || paths.length > 8 || new Set(paths).size !== paths.length) throw new Error('Invalid context request: expected 1–8 distinct paths');
    for (const path of paths) {
      if (typeof path !== 'string' || path.length > 240 || !/^[A-Za-z0-9_.@/-]+$/.test(path) || path.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Invalid repository context path');
    }
    const result = [];
    for (const path of paths) {
      if (!cache.has(path)) {
        if (cache.size >= 16) throw new Error('Context retrieval exceeds 16 files');
        cache.set(path, (async () => {
          const [file] = await loadFileContext({ ...options, files: [{ filename: path, status: 'modified' }] });
          if (!file || file.omitted || file.clipped) throw new Error(`Requested context unavailable or incomplete: ${path}`);
          totalBytes += Buffer.byteLength(file.text);
          if (totalBytes > 200_000) throw new Error('Context retrieval exceeds 200000 bytes');
          return file;
        })());
      }
      result.push(await cache.get(path));
    }
    return result;
  };
}
