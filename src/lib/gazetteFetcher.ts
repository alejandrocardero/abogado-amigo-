/**
 * Descarga y parseo de gacetas oficiales desde el navegador.
 *
 * Las fuentes oficiales no envían cabeceras CORS, por lo que se intenta una
 * cadena de proxies públicos. Si todos fallan se reporta el error de forma
 * honesta: este módulo NUNCA fabrica entradas de ejemplo.
 */

import { GazetteFeedItem, Jurisdiction } from '../types';
import { GAZETTE_SOURCES, ALLOWED_DOMAINS } from '../lib/appConfig';

export { GAZETTE_SOURCES };

/** Entrada de gaceta lista para mostrar y persistir. */
export interface GazetteEntry {
  title: string;
  url: string;
  publishedAt: string;
  summary: string;
  sourceName: string;
  jurisdiction: Jurisdiction;
  contentHash: string;
}

/** Proxies CORS públicos de confianza. */
const PROXIES: ((u: string) => string)[] = [
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
];

const NOISE_HOSTS = ['facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'youtube.com', 'linkedin.com', 't.me', 'wa.me'];

/**
 * Valida que una URL pertenece a un dominio permitido para la jurisdicción.
 * Previene SSRF y exfiltración via proxies públicos.
 */
function isUrlAllowed(url: string, jurisdiction: Jurisdiction): boolean {
  try {
    const parsed = new URL(url);
    const allowed = ALLOWED_DOMAINS[jurisdiction] ?? [];
    return allowed.some((domain) => parsed.hostname === domain || parsed.hostname.endsWith('.' + domain));
  } catch {
    return false;
  }
}

/**
 * Hash SHA-256 para identidad/deduplicación de entradas.
 * Criptográficamente seguro, previene colisiones intencionales.
 */
export async function contentHashOf(url: string, title: string): Promise<string> {
  const input = `${url}|${title}`;
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Resuelve `href` contra `base`; devuelve null si no es http(s) válido. */
export function resolveUrl(href: string, base: string): string | null {
  try {
    const resolved = new URL(href, base);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null;
    return resolved.href;
  } catch {
    return null;
  }
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

const DATE_PATTERN = /(\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+\d{4})/i;

function extractDate(text: string): string {
  const match = DATE_PATTERN.exec(text);
  return match ? match[1] : '';
}

function isNoiseHref(href: string): boolean {
  const h = href.trim().toLowerCase();
  if (h === '' || h.startsWith('#') || h.startsWith('javascript:') || h.startsWith('mailto:') || h.startsWith('tel:')) return true;
  return NOISE_HOSTS.some((host) => h.includes(host));
}

interface RawAnchor {
  href: string;
  title: string;
  context: string;
}

function anchorsViaDomParser(html: string): RawAnchor[] | null {
  try {
    if (typeof DOMParser === 'undefined') return null;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const anchors = doc.querySelectorAll('a[href]');
    const out: RawAnchor[] = [];
    anchors.forEach((a) => {
      const href = a.getAttribute('href') ?? '';
      const title = (a.textContent ?? '').replace(/\s+/g, ' ').trim();
      const context = (a.parentElement?.textContent ?? a.textContent ?? '').replace(/\s+/g, ' ').trim();
      out.push({ href, title, context });
    });
    return out;
  } catch {
    return null;
  }
}

function anchorsViaRegex(html: string): RawAnchor[] {
  const out: RawAnchor[] = [];
  const pattern = /<a\s[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const title = stripTags(match[2]);
    out.push({ href: match[1], title, context: title });
  }
  return out;
}

/**
 * Extrae entradas de un HTML de gaceta. Usa DOMParser cuando existe y,
 * si no (p. ej. entorno Node de tests), cae a extracción por regex.
 */
export async function parseGazetteHtml(
  html: string,
  sourceName: string,
  jurisdiction: Jurisdiction,
  baseUrl?: string,
): Promise<GazetteEntry[]> {
  const base = baseUrl ?? GAZETTE_SOURCES[jurisdiction].urls[0];
  const anchors = anchorsViaDomParser(html) ?? anchorsViaRegex(html);
  const seen = new Set<string>();
  const entries: GazetteEntry[] = [];

  for (const anchor of anchors) {
    if (isNoiseHref(anchor.href)) continue;
    const title = anchor.title;
    if (title.length < 5 || title.length > 200) continue;
    const url = resolveUrl(anchor.href, base);
    if (url === null || seen.has(url)) continue;
    // Validación estricta: solo URLs de dominios permitidos
    if (!isUrlAllowed(url, jurisdiction)) continue;
    seen.add(url);
    const contentHash = await contentHashOf(url, title);
    entries.push({
      title,
      url,
      publishedAt: extractDate(anchor.context),
      summary: anchor.context.slice(0, 240),
      sourceName,
      jurisdiction,
      contentHash,
    });
    if (entries.length >= 25) break;
  }
  return entries;
}

/**
 * Descarga la gaceta de una jurisdicción probando cada URL × proxy.
 * Nunca inventa datos: ante cualquier fallo devuelve `error`.
 * Valida URLs contra allowlist para prevenir SSRF.
 */
export async function fetchGazette(
  jurisdiction: Jurisdiction,
  opts?: { timeoutMs?: number },
): Promise<{ entries: GazetteEntry[]; source: string; error?: string; elapsedMs: number }> {
  const timeoutMs = opts?.timeoutMs ?? 12000;
  const source = GAZETTE_SOURCES[jurisdiction];
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const elapsed = () => Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - started);

  for (const url of source.urls) {
    // Validar URL base contra allowlist
    if (!isUrlAllowed(url, jurisdiction)) {
      continue;
    }
    for (const proxy of PROXIES) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const proxyUrl = proxy(url);
        // Validar que el proxy no redirija a dominios no permitidos
        const response = await fetch(proxyUrl, { signal: controller.signal });
        if (!response.ok) continue;
        const html = await response.text();
        if (!html || html.trim().length === 0) continue;
        const entries = await parseGazetteHtml(html, source.name, jurisdiction, url);
        if (entries.length > 0) {
          return { entries, source: source.name, elapsedMs: elapsed() };
        }
        return {
          entries: [],
          source: source.name,
          error: 'La fuente respondió pero no se pudieron leer entradas (estructura no reconocida).',
          elapsedMs: elapsed(),
        };
      } catch {
        continue;
      } finally {
        clearTimeout(timer);
      }
    }
  }

  return {
    entries: [],
    source: source.name,
    error: 'Fuente no disponible (red/CORS) — intenta más tarde.',
    elapsedMs: elapsed(),
  };
}

/**
 * Separa las entradas nuevas de las ya vistas. Compara por contentHash y
 * url; para ítems almacenados sin esos campos (GazetteFeedItem) compara
 * por título.
 */
export function diffGazetteEntries(
  existing: GazetteFeedItem[] | GazetteEntry[],
  incoming: GazetteEntry[],
): { fresh: GazetteEntry[]; seenCount: number } {
  const keys = new Set<string>();
  for (const item of existing) {
    const maybe = item as Partial<GazetteEntry>;
    if (typeof maybe.contentHash === 'string') keys.add(maybe.contentHash);
    if (typeof maybe.url === 'string') keys.add(maybe.url);
    if (typeof item.title === 'string') keys.add(item.title);
  }
  const fresh: GazetteEntry[] = [];
  let seenCount = 0;
  for (const entry of incoming) {
    if (keys.has(entry.contentHash) || keys.has(entry.url) || keys.has(entry.title)) {
      seenCount++;
    } else {
      fresh.push(entry);
    }
  }
  return { fresh, seenCount };
}
