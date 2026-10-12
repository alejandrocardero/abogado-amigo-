import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  chunkText,
  detectLawReferences,
  extractTextFromFile,
  normalizeForSearch,
  retrieveTopK,
  RetrievalResult,
} from '../lib/documents';
import {
  DocumentFormat,
  DocumentVersion,
  IndexedDocument,
  LangGraphNodeStatus,
  UserProfile,
} from '../types';
import storage from '../lib/db';

const MAX_CONTENT_CHARS = 400_000;
const MAX_CHUNKS_PER_DOC = 100;
const MAX_VERSIONS_PER_DOC = 3;

/** Pipeline honesto: cada nodo refleja una etapa real del indexado local. */
const createInitialNodes = (docs: IndexedDocument[]): LangGraphNodeStatus[] => {
  const hasDocs = docs.length > 0;
  const totalChunks = docs.reduce((sum, d) => sum + d.chunksCount, 0);
  const totalTokens = docs.reduce((sum, d) => sum + d.tokensCount, 0);
  const totalLawRefs = docs.flatMap((d) => detectLawReferences(d.content)).length;

  return [
    {
      id: 'loader',
      name: 'Document Loader',
      description: 'Lectura del archivo y extracción de texto en el navegador',
      icon: 'upload_file',
      status: hasDocs ? 'completed' : 'idle',
      outputSummary: hasDocs ? `${docs.length} docs procesados` : undefined,
    },
    {
      id: 'splitter',
      name: 'Text Splitter',
      description: 'Segmentación del texto en fragmentos (chunks)',
      icon: 'content_cut',
      status: hasDocs ? 'completed' : 'idle',
      outputSummary: hasDocs ? `${totalChunks} chunks · ${totalTokens} tokens` : undefined,
    },
    {
      id: 'index',
      name: 'Índice Local',
      description: 'Persistencia de fragmentos en el almacenamiento del navegador',
      icon: 'database',
      status: hasDocs ? 'completed' : 'idle',
      outputSummary: hasDocs ? 'Guardado en localStorage ✓' : undefined,
    },
    {
      id: 'search',
      name: 'Búsqueda Léxica',
      description: 'Recuperación por similitud coseno de términos (TF)',
      icon: 'troubleshoot',
      status: hasDocs ? 'completed' : 'idle',
      outputSummary: hasDocs ? `${totalLawRefs} refs legales detectadas` : undefined,
    },
  ];
};

interface RAGLangGraphScreenProps {
  userProfile?: UserProfile | null;
}

