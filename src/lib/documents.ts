/**
 * Indexación de documentos legales: extracción de texto, chunking,
 * recuperación léxica y detección de referencias a leyes.
 *
 * Todo el procesamiento es local (sin red ni IA): los archivos se parsean en
 * el navegador, se dividen en fragmentos y se indexan para búsqueda léxica.
 */

import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

/** Fragmento de texto indexable con su posición y estimación de tokens. */
export interface TextChunk {
  id: string;
  index: number;
  content: string;
  tokens: number;
}

/** Resultado de recuperación: chunk junto a su puntaje de relevancia. */
export interface RetrievalResult {
  chunk: TextChunk;
  score: number;
}

/** Referencia a una ley detectada en el texto. */
export interface DetectedLawReference {
  law: string;
  article?: string;
  snippet: string;
}

/**
 * Extrae el texto plano de un archivo según su extensión.
 * Soporta PDF, DOCX/DOC y formatos de texto plano.
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const ext = name.slice(name.lastIndexOf('.'));
  let text: string;

  if (ext === '.pdf') {
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const parts: string[] = [];
    for (let page = 1; page <= pdf.numPages; page++) {
      const content = await (await pdf.getPage(page)).getTextContent();
      parts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
    }
    text = parts.join('\n');
    if (text.trim().length === 0) {
      throw new Error('El PDF no contiene texto extraíble (posiblemente escaneado)');
    }
  } else if (ext === '.docx' || ext === '.doc') {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    text = result.value;
  } else {
    text = await file.text();
  }

  if (text.trim().length === 0) {
    throw new Error('No se pudo extraer texto del archivo');
  }
  return text;
}

/**
 * Divide un texto en fragmentos conscientes de párrafos y oraciones.
 * Cada chunk respeta `maxChars` y comparte hasta `overlap` caracteres
 * con el anterior. Devuelve [] para texto vacío.
 */
export function chunkText(text: string, maxChars = 1200, overlap = 200): TextChunk[] {
  if (text.trim().length === 0) return [];

  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0);
  const pieces: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChars) {
      pieces.push(paragraph);
      continue;
    }
    const sentences = paragraph.split(/(?<=[.!?])\s+/);
    let buffer = '';
    for (const sentence of sentences) {
      if (sentence.length > maxChars) {
        if (buffer) {
          pieces.push(buffer);
          buffer = '';
        }
        for (let i = 0; i < sentence.length; i += maxChars) {
          pieces.push(sentence.slice(i, i + maxChars));
        }
      } else if (buffer.length + sentence.length + 1 > maxChars) {
        pieces.push(buffer);
        buffer = sentence;
      } else {
        buffer = buffer ? `${buffer} ${sentence}` : sentence;
      }
    }
    if (buffer) pieces.push(buffer);
  }

  const chunks: string[] = [];
  let current = '';
  for (const piece of pieces) {
    const candidate = current ? `${current}\n\n${piece}` : piece;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      current = piece;
    }
  }
  if (current) chunks.push(current);

  const withOverlap: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (i === 0 || overlap <= 0) {
      withOverlap.push(chunks[i]);
      continue;
    }
    const tail = chunks[i - 1].slice(-overlap);
    const merged = `${tail}${chunks[i]}`;
    withOverlap.push(merged.length <= maxChars ? merged : merged.slice(merged.length - maxChars));
  }

  return withOverlap.map((content, index) => ({
    id: `chunk-${String(index).padStart(3, '0')}`,
    index,
    content,
    tokens: Math.ceil(content.length / 4),
  }));
}

/**
 * Normaliza texto para búsqueda: minúsculas, sin diacríticos y
 * espacios colapsados.
 */
export function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(s: string): string[] {
  return normalizeForSearch(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 3);
}

/**
 * Recupera los k chunks más relevantes para una consulta usando
 * similitud coseno de frecuencias de término (determinista).
 */
export function retrieveTopK(query: string, chunks: TextChunk[], k = 3): RetrievalResult[] {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  const queryCounts = new Map<string, number>();
  for (const term of queryTerms) queryCounts.set(term, (queryCounts.get(term) ?? 0) + 1);

  const results: RetrievalResult[] = [];
  for (const chunk of chunks) {
    const chunkTokens = tokenize(chunk.content);
    if (chunkTokens.length === 0) continue;
    const chunkCounts = new Map<string, number>();
    for (const token of chunkTokens) chunkCounts.set(token, (chunkCounts.get(token) ?? 0) + 1);

    let dot = 0;
    let queryNorm = 0;
    for (const [term, qCount] of queryCounts) {
      queryNorm += qCount * qCount;
      const cCount = chunkCounts.get(term) ?? 0;
      dot += qCount * cCount;
    }
    let chunkNorm = 0;
    for (const cCount of chunkCounts.values()) {
      chunkNorm += cCount * cCount;
    }
    if (dot === 0 || queryNorm === 0 || chunkNorm === 0) continue;
    const score = dot / (Math.sqrt(queryNorm) * Math.sqrt(chunkNorm));
    if (score > 0) results.push({ chunk, score });
  }

  return results
    .sort((a, b) => b.score - a.score || a.chunk.index - b.chunk.index)
    .slice(0, k);
}

const LAW_PATTERN =
  /\b(Decreto-Ley|Decreto|Ley|Código|Reglamento|Resolución)\s+(?:N(?:ú|u)?mero\.?\s+|No\.?\s+)?(\d+[\dA-Za-z-]*|[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]*(?:\s+(?:de|del|la|las|el|los|y|para|en|sobre|con)\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]*|\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]*){0,5})/g;

const ARTICLE_PATTERN = /Art(?:ículo)?\.?\s*(\d+)/;

/**
 * Detecta referencias a leyes (Ley, Decreto, Código, etc.) y sus
 * artículos mediante expresiones regulares. Sin IA.
 */
export function detectLawReferences(text: string): DetectedLawReference[] {
  const seen = new Set<string>();
  const results: DetectedLawReference[] = [];

  for (const match of text.matchAll(LAW_PATTERN)) {
    const law = `${match[1]} ${match[2]}`.replace(/\s+/g, ' ').trim();
    const start = match.index ?? 0;
    const window = text.slice(start, start + match[0].length + 120);
    const articleMatch = ARTICLE_PATTERN.exec(window.slice(match[0].length));
    const article = articleMatch ? articleMatch[1] : undefined;

    const key = `${law}|${article ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const snippetStart = Math.max(0, start - 20);
    const snippet = text.slice(snippetStart, snippetStart + 80).replace(/\s+/g, ' ').trim();
    results.push({ law, article, snippet });
    if (results.length >= 50) break;
  }

  return results;
}
