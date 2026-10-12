import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Jurisdiction, NavTab, UserProfile } from '../types';
import { useOllama } from '../hooks/useOllama';
import { Logo } from './Logo';
import { ModelSettingsModal } from './ModelSettingsModal';

interface HeaderProps {
  currentTab: NavTab;
  userProfile?: UserProfile | null;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
}

const COUNTRY_FLAGS: Record<Jurisdiction, string> = {
  CU: '\u{1F1E8}\u{1F1FA}',
  DO: '\u{1F1E9}\u{1F1F4}',
  MX: '\u{1F1F2}\u{1F1FD}',
};

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  userProfile,
  onOpenNotifications,
  onOpenProfile,
}) => {
  const {
    settings,
    isDiscovering,
    discoverError,
    discoverModels,
    testModel,
    selectModel,
  } = useOllama();
  const [isModelSettingsOpen, setIsModelSettingsOpen] = useState(false);

  const getTabTitle = () => {
    switch (currentTab) {
      case 'asistente':
        return 'Asistente Legal';
      case 'gacetas':
        return 'Gacetas Y Monitor';
      case 'extractor':
        return 'Agente Extractor PDF';
      case 'rag_indexer':
        return 'RAG LangGraph';
      case 'leyes':
        return 'Biblioteca Legal';
      default:
        return 'Asistente Legal';
    }
  };

  const flag = userProfile ? COUNTRY_FLAGS[userProfile.country] : undefined;
  const countryLabel = userProfile?.countryName?.trim();
  const currencyLabel = userProfile?.currency?.trim();

  const activeTitle = getTabTitle();

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-[#f8f9ff]/88 backdrop-blur-xl shadow-[0_1px_12px_rgba(11,28,48,0.05)] border-b border-outline-variant/20 pt-safe">
        <div className="h-28 px-margin flex flex-col justify-center gap-space-xs max-w-2xl mx-auto">
          {/* Top Row: Brand & Profile Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <Logo className="h-8 w-auto object-contain" />
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight leading-none">
                  Abogado Amigo
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Inteligencia Legal MiPyME
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                aria-label="Estado de sincronización y alertas de gaceta"
                className="relative w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-lowest/80 border border-outline-variant/20 text-on-surface hover:bg-surface-container hover:border-secondary/30 cursor-pointer"
                type="button"
                onClick={onOpenNotifications}
              >
                <span className="material-symbols-outlined text-[21px]">notifications</span>
                <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-secondary"></span>
                </span>
              </button>
              <button
                aria-label="Configuración del modelo de IA"
                className="w-10 h-10 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface flex-shrink-0 cursor-pointer"
                type="button"
                onClick={() => setIsModelSettingsOpen(true)}
              >
                <span className="material-symbols-outlined text-[20px]">settings</span>
              </button>
              <button
                aria-label="Perfil del usuario y tenant MiPyME"
                onClick={onOpenProfile}
                className="w-9 h-9 rounded-full bg-primary btn-lift-primary flex items-center justify-center text-on-primary cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
              </button>
            </div>
          </div>

          {/* Bottom Row: Country / Currency Badge & View Title */}
          <div className="flex items-center justify-between gap-space-sm pt-0.5">
            <div
              aria-label={
                countryLabel && currencyLabel
                  ? `País registrado: ${countryLabel}. Moneda: ${currencyLabel}`
                  : 'País registrado'
              }
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-low border border-outline-variant/30 font-label-sm text-label-sm text-on-surface"
              role="status"
            >
              {flag && <span className="text-[12px] leading-none">{flag}</span>}
              <span className="truncate">{countryLabel || 'País no definido'}</span>
              {currencyLabel && (
                <>
                  <span
                    aria-hidden="true"
                    className="w-px h-3 bg-outline-variant/40 rounded-full"
                  />
                  <span className="text-on-surface-variant">{currencyLabel}</span>
                </>
              )}
            </div>

            <div className="flex items-center overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.span
                  key={activeTitle}
                  initial={{ opacity: 0, y: 6, filter: 'blur(3px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -6, filter: 'blur(3px)' }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="font-headline-sm text-headline-sm text-on-surface truncate font-medium"
                >
                  {activeTitle}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

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
