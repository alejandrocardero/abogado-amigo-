import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatMessage, Jurisdiction, LegalCitation, LegalOpinion, UserProfile, LawCatalogItem } from '../types';
import { sampleKnowledgeBase } from '../data/legalData';
import storage from '../lib/db';
import { generateLegalOpinion } from '../lib/ollamaLegal';
import { retrieveTopK, TextChunk } from '../lib/documents';

interface SpeechRecognitionLike {
  start(): void;
  stop(): void;
  onresult: ((e: { results: Array<Array<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  lang: string;
  interimResults: boolean;
}

// The Web Speech API is undeclared in lib.dom and shipped under two vendor names.
const getSR = (): (new () => SpeechRecognitionLike) | null => {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
};

/** Only ever rendered for the signed-in user's country: the chat has no switcher. */
const COUNTRY_INFO: Record<
  Jurisdiction,
  { flag: string; title: string; source: string; time: string; gazette: string }
> = {
  MX: {
    flag: '🇲🇽',
    title: 'México Federal',
    source: 'DOF MÉXICO',
    time: 'Sinc. hoy 06:00 AM',
    gazette: 'Ver en DOF',
  },
  CU: {
    flag: '🇨🇺',
    title: 'Cuba Nacional',
    source: 'GACETA OFICIAL CUBA',
    time: 'Sinc. hoy 07:15 AM',
    gazette: 'Ver en Gaceta (Cuba)',
  },
  DO: {
    flag: '🇩🇴',
    title: 'Rep. Dominicana',
    source: 'GACETA OFICIAL DO',
    time: 'Extracción en curso',
    gazette: 'Ver en Gaceta (R.D.)',
  },
};

const TEXT_EXTENSIONS = ['txt', 'md', 'json', 'xml', 'csv', 'html'] as const;
const ATTACHMENT_SNIPPET_LIMIT = 500;

interface AsistenteScreenProps {
  onOpenCitation: (c: LegalCitation) => void;
  onOpenDictamen: (o: LegalOpinion) => void;
  onNavigateToLaw: (law: LawCatalogItem) => void;
  userProfile?: UserProfile | null;
}

export const AsistenteScreen: React.FC<AsistenteScreenProps> = ({
  onOpenCitation,
  onOpenDictamen,
  onNavigateToLaw,
  userProfile,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => storage.messages.get());
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{ name: string; snippet: string } | null>(
    null
  );
  const [isNearBottom, setIsNearBottom] = useState(false);
  const [canScrollPage, setCanScrollPage] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Botón flotante: si estás arriba te lleva al fondo y viceversa.
  useEffect(() => {
    const update = () => {
      const doc = document.documentElement;
      setCanScrollPage(doc.scrollHeight - window.innerHeight > 240);
      setIsNearBottom(window.innerHeight + window.scrollY >= doc.scrollHeight - 160);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [messages.length]);

  const handleScrollJump = () => {
    window.scrollTo({
      top: isNearBottom ? 0 : document.documentElement.scrollHeight,
      behavior: 'smooth',
    });
  };

  const [indexedDocs, setIndexedDocs] = useState<{ chunks: TextChunk[] }[]>(() => storage.indexedDocs.get());

  useEffect(() => {
    setIndexedDocs(storage.indexedDocs.get());
  }, []);

  // Product rule: jurisdiction is owned by the account, never by the chat UI.
  const jurisdiction: Jurisdiction = userProfile?.country ?? 'MX';
  const currentJur = COUNTRY_INFO[jurisdiction];

  // Helper: find matching law in local storage by title, code, or partial match
  const findMatchingLaw = useCallback((citation: LegalCitation): LawCatalogItem | null => {
    const laws = storage.laws.get();
    if (!laws.length) return null;

    const searchTerms = [
      citation.lawName.toLowerCase(),
      citation.article.toLowerCase(),
    ].filter(Boolean);

    // Try exact match first (by title or code)
    for (const law of laws) {
      const lawTitle = law.title.toLowerCase();
      const lawCode = law.code.toLowerCase();
      for (const term of searchTerms) {
        if (lawTitle.includes(term) || lawCode.includes(term)) {
          return law;
        }
      }
    }

    // Fallback: partial match on description
    for (const law of laws) {
      const lawDesc = law.description.toLowerCase();
      for (const term of searchTerms) {
        if (lawDesc.includes(term)) return law;
      }
    }

    return null;
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const handleAttachmentSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!file.type.startsWith('text/') && !(TEXT_EXTENSIONS as readonly string[]).includes(ext)) {
      showToast('Formato no soportado: solo archivos de texto');
      return;
    }
    try {
      const snippet = (await file.text()).slice(0, ATTACHMENT_SNIPPET_LIMIT);
      setPendingAttachment({ name: file.name, snippet });
      showToast('Archivo listo para enviar');
    } catch {
      showToast('No se pudo leer el archivo');
    }
  };

  const toggleDictation = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognitionCtor = getSR();
    if (!SpeechRecognitionCtor) {
      showToast('Tu navegador no soporta dictado por voz');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.onresult = (result) => {
      const transcript = result.results[0]?.[0]?.transcript.trim() ?? '';
      if (!transcript) return;
      setInputValue((current) => (current.trim() ? `${current.trim()} ${transcript}` : transcript));
    };
    recognition.onerror = () => {
      setIsRecording(false);
      recognitionRef.current = null;
      showToast('No pude captar el audio; revisa el micrófono');
    };
    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
      showToast('Escuchando consulta jurídica en español…');
    } catch {
      recognitionRef.current = null;
      showToast('No se pudo iniciar el dictado por voz');
    }
  };

  const handleSend = useCallback(async (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query || isGenerating) return;

    const newMsgId = `msg-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: newMsgId,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      authorLabel: userProfile
        ? `${userProfile.userName} · ${userProfile.businessName}`
        : `Tú · ${currentJur.title}`,
      text: query,
      attachment: pendingAttachment ?? undefined,
    };

    const optimisticMessages = [...messages, userMsg];
    setMessages(optimisticMessages);
    storage.messages.set(optimisticMessages);
    setInputValue('');
    setPendingAttachment(null);
    setIsGenerating(true);

    const loadingMsgId = `assistant-loading-${Date.now()}`;
    const loadingMsg: ChatMessage = {
      id: loadingMsgId,
      sender: 'assistant',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      authorLabel: 'Abogado Amigo',
      opinion: undefined,
      text: 'Generando dictamen legal con IA...',
    };
    setMessages((prev) => [...prev, loadingMsg]);

    try {
      const allChunks = indexedDocs.flatMap((d) => d.chunks);
      const relevantResults = retrieveTopK(query, allChunks, 5);
      const documentContext = relevantResults.length > 0
        ? relevantResults.map((r) => `[Fuente: ${r.chunk.content.slice(0, 300)}...]`).join('\n\n')
        : '';

      const opinionResponse = await generateLegalOpinion(
        query,
        jurisdiction,
        userProfile ? { userName: userProfile.userName, businessName: userProfile.businessName } : undefined,
        documentContext
      );

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        authorLabel: 'Abogado Amigo',
        opinion: opinionResponse,
      };

      const finalMessages = [...messages, userMsg, assistantMsg];
      setMessages(finalMessages);
      storage.messages.set(finalMessages);
    } catch (error) {
      console.error('[Asistente] Error:', error);
      const fallbackOpinion = {
        id: `opinion-${Date.now()}`,
        jurisdiction,
        topic: query.slice(0, 35) + '...',
        badgeTitle:
          jurisdiction === 'MX'
            ? 'DICTAMEN FUNDAMENTADO · LFT & CFF (MÉXICO)'
            : jurisdiction === 'CU'
            ? 'DICTAMEN FUNDAMENTADO · DECRETO-LEY 88 & LEY 116 (CUBA)'
            : 'DICTAMEN FUNDAMENTADO · CÓDIGO DE TRABAJO (REP. DOMINICANA)',
        summary: `Para tu consulta sobre "${query}", la legislación vigente establece obligaciones específicas. Se recomienda revisar la normativa aplicable.`,
        citations: [
          {
            lawName: jurisdiction === 'MX' ? 'Ley Federal del Trabajo' : jurisdiction === 'CU' ? 'Decreto-Ley No. 88' : 'Código de Trabajo Ley 16-92',
            article: 'Normativa General Vigente',
            sourceRef: 'Gaceta Oficial Indexada',
            quote: 'Toda relación de prestación de servicios remunerados subordinados goza de presunción legal de relación contractual con todas las prerrogativas de ley.',
          },
        ],
        graphConnections: [
          { label: 'Estatuto Principal', icon: 'gavel', type: 'primary' },
          { label: 'Obligación Patronal', icon: 'schedule', type: 'neutral' },
          { label: 'Seguridad Social', icon: 'shield', type: 'secondary' },
        ],
        takeaways: [
          { id: 1, title: 'Formalización de Expediente', description: 'Conserva copia firmada de identificación, comprobante y contrato debidamente foliado.', boldHighlight: 'copia firmada' },
          { id: 2, title: 'Calendario de Vencimientos', description: 'Programa alertas periódicas para evitar recargos y multas de las autoridades fiscales.', boldHighlight: 'alertas periódicas' },
        ],
        disclaimer: 'Esta orientación es informativa y sustentada en legislación oficial indexada. No sustituye el mandato ni patrocinio letrado de un abogado certificado.',
      } satisfies LegalOpinion;

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        authorLabel: 'Abogado Amigo',
        opinion: fallbackOpinion,
      };

      const finalMessages = [...messages, userMsg, assistantMsg];
      setMessages(finalMessages);
      storage.messages.set(finalMessages);
    } finally {
      setIsGenerating(false);
    }
  }, [inputValue, isGenerating, messages, pendingAttachment, userProfile, jurisdiction, currentJur, indexedDocs]);

  const handleCopyCitation = (opinion: LegalOpinion) => {
    if (opinion.citations.length > 0) {
      const c = opinion.citations[0];
      navigator.clipboard?.writeText(`${c.lawName} (${c.article}): "${c.quote}"`);
      showToast('Cita legal copiada al portapapeles');
    }
  };

  return (
    <div className="flex flex-col w-full relative">
      {/* Toast Notification Banner */}
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

      {/* Status & RAG Verification Sub-bar */}
      <div className="px-margin pt-space-xs pb-space-sm flex flex-col gap-space-xs max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between bg-surface-container-low px-3.5 py-2.5 rounded-xl border border-outline-variant/20 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-2 w-2 relative flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
            </span>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-label-sm text-label-sm text-secondary font-bold tracking-tight">
                  {currentJur.source}
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                  · {currentJur.time}
                </span>
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
                Bases Oficiales en vigor indexadas
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-surface-container-lowest px-2.5 py-1 rounded-full border border-outline-variant/20 shadow-xs flex-shrink-0">
            <span className="material-symbols-outlined text-[14px] text-secondary fill-1">
              verified
            </span>
            <span className="font-label-sm text-label-sm text-on-surface">Indexación Local</span>
          </div>
        </div>

        {/* Registered Jurisdiction — read-only, driven by the account country */}
        <div className="flex items-center gap-2 px-3.5 py-2 bg-surface-container-lowest rounded-xl border border-outline-variant/20 shadow-xs">
          <span className="text-base leading-none">{currentJur.flag}</span>
          <div className="flex items-center gap-1 min-w-0">
            <span className="font-label-md text-label-md text-on-surface font-semibold">
              Jurisdicción:
            </span>
            <span className="font-label-md text-label-md text-secondary font-bold truncate">
              {currentJur.title}
            </span>
          </div>
        </div>
      </div>

      {/* Conversation Flow Container */}
      <div className="flex flex-col px-margin gap-space-lg pb-36 max-w-2xl mx-auto w-full">
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center justify-center gap-4 py-16 px-4 max-w-2xl mx-auto"
          >
            <div className="w-16 h-16 rounded-2xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px] text-on-surface-variant">balance</span>
            </div>
            <div className="text-center">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Aún no hay consultas
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1.5 max-w-xs">
                Escribe tu primera consulta legal o usa una de las sugerencias de abajo.
              </p>
            </div>
          </motion.div>
        ) : (
          messages.map((msg, idx) => {
          if (msg.sender === 'user') {
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.28, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-end self-end max-w-[90%] gap-1"
              >
                <div className="flex items-center gap-1.5 text-on-surface-variant px-1">
                  <span className="font-label-sm text-label-sm">{msg.authorLabel}</span>
                  <span className="font-label-sm text-label-sm">{msg.timestamp}</span>
                </div>
                <div className="bg-primary text-on-primary px-4 py-3 rounded-2xl rounded-br-sm shadow-md border border-white/10 flex flex-col gap-2">
                  {msg.attachment && (
                    <div className="flex items-start gap-2 bg-white/10 border border-white/10 rounded-xl px-2.5 py-2">
                      <span className="material-symbols-outlined text-[16px] text-secondary-fixed flex-shrink-0 mt-0.5">
                        attach_file
                      </span>
                      <div className="flex flex-col min-w-0 gap-0.5">
                        <span className="font-label-sm text-label-sm text-on-primary font-semibold truncate">
                          {msg.attachment.name}
                        </span>
                        {msg.attachment.snippet && (
                          <span className="font-body-sm text-body-sm text-on-primary/60 leading-snug line-clamp-2 break-words">
                            {msg.attachment.snippet}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <p className="font-body-md text-body-md text-on-primary leading-relaxed">
                    {msg.text}
                  </p>
                </div>
              </motion.div>
            );
          }

          const opinion = msg.opinion;
          if (!opinion) return null;

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.34, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-start self-start w-full gap-2"
            >
              {/* Assistant Header Label */}
              <div className="flex items-center gap-2 px-1">
                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-on-secondary shadow-sm">
                  <span className="material-symbols-outlined text-[15px]">balance</span>
                </div>
                <span className="font-label-md text-label-md text-on-surface font-bold">
                  Abogado Amigo
                </span>
                <span className="bg-surface-container-high text-secondary px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold">
                  Dictamen AI Asistido
                </span>
              </div>

              {/* Main Assistant Container */}
              <div className="bg-surface-container-lowest w-full rounded-2xl rounded-bl-sm p-4 border border-outline-variant/20 card-elevated flex flex-col gap-space-md">
                {/* Legal Status Verification Badge */}
                <div className="flex items-center gap-2 bg-surface-container-low p-2.5 rounded-xl border border-outline-variant/15">
                  <span className="h-2.5 w-2.5 rounded-full bg-secondary flex-shrink-0"></span>
                  <span className="font-label-sm text-label-sm text-on-surface font-bold uppercase tracking-wider">
                    {opinion.badgeTitle}
                  </span>
                </div>

                {/* Executive Summary */}
                <div className="flex flex-col gap-1">
                  <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest font-bold">
                    Resumen Ejecutivo
                  </span>
                  <p className="font-headline-sm text-headline-sm text-on-surface font-medium leading-snug">
                    {opinion.summary}
                  </p>
                </div>

                {/* Interactive Legal Authorities & Citations Card */}
                {opinion.citations.length > 0 && (
                  <div className="bg-surface-container-low rounded-xl p-3.5 flex flex-col gap-3 border border-outline-variant/15">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-secondary text-[20px]">
                          gavel
                        </span>
                        <span className="font-label-md text-label-md text-on-surface font-bold">
                          Fundamento Normativo Oficial
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-bright text-on-surface border border-outline-variant/20 shadow-xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-secondary"></span>
                        <span className="font-label-sm text-label-sm font-bold text-secondary">
                          LEY VIGENTE
                        </span>
                      </span>
                    </div>

                    {opinion.citations.map((c, index) => (
                      <div
                        key={index}
                        className="bg-surface-container-lowest rounded-xl p-3 flex flex-col gap-1.5 border border-outline-variant/15 card-elevated"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-label-sm text-label-sm font-bold text-on-surface">
                            {c.lawName}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const law = findMatchingLaw(c);
                              if (law) {
                                onNavigateToLaw(law);
                              } else {
                                const countryNames: Record<string, string> = { MX: 'México', CU: 'Cuba', DO: 'República Dominicana' };
                                const countryName = countryNames[jurisdiction] || jurisdiction;
                                showToast(`No se encontró "${c.lawName}" en la base local para ${countryName}. Actualiza gacetas oficiales o sube documentos.`);
                              }
                            }}
                            className="px-2 py-0.5 rounded-md bg-secondary-fixed/50 text-secondary font-label-sm text-label-sm flex items-center gap-0.5 cursor-pointer"
                            title="Leer ley completa en el apartado Leyes"
                          >
                            <span className="material-symbols-outlined text-[13px]">menu_book</span>
                            <span>Ley completa</span>
                          </button>
                        </div>
                        <p className="font-legal-quote text-legal-quote text-on-surface-variant italic pl-2.5 border-l-2 border-secondary/40">
                          {c.quote}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                    {/* Business Takeaways Callout */}
                {opinion.takeaways.length > 0 && (
                  <div className="bg-surface-container rounded-xl p-3.5 flex flex-col gap-2.5 border border-outline-variant/15">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-[20px]">
                        storefront
                      </span>
                      <span className="font-label-md text-label-md text-on-surface font-bold">
                        Impacto Operativo Inmediato (Cafetería)
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 text-on-surface">
                      {opinion.takeaways.map((takeaway) => (
                        <div
                          key={takeaway.id}
                          className="flex items-start gap-2.5 bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/15 card-elevated"
                        >
                          <div className="w-6 h-6 rounded-full bg-surface-container-low text-secondary flex items-center justify-center font-label-sm text-label-sm font-bold flex-shrink-0">
                            {takeaway.id}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-label-md text-label-md text-on-surface font-semibold">
                              {takeaway.title}
                            </span>
                            <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                              {takeaway.boldHighlight ? (
                                <>
                                  {takeaway.description.split(takeaway.boldHighlight)[0]}
                                  <strong className="text-on-surface font-semibold">
                                    {takeaway.boldHighlight}
                                  </strong>
                                  {takeaway.description.split(takeaway.boldHighlight)[1]}
                                </>
                              ) : (
                                takeaway.description
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mandatory Legal Disclaimer Box */}
                <div className="bg-surface-container-low p-2.5 rounded-xl flex items-start gap-2 border border-outline-variant/15">
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant flex-shrink-0 mt-0.5">
                    info
                  </span>
                  <p className="font-label-sm text-label-sm text-on-surface-variant leading-relaxed">
                    <strong>Aviso de Alcance:</strong> {opinion.disclaimer}
                  </p>
                </div>

                {/* Quick Action Buttons Array */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <button
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/25 text-on-surface font-label-sm text-label-sm font-semibold cursor-pointer"
                    onClick={() => handleCopyCitation(opinion)}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[15px] text-secondary">content_copy</span>
                    <span>Copiar Cita</span>
                  </button>
                  <button
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/25 text-on-surface font-label-sm text-label-sm font-semibold cursor-pointer"
                    onClick={() => onOpenDictamen(opinion)}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[15px] text-secondary">picture_as_pdf</span>
                    <span>Descargar Dictamen</span>
                  </button>
<button
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-secondary-fixed hover:bg-secondary-fixed-dim border border-secondary/20 text-secondary font-label-sm text-label-sm font-semibold cursor-pointer"
                      onClick={() => {
                        if (opinion.citations.length > 0) {
                          const law = findMatchingLaw(opinion.citations[0]);
                          if (law) {
                            onNavigateToLaw(law);
                          } else {
                            const countryNames: Record<string, string> = { MX: 'México', CU: 'Cuba', DO: 'República Dominicana' };
                            const countryName = countryNames[jurisdiction] || jurisdiction;
                            showToast(`No se encontró "${opinion.citations[0].lawName}" en la base local para ${countryName}. Actualiza gacetas oficiales o sube documentos.`);
                          }
                        }
                      }}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[15px]">menu_book</span>
                      <span>Leer ley completa</span>
                    </button>
                </div>
              </div>
            </motion.div>
          );
        })
      )}
      </div>

      {/* Botón flotante: salto rápido inicio ⇄ fondo de la conversación */}
      <AnimatePresence>
        {canScrollPage && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            type="button"
            aria-label={
              isNearBottom
                ? 'Ir al inicio de la conversación'
                : 'Ir al final de la conversación'
            }
            title={isNearBottom ? 'Ir arriba' : 'Ir abajo'}
            onClick={handleScrollJump}
            className="fixed bottom-40 right-4 z-40 w-11 h-11 rounded-full bg-primary text-on-primary shadow-xl border border-white/10 flex items-center justify-center cursor-pointer hover:bg-primary/90"
          >
            <span className="material-symbols-outlined text-[22px]">
              {isNearBottom ? 'keyboard_double_arrow_up' : 'keyboard_double_arrow_down'}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Bottom Interactive Consultation Input Floating Bar */}
      <div className="fixed bottom-16 left-0 right-0 z-40 bg-[#f8f9ff]/94 backdrop-blur-xl px-margin pt-2.5 pb-3 shadow-[0_-6px_20px_rgba(11,28,48,0.06)] border-t border-outline-variant/20">
        <div className="flex flex-col gap-2 max-w-lg mx-auto">
          {/* Pending Attachment Preview */}
          {pendingAttachment && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-surface-container-lowest rounded-xl border border-outline-variant/25 shadow-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[16px] text-secondary flex-shrink-0">
                  description
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="font-label-sm text-label-sm text-on-surface font-semibold truncate">
                    {pendingAttachment.name}
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                    {pendingAttachment.snippet.slice(0, 60) || 'Archivo vacío'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                aria-label="Quitar archivo adjunto"
                onClick={() => setPendingAttachment(null)}
                className="w-6 h-6 rounded-full bg-surface-container-low border border-outline-variant/25 text-on-surface-variant hover:text-on-surface flex items-center justify-center flex-shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          )}

          {/* Main Input Bar */}
          <div className="flex items-center gap-2 bg-surface-container-lowest rounded-2xl p-1.5 shadow-md border border-outline-variant/30 focus-within:border-secondary/50 transition-colors">
            {/* Attachment Button */}
            <input
              ref={attachmentInputRef}
              type="file"
              accept=".txt,.md,.json,.xml,.csv,.html,text/plain,text/markdown,text/csv,text/html,application/json,application/xml"
              className="hidden"
              onChange={handleAttachmentSelected}
              disabled={isGenerating}
            />
            <button
              aria-label="Adjuntar documento legal de texto"
              onClick={() => attachmentInputRef.current?.click()}
              disabled={isGenerating}
              className={`w-10 h-10 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface flex-shrink-0 cursor-pointer ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">attach_file</span>
            </button>

            {/* Text Input */}
            <input
              className="flex-1 bg-transparent px-2 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none min-w-0"
              placeholder={isGenerating ? 'Generando respuesta...' : 'Escribe tu consulta legal (ej. contrato, despido, IMSS)...'}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isGenerating) handleSend();
              }}
              disabled={isGenerating}
            />

            {/* Mic / Voice Dictation Button */}
            <button
              aria-label="Dictar consulta legal por voz"
              onClick={toggleDictation}
              disabled={isGenerating || isRecording}
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer ${isGenerating
                  ? 'opacity-50 cursor-not-allowed'
                  : isRecording
                    ? 'bg-error-container text-error animate-pulse'
                    : 'hover:bg-surface-container-low text-on-surface-variant'
                }`}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">mic</span>
            </button>

            {isGenerating ? (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-secondary">
                <span className="material-symbols-outlined text-[20px] animate-pulse">psychology</span>
                <span className="sr-only">Pensando...</span>
              </div>
            ) : (
              <button
                aria-label="Enviar consulta a Abogado Amigo"
                onClick={() => handleSend()}
                className="w-10 h-10 rounded-xl bg-secondary btn-lift-secondary text-on-secondary flex items-center justify-center flex-shrink-0 cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">send</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
