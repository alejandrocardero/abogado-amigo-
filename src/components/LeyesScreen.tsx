import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { storage } from '../lib/db';
import { LawCatalogItem, Jurisdiction, UserProfile } from '../types';

interface LeyesScreenProps {
  userProfile?: UserProfile | null;
  onSelectLaw: (law: LawCatalogItem) => void;
}

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

export const LeyesScreen: React.FC<LeyesScreenProps> = ({
  userProfile,
  onSelectLaw,
}) => {
  const [laws] = useState<LawCatalogItem[]>(() => storage.laws.get());
  const [searchTerm, setSearchTerm] = useState('');

  const userJurisdiction: Jurisdiction = userProfile?.country ?? 'MX';

  const filteredLaws = laws.filter((law) => {
    const matchesCountry = law.country === userJurisdiction;
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      law.title.toLowerCase().includes(query) ||
      law.description.toLowerCase().includes(query) ||
      law.code.toLowerCase().includes(query);
    return matchesCountry && matchesSearch;
  });

  return (
    <div className="flex flex-col w-full relative px-margin gap-space-md max-w-2xl mx-auto pb-32">
      {/* Search and Jurisdiction Filter Bar */}
      <div className="flex flex-col gap-2.5 pt-2">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
          </span>
          <input
            type="text"
            placeholder="Buscar por artículo, ley, decreto o materia..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest rounded-xl border border-outline-variant/30 text-on-surface font-body-md text-body-md placeholder:text-on-surface-variant focus:outline-none focus:border-secondary shadow-xs transition-colors"
          />
        </div>

        {/* Jurisdiction Scope */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[15px] leading-none">{getJurisdictionFlag(userJurisdiction)}</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
              Normativa {getJurisdictionName(userJurisdiction)}
            </span>
          </div>
          <span className="font-label-sm text-label-sm text-secondary font-semibold whitespace-nowrap shrink-0">
            Tu jurisdicción
          </span>
        </div>
      </div>

      {/* Catalog List */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-on-surface-variant px-1">
          <span className="tabular-nums">{filteredLaws.length} compendios normativos oficiales</span>
          <span className="text-secondary font-semibold">Índice Semántico Actualizado</span>
        </div>

        {filteredLaws.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-xl p-space-lg card-elevated text-center border border-outline-variant/20">
            <span className="material-symbols-outlined text-secondary text-[48px] mb-3 block">menu_book</span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-1">
              Biblioteca vacía
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Aún no hay leyes indexadas en tu navegador. El catálogo aparecerá aquí cuando se cargue material normativo.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredLaws.map((law, idx) => (
              <motion.button
                key={law.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.22, delay: idx * 0.03 }}
                type="button"
                onClick={() => onSelectLaw(law)}
                className="w-full text-left bg-surface-container-lowest rounded-xl p-4 cursor-pointer border border-outline-variant/20 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2 w-full">
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg">{getJurisdictionFlag(law.country)}</span>
                    <span className="font-label-sm text-label-sm text-secondary font-bold">
                      {law.source}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${
                      law.badge === 'Vigente'
                        ? 'bg-[#ECFDF5] text-[#065F46]'
                        : law.badge === 'Reformada'
                        ? 'bg-surface-container-high text-secondary'
                        : 'bg-error-container text-on-error-container'
                    }`}
                  >
                    {law.badge}
                  </span>
                </div>

                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    {law.title}
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 line-clamp-2">
                    {law.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20 text-xs text-on-surface-variant w-full">
                  <span className="tabular-nums">{law.articlesCount} artículos indexados</span>
                  <div className="flex items-center gap-1 text-secondary font-semibold">
                    <span>Ver en catálogo</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </div>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        )}

        {laws.length > 0 && filteredLaws.length === 0 && (
          <div className="text-center py-4 text-on-surface-variant font-body-sm text-body-sm">
            Sin resultados para este filtro
          </div>
        )}
      </div>
    </div>
  );
};