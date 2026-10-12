import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { storage } from '../lib/db';
import { fetchGazette, diffGazetteEntries, GAZETTE_SOURCES } from '../lib/gazetteFetcher';
import { extractTextFromFile } from '../lib/documents';
import { generateWithOllama } from '../lib/ollama';
import { useOllama } from '../hooks/useOllama';
import { GazetteFeedItem, Jurisdiction, NavTab, ReviewState, UserProfile, LawCatalogItem } from '../types';

interface GacetasScreenProps {
  userProfile?: UserProfile | null;
  onOpenLogs: () => void;
  onOpenComparative: () => void;
  onNavigateToTab?: (tab: NavTab) => void;
}

const MAX_FEED_ITEMS = 200;
const MAX_NOTIFICATIONS = 50;
const MAX_LOGS = 200;

function appendLog(level: 'info' | 'success' | 'error', message: string) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  storage.logs.set([...storage.logs.get(), entry].slice(-MAX_LOGS));
}

export const GacetasScreen: React.FC<GacetasScreenProps> = ({
  userProfile,
  onOpenLogs,
  onOpenComparative,
  onNavigateToTab,
}) => {
  const country: Jurisdiction = userProfile?.country ?? 'MX';
  const [items, setItems] = useState<GazetteFeedItem[]>(() => storage.gazetteFeed.get());
  const [reviewState, setReviewState] = useState<ReviewState>(() => storage.reviewResolved.get());
  const [filter, setFilter] = useState<'todos' | 'nuevas' | 'reformas' | 'derogaciones' | 'revision'>('todos');
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatusText, setScanStatusText] = useState('Escanear Gaceta Oficial');
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastScanSummary, setLastScanSummary] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const { settings: modelSettings } = useOllama();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingGazette, setIsUploadingGazette] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const openFilePicker = () => fileInputRef.current?.click();

  const handleGazetteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowedExts = ['pdf', 'docx', 'doc', 'txt', 'md'];
    if (!ext || !allowedExts.includes(ext)) {
      showToast('Formato no soportado. Usa PDF, DOCX, DOC, TXT o MD.');
      return;
    }

    const selectedModel = modelSettings.selectedModel;
    if (selectedModel === 'gemini-2.0-flash-exp' || !modelSettings.availableModels.some(m => m.name === selectedModel)) {
      showToast('Selecciona un modelo Ollama válido en Configuración > Configurar Modelos');
      return;
    }

    setIsUploadingGazette(true);
    setUploadError(null);
    setScanStatusText(`Extrayendo texto de ${file.name}...`);
    appendLog('info', `Subida manual de gaceta iniciada: ${file.name}`);

    try {
      const rawText = await extractTextFromFile(file);
      const content = rawText.slice(0, 100_000);

      setScanStatusText(`Analizando con ${selectedModel}...`);
      appendLog('info', `Analizando gaceta con modelo ${selectedModel}`);

      const prompt = `Eres un asistente legal especializado en derecho ${country === 'MX' ? 'mexicano' : country === 'CU' ? 'cubano' : 'dominicano'}.
Analiza el siguiente contenido de una gaceta oficial y extrae TODAS las leyes, decretos, resoluciones o normas mencionadas.

Para cada norma encontrada, devuelve UN OBJETO JSON con estos campos exactos:
- id: identificador único (ej: "mx-lft-2024-001")
- country: "${country}"
- title: título completo de la norma
- source: "${GAZETTE_SOURCES[country].name}"
- code: código o número de la norma (ej: "LFT", "DL-88", "Ley 16-92")
- articlesCount: número estimado de artículos (entero)
- lastUpdated: fecha de publicación en formato YYYY-MM-DD
- badge: "Vigente" | "Reformada" | "En Revisión" | "Derogada"
- description: resumen de 2-3 líneas del contenido y alcance

DEVUELVE SOLO UN ARRAY JSON VÁLIDO, SIN TEXTO ADICIONAL, SIN MARKDOWN.

CONTENIDO DE LA GACETA:
${content}`;

      const response = await generateWithOllama(selectedModel, prompt, modelSettings.ollamaBaseUrl);

      let extractedLaws: LawCatalogItem[] = [];
      try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          extractedLaws = JSON.parse(jsonMatch[0]);
        } else {
          extractedLaws = JSON.parse(response);
        }
      } catch (parseError) {
        appendLog('error', `Error parseando respuesta del modelo: ${parseError}`);
        showToast('El modelo no devolvió JSON válido. Revisa los logs.');
        return;
      }

      if (!Array.isArray(extractedLaws) || extractedLaws.length === 0) {
        showToast('No se detectaron leyes en el documento.');
        return;
      }

      const validLaws = extractedLaws
        .filter(law => law.title && law.code && law.id)
        .map(law => ({
          ...law,
          country: country as Jurisdiction,
          source: GAZETTE_SOURCES[country].name,
          lastUpdated: law.lastUpdated?.match(/^\d{4}-\d{2}-\d{2}$/) ? law.lastUpdated : new Date().toISOString().split('T')[0],
          badge: ['Vigente', 'Reformada', 'En Revisión', 'Derogada'].includes(law.badge) ? law.badge : 'Vigente',
          articlesCount: Number.isInteger(law.articlesCount) && law.articlesCount > 0 ? law.articlesCount : 1,
        }));

      if (validLaws.length === 0) {
        showToast('No se pudieron validar leyes extraídas.');
        return;
      }

      const existingLaws = storage.laws.get();
      const existingIds = new Set(existingLaws.map(l => l.id));
      const newLaws = validLaws.filter(l => !existingIds.has(l.id));
      const updatedLaws = [...newLaws, ...existingLaws].slice(0, 200);
      storage.laws.set(updatedLaws);

      const summary = `${newLaws.length} leyes nuevas agregadas de ${file.name} (${validLaws.length} detectadas, ${validLaws.length - newLaws.length} duplicadas)`;
      setLastScanSummary(summary);
      setScanStatusText('Escanear Gaceta Oficial');
      showToast(`¡Completado! ${summary}`);
      appendLog('success', `Gaceta procesada: ${summary}`);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido al procesar la gaceta';
      setUploadError(message);
      setScanStatusText('Escanear Gaceta Oficial');
      showToast(`Error: ${message}`);
      appendLog('error', `Error procesando gaceta manual: ${message}`);
    } finally {
      setIsUploadingGazette(false);
    }
  };

  const handleManualScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanError(null);
    setLastScanSummary(null);
    setScanStatusText(`Consultando ${GAZETTE_SOURCES[country].name}...`);
    appendLog('info', `Escaneo manual iniciado para ${country}`);

    try {
      const result = await fetchGazette(country);

      if (result.error || result.entries.length === 0) {
        const message = result.error ?? 'No se encontraron entradas en la fuente.';
        setScanError('No se pudo consultar la gaceta en este momento. Verifica tu conexión e inténtalo de nuevo.');
        setScanStatusText('Escanear Gaceta Oficial');
        showToast(message);
        appendLog('error', `Escaneo fallido (${country}): ${message}`);
        return;
      }

      const { fresh, seenCount } = diffGazetteEntries(items, result.entries);
      const freshItems: GazetteFeedItem[] = fresh.map((entry) => ({
        id: entry.contentHash,
        jurisdiction: entry.jurisdiction,
        typeLabel: entry.sourceName,
        ragScore: '',
        title: entry.title,
        summary: entry.summary,
        category: 'nueva' as const,
        tags: [],
      }));

      const nextItems = [...freshItems, ...items].slice(0, MAX_FEED_ITEMS);
      storage.gazetteFeed.set(nextItems);
      setItems(nextItems);

      if (freshItems.length > 0) {
        const note = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
          title: 'Nuevas publicaciones en gaceta',
          message: `${freshItems.length} entrada(s) nueva(s) detectada(s) en ${result.source}.`,
          read: false,
        };
        storage.notifications.set([note, ...storage.notifications.get()].slice(0, MAX_NOTIFICATIONS));
      }

      setLastScanSummary(`${freshItems.length} nuevas · ${seenCount} ya registradas · ${result.elapsedMs} ms`);
      setScanStatusText('Escanear Gaceta Oficial');
      showToast(`Escaneo completado: ${freshItems.length} nuevas, ${seenCount} existentes`);
      appendLog('success', `Escaneo ${country}: ${freshItems.length} nuevas, ${seenCount} existentes (${result.elapsedMs} ms)`);
    } catch {
      setScanError('No se pudo consultar la gaceta en este momento. Verifica tu conexión e inténtalo de nuevo.');
      setScanStatusText('Escanear Gaceta Oficial');
      appendLog('error', `Escaneo fallido (${country}): excepción de red`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleReview = (itemId: string, outcome: 'validated' | 'discarded') => {
    const next: ReviewState = { ...reviewState, [itemId]: outcome };
    setReviewState(next);
    storage.reviewResolved.set(next);
    showToast(outcome === 'validated' ? 'Gaceta validada e indexada' : 'Conflicto descartado del pipeline');
    appendLog('info', `Revisión ${outcome} para entrada ${itemId}`);
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filter === 'todos') return true;
      if (filter === 'nuevas') return item.category === 'nueva';
      if (filter === 'reformas') return item.category === 'reforma';
      if (filter === 'derogaciones') return item.category === 'derogacion';
      if (filter === 'revision') return item.category === 'revision';
      return true;
    });
  }, [items, filter]);

  const categoryCounts = useMemo(() => {
    const counts = { nueva: 0, reforma: 0, derogacion: 0, revision: 0 };
    items.forEach((item) => {
      if (item.category in counts) counts[item.category]++;
    });
    return counts;
  }, [items]);

  const reviewedCount = useMemo(
    () => items.filter((item) => reviewState[item.id] === 'validated').length,
    [items, reviewState],
  );
  const pendingCount = useMemo(
    () => items.filter((item) => item.category === 'revision' && (reviewState[item.id] ?? 'pending') === 'pending').length,
    [items, reviewState],
  );

  const getCategoryBadgeClass = (category: GazetteFeedItem['category']) => {
    switch (category) {
      case 'reforma':
        return 'bg-surface-container text-secondary';
      case 'nueva':
        return 'bg-surface-container text-tertiary';
      case 'derogacion':
        return 'bg-error-container text-on-error-container';
      case 'revision':
        return 'bg-surface-container-highest text-on-primary-fixed';
      default:
        return 'bg-surface-container text-on-surface-variant';
    }
  };

  const getCategoryLabel = (category: GazetteFeedItem['category']) => {
    switch (category) {
      case 'reforma':
        return 'Reforma';
      case 'nueva':
        return 'Nueva Ley';
      case 'derogacion':
        return 'Derogación';
      case 'revision':
        return 'En Revisión';
      default:
        return category;
    }
  };

  const getJurisdictionFlag = (jurisdiction: Jurisdiction) => {
    switch (jurisdiction) {
      case 'MX':
        return '🇲🇽';
      case 'CU':
        return '🇨🇺';
      case 'DO':
        return '🇩🇴';
      default:
        return '🌐';
    }
  };

  const getJurisdictionName = (jurisdiction: Jurisdiction) => {
    switch (jurisdiction) {
      case 'MX':
        return 'México (DOF)';
      case 'CU':
        return 'Cuba (Gaceta Oficial)';
      case 'DO':
        return 'Rep. Dominicana';
      default:
        return jurisdiction;
    }
  };

  const renderFeedItem = (item: GazetteFeedItem) => {
    const isRevision = item.category === 'revision';
    const isDerogacion = item.category === 'derogacion';
    const itemReview = reviewState[item.id] ?? 'pending';

    return (
      <motion.article
        key={item.id}
        layout
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className={`bg-surface-container-lowest rounded-xl p-space-md card-elevated flex flex-col gap-space-sm relative border border-outline-variant/20 ${
          isRevision && itemReview === 'validated'
            ? 'border-[#059669] bg-[#ECFDF5]/60'
            : isRevision && itemReview === 'discarded'
            ? 'opacity-50'
            : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="font-label-sm text-label-sm px-2.5 py-0.5 rounded-full bg-surface-container text-secondary font-semibold">
            {item.typeLabel} · {getJurisdictionFlag(item.jurisdiction)} {getJurisdictionName(item.jurisdiction)}
          </span>
          <span className={`font-label-sm text-label-sm ${getCategoryBadgeClass(item.category)} px-2.5 py-0.5 rounded-full flex items-center gap-1 font-medium`}>
            <span className="material-symbols-outlined text-[13px]">
              {item.category === 'reforma' ? 'edit' : item.category === 'nueva' ? 'newspaper' : item.category === 'derogacion' ? 'cancel' : 'pending'}
            </span>
            {getCategoryLabel(item.category)}
          </span>
        </div>
        <div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            {item.title}
          </h3>
          {item.quote && (
            <p className="font-legal-quote text-legal-quote text-on-surface-variant mt-1 italic pl-3 border-l-2 border-outline-variant">
              {item.quote}
            </p>
          )}
          {item.summary && !item.quote && (
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              {item.summary}
            </p>
          )}
        </div>
        {item.impact && (
          <div className="bg-surface-container-low rounded-lg p-space-sm flex flex-col gap-1 border-l-4 border-secondary">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-secondary font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">priority_high</span>
                Impacto Operativo: {item.impact.level}
              </span>
              {item.impact.articlesModified && (
                <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                  Modifica {item.impact.articlesModified}
                </span>
              )}
            </div>
            <p className="font-body-md text-body-md text-on-surface">
              {item.impact.details}
            </p>
          </div>
        )}
        {item.conflictDetails && (
          <div className="bg-error-container/30 rounded-lg p-space-sm flex items-center justify-between border border-error/15">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-error text-[18px]">warning</span>
              <span className="font-body-sm text-body-sm text-on-surface font-medium">
                Conflicto detectado en {item.conflictDetails.article}:
              </span>
            </div>
            <span className="font-label-md text-label-md text-error font-bold">
              {item.conflictDetails.conflictText}
            </span>
          </div>
        )}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {item.tags.map((tag) => (
              <span key={tag} className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-medium">
                #{tag}
              </span>
            ))}
          </div>
        )}
        {isDerogacion && item.derogationDetails && (
          <div className="flex items-center justify-between pt-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              Grafo de Conocimiento actualizado
            </span>
            <button
              onClick={onOpenComparative}
              className="px-2.5 py-1 rounded-lg bg-secondary-fixed/50 text-secondary font-label-sm text-label-sm font-bold flex items-center gap-1 cursor-pointer"
              type="button"
            >
              Ver Tabla Comparativa
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            </button>
          </div>
        )}
        {isRevision && itemReview === 'pending' && (
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => handleReview(item.id, 'validated')}
              className="flex-1 py-2.5 px-3 rounded-xl bg-primary btn-lift-primary text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              Revisar y Validar
            </button>
            <button
              onClick={() => handleReview(item.id, 'discarded')}
              className="py-2.5 px-3.5 rounded-xl bg-surface-container-lowest text-on-surface-variant font-label-md text-label-md font-semibold flex items-center justify-center gap-1 hover:text-error cursor-pointer border border-outline-variant/30"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              Descartar
            </button>
          </div>
        )}
        {isRevision && itemReview === 'validated' && (
          <div className="flex items-center gap-2 pt-1 text-[#065F46] bg-[#ECFDF5]/60 rounded-lg p-2 border border-[#059669]/30">
            <span className="material-symbols-outlined text-[18px]">verified</span>
            <span className="font-body-sm text-body-sm font-medium">
              Validada e incorporada al índice.
            </span>
          </div>
        )}
        {isRevision && itemReview === 'discarded' && (
          <div className="flex items-center gap-2 pt-1 text-error bg-error-container/30 rounded-lg p-2 border border-error/20">
            <span className="material-symbols-outlined text-[18px]">cancel</span>
            <span className="font-body-sm text-body-sm font-medium">
              Conflicto descartado del pipeline.
            </span>
          </div>
        )}
      </motion.article>
    );
  };

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

      {/* Source status for the user's single jurisdiction */}
      <section className="flex flex-col gap-space-sm pt-space-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-secondary"></span>
            </span>
            <span className="font-label-md text-label-md text-on-surface uppercase tracking-wider font-semibold">
              Monitor de Gacetas
            </span>
          </div>
          <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container-high px-2.5 py-0.5 rounded-full font-medium">
            {getJurisdictionFlag(country)} {country}
          </span>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-space-md card-elevated flex flex-col gap-space-xs border border-outline-variant/20">
          <div className="flex items-start justify-between gap-space-sm">
            <div className="flex items-center gap-space-xs">
              <span className="text-[20px]">{getJurisdictionFlag(country)}</span>
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface leading-tight font-semibold">
                  {getJurisdictionName(country)}
                </h2>
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  {GAZETTE_SOURCES[country].name}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-low text-on-tertiary-container font-label-sm text-label-sm font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container"></span>
              {items.length} entradas
            </span>
          </div>
          {lastScanSummary && (
            <div className="bg-surface-container-low rounded-lg p-2.5 flex items-center gap-2 mt-1 border border-outline-variant/15">
              <span className="material-symbols-outlined text-secondary text-[18px]">verified</span>
              <span className="font-body-sm text-body-sm text-on-surface font-medium">
                Último escaneo: {lastScanSummary}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Interactive Controls & Manual Trigger Section */}
      <section className="flex flex-col gap-space-sm">
        <div className="flex items-center justify-between">
          <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Operaciones del Crawler
          </span>
          <button
            onClick={onOpenLogs}
            className="px-2.5 py-1 rounded-lg bg-secondary-fixed/50 text-secondary font-label-sm text-label-sm cursor-pointer font-semibold flex items-center gap-1"
            type="button"
          >
            <span className="material-symbols-outlined text-[14px]">terminal</span>
            <span>Ver Logs</span>
          </button>
        </div>

        {onNavigateToTab && (
          <div className="grid grid-cols-2 gap-2.5 pb-1">
            <button
              onClick={() => onNavigateToTab('extractor')}
              type="button"
              className="p-3.5 rounded-xl bg-surface-container-lowest border border-secondary/30 hover:border-secondary text-left flex flex-col gap-1 cursor-pointer group"
            >
              <div className="flex items-center justify-between text-secondary">
                <span className="material-symbols-outlined text-[20px]">
                  smart_toy
                </span>
                <span className="text-[10px] bg-secondary-fixed text-secondary px-1.5 py-0.5 rounded font-bold font-mono">
                  .md + .json
                </span>
              </div>
              <span className="font-label-md text-label-md text-on-surface font-bold leading-tight">
                Agente Extractor PDF
              </span>
              <span className="text-[11px] text-on-surface-variant leading-tight">
                Detecta leyes por tema y extrae en carpetas
              </span>
            </button>

            <button
              onClick={() => onNavigateToTab('rag_indexer')}
              type="button"
              className="p-3.5 rounded-xl bg-surface-container-lowest border border-secondary/30 hover:border-secondary text-left flex flex-col gap-1 cursor-pointer group"
            >
              <div className="flex items-center justify-between text-secondary">
                <span className="material-symbols-outlined text-[20px]">
                  account_tree
                </span>
                <span className="text-[10px] bg-[#ECFDF5] text-[#065F46] px-1.5 py-0.5 rounded font-bold font-mono">
                  LangGraph
                </span>
              </div>
              <span className="font-label-md text-label-md text-on-surface font-bold leading-tight">
                RAG Indexador
              </span>
              <span className="text-[11px] text-on-surface-variant leading-tight">
                Indexa archivos en cualquier formato
              </span>
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt,.md"
          className="hidden"
          onChange={handleGazetteUpload}
          disabled={isUploadingGazette || isScanning}
        />

        <button
          onClick={handleManualScan}
          disabled={isScanning || isUploadingGazette}
          className={`w-full text-on-primary rounded-xl py-3 px-space-md flex items-center justify-center gap-space-xs cursor-pointer ${
            isScanning || isUploadingGazette
              ? 'bg-secondary-container btn-lift-secondary opacity-80'
              : 'bg-primary btn-lift-primary'
          }`}
          type="button"
        >
          <span
            className={`material-symbols-outlined text-[20px] ${
              isScanning ? 'animate-spin' : ''
            }`}
          >
            bolt
          </span>
          <span className="font-label-lg text-label-lg font-semibold tracking-wide">
            {scanStatusText}
          </span>
        </button>

        <button
          type="button"
          onClick={openFilePicker}
          disabled={isUploadingGazette || isScanning}
          className="w-full px-4 py-2.5 rounded-xl bg-secondary btn-lift-secondary text-on-secondary font-label-md text-label-md font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-default"
        >
          <span className="material-symbols-outlined text-[18px]">upload_file</span>
          <span>Subir Gaceta Manual (PDF/DOCX/TXT)</span>
        </button>

        {scanError && (
          <div className="bg-error-container/40 rounded-xl p-space-md border border-error/20 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-error text-[20px]">error</span>
              <p className="font-body-md text-body-md text-on-surface font-medium">
                {scanError}
              </p>
            </div>
            <button
              onClick={handleManualScan}
              disabled={isScanning}
              className="self-start px-3 py-1.5 rounded-lg bg-error text-on-error font-label-md text-label-md font-semibold cursor-pointer"
              type="button"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Filter Pills (Scrollable horizontal rail) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-1 no-scrollbar">
          <button
            onClick={() => setFilter('todos')}
            className={`px-3.5 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap cursor-pointer ${
              filter === 'todos'
                ? 'bg-primary text-on-primary btn-lift-primary'
                : 'bg-surface-container-lowest border border-outline-variant/25 text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            Todos
          </button>
          <button
            onClick={() => setFilter('nuevas')}
            className={`px-3.5 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap cursor-pointer ${
              filter === 'nuevas'
                ? 'bg-primary text-on-primary btn-lift-primary'
                : 'bg-surface-container-lowest border border-outline-variant/25 text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            Nuevas Leyes
          </button>
          <button
            onClick={() => setFilter('reformas')}
            className={`px-3.5 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap cursor-pointer ${
              filter === 'reformas'
                ? 'bg-primary text-on-primary btn-lift-primary'
                : 'bg-surface-container-lowest border border-outline-variant/25 text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            Reformas
          </button>
          <button
            onClick={() => setFilter('derogaciones')}
            className={`px-3.5 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              filter === 'derogaciones'
                ? 'bg-error text-on-error shadow-md'
                : 'bg-error-container text-on-error-container'
            }`}
            type="button"
          >
            <span>Derogaciones</span>
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center font-label-sm text-label-sm ${
                filter === 'derogaciones' ? 'bg-white text-error' : 'bg-error text-on-error'
              }`}
            >
              {categoryCounts.derogacion}
            </span>
          </button>
          <button
            onClick={() => setFilter('revision')}
            className={`px-3.5 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              filter === 'revision'
                ? 'bg-primary text-on-primary btn-lift-primary'
                : 'bg-surface-container-highest text-on-primary-fixed'
            }`}
            type="button"
          >
            <span>En Revisión Humana</span>
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center font-label-sm text-label-sm ${
                filter === 'revision'
                  ? 'bg-secondary text-white'
                  : 'bg-primary text-on-primary'
              }`}
            >
              {categoryCounts.revision}
            </span>
          </button>
        </div>
      </section>

      {/* Feed de Últimas Publicaciones Procesadas */}
      <section className="flex flex-col gap-space-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-secondary text-[22px]">schema</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Publicaciones Registradas
            </h2>
          </div>
          <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
            {filteredItems.length} eventos recientes
          </span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-xl p-space-lg card-elevated text-center border border-outline-variant/20">
            <span className="material-symbols-outlined text-secondary text-[48px] mb-3 block">inbox</span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-1">
              Sin publicaciones procesadas
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Aún no se han indexado gacetas oficiales. Ejecuta un escaneo para consultar la fuente.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredItems.map(renderFeedItem)}
          </AnimatePresence>
        )}

        {items.length > 0 && filteredItems.length === 0 && (
          <div className="text-center py-4 text-on-surface-variant font-body-sm text-body-sm">
            Sin resultados para este filtro
          </div>
        )}
      </section>

      {/* Metrics computed from actual stored data */}
      <section className="bg-surface-container-lowest rounded-xl p-space-md card-elevated flex flex-col gap-space-sm mb-space-lg border border-outline-variant/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-secondary text-[20px]">hub</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Métricas del Tenant
            </h2>
          </div>
          <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
            {country}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5 pt-1">
          <div className="bg-surface-container-low rounded-xl p-3 flex flex-col items-center justify-center text-center border border-outline-variant/15">
            <span className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-bold tabular-nums">
              {items.length}
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
              Entradas
            </span>
          </div>
          <div className="bg-surface-container-low rounded-xl p-3 flex flex-col items-center justify-center text-center border border-outline-variant/15">
            <span className="font-headline-lg-mobile text-headline-lg-mobile text-secondary font-bold tabular-nums">
              {reviewedCount}
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
              Revisadas
            </span>
          </div>
          <div className="bg-surface-container-low rounded-xl p-3 flex flex-col items-center justify-center text-center border border-outline-variant/15">
            <span className="font-headline-lg-mobile text-headline-lg-mobile text-on-tertiary-container font-bold tabular-nums">
              {pendingCount}
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
              Pendientes
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
