import { describe, expect, it } from 'vitest';
import {
  chunkText,
  detectLawReferences,
  normalizeForSearch,
  retrieveTopK,
  TextChunk,
} from './documents';

describe('chunkText', () => {
  it('devuelve [] para texto vacío o solo espacios', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\n  ')).toEqual([]);
  });

  it('cada chunk respeta el límite maxChars', () => {
    const paragraph = 'Esta es una oración de prueba. '.repeat(40);
    const text = Array.from({ length: 6 }, () => paragraph).join('\n\n');
    const chunks = chunkText(text, 500, 50);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(500);
    }
  });

  it('los chunks consecutivos comparten solapamiento', () => {
    const paragraph = 'Palabra '.repeat(200).trim();
    const text = `${paragraph}\n\n${paragraph}\n\n${paragraph}`;
    const chunks = chunkText(text, 400, 80);
    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 1; i < chunks.length; i++) {
      const head = chunks[i].content.slice(0, 20);
      expect(chunks[i - 1].content.includes(head)).toBe(true);
    }
  });

  it('estima tokens como ceil(longitud/4) e ids secuenciales', () => {
    const chunks = chunkText('Hola mundo.\n\nOtro párrafo aquí.', 1200, 200);
    expect(chunks.length).toBe(1);
    expect(chunks[0].id).toBe('chunk-000');
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].tokens).toBe(Math.ceil(chunks[0].content.length / 4));
  });

  it('recorta párrafos gigantes que exceden maxChars', () => {
    const huge = 'x'.repeat(3000);
    const chunks = chunkText(huge, 1000, 100);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(1000);
  });
});

describe('normalizeForSearch', () => {
  it('minúsculas, sin diacríticos y espacios colapsados', () => {
    expect(normalizeForSearch('ÁrTículo')).toBe('articulo');
    expect(normalizeForSearch('  Constitución   Política  ')).toBe('constitucion politica');
    expect(normalizeForSearch('Niño  jurídico')).toBe('nino juridico');
  });
});

describe('retrieveTopK', () => {
  const chunks: TextChunk[] = [
    { id: 'chunk-000', index: 0, content: 'El contrato de arrendamiento regula la renta del inmueble', tokens: 12 },
    { id: 'chunk-001', index: 1, content: 'La sentencia penal condena al acusado por fraude', tokens: 10 },
    { id: 'chunk-002', index: 2, content: 'arrendamiento renta contrato', tokens: 3 },
  ];

  it('el chunk más relevante queda primero', () => {
    const results = retrieveTopK('arrendamiento renta contrato', chunks, 3);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk.id).toBe('chunk-002');
  });

  it('respeta k y filtra score 0', () => {
    const results = retrieveTopK('arrendamiento', chunks, 1);
    expect(results.length).toBe(1);
    const none = retrieveTopK('xyzqqq', chunks, 3);
    expect(none).toEqual([]);
  });

  it('ordena empates por chunk.index', () => {
    const tied: TextChunk[] = [
      { id: 'chunk-000', index: 0, content: 'derecho civil', tokens: 3 },
      { id: 'chunk-001', index: 1, content: 'derecho civil', tokens: 3 },
    ];
    const results = retrieveTopK('derecho', tied, 2);
    expect(results[0].chunk.index).toBe(0);
    expect(results[1].chunk.index).toBe(1);
  });
});

describe('detectLawReferences', () => {
  it('detecta Ley con artículo', () => {
    const refs = detectLawReferences('Conforme a la Ley Federal del Trabajo, Artículo 24, el patrón debe...');
    expect(refs.length).toBeGreaterThan(0);
    expect(refs[0].law).toContain('Ley Federal del Trabajo');
    expect(refs[0].article).toBe('24');
  });

  it('detecta Decreto-Ley No. 88', () => {
    const refs = detectLawReferences('Según el Decreto-Ley No. 88 de 2020, se establece...');
    expect(refs.length).toBeGreaterThan(0);
    expect(refs[0].law).toContain('Decreto-Ley');
    expect(refs[0].law).toContain('88');
  });

  it('devuelve [] cuando no hay referencias', () => {
    expect(detectLawReferences('Texto sin menciones legales relevantes.')).toEqual([]);
  });

  it('deduplica por (law, article)', () => {
    const text = 'Ley 123, Artículo 5. Más adelante: Ley 123, Artículo 5 otra vez.';
    const refs = detectLawReferences(text);
    const keys = refs.map((r) => `${r.law}|${r.article ?? ''}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