export const RAGLangGraphScreen: React.FC<RAGLangGraphScreenProps> = ({ userProfile }) => {
  const [indexedDocs, setIndexedDocs] = useState<IndexedDocument[]>(() => storage.indexedDocs.get());
  const [nodes, setNodes] = useState<LangGraphNodeStatus[]>(() => createInitialNodes(storage.indexedDocs.get()));
  const [selectedDoc, setSelectedDoc] = useState<IndexedDocument | null>(
    () => storage.indexedDocs.get()[0] ?? null,
  );
  const [docVersions, setDocVersions] = useState<DocumentVersion[]>(() => storage.versions.get());
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [activeFormatFilter, setActiveFormatFilter] = useState<string>('all');
  const [testQuery, setTestQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RetrievalResult[] | null>(null);
  const [lawRefs, setLawRefs] = useState<{ law: string; article?: string; snippet: string }[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const persistVersions = (next: DocumentVersion[]) => {
    setDocVersions(next);
    storage.versions.set(next);
  };

  /** Guarda el estado previo de un documento como versión (máx. 3 por doc). */
  const pushVersion = (doc: IndexedDocument) => {
    const existing = storage.versions.get().filter((v) => v.docId === doc.id);
    const nextVersionNumber = existing.reduce((max, v) => Math.max(max, v.version), 0) + 1;
    const snapshot: DocumentVersion = {
      docId: doc.id,
      version: nextVersionNumber,
      hash: `${doc.content.length}-${doc.chunksCount}`,
      uploadedAt: new Date().toISOString(),
      content: doc.content,
      chunks: doc.chunks,
    };
    const forDoc = [...existing, snapshot]
      .sort((a, b) => a.version - b.version)
      .slice(-MAX_VERSIONS_PER_DOC);
    const others = storage.versions.get().filter((v) => v.docId !== doc.id);
    persistVersions([...others, ...forDoc]);
  };

  const handleRestoreVersion = (version: DocumentVersion) => {
    const target = indexedDocs.find((d) => d.id === version.docId);
    if (!target) {
      showToast('El documento original ya no existe en el índice');
      return;
    }
    pushVersion(target);
    const restored: IndexedDocument = {
      ...target,
      content: version.content,
      chunks: version.chunks,
      chunksCount: version.chunks.length,
      tokensCount: version.chunks.reduce((sum, c) => sum + c.tokens, 0),
      status: 'indexed',
    };
    const next = indexedDocs.map((d) => (d.id === target.id ? restored : d));
    setIndexedDocs(next);
    storage.indexedDocs.set(next);
    setSelectedDoc(restored);
    setNodes(createInitialNodes(next));
    showToast(`Versión ${version.version} restaurada`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || isIndexing) return;

    const file = files[0];
    const ext = file.name.split('.').pop()?.toLowerCase() as DocumentFormat;
    const validFormats: DocumentFormat[] = ['pdf', 'docx', 'txt', 'md', 'json', 'xml', 'html', 'csv', 'ocr'];
    const safeFormat: DocumentFormat = validFormats.includes(ext) ? ext : 'txt';

    setIsIndexing(true);

    try {
      const rawText = await extractTextFromFile(file);
      const content = rawText.slice(0, MAX_CONTENT_CHARS);
      const chunks = chunkText(content).slice(0, MAX_CHUNKS_PER_DOC);
      const tokensCount = chunks.reduce((sum, c) => sum + c.tokens, 0);

      const existing = indexedDocs.find((d) => d.name === file.name);
      if (existing) pushVersion(existing);

      const newDoc: IndexedDocument = {
        id: existing ? existing.id : `doc-${Date.now()}`,
        name: file.name,
        format: safeFormat,
        sizeBytes: file.size,
        uploadedAt: new Date().toLocaleString('es-ES'),
        status: 'indexed',
        content,
        chunks,
        chunksCount: chunks.length,
        tokensCount,
      };

      const nextDocs = existing
        ? indexedDocs.map((d) => (d.id === existing.id ? newDoc : d))
        : [newDoc, ...indexedDocs];
      setIndexedDocs(nextDocs);
      storage.indexedDocs.set(nextDocs);
      setSelectedDoc(newDoc);
      setNodes(createInitialNodes(nextDocs));
      showToast(`"${file.name}" indexado localmente (${chunks.length} fragmentos)`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo indexar el archivo');
    } finally {
      setIsIndexing(false);
      e.target.value = '';
    }
  };

  const runLangGraphPipeline = () => {
    if (isPipelineRunning || isIndexing) return;
    setIsPipelineRunning(true);

    const totalChunks = indexedDocs.reduce((sum, d) => sum + d.chunksCount, 0);
    const totalTokens = indexedDocs.reduce((sum, d) => sum + d.tokensCount, 0);
    const totalLawRefs = indexedDocs.flatMap((d) => detectLawReferences(d.content)).length;

    setNodes((prev) =>
      prev.map((n, i) => ({
        ...n,
        status: 'completed',
        outputSummary:
          i === 0
            ? `${indexedDocs.length} docs · ${totalChunks} fragmentos`
            : i === 1
            ? `${totalChunks} chunks · ${totalTokens} tokens`
            : i === 2
            ? 'Indexado en localStorage ✓'
            : `${totalLawRefs} referencias legales detectadas`,
      })),
    );

    setIsPipelineRunning(false);
    showToast(`Pipeline verificado: ${indexedDocs.length} docs, ${totalChunks} chunks, ${totalLawRefs} refs legales`);
  };

  const handleTestRAGQuery = () => {
    const query = testQuery.trim();
    if (!query) return;

    const allChunks = indexedDocs.flatMap((d) => d.chunks);
    const normalized = normalizeForSearch(query);
    const results = retrieveTopK(normalized, allChunks, 5);
    setSearchResults(results);

    const refs = results.flatMap((r) => detectLawReferences(r.chunk.content));
    const seen = new Set<string>();
    setLawRefs(
      refs.filter((r) => {
        const key = `${r.law}|${r.article ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 5),
    );
  };

  const filteredDocs = indexedDocs.filter((doc) => {
    if (activeFormatFilter === 'all') return true;
    return doc.format === activeFormatFilter;
  });

  const totalChunks = indexedDocs.reduce((sum, d) => sum + d.chunksCount, 0);
  const totalTokens = indexedDocs.reduce((sum, d) => sum + d.tokensCount, 0);
  const selectedVersions = selectedDoc
    ? docVersions.filter((v) => v.docId === selectedDoc.id).sort((a, b) => b.version - a.version)
    : [];

  return (
    <div className="flex flex-col w-full relative px-margin gap-space-lg max-w-2xl mx-auto pb-32">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -14, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 450, damping: 30 }}
            className="fixed top-30 left-1/2 -translate-x-1/2 z-50 bg-primary text-on-primary px-4 py-2 rounded-full shadow-xl text-xs font-semibold flex items-center gap-2 border border-white/10"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary-fixed">check_circle</span>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <section className="bg-surface-container-lowest rounded-2xl p-4 card-elevated border border-outline-variant/20 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-secondary text-white flex items-center justify-center font-bold shadow-sm">
              <span className="material-symbols-outlined text-[20px]">account_tree</span>
            </div>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold leading-tight">
                RAG LangGraph · Indexador Universal
              </h2>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                Indexación local de documentos en tu navegador, sin servidores externos
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-surface-container-high text-secondary font-label-sm text-label-sm font-semibold">
            Indexación Local
          </span>
        </div>
        {/* Métricas reales del índice */}
        <div className="flex items-center gap-4 pt-1 text-[11px] text-on-surface-variant font-mono tabular-nums">
          <span>{indexedDocs.length} documentos</span>
          <span>· {totalChunks} fragmentos</span>
          <span>· {totalTokens} tokens aprox.</span>
          {userProfile && <span>· {userProfile.email}</span>}
        </div>
      </section>

      {/* Universal Upload Box (Any Format) */}
      <section className="bg-surface-container-lowest rounded-2xl p-4 card-elevated border border-outline-variant/20 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="font-label-md text-label-md text-on-surface font-bold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-secondary text-[18px]">cloud_upload</span>
            Cargar Documento en Cualquier Formato
          </span>
          <span className="text-xs text-on-surface-variant font-mono">
            PDF · DOCX · TXT · MD · JSON · XML · CSV · OCR
          </span>
        </div>

        {/* Drag & Drop Area */}
        <label
          className={`border-2 border-dashed border-secondary/40 hover:border-secondary bg-surface-container-low/60 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 transition-all hover:bg-surface-container-low group ${
            isIndexing ? 'opacity-60 pointer-events-none' : 'cursor-pointer'
          }`}
        >
          <input
            type="file"
            onChange={handleFileUpload}
            className="hidden"
            disabled={isIndexing}
            accept=".pdf,.docx,.txt,.md,.json,.xml,.html,.csv,.ocr"
          />
          <div className="w-12 h-12 rounded-full bg-secondary-fixed text-secondary flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
            <span className={`material-symbols-outlined text-[26px] ${isIndexing ? 'animate-spin' : ''}`}>
              {isIndexing ? 'sync' : 'upload_file'}
            </span>
          </div>
          <div className="text-center">
            <p className="font-label-md text-label-md text-on-surface font-semibold">
              {isIndexing ? 'Indexando documento...' : 'Haz clic para seleccionar o arrastra archivos aquí'}
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              El texto se extrae y fragmenta localmente; nada se sube a servidores
            </p>
          </div>
        </label>

        {/* Format Badges */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-on-surface-variant font-semibold">Formatos indexables:</span>
          <div className="flex items-center gap-1 flex-wrap">
            {['PDF', 'DOCX', 'TXT', 'MD', 'JSON', 'XML', 'CSV', 'OCR'].map((fmt) => (
              <span
                key={fmt}
                className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-mono text-[10px] font-bold"
              >
                .{fmt.toLowerCase()}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Visual LangGraph Pipeline Nodes */}
      <section className="bg-surface-container-lowest rounded-2xl p-4 card-elevated border border-outline-variant/20 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-secondary text-[20px]">hub</span>
            <span className="font-label-md text-label-md text-on-surface font-bold">
              Pipeline de Indexación Local
            </span>
          </div>
          <button
            type="button"
            onClick={runLangGraphPipeline}
            disabled={isPipelineRunning || isIndexing}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer ${
              isPipelineRunning
                ? 'bg-secondary text-white'
                : 'bg-primary btn-lift-primary text-on-primary'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[15px] ${
                isPipelineRunning ? 'animate-spin' : ''
              }`}
            >
              {isPipelineRunning ? 'sync' : 'play_arrow'}
            </span>
            <span>{isPipelineRunning ? 'Verificando...' : 'Re-ejecutar Grafo'}</span>
          </button>
        </div>

        {/* Nodos del Grafo en Cascada */}
        <div className="flex flex-col gap-2">
          {nodes.map((node, index) => {
            const isCompleted = node.status === 'completed';
            const isRunning = node.status === 'running';

            return (
              <div key={node.id} className="relative">
                <div
                  className={`p-3 rounded-xl border transition-all duration-200 flex items-start justify-between gap-3 ${
                    isRunning
                      ? 'border-secondary bg-secondary-fixed/35 shadow-md scale-[1.01]'
                      : isCompleted
                      ? 'border-outline-variant/20 bg-surface-container-lowest'
                      : 'border-outline-variant/15 bg-surface-container-low opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                        isRunning
                          ? 'bg-secondary text-white animate-pulse'
                          : isCompleted
                          ? 'bg-[#ECFDF5] text-[#059669]'
                          : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {isCompleted ? 'check_circle' : node.icon}
                      </span>
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-label-md text-label-md text-on-surface font-bold font-mono">
                          {node.name}
                        </span>
                        {node.latencyMs && (
                          <span className="text-[10px] text-secondary font-mono bg-surface-container px-1.5 py-0.2 rounded tabular-nums">
                            {node.latencyMs}ms
                          </span>
                        )}
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        {node.description}
                      </p>
                      {node.outputSummary && isCompleted && (
                        <span className="text-[11px] text-[#065F46] font-mono mt-0.5">
                          ✓ {node.outputSummary}
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`font-label-sm text-label-sm px-2.5 py-0.5 rounded-full font-bold uppercase flex-shrink-0 ${
                      isRunning
                        ? 'bg-secondary text-white animate-pulse'
                        : isCompleted
                        ? 'bg-[#ECFDF5] text-[#065F46]'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {node.status}
                  </span>
                </div>

                {index < nodes.length - 1 && (
                  <div className="w-0.5 h-2 bg-secondary/30 ml-7 my-0.5"></div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Corpus Indexado Multi-Formato */}
      <section className="bg-surface-container-lowest rounded-2xl p-4 card-elevated border border-outline-variant/20 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="font-label-md text-label-md text-on-surface font-bold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-secondary text-[18px]">dns</span>
            Documentos en Índice Local ({indexedDocs.length})
          </span>
          <span className="text-xs text-on-surface-variant font-mono">Almacenamiento del navegador</span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {['all', 'pdf', 'docx', 'json', 'md'].map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => setActiveFormatFilter(fmt)}
              className={`px-3 py-1 rounded-full font-label-sm text-label-sm uppercase font-semibold cursor-pointer ${
                activeFormatFilter === fmt
                  ? 'bg-primary btn-lift-primary text-on-primary font-bold'
                  : 'bg-surface-container-low border border-outline-variant/20 text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {fmt}
            </button>
          ))}
        </div>

        {/* Document Cards */}
        <div className="space-y-2">
          {indexedDocs.length === 0 && (
            <div className="border border-dashed border-outline-variant/40 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-2 bg-surface-container-low/50">
              <span className="material-symbols-outlined text-secondary text-[32px]">inbox</span>
              <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Sin documentos indexados
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm">
                Sube un archivo (PDF, DOCX, TXT, MD, JSON, XML, HTML o CSV) para indexarlo localmente.
                Los documentos se guardan en este navegador.
              </p>
            </div>
          )}
          <AnimatePresence mode="popLayout">
            {filteredDocs.map((doc) => {
              const isDocSelected = selectedDoc?.id === doc.id;
              return (
                <motion.button
                  key={doc.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                  type="button"
                  onClick={() => setSelectedDoc(doc)}
                  className={`w-full p-3 rounded-xl border text-left cursor-pointer flex items-center justify-between ${
                    isDocSelected
                      ? 'border-secondary bg-surface-container-low shadow-sm'
                      : 'border-outline-variant/25 bg-surface-container-lowest hover:bg-surface-container-low/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="px-2 py-1 rounded-lg bg-secondary-fixed text-secondary font-mono text-xs font-bold uppercase">
                      {doc.format}
                    </span>
                    <div className="min-w-0">
                      <span className="font-label-md text-label-md text-on-surface font-semibold block truncate">
                        {doc.name}
                      </span>
                      <span className="text-[11px] text-on-surface-variant flex items-center gap-1.5 tabular-nums">
                        <span>{doc.chunksCount} fragmentos</span>
                        <span>· {doc.tokensCount} tokens</span>
                        <span>· {doc.uploadedAt}</span>
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#065F46] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#059669]"></span>
                    Indexado
                  </span>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Chunks Inspector for selected document */}
        {selectedDoc && selectedDoc.chunks.length > 0 && (
          <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/20 space-y-2">
            <span className="font-label-sm text-label-sm text-on-surface font-bold uppercase tracking-wider block">
              Fragmentos indexados: {selectedDoc.name}
            </span>
            {selectedDoc.chunks.slice(0, 5).map((chunk) => (
              <div
                key={chunk.id}
                className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/15 text-xs space-y-1.5 card-elevated"
              >
                <div className="flex items-center justify-between text-secondary font-semibold font-mono text-[11px]">
                  <span>Fragmento #{chunk.index + 1}</span>
                  <span>{chunk.tokens} tokens</span>
                </div>
                <p className="text-on-surface font-sans leading-relaxed">
                  "{chunk.content.slice(0, 280)}{chunk.content.length > 280 ? '…' : ''}"
                </p>
              </div>
            ))}
            {selectedDoc.chunks.length > 5 && (
              <p className="text-[11px] text-on-surface-variant font-mono">
                + {selectedDoc.chunks.length - 5} fragmentos más
              </p>
            )}
          </div>
        )}

        {/* Versiones del documento seleccionado */}
        {selectedDoc && selectedVersions.length > 0 && (
          <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/20 space-y-2">
            <span className="font-label-sm text-label-sm text-on-surface font-bold uppercase tracking-wider block">
              Versiones anteriores ({selectedVersions.length})
            </span>
            {selectedVersions.map((v) => (
              <div
                key={`${v.docId}-${v.version}`}
                className="flex items-center justify-between p-2.5 bg-surface-container-lowest rounded-xl border border-outline-variant/15 text-xs"
              >
                <span className="text-on-surface-variant font-mono">
                  v{v.version} · {new Date(v.uploadedAt).toLocaleString('es-ES')} · {v.chunks.length} fragmentos
                </span>
                <button
                  type="button"
                  onClick={() => handleRestoreVersion(v)}
                  className="px-2.5 py-1 rounded-lg bg-secondary-fixed text-secondary font-semibold cursor-pointer hover:opacity-80"
                >
                  Restaurar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* RAG Query Test Playground */}
      <section className="bg-surface-container-lowest rounded-2xl p-4 card-elevated border border-outline-variant/20 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-[20px]">troubleshoot</span>
          <span className="font-label-md text-label-md text-on-surface font-bold">
            Probador de Recuperación Local
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            placeholder={indexedDocs.length > 0 ? 'Escribe una pregunta sobre tus documentos...' : 'Sube documentos primero para consultar'}
            className="flex-1 px-3.5 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/30 text-xs text-on-surface focus:outline-none focus:border-secondary font-sans transition-colors"
          />
          <button
            onClick={handleTestRAGQuery}
            type="button"
            className="px-4 py-2.5 bg-secondary btn-lift-secondary text-white rounded-xl text-xs font-semibold cursor-pointer"
          >
            Buscar
          </button>
        </div>

        <AnimatePresence>
          {searchResults !== null && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {searchResults.length === 0 ? (
                <div className="p-3.5 bg-surface-container-low border border-outline-variant/20 rounded-xl text-xs text-on-surface-variant font-mono">
                  {indexedDocs.length === 0
                    ? 'No hay documentos indexados. Sube archivos para consultar.'
                    : 'Sin coincidencias en tu índice local'}
                </div>
              ) : (
                searchResults.map((r) => (
                  <div
                    key={r.chunk.id}
                    className="p-3.5 bg-[#ECFDF5] border border-[#059669]/30 rounded-xl text-xs text-[#065F46] font-mono leading-relaxed space-y-1"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>Fragmento #{r.chunk.index + 1}</span>
                      <span>Relevancia: {(r.score * 100).toFixed(1)}%</span>
                    </div>
                    <p>"{r.chunk.content.slice(0, 240)}{r.chunk.content.length > 240 ? '…' : ''}"</p>
                  </div>
                ))
              )}

              {lawRefs.length > 0 && (
                <div className="p-3.5 bg-surface-container-low border border-outline-variant/20 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-on-surface block">
                    {indexedDocs.length === 1 && selectedDoc
                      ? `Referencias en "${selectedDoc.name}":`
                      : 'Referencias legales detectadas:'}
                  </span>
                  {lawRefs.map((ref, i) => (
                    <p key={i} className="text-on-surface-variant font-mono">
                      · {ref.law}{ref.article ? `, Art. ${ref.article}` : ''} — "{ref.snippet}"
                    </p>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
};
