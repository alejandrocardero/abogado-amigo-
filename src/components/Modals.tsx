import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, Variants } from 'motion/react';
import {
  Jurisdiction,
  LegalCitation,
  LegalOpinion,
  LogEntry,
  NotificationItem,
  UserProfile,
  LawCatalogItem,
} from '../types';
import {
  StatuteContent,
  ObligationContent,
  SeguridadSocialContent,
} from '../data/graphFlowContent';
import {
  ResolvedStatuteData,
  ResolvedObligationData,
  ResolvedSeguridadSocialData,
} from '../lib/graphFlowContent';
import storage from '../lib/db';
import { ModelSettingsModal } from './ModelSettingsModal';
import { useOllama } from '../hooks/useOllama';

/** Official gazette per jurisdiction, mirroring the signup country config. */
const GAZETTE: Record<Jurisdiction, { name: string; gazette: string }> = {
  MX: { name: 'México', gazette: 'Diario Oficial de la Federación (DOF)' },
  CU: { name: 'Cuba', gazette: 'Gaceta Oficial de la República (MINJUS)' },
  DO: { name: 'República Dominicana', gazette: 'Gaceta Oficial Dominicana' },
};

const formatTimestamp = (value: string): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('es-MX');
};

const LOG_LEVEL: Record<LogEntry['level'], { dot: string; text: string; label: string }> = {
  info: { dot: 'bg-sky-400', text: 'text-sky-300', label: 'INFO' },
  success: { dot: 'bg-emerald-400', text: 'text-emerald-300', label: 'OK' },
  error: { dot: 'bg-red-400', text: 'text-red-300', label: 'ERR' },
};

const byNewest = <T extends { timestamp: string }>(a: T, b: T): number =>
  b.timestamp.localeCompare(a.timestamp);

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.16 } },
};

const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 16, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 420, damping: 32 },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 10,
    filter: 'blur(2px)',
    transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] },
  },
};

// ==================== Citation / Gazette Reader Modal ====================
interface CitationModalProps {
  citation: LegalCitation | null;
  onClose: () => void;
}

