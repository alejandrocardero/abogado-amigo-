import { describe, it, expect } from 'vitest';
import {
  contentHashOf,
  diffGazetteEntries,
  parseGazetteHtml,
  resolveUrl,
  GazetteEntry,
} from './gazetteFetcher';

describe('contentHashOf', () => {
  it('es determinista para la misma entrada', async () => {
    const a = await contentHashOf('https://x.gob/a', 'Decreto 1');
    const b = await contentHashOf('https://x.gob/a', 'Decreto 1');
    expect(a).toBe(b);
  });

  it('produce 64 caracteres hex (SHA-256) y cambia con la url', async () => {
    const a = await contentHashOf('https://x.gob/a', 'Decreto 1');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    const b = await contentHashOf('https://x.gob/b', 'Decreto 1');
    expect(a).not.toBe(b);
  });
});

describe('resolveUrl', () => {
  it('acepta URLs absolutas http(s)', () => {
    expect(resolveUrl('https://www.dof.gob.mx/nota.pdf', 'https://www.dof.gob.mx/')).toBe('https://www.dof.gob.mx/nota.pdf');
  });

  it('resuelve rutas relativas contra la base', () => {
    expect(resolveUrl('/notas/1.html', 'https://www.gacetaoficial.cu/')).toBe('https://www.gacetaoficial.cu/notas/1.html');
  });

  it('rechaza javascript: y cadenas inválidas', () => {
    expect(resolveUrl('javascript:void(0)', 'https://x.gob/')).toBeNull();
    expect(resolveUrl('http://[::1', 'https://x.gob/')).toBeNull();
  });
});

describe('diffGazetteEntries', () => {
  const incoming: GazetteEntry[] = [
    { title: 'Ley A', url: 'https://x/a', publishedAt: '', summary: '', sourceName: 's', jurisdiction: 'MX', contentHash: 'h1' },
    { title: 'Ley B', url: 'https://x/b', publishedAt: '', summary: '', sourceName: 's', jurisdiction: 'MX', contentHash: 'h2' },
  ];

  it('marca como vistas las que ya existen por contentHash', () => {
    const existing: GazetteEntry[] = [{ ...incoming[0] }];
    const { fresh, seenCount } = diffGazetteEntries(existing, incoming);
    expect(seenCount).toBe(1);
    expect(fresh.map((e) => e.title)).toEqual(['Ley B']);
  });

  it('compara por título cuando el existente es GazetteFeedItem', () => {
    const existing = [{ id: '1', jurisdiction: 'MX' as const, typeLabel: 't', ragScore: '0', title: 'Ley A', category: 'nueva' as const, tags: [] }];
    const { fresh, seenCount } = diffGazetteEntries(existing, incoming);
    expect(seenCount).toBe(1);
    expect(fresh).toHaveLength(1);
  });
});

describe('parseGazetteHtml', () => {
  it('extrae entradas de un HTML mínimo y filtra ruido', async () => {
    const html = `
      <html><body>
        <a href="#menu">Menú principal</a>
        <a href="javascript:void(0)">Click aquí</a>
        <a href="https://www.facebook.com/dof">Facebook</a>
        <a href="/notas/decreto-123.html">Decreto número 123 por el que se reforma la ley</a>
        <a href="https://www.dof.gob.mx/notas/ley-456.html">Ley 456 de ingresos de la federación</a>
      </body></html>`;
    const entries = await parseGazetteHtml(html, 'DOF', 'MX', 'https://www.dof.gob.mx/');
    expect(entries.length).toBe(2);
    expect(entries[0].url).toBe('https://www.dof.gob.mx/notas/decreto-123.html');
    expect(entries[0].contentHash).toBe(await contentHashOf(entries[0].url, entries[0].title));
    expect(entries[1].url).toBe('https://www.dof.gob.mx/notas/ley-456.html');
  });

  it('devuelve [] para HTML sin enlaces útiles', async () => {
    expect(await parseGazetteHtml('<html><body><p>Hola</p></body></html>', 'DOF', 'MX')).toEqual([]);
  });
});
