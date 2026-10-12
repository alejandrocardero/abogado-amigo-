/**
 * Cliente de integración con Ollama para descubrimiento de modelos,
 * pruebas de conectividad y generación de texto local.
 */

import { OllamaModel, OllamaModelStatus } from '../types';

export const DEFAULT_BASE_URL = 'http://localhost:11434';

const TIMEOUT_MS = 30_000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${TIMEOUT_MS / 1000}s`);
    }
    throw new Error(
      `Cannot reach Ollama at ${url}. Is the Ollama server running? (${
        error instanceof Error ? error.message : String(error)
      })`
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function listOllamaModels(baseUrl: string = DEFAULT_BASE_URL): Promise<OllamaModel[]> {
  const url = `${baseUrl}/api/tags`;

  let response: Response;
  try {
    response = await fetchWithTimeout(url);
  } catch (error) {
    throw new Error(
      `[Ollama] Failed to list models: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `[Ollama] Failed to list models: HTTP ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as { models?: OllamaModel[] };
  return data.models ?? [];
}

export async function testOllamaModel(
  modelName: string,
  baseUrl: string = DEFAULT_BASE_URL
): Promise<OllamaModelStatus> {
  const url = `${baseUrl}/api/chat`;
  const startedAt = performance.now();

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      }),
    });

    const latencyMs = Math.round(performance.now() - startedAt);

    if (!response.ok) {
      return {
        model: modelName,
        available: false,
        testedAt: new Date().toISOString(),
        latencyMs,
        error: `HTTP ${response.status} ${response.statusText}`,
      };
    }

    return {
      model: modelName,
      available: true,
      testedAt: new Date().toISOString(),
      latencyMs,
    };
  } catch (error) {
    return {
      model: modelName,
      available: false,
      testedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function generateWithOllama(
  modelName: string,
  prompt: string,
  baseUrl: string = DEFAULT_BASE_URL
): Promise<string> {
  const url = `${baseUrl}/api/generate`;

  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName, prompt, stream: false }),
    });
  } catch (error) {
    throw new Error(
      `[Ollama] Generation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `[Ollama] Generation failed: HTTP ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as { response?: string };
  return data.response ?? '';
}