export const CitationModal: React.FC<CitationModalProps> = ({ citation, onClose }) => {
  return (
    <AnimatePresence>
      {citation && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl border border-outline-variant/25 overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="p-4 bg-surface-container flex items-center justify-between border-b border-outline-variant/30">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-secondary-fixed text-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">gavel</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface leading-tight font-semibold">
                    {citation.lawName}
                  </h3>
                  <span className="font-label-sm text-label-sm text-secondary font-semibold">
                    Texto Oficial · {citation.article}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-surface-container-lowest/80 hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant cursor-pointer"
              >
                <span className="material-symbols-outlined text-[19px]">close</span>
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between bg-surface-container-low px-3.5 py-2.5 rounded-xl border border-outline-variant/20">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Fuente Oficial: <strong className="text-on-surface">{citation.sourceRef}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#065F46] font-label-sm text-label-sm font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#059669]"></span>
                  TEXTO OFICIAL
                </span>
              </div>

              <div className="bg-surface-container-low p-4 rounded-xl border-l-4 border-secondary shadow-xs">
                <p className="font-legal-quote text-legal-quote text-on-surface leading-relaxed italic">
                  {citation.quote}
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-label-md text-label-md text-on-surface font-bold uppercase tracking-wider">
                  Interpretación y Aplicación Práctica
                </h4>
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  El cumplimiento de este precepto es mandatorio y auditable por las autoridades laborales. La falta de constancia escrita o retraso en la inscripción no invalida los derechos del trabajador pero genera multas objetivas directas hacia el empleador.
                </p>
              </div>

              <div className="p-3 bg-surface-container-low rounded-xl text-on-surface-variant text-xs flex items-center gap-2 border border-outline-variant/15">
                <span className="material-symbols-outlined text-secondary text-[18px]">verified_user</span>
                <span>
                  Indexado en el RAG local desde {citation.sourceRef}. El texto se muestra tal como fue
                  capturado; no se verificó su vigencia ante la fuente oficial.
                </span>
              </div>
            </div>

            <div className="p-4 bg-surface-container-low flex items-center justify-end gap-2.5 border-t border-outline-variant/20">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(`${citation.lawName} - ${citation.article}:\n${citation.quote}`);
                }}
                className="px-3.5 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 hover:border-secondary/40 text-on-surface font-label-sm text-label-sm font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-secondary">content_copy</span>
                <span>Copiar Cita</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-primary btn-lift-primary text-on-primary font-label-sm text-label-sm font-semibold cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ==================== Certified Dictamen PDF/Modal ====================
interface DictamenModalProps {
  opinion: LegalOpinion | null;
  onClose: () => void;
  userProfile?: UserProfile | null;
}

export const DictamenModal: React.FC<DictamenModalProps> = ({ opinion, onClose, userProfile }) => {
  const jurisdiction = opinion?.jurisdiction ?? userProfile?.country ?? null;
  const gazette = jurisdiction !== null ? GAZETTE[jurisdiction] : null;
  const countryName = userProfile?.countryName ?? gazette?.name ?? '—';
  const recipient = userProfile?.businessName || 'Emprendedor';
  const folio =
    opinion && jurisdiction !== null
      ? `AA-${new Date().getFullYear()}-${jurisdiction}-${opinion.id}`
      : null;

  return (
    <AnimatePresence>
      {opinion && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-container-lowest w-full max-w-xl rounded-2xl shadow-2xl border border-outline-variant/25 overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header bar */}
            <div className="p-4 bg-primary text-on-primary flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-secondary/20 border border-secondary/40 flex items-center justify-center">
                  <span className="material-symbols-outlined text-secondary-fixed text-[22px]">verified</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-primary leading-tight">
                    Dictamen Jurídico Certificado
                  </h3>
                  <p className="font-label-sm text-label-sm text-on-primary/70 font-mono">
                    {folio !== null ? `Folio: ${folio}` : 'Dictamen sin folio asignado'} ·{' '}
                    {folio !== null ? 'Documento informativo sin firma digital' : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-on-primary cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Certificate Paper Style Body */}
            <div className="p-6 overflow-y-auto space-y-4 bg-surface text-on-surface">
              <div className="border border-outline-variant/40 rounded-xl p-4 bg-white shadow-xs space-y-4">
                <div className="flex items-start justify-between border-b border-outline-variant/30 pb-3">
                  <div>
                    <span className="font-label-sm text-label-sm text-secondary font-bold uppercase tracking-wider">
                      Abogado Amigo Sovereign RAG
                    </span>
                    <h4 className="font-headline-md text-headline-md text-on-surface">
                      Cédula de Orientación Normativa
                    </h4>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Jurisdicción: {countryName}
                      {gazette ? ` (${gazette.gazette})` : ''} · Destinatario: {recipient}
                    </p>
                  </div>
                  <div className="w-14 h-14 bg-surface-container-low border border-outline-variant/50 rounded-lg flex flex-col items-center justify-center text-center p-1">
                    <span className="material-symbols-outlined text-secondary text-[24px]">qr_code_2</span>
                    <span className="text-[8px] text-on-surface-variant font-bold leading-none">VALIDAR</span>
                  </div>
                </div>

                <div>
                  <h5 className="font-label-sm text-label-sm text-secondary uppercase tracking-widest font-bold mb-1">
                    Resumen del Asesoramiento
                  </h5>
                  <p className="font-headline-sm text-headline-sm text-on-surface font-medium leading-relaxed">
                    {opinion.summary}
                  </p>
                </div>

                <div>
                  <h5 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mb-2">
                    Preceptos Legales Fundamentales
                  </h5>
                  <div className="space-y-2">
                    {opinion.citations.map((c, i) => (
                      <div key={i} className="p-3 bg-surface-container-low rounded-xl text-sm border border-outline-variant/15">
                        <span className="font-label-sm text-label-sm font-bold text-on-surface block">
                          {c.lawName} ({c.article})
                        </span>
                        <p className="font-legal-quote text-legal-quote text-on-surface-variant italic mt-1 pl-2.5 border-l-2 border-secondary/40">
                          {c.quote}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h5 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mb-2">
                    Hoja de Ruta Operativa
                  </h5>
                  <div className="space-y-2">
                    {opinion.takeaways.map((t) => (
                      <div key={t.id} className="flex items-start gap-2.5 text-xs text-on-surface">
                        <span className="w-4 h-4 rounded-full bg-secondary text-white flex items-center justify-center font-bold flex-shrink-0 text-[10px]">
                          {t.id}
                        </span>
                        <p>
                          <strong>{t.title}:</strong> {t.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-outline-variant/30 flex items-center justify-between text-xs text-on-surface-variant">
                  <span className="font-mono">Sello: {opinion.id ?? '—'}</span>
                  <span className="font-semibold text-secondary">Documento Legal Informativo</span>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="p-4 bg-surface-container-low flex items-center justify-between border-t border-outline-variant/20">
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Listo para imprimir o archivar
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-secondary btn-lift-secondary text-on-secondary font-label-sm text-label-sm font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  <span>Imprimir / Guardar PDF</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ==================== Activity Log Modal ====================
interface CeleryLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CeleryLogsModal: React.FC<CeleryLogsModalProps> = ({ isOpen, onClose }) => {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (isOpen) setEntries(storage.logs.get());
  }, [isOpen]);

  const ordered = useMemo(() => [...entries].sort(byNewest), [entries]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0b1329] text-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] font-mono border border-slate-700"
          >
            <div className="p-4 bg-[#080d1c] flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-sm font-semibold text-slate-200">
                  Registro de actividad local
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 text-xs text-slate-300 leading-relaxed">
              {ordered.length === 0 ? (
                <div className="p-5 bg-slate-900 rounded-xl border border-slate-800 flex flex-col items-center text-center gap-2">
                  <span className="material-symbols-outlined text-[32px] text-slate-500">terminal</span>
                  <span className="text-sm font-semibold text-slate-200">Sin actividad registrada</span>
                  <p className="text-slate-400 leading-relaxed">
                    Aún no se ha registrado actividad. Las acciones del pipeline aparecerán aquí.
                  </p>
                </div>
              ) : (
                ordered.map((entry) => {
                  const level = LOG_LEVEL[entry.level];
                  return (
                    <div
                      key={entry.id}
                      className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-start gap-3"
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${level.dot}`}
                      ></span>
                      <span className="text-slate-500 flex-shrink-0">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                      <span className={`font-semibold flex-shrink-0 ${level.text}`}>
                        {level.label}
                      </span>
                      <span className="text-slate-200 flex-1 break-words">{entry.message}</span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3.5 bg-[#080d1c] flex items-center justify-between border-t border-slate-800">
              <span className="text-[11px] text-slate-500">
                {ordered.length === 1
                  ? '1 entrada'
                  : `${ordered.length} entradas`}
              </span>
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl bg-secondary btn-lift-secondary text-white text-xs font-semibold cursor-pointer"
              >
                Cerrar Consola
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ==================== Comparative Table Modal ====================
interface ComparativeTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile?: UserProfile | null;
}

export const ComparativeTableModal: React.FC<ComparativeTableModalProps> = ({
  isOpen,
  onClose,
  userProfile,
}) => {
  const applies = userProfile?.country === 'DO';
  const tableCountry = GAZETTE.DO;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl border border-outline-variant/25 overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="p-4 bg-surface-container flex items-center justify-between border-b border-outline-variant/30">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-error-container text-error flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface leading-tight font-semibold">
                    Tabla Comparativa de Derogación
                  </h3>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {applies ? `${tableCountry.name} 🇩🇴` : `Comparativa de ${tableCountry.name} 🇩🇴`}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {applies ? (
                <>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-error-container/30 p-3.5 rounded-xl border border-error/20">
                      <span className="font-label-sm text-label-sm text-error font-bold uppercase block mb-1">
                        Norma Derogada (is_current=False)
                      </span>
                      <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                        Ley No. 141-15
                      </h4>
                      <p className="text-on-surface-variant mt-2 leading-relaxed">
                        Reestructuración y Liquidación de Empresas. Procedimientos judiciales lentos de quiebra comercial.
                      </p>
                    </div>

                    <div className="bg-[#ECFDF5] p-3.5 rounded-xl border border-[#059669]/30">
                      <span className="font-label-sm text-label-sm text-[#065F46] font-bold uppercase block mb-1">
                        Norma Vigente Sustituta
                      </span>
                      <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                        Ley Orgánica 45-23
                      </h4>
                      <p className="text-on-surface-variant mt-2 leading-relaxed">
                        Régimen de Garantías Mobiliarias. Sistema Electrónico de Garantías Mobiliarias (SEGM) ágil para pymes.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/20 space-y-1">
                    <h5 className="font-label-sm text-label-sm text-on-surface font-bold">
                      Impacto Inmediato en Contratos y Préstamos
                    </h5>
                    <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                      Cualquier contrato que invoque prendas o privilegios bajo la derogada Ley 141-15 debe actualizarse al régimen registral único de la Ley 45-23 para mantener prioridad crediticia ante entidades bancarias dominicanas.
                    </p>
                  </div>
                </>
              ) : (
                <div className="p-5 bg-surface-container-low rounded-xl border border-outline-variant/15 flex flex-col items-center text-center gap-2">
                  <span className="material-symbols-outlined text-[32px] text-on-surface-variant">
                    public
                  </span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-semibold text-center">
                    Esta tabla comparativa corresponde a la jurisdicción de {tableCountry.name} 🇩🇴
                  </span>
                  <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                    Tu jurisdicción registrada es {userProfile?.countryName ?? 'sin definir'} (
                    {userProfile?.country ?? '—'}), por lo que esta tabla no aplica a tu cuenta.
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-surface-container-low flex items-center justify-end border-t border-outline-variant/20">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-primary btn-lift-primary text-on-primary font-label-sm text-label-sm font-semibold cursor-pointer"
              >
                Cerrar Tabla
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ==================== Notifications Modal ====================
interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (isOpen) setNotifications(storage.notifications.get());
  }, [isOpen]);

  const ordered = useMemo(() => [...notifications].sort(byNewest), [notifications]);
  const unreadCount = ordered.filter((item) => !item.read).length;

  const persist = (next: NotificationItem[]) => {
    setNotifications(next);
    storage.notifications.set(next);
  };

  const markAsRead = (id: string) => {
    const target = notifications.find((item) => item.id === id);
    if (!target || target.read) return;
    persist(notifications.map((item) => (item.id === id ? { ...item, read: true } : item)));
  };

  const markAllAsRead = () => {
    if (unreadCount === 0) return;
    persist(notifications.map((item) => (item.read ? item : { ...item, read: true })));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-start justify-center p-4 pt-28"
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-2xl border border-outline-variant/25 overflow-hidden flex flex-col max-h-[calc(100dvh-9.5rem)]"
          >
            <div className="p-4 bg-surface-container flex items-center justify-between border-b border-outline-variant/30 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-secondary-fixed text-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">notifications_active</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface leading-tight font-semibold">
                    Alertas de Gaceta Oficial
                  </h3>
                  <span className="font-label-sm text-label-sm text-secondary font-semibold">
                    {notifications.length} Alertas de Sincronización
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3">
              {ordered.length === 0 ? (
                <div className="p-5 bg-surface-container-low rounded-xl border border-outline-variant/15 flex flex-col items-center text-center gap-2">
                  <span className="material-symbols-outlined text-[32px] text-on-surface-variant">
                    notifications_off
                  </span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Sin alertas
                  </span>
                  <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                    Aún no hay avisos registrados. Las sincronizaciones e indexaciones se avisarán aquí.
                  </p>
                </div>
              ) : (
                ordered.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/15 flex items-start gap-3"
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${
                        item.read ? 'bg-outline' : 'bg-secondary'
                      }`}
                    ></span>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`font-label-sm text-label-sm ${
                            item.read ? 'text-on-surface-variant' : 'text-on-surface font-bold'
                          }`}
                        >
                          {item.title}
                        </span>
                        <span className="text-[11px] text-on-surface-variant font-mono flex-shrink-0">
                          {formatTimestamp(item.timestamp)}
                        </span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                        {item.message}
                      </p>
                      {!item.read && (
                        <button
                          type="button"
                          onClick={() => markAsRead(item.id)}
                          className="mt-1 text-[11px] font-label-sm text-label-sm font-semibold text-secondary hover:underline cursor-pointer"
                        >
                          Marcar como leída
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3.5 bg-surface-container-low flex items-center justify-between gap-2 border-t border-outline-variant/20 shrink-0">
              <button
                type="button"
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                className="px-3.5 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 hover:border-secondary/40 text-on-surface font-label-sm text-label-sm font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:hover:border-outline-variant/30 disabled:cursor-default cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-secondary">mark_email_read</span>
                <span>Marcar todas como leídas</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-primary btn-lift-primary text-on-primary font-label-sm text-label-sm font-semibold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ==================== User Profile Modal ====================
interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile?: UserProfile | null;
  onLogout?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onLogout,
}) => {
  const initials = userProfile?.businessName
    ? userProfile.businessName.slice(0, 2).toUpperCase()
    : '—';

  const [isModelSettingsOpen, setIsModelSettingsOpen] = useState(false);
  const {
    settings,
    isDiscovering,
    discoverError,
    discoverModels,
    testModel,
    selectModel,
  } = useOllama();

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-start justify-center p-4 pt-28"
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-2xl border border-outline-variant/25 overflow-hidden flex flex-col max-h-[calc(100dvh-9.5rem)]"
          >
            <div className="p-4 bg-primary text-on-primary flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-secondary text-white flex items-center justify-center font-bold shadow-sm">
                  {initials}
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm leading-tight text-white">
                    {userProfile?.businessName || 'Sin datos'}
                  </h3>
                  <span className="font-label-sm text-label-sm text-white/70 font-mono">
                    {userProfile?.email || 'Sin sesión'}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-on-surface">
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/15">
                  <span className="text-on-surface-variant block">Usuario Titular</span>
                  <strong className="text-on-surface text-sm truncate block">
                    {userProfile?.userName || 'Sin datos'}
                  </strong>
                </div>
                <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/15">
                  <span className="text-on-surface-variant block">País / Jurisdicción</span>
                  <strong className="text-on-surface text-sm">
                    {userProfile?.countryName || '—'} ({userProfile?.country || '—'})
                  </strong>
                </div>
                <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/15">
                  <span className="text-on-surface-variant block">Moneda Oficial</span>
                  <strong className="text-secondary text-sm font-mono">
                    {userProfile?.currency || '—'} ({userProfile?.currencySymbol || '—'})
                  </strong>
                </div>
                <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/15">
                  <span className="text-on-surface-variant block">Términos Aceptados</span>
                  <strong className="text-[#065F46] text-sm">
                    {userProfile?.acceptedTermsAt || 'Sin datos'}
                  </strong>
                </div>
              </div>

              <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/25 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm font-bold text-on-surface">
                    Sincronización Transfronteriza
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-[#065F46] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#059669]"></span>
                    Conectado
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Tus consultas son verificadas simultáneamente contra bases oficiales de México (DOF), Cuba (MINJUS) y República Dominicana.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-surface-container-low flex items-center justify-between gap-2 border-t border-outline-variant/20 shrink-0">
              {onLogout ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-error-container/80 hover:bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">logout</span>
                  <span>Cerrar Sesión</span>
                </button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModelSettingsOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 hover:border-secondary/40 text-on-surface font-label-sm text-label-sm font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] text-secondary">settings</span>
                  <span>Configurar Modelos</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-primary btn-lift-primary text-on-primary font-label-sm text-label-sm font-semibold cursor-pointer"
                >
                  Aceptar
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <ModelSettingsModal
      isOpen={isModelSettingsOpen}
      onClose={() => setIsModelSettingsOpen(false)}
      settings={settings}
      isDiscovering={isDiscovering}
      discoverError={discoverError}
      onDiscoverModels={discoverModels}
      onTestModel={testModel}
      onSelectModel={selectModel}
    />
    </>
  );
};

// ==================== Estatuto Principal Modal ====================

interface EstatutoModalProps {
  content: ResolvedStatuteData | null;
  onClose: () => void;
  onNavigateToLaw?: (law: LawCatalogItem) => void;
}

export const EstatutoModal: React.FC<EstatutoModalProps> = ({
  content,
  onClose,
  onNavigateToLaw,
}) => {
  return (
    <AnimatePresence>
      {content && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-container-lowest w-full max-w-3xl rounded-2xl shadow-2xl border border-outline-variant/25 overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-4 bg-surface-container flex items-center justify-between border-b border-outline-variant/30">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary text-[20px]">gavel</span>
                </div>
                <div className="min-w-0">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface leading-tight font-semibold truncate">
                    {content.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-label-sm text-label-sm text-secondary font-semibold">
                      {content.code} · {content.source}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase
                      {content.badge === 'Vigente' ? 'bg-[#ECFDF5] text-[#065F46] border border-[#059669]/30' :
                       content.badge === 'Reformada' ? 'bg-[#FFFAEB] text-[#B45309] border border-[#F59E0B]/30' :
                       content.badge === 'Derogada' ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#EF4444]/30' :
                       'bg-surface-container-high text-on-surface-variant border border-outline-variant/30'
                      }">
                      {content.badge}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-surface-container-lowest/80 hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant cursor-pointer flex-shrink-0"
              >
                <span className="material-symbols-outlined text-[19px]">close</span>
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {/* Description */}
              <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/20">
                <h4 className="font-label-md text-label-md text-on-surface font-bold uppercase tracking-wider mb-2">
                  Descripción
                </h4>
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  {content.description}
                </p>
              </div>

              {/* Key Articles */}
              <div className="space-y-3">
                <h4 className="font-label-md text-label-md text-on-surface font-bold uppercase tracking-wider">
                  Artículos Clave ({content.keyArticles.length})
                </h4>
                <div className="space-y-2">
                  {content.articles.map((article) => (
                    <div
                      key={article.number}
                      className={`bg-surface-container-lowest rounded-xl p-4 border-l-4 transition-colors ${
                        content.keyArticles.includes(article.number)
                          ? 'border-primary bg-primary/5'
                          : 'border-outline-variant/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-label-sm text-label-sm font-bold text-on-surface bg-surface-container-high px-2.5 py-1 rounded-lg flex-shrink-0">
                            Art. {article.number}
                          </span>
                          <div>
                            <h5 className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">
                              {article.title}
                            </h5>
                          </div>
                        </div>
                        {content.keyArticles.includes(article.number) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm font-bold flex-shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                            CLAVE
                          </span>
                        )}
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed mt-2 pl-8">
                        {article.summary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Source Attribution */}
              <div className="p-3 bg-surface-container-low rounded-xl text-on-surface-variant text-xs flex items-center gap-2 border border-outline-variant/15">
                <span className="material-symbols-outlined text-secondary text-[18px]">verified_user</span>
                <span>
                  Texto oficial indexado desde {content.source}. Los artículos mostrados son una selección representativa;
                  consulte la versión completa en la gaceta oficial para vigencia actual.
                </span>
              </div>
            </div>

            <div className="p-4 bg-surface-container-low flex items-center justify-end gap-2.5 border-t border-outline-variant/20">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(
                    `${content.title} (${content.code})\n${content.articles.map((a) => `Art. ${a.number}: ${a.title}`).join('\n')}`
                  );
                }}
                className="px-3.5 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 hover:border-secondary/40 text-on-surface font-label-sm text-label-sm font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-secondary">content_copy</span>
                <span>Copiar Artículos</span>
              </button>
              {onNavigateToLaw && content.catalogItem && (
                <button
                  onClick={() => {
                    onNavigateToLaw(content.catalogItem!);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-primary btn-lift-primary text-on-primary font-label-sm text-label-sm font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">menu_book</span>
                  <span>Ver en Leyes</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-secondary btn-lift-secondary text-on-secondary font-label-sm text-label-sm font-semibold cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ==================== Obligación Patronal Modal ====================

interface ObligacionModalProps {
  content: ResolvedObligationData | null;
  onClose: () => void;
  onNavigateToLaw?: (law: LawCatalogItem) => void;
}

export const ObligacionModal: React.FC<ObligacionModalProps> = ({
  content,
  onClose,
  onNavigateToLaw,
}) => {
  const [expandedSteps, setExpandedSteps] = React.useState<Set<number>>(new Set());

  const toggleStep = (stepId: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  if (!content) return null;

  return (
    <AnimatePresence>
      <motion.div
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={(e) => e.stopPropagation()}
          className="bg-surface-container-lowest w-full max-w-2xl rounded-2xl shadow-2xl border border-outline-variant/25 overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="p-4 bg-surface-container flex items-center justify-between border-b border-outline-variant/30">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-secondary/10 border border-secondary/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary text-[20px]">schedule</span>
              </div>
              <div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface leading-tight font-semibold">
                  {content.obligationTitle}
                </h3>
                <span className="font-label-sm text-label-sm text-secondary font-semibold">
                  Obligación Derivada · {content.steps.length} Pasos
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-surface-container-lowest/80 hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant cursor-pointer"
            >
              <span className="material-symbols-outlined text-[19px]">close</span>
            </button>
          </div>

          <div className="p-5 overflow-y-auto space-y-4">
            {/* Description */}
            <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/20">
              <h4 className="font-label-md text-label-md text-on-surface font-bold uppercase tracking-wider mb-2">
                Qué Establece la Ley
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                {content.description}
              </p>
            </div>

            {/* Legal Foundation */}
            <div className="bg-surface-container-low p-4 rounded-xl border-l-4 border-secondary">
              <h4 className="font-label-sm text-label-sm text-secondary font-bold uppercase tracking-wider mb-1">
                Fundamento Normativo
              </h4>
              <p className="font-legal-quote text-legal-quote text-on-surface-variant italic">
                {content.legalFoundation}
              </p>
            </div>

            {/* Steps Checklist */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-label-md text-label-md text-on-surface font-bold uppercase tracking-wider">
                  Pasos para el Cumplimiento
                </h4>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {content.steps.filter((s) => s.priority === 'Alta').length} de alta prioridad
                </span>
              </div>
              <div className="space-y-2">
                {content.steps.map((step) => {
                  const isExpanded = expandedSteps.has(step.id);
                  const priorityColor =
                    step.priority === 'Alta'
                      ? 'bg-error-container text-error border-error/20'
                      : step.priority === 'Media'
                      ? 'bg-warning-container text-warning border-warning/20'
                      : 'bg-surface-container-high text-on-surface-variant border-outline-variant/20';

                  return (
                    <div
                      key={step.id}
                      className={`group rounded-xl border transition-all duration-200 ${priorityColor}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleStep(step.id)}
                        className="w-full p-4 flex items-start gap-3 text-left"
                      >
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-container-low border border-outline-variant/30 flex items-center justify-center text-on-surface-variant font-label-sm text-label-sm font-bold">
                          {step.id}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h5 className="font-label-md text-label-md text-on-surface font-semibold truncate">
                              {step.title}
                            </h5>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${priorityColor}`}>
                              {step.priority}
                            </span>
                          </div>
                          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed mt-1">
                            {step.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-[11px] text-on-surface-variant">
                            <span className="font-mono bg-surface-container-low px-1.5 py-0.5 rounded">
                              {step.legalBasis}
                            </span>
                            {step.deadline && (
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">schedule</span>
                                {step.deadline}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`material-symbols-outlined text-on-surface-variant transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                          expand_more
                        </span>
                      </button>

                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="px-4 pb-4 border-t border-outline-variant/20 bg-surface-container-lowest/50"
                        >
                          <div className="flex flex-col gap-2 pt-2">
                            {onNavigateToLaw && content.catalogItems.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">
                                  Leyes relacionadas:
                                </span>
                                {content.catalogItems.map((law) => (
                                  <button
                                    key={law.id}
                                    type="button"
                                    onClick={() => {
                                      onNavigateToLaw(law);
                                      onClose();
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface-variant hover:bg-surface-container border border-outline-variant/20 font-label-sm text-label-sm cursor-pointer"
                                  >
                                    {law.code}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-4 bg-surface-container-low flex items-center justify-end gap-2.5 border-t border-outline-variant/20">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(
                  `${content.obligationTitle}\n\n${content.steps.map((s) => `${s.id}. ${s.title} (${s.priority})`).join('\n')}`
                );
              }}
              className="px-3.5 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 hover:border-secondary/40 text-on-surface font-label-sm text-label-sm font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-secondary">content_copy</span>
              <span>Copiar Checklist</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-primary btn-lift-primary text-on-primary font-label-sm text-label-sm font-semibold cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ==================== Seguridad Social Modal ====================

interface SeguridadSocialModalProps {
  content: ResolvedSeguridadSocialData | null;
  onClose: () => void;
  onNavigateToLaw?: (law: LawCatalogItem) => void;
}

export const SeguridadSocialModal: React.FC<SeguridadSocialModalProps> = ({
  content,
  onClose,
  onNavigateToLaw,
}) => {
  if (!content) return null;

  return (
    <AnimatePresence>
      <motion.div
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={(e) => e.stopPropagation()}
          className="bg-surface-container-lowest w-full max-w-3xl rounded-2xl shadow-2xl border border-outline-variant/25 overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="p-4 bg-surface-container flex items-center justify-between border-b border-outline-variant/30">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-secondary-container/20 border border-secondary-container/40 flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary text-[20px]">shield</span>
              </div>
              <div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface leading-tight font-semibold">
                  {content.entityName}
                </h3>
                <span className="font-label-sm text-label-sm text-secondary font-semibold">
                  Requisitos, Formularios, Plazos y Sanciones
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-surface-container-lowest/80 hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant cursor-pointer"
            >
              <span className="material-symbols-outlined text-[19px]">close</span>
            </button>
          </div>

          <div className="p-5 overflow-y-auto space-y-4">
            {/* Description */}
            <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/20">
              <h4 className="font-label-md text-label-md text-on-surface font-bold uppercase tracking-wider mb-2">
                Visión General
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                {content.description}
              </p>
            </div>

            {/* Contact Info */}
            {content.contactInfo && (
              <div className="bg-secondary-container/20 p-4 rounded-xl border border-secondary/30">
                <h4 className="font-label-md text-label-md text-secondary font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">contact_support</span>
                  Canales Oficiales
                </h4>
                <div className="flex flex-col gap-2 text-sm text-on-surface-variant">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-secondary">public</span>
                    <span>{content.contactInfo.portal}</span>
                  </div>
                  {content.contactInfo.phone && (
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-secondary">phone</span>
                      <span>{content.contactInfo.phone}</span>
                    </div>
                  )}
                  {content.contactInfo.email && (
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-secondary">email</span>
                      <span>{content.contactInfo.email}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Requirements Table */}
            <div className="space-y-3">
              <h4 className="font-label-md text-label-md text-on-surface font-bold uppercase tracking-wider">
                Requisitos y Obligaciones ({content.requirements.length})
              </h4>
              <div className="space-y-3">
                {content.requirements.map((req) => (
                  <div
                    key={req.id}
                    className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/15 card-elevated"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <h5 className="font-label-md text-label-md text-on-surface font-semibold truncate">
                            {req.title}
                          </h5>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold flex-shrink-0">
                            {req.entity}
                          </span>
                        </div>
                        <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed mb-3">
                          {req.description}
                        </p>

                        {/* Forms */}
                        {req.forms.length > 0 && (
                          <div className="mb-3">
                            <span className="font-label-sm text-label-sm text-secondary font-bold uppercase tracking-wider">
                              Formularios:
                            </span>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {req.forms.map((form, i) => (
                                <span
                                  key={i}
                                  className="px-2.5 py-1 rounded-lg bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm border border-outline-variant/20"
                                >
                                  {form}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Deadlines & Sanctions */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="p-2.5 bg-surface-container-lowest rounded-lg border border-outline-variant/15">
                            <div className="flex items-center gap-1.5 text-secondary font-bold mb-1">
                              <span className="material-symbols-outlined text-[14px]">schedule</span>
                              Plazos
                            </div>
                            <p className="font-body-sm text-body-sm text-on-surface-variant">
                              {req.deadlines}
                            </p>
                          </div>
                          <div className="p-2.5 bg-error-container/20 rounded-lg border border-error/20">
                            <div className="flex items-center gap-1.5 text-error font-bold mb-1">
                              <span className="material-symbols-outlined text-[14px]">warning</span>
                              Sanciones
                            </div>
                            <p className="font-body-sm text-body-sm text-on-surface-variant">
                              {req.sanctions}
                            </p>
                          </div>
                        </div>

                        {/* Applies to */}
                        <p className="font-label-sm text-label-sm text-on-surface-variant mt-2">
                          <span className="font-semibold">Aplica a:</span> {req.appliesTo}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Related Laws */}
            {onNavigateToLaw && content.catalogItems.length > 0 && (
              <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/20">
                <h4 className="font-label-md text-label-md text-on-surface font-bold uppercase tracking-wider mb-3">
                  Marco Normativo Relacionado
                </h4>
                <div className="flex flex-wrap gap-2">
                  {content.catalogItems.map((law) => (
                    <button
                      key={law.id}
                      type="button"
                      onClick={() => {
                        onNavigateToLaw(law);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-surface-container-highest text-on-surface-variant hover:bg-surface-container border border-outline-variant/20 font-label-sm text-label-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[14px]">menu_book</span>
                      <span>{law.title} ({law.code})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-surface-container-low flex items-center justify-end gap-2.5 border-t border-outline-variant/20">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(
                  `${content.entityName}\n\n${content.requirements.map((r) => `${r.title}: ${r.deadlines} | ${r.sanctions}`).join('\n\n')}`
                );
              }}
              className="px-3.5 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/30 hover:border-secondary/40 text-on-surface font-label-sm text-label-sm font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-secondary">content_copy</span>
              <span>Copiar Resumen</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-primary btn-lift-primary text-on-primary font-label-sm text-label-sm font-semibold cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
