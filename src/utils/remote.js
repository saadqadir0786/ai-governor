/**
 * Remote registry fetcher with offline fallback
 */

import { DEFAULT_MODEL_REGISTRY } from '../matrix.js';

const REMOTE_REGISTRY_URL = process.env.AI_GOVERNOR_REMOTE_URL || 'https://raw.githubusercontent.com/alishba/ai-governor-registry/main/models.json';

/**
 * Attempt to fetch the latest model capabilities matrix from remote source
 * Falls back to local bundled registry if network fails or times out.
 */
export async function getModelRegistry(timeoutMs = 1500) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(REMOTE_REGISTRY_URL, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return { registry: data, source: 'remote' };
    }
  } catch (err) {
    // Offline or unreachable - gracefully fall back
  }

  return { registry: DEFAULT_MODEL_REGISTRY, source: 'local' };
}
