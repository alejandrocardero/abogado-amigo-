import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import storage from '../lib/db';
import WatermarkInput from './WatermarkInput';
import {
  extractTextFromFile,
  chunkText,
  detectLawReferences,
  retrieveTopK,
  DetectedLawReference,
} from '../lib/documents';
import { sha256Hex } from '../lib/crypto';
import {
  AgentToolCallStep,
  DocumentFormat,
  DocumentVersion,
  IndexedDocument,
  UserProfile,
} from '../types';
import { SuggestionChips } from './SuggestionChips';
import { useOllama } from '../hooks/useOllama';
import { generateWithOllama } from '../lib/ollama';
import { APP_CONFIG } from '../lib/appConfig';

const MAX_CONTENT_CHARS = 400_000;
const MAX_CHUNKS_PER_DOC = 100;
const MAX_VERSIONS_PER_DOC = 3;

const SUPPORTED_EXTENSIONS: Record<string, DocumentFormat> = {
  pdf: 'pdf',
  docx: 'docx',
  doc: 'docx',
  txt: 'txt',
  md: 'md',
  json: 'json',
  csv: 'csv',
  xml: 'xml',
  html: 'html',
};

interface AgenteExtractorScreenProps {
  userProfile?: UserProfile | null;
}

export const AgenteExtractorScreen: React.FC<AgenteExtractorScreenProps> = ({ userProfile }) => {
  const [docs, setDocs] = useState<IndexedDocument[]>(() => storage.indexedDocs.get());
  const [selectedDoc, setSelectedDoc] = useState<IndexedDocument | null>(
    () => storage.indexedDocs.get()[0] ?? null,
  );
  const [searchTopic, setSearchTopic] = useState('');
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [toolSteps, setToolSteps] = useState<AgentToolCallStep[]>([]);
  const [detectedRefs, setDetectedRefs] = useState<DetectedLawReference[]>([]);
  const [selectedRef, setSelectedRef] = useState<DetectedLawReference | null>(null);
  const [activeFileTab, setActiveFileTab] = useState<'md' | 'json'>('md');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const { settings } = useOllama();

  const handleSelectDoc = (doc: IndexedDocument) => {
    setSelectedDoc(doc);
    const refs = detectLawReferences(doc.content);
    setDetectedRefs(refs);
    setSelectedRef(refs[0] ?? null);
    generateSuggestions();
  };

  const handleRunAgent = () => {
    if (isAgentRunning || !selectedDoc) return;
    setIsAgentRunning(true);
    setToolSteps([]);

    const refs = detectLawReferences(selectedDoc.content);
    setDetectedRefs(refs);
    setSelectedRef(refs[0] ?? null);
    const topHits = retrieveTopK(searchTopic, selectedDoc.chunks, 3);
    const now = () => new Date().toLocaleTimeString('es-MX', { hour12: false });

    const steps: AgentToolCallStep[] = [
      {
        step: 1,
        toolName: 'parse_document_structure',
        input: { filename: selectedDoc.name, format: selectedDoc.format },
        output: {
          status: 'parsed',
          sizeBytes: selectedDoc.sizeBytes,
          charLength: selectedDoc.content.length,
        },
        status: 'success',
        timestamp: now(),
      },
      {
        step: 2,
        toolName: 'detect_law_references',
        input: { topic: searchTopic },
        output: { referencesFound: refs.length, firstMatch: refs[0]?.law ?? null },
        status: 'success',
        timestamp: now(),
      },
      {
        step: 3,
        toolName: 'segment_text_chunks',
        input: { maxChars: 1200, overlap: 200 },
        output: { chunksExtracted: selectedDoc.chunksCount, tokensCount: selectedDoc.tokensCount },
        status: 'success',
        timestamp: now(),
      },
      {
        step: 4,
        toolName: 'retrieve_relevant_chunks',
        input: { query: searchTopic, k: 3 },
        output: {
          hits: topHits.length,
          topScore: topHits.length > 0 ? Number(topHits[0].score.toFixed(3)) : 0,
        },
        status: 'success',
        timestamp: now(),
      },
    ];

    setToolSteps(steps);
    setIsAgentRunning(false);
    showToast(`Análisis completado: ${refs.length} referencias legales detectadas`);
  };

  const handleDownloadFile = (filename: string, content: string) => {
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showToast(`Descargado: ${filename}`);
  };

  const handleDownloadAllZip = async () => {
    if (docs.length === 0) {
      showToast('No hay documentos extraídos para exportar');
      return;
    }
    const zip = new JSZip();
    for (const doc of docs) {
      const base = doc.name.replace(/\.[^.]+$/, '');
      zip.file(`${base}.txt`, doc.content);
      zip.file(
        `${base}_metadata.json`,
        JSON.stringify(
          {
            name: doc.name,
            format: doc.format,
            sizeBytes: doc.sizeBytes,
            uploadedAt: doc.uploadedAt,
            chunksCount: doc.chunksCount,
            tokensCount: doc.tokensCount,
            detectedLawReferences: detectLawReferences(doc.content).length,
          },
          null,
          2,
        ),
      );
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const element = document.createElement('a');
    element.href = URL.createObjectURL(blob);
    element.download = 'documentos_extraidos.zip';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(element.href);
    showToast(`Paquete ZIP exportado con ${docs.length} documento(s)`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const ext = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
    const format = SUPPORTED_EXTENSIONS[ext];
    if (!format) {
      showToast(`Formato no soportado: .${ext}`);
      return;
    }

    setIsExtracting(true);
    try {
      const rawText = await extractTextFromFile(file);
      const content = rawText.slice(0, MAX_CONTENT_CHARS);
      const chunks = chunkText(content).slice(0, MAX_CHUNKS_PER_DOC);
      const tokensCount = chunks.reduce((acc, c) => acc + c.tokens, 0);

      const newDoc: IndexedDocument = {
        id: `doc-${Date.now()}`,
        name: file.name,
        format,
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
        status: 'indexed',
        content,
        chunks,
        chunksCount: chunks.length,
        tokensCount,
      };

      const nextDocs = [newDoc, ...docs];
      setDocs(nextDocs);
      storage.indexedDocs.set(nextDocs);

      const existingVersions = storage.versions.get().filter((v) => v.docId === newDoc.id);
      const version: DocumentVersion = {
        docId: newDoc.id,
        version: existingVersions.length + 1,
        hash: await sha256Hex(content),
        uploadedAt: newDoc.uploadedAt,
        content,
        chunks,
      };
      const otherVersions = storage.versions.get().filter((v) => v.docId !== newDoc.id);
      const docVersions = [...existingVersions, version].slice(-MAX_VERSIONS_PER_DOC);
      storage.versions.set([...otherVersions, ...docVersions]);

      setSelectedDoc(newDoc);
      const refs = detectLawReferences(content);
      setDetectedRefs(refs);
      setSelectedRef(refs[0] ?? null);
      showToast(`"${file.name}" extraído: ${content.length.toLocaleString('es-MX')} caracteres`);
      generateSuggestions();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido al extraer texto';
      showToast(`Error: ${message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const generateSuggestions = useCallback(async () => {
    if (!selectedDoc || settings.selectedModel.startsWith('gemini-')) {
      return;
    }

    setIsGeneratingSuggestions(true);
    try {
      const content = selectedDoc.content.slice(0, 3000);
      const response = await generateWithOllama(
        settings.selectedModel,
        APP_CONFIG.suggestionPrompt + '\n\nDocumento:\n' + content,
      );
      const parsed = response
        .split('\n')
        .map((line) => line.replace(/^\s*\d+[\.\)]\s*/, '').trim())
        .filter((line) => line.length > 0)
        .slice(0, 5);
      setSuggestions(parsed);
    } catch {
      setSuggestions([]);
    } finally {
      setIsGeneratingSuggestions(false);
    }
  }, [selectedDoc, settings.selectedModel]);

  const totalChunks = docs.reduce((acc, d) => acc + d.chunksCount, 0);
  const totalTokens = docs.reduce((acc, d) => acc + d.tokensCount, 0);

  return (
    <div className="flex flex-col w-full relative px-margin gap-space-lg max-w-2xl mx-auto pb-32">
      {/* Shared file input — opened programmatically by the upload buttons */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt,.md,.json,.csv,.xml,.html"
        className="hidden"
        onChange={handleFileUpload}
      />
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
            <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold shadow-sm">
              <span className="material-symbols-outlined text-[20px]">smart_toy</span>
            </div>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold leading-tight">
                Agente SLM Extractor de Documentos
              </h2>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                Extracción real de texto · Detección de leyes · Exportación ZIP
                {userProfile ? ` · ${userProfile.userName}` : ''}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-surface-container-high text-secondary font-label-sm text-label-sm font-semibold">
            {docs.length} doc(s) · {totalChunks} fragmentos
          </span>
        </div>
      </section>

      {/* 1. Selector de Documento */}
      <section className="bg-surface-container-lowest rounded-2xl p-4 card-elevated border border-outline-variant/20 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="font-label-md text-label-md text-on-surface font-bold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-secondary text-[18px]">description</span>
            1. Seleccionar o Subir Documento
          </span>
          <span className="text-xs text-on-surface-variant tabular-nums">
            {selectedDoc ? `${selectedDoc.chunksCount} fragmentos indexables` : '0 fragmentos indexables'}
          </span>
        </div>

        {/* Empty state when no docs */}
        {docs.length === 0 && (
          <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-6 text-center card-elevated">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/50 mb-2 block">description</span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-1">Sin documentos cargados</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">Carga un PDF, DOCX o archivo de texto para extraer su contenido real.</p>
            <button
              type="button"
              onClick={openFilePicker}
              disabled={isExtracting}
              className="px-4 py-2 bg-primary btn-lift-primary text-on-primary rounded-xl font-label-md text-label-md font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[20px]">upload_file</span>
              {isExtracting ? 'Extrayendo texto...' : 'Cargar Documento'}
            </button>
          </div>
        )}

        {/* Document selector pills */}
        {docs.length > 0 && (
          <div className="grid grid-cols-1 gap-2">
            {docs.map((d) => {
              const isSelected = selectedDoc?.id === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => handleSelectDoc(d)}
                  className={`p-3 rounded-xl border text-left cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'border-secondary bg-surface-container-low shadow-sm'
                      : 'border-outline-variant/25 bg-surface-container-lowest hover:bg-surface-container-low/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="material-symbols-outlined text-secondary text-[22px]">description</span>
                    <div className="min-w-0">
                      <span className="font-label-md text-label-md text-on-surface font-semibold block truncate">
                        {d.name}
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
                        <span className="font-mono text-[11px] text-secondary">{d.format.toUpperCase()}</span>
                        <span>· {d.chunksCount} fragmentos · {d.tokensCount.toLocaleString('es-MX')} tokens</span>
                      </span>
                    </div>
                  </div>
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected ? 'bg-secondary text-white' : 'border border-outline-variant/40'
                    }`}
                  >
                    {isSelected && (
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Upload box */}
        <div className="border border-dashed border-outline-variant/50 rounded-xl p-3 bg-surface-container-low/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-secondary text-[20px]">upload_file</span>
            <span>{isExtracting ? 'Extrayendo texto real del archivo...' : '¿Otro documento? PDF, DOCX o texto plano.'}</span>
          </div>
          <button
            type="button"
            onClick={openFilePicker}
            disabled={isExtracting}
            className="px-3 py-1.5 bg-surface-container-lowest border border-outline-variant/30 hover:border-secondary/40 rounded-lg text-xs font-semibold text-secondary cursor-pointer disabled:opacity-60"
          >
            {isExtracting ? 'Procesando...' : 'Subir'}
          </button>
        </div>
      </section>

      {/* 2. Criterio de Búsqueda para el Agente */}
      <section className="bg-surface-container-lowest rounded-2xl p-4 card-elevated border border-outline-variant/20 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="font-label-md text-label-md text-on-surface font-bold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-secondary text-[18px]">find_in_page</span>
            2. Criterio o Tema a Buscar en el Documento
          </span>
        </div>

        <WatermarkInput
          value={searchTopic}
          onChange={setSearchTopic}
          watermark="Ejemplo: Vacaciones dignas, Estatutos societarios, Garantías mobiliarias..."
          placeholder="Escribe tu criterio de búsqueda..."
          className="w-full"
        />

        <SuggestionChips
          suggestions={suggestions}
          onSelect={setSearchTopic}
          isLoading={isGeneratingSuggestions}
          label="Sugerencias:"
          emptyMessage="Sube un documento y selecciona un modelo Ollama para generar sugerencias"
        />

        {/* Action Trigger Button */}
        <button
          onClick={handleRunAgent}
          disabled={isAgentRunning || isExtracting || !selectedDoc}
          className={`w-full py-3 px-4 rounded-xl font-label-lg text-label-lg font-semibold flex items-center justify-center gap-2 cursor-pointer ${
            isAgentRunning || isExtracting
              ? 'bg-secondary-container text-white cursor-wait'
              : 'bg-primary btn-lift-primary text-on-primary'
          }`}
          type="button"
        >
          <span
            className={`material-symbols-outlined text-[20px] ${
              isAgentRunning ? 'animate-spin' : ''
            }`}
          >
            {isAgentRunning ? 'sync' : 'psychology'}
          </span>
          <span>
            {isAgentRunning
              ? 'Analizando documento...'
              : 'Analizar Documento con Agente SLM (Tool Calling)'}
          </span>
        </button>
      </section>

      {/* 3. Traza de Tool Calling del Agente SLM */}
      <AnimatePresence>
        {toolSteps.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="bg-surface-container-lowest rounded-2xl p-4 card-elevated border border-outline-variant/20 flex flex-col gap-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-on-surface font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary text-[18px]">terminal</span>
                3. Traza de Tool Calling del Agente
              </span>
              <span className="text-[11px] text-on-tertiary-container font-bold flex items-center gap-1 bg-[#ECFDF5] px-2.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#059669]"></span>
                Tool Calling Exitoso
              </span>
            </div>

            <div className="space-y-2">
              {toolSteps.map((step) => (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-surface-container-low rounded-xl p-3 border border-outline-variant/20 flex flex-col gap-1.5 font-mono text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-secondary text-white flex items-center justify-center text-[10px] font-bold">
                        {step.step}
                      </span>
                      <strong className="text-secondary font-semibold">tool_call:</strong>
                      <span className="text-on-surface font-bold">{step.toolName}()</span>
                    </div>
                    <span className="text-[10px] text-on-surface-variant">{step.timestamp}</span>
                  </div>

                  <div className="text-[11px] text-on-surface-variant bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/15 overflow-x-auto">
                    <span className="text-slate-500 font-semibold">Output: </span>
                    <span className="text-slate-800">{JSON.stringify(step.output)}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* 4. Referencias de Leyes Detectadas & Contenido Extraído */}
      <section className="bg-surface-container-lowest rounded-2xl p-4 card-elevated border border-outline-variant/20 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="font-label-md text-label-md text-on-surface font-bold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-secondary text-[18px]">folder_special</span>
            4. Referencias de Leyes Detectadas ({detectedRefs.length})
          </span>
          <button
            type="button"
            onClick={handleDownloadAllZip}
            className="px-2.5 py-1 rounded-lg bg-secondary-fixed/60 text-xs text-secondary font-bold flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">archive</span>
            Exportar Paquete ZIP
          </button>
        </div>

        {/* Presence Determination Card */}
        {selectedRef && (
          <div className="bg-[#ECFDF5] border border-[#059669]/30 rounded-xl p-3.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#065F46]">
                <span className="w-2 h-2 rounded-full bg-[#059669]"></span>
                REFERENCIA DETECTADA EN EL TEXTO EXTRAÍDO
              </span>
              <span className="text-[11px] text-[#065F46] font-mono">
                {selectedRef.article ? `Art. ${selectedRef.article}` : 'Sin artículo'}
              </span>
            </div>
            <p className="text-xs text-[#065F46] leading-relaxed">
              {selectedRef.snippet}
            </p>
          </div>
        )}

        {/* Detected references list */}
        <div className="bg-[#0b1329] text-slate-200 rounded-xl p-3.5 font-mono text-xs border border-slate-700">
          <div className="flex items-center gap-2 text-cyan-400 pb-2 border-b border-slate-800">
            <span className="material-symbols-outlined text-[16px]">folder_open</span>
            <span>/extracted/{selectedDoc?.id ?? 'sin-documento'}/</span>
          </div>

          <div className="pt-2 space-y-2">
            {detectedRefs.length === 0 && (
              <p className="text-slate-400 text-[11px] pl-4">
                {selectedDoc
                  ? 'Sin referencias legales detectadas en este documento.'
                  : 'Selecciona un documento para ver sus referencias.'}
              </p>
            )}
            {detectedRefs.map((ref, idx) => {
              const isActive = selectedRef === ref;
              return (
                <div key={`${ref.law}-${idx}`} className="pl-4">
                  <div
                    onClick={() => setSelectedRef(ref)}
                    className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg cursor-pointer transition-colors ${
                      isActive ? 'bg-blue-900/60 text-white font-bold' : 'hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[15px] text-amber-400">gavel</span>
                      <span>{ref.law}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {ref.article ? `Art. ${ref.article}` : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* File Content Previewer */}
        {selectedDoc && (
          <div className="border border-outline-variant/25 rounded-xl overflow-hidden flex flex-col bg-surface-container-lowest shadow-xs">
            <div className="bg-surface-container flex items-center justify-between px-3 py-2 border-b border-outline-variant/20">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveFileTab('md')}
                  className={`px-3 py-1.5 rounded-lg font-label-sm text-label-sm font-semibold flex items-center gap-1 cursor-pointer ${
                    activeFileTab === 'md'
                      ? 'bg-surface-container-lowest text-secondary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">description</span>
                  contenido_extraido.txt
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFileTab('json')}
                  className={`px-3 py-1.5 rounded-lg font-label-sm text-label-sm font-semibold flex items-center gap-1 cursor-pointer ${
                    activeFileTab === 'json'
                      ? 'bg-surface-container-lowest text-secondary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">data_object</span>
                  metadata.json
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const content =
                      activeFileTab === 'md'
                        ? selectedDoc.content
                        : JSON.stringify(
                            {
                              name: selectedDoc.name,
                              format: selectedDoc.format,
                              sizeBytes: selectedDoc.sizeBytes,
                              uploadedAt: selectedDoc.uploadedAt,
                              chunksCount: selectedDoc.chunksCount,
                              tokensCount: selectedDoc.tokensCount,
                            },
                            null,
                            2,
                          );
                    navigator.clipboard?.writeText(content);
                    showToast('Contenido copiado al portapapeles');
                  }}
                  className="p-1.5 rounded-lg bg-surface-container-lowest/80 hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface cursor-pointer"
                  title="Copiar contenido"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (activeFileTab === 'md') {
                      handleDownloadFile(`${selectedDoc.name.replace(/\.[^.]+$/, '')}.txt`, selectedDoc.content);
                    } else {
                      handleDownloadFile(
                        `${selectedDoc.name.replace(/\.[^.]+$/, '')}_metadata.json`,
                        JSON.stringify(
                          {
                            name: selectedDoc.name,
                            format: selectedDoc.format,
                            sizeBytes: selectedDoc.sizeBytes,
                            uploadedAt: selectedDoc.uploadedAt,
                            chunksCount: selectedDoc.chunksCount,
                            tokensCount: selectedDoc.tokensCount,
                          },
                          null,
                          2,
                        ),
                      );
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-secondary btn-lift-secondary text-white font-label-sm text-label-sm font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  Descargar
                </button>
              </div>
            </div>

            <div className="p-4 max-h-80 overflow-y-auto font-mono text-xs">
              <AnimatePresence mode="wait">
                {activeFileTab === 'md' ? (
                  <motion.div
                    key="tab-md"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="font-sans text-on-surface whitespace-pre-wrap leading-relaxed"
                  >
                    <div className="p-3 bg-surface-container-low rounded-lg mb-3 border-l-4 border-secondary text-xs">
                      <strong>Texto extraído:</strong> {selectedDoc.content.length.toLocaleString('es-MX')} caracteres ·{' '}
                      {selectedDoc.chunksCount} fragmentos · {selectedDoc.tokensCount.toLocaleString('es-MX')} tokens
                    </div>
                    <pre className="font-mono text-xs bg-slate-900 text-slate-100 p-3.5 rounded-xl overflow-x-auto">
                      {selectedDoc.content}
                    </pre>
                  </motion.div>
                ) : (
                  <motion.div
                    key="tab-json"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-2"
                  >
                    <div className="p-3 bg-surface-container-low rounded-lg mb-2 border-l-4 border-emerald-600 text-xs font-sans">
                      <strong>Metadatos reales del documento indexado</strong>
                    </div>
                    <pre className="p-3.5 bg-slate-900 text-emerald-400 rounded-xl overflow-x-auto">
                      {JSON.stringify(
                        {
                          name: selectedDoc.name,
                          format: selectedDoc.format,
                          sizeBytes: selectedDoc.sizeBytes,
                          uploadedAt: selectedDoc.uploadedAt,
                          status: selectedDoc.status,
                          chunksCount: selectedDoc.chunksCount,
                          tokensCount: selectedDoc.tokensCount,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
