import React from 'react';

interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  isLoading?: boolean;
  label?: string; // Default: "Sugerencias:"
  emptyMessage?: string; // Default: "Sube un documento para generar sugerencias"
}

const CHIP_SURFACE =
  'px-2.5 py-1 rounded-full bg-surface-container-low border border-outline-variant/25';
const CHIP_TYPO = 'text-on-surface font-label-sm text-label-sm whitespace-nowrap';

/** Concatenation order reproduces the inline chip class in AgenteExtractorScreen.tsx verbatim. */
const CHIP_CLASS = `${CHIP_SURFACE} hover:border-secondary/40 ${CHIP_TYPO} cursor-pointer`;

/** h-[22px] = font-label-sm line-height (14px) + py-1 (8px), matching a real chip. */
const CHIP_SKELETON_CLASS = `${CHIP_SURFACE} ${CHIP_TYPO} h-[22px] animate-pulse opacity-60`;

const LABEL_CLASS = 'font-label-sm text-label-sm text-on-surface-variant flex-shrink-0';

const CHIP_ICON = 'psychology';

const SKELETON_WIDTHS = ['w-32', 'w-24', 'w-28'] as const;

export const SuggestionChips: React.FC<SuggestionChipsProps> = ({
  suggestions,
  onSelect,
  isLoading = false,
  label = 'Sugerencias:',
  emptyMessage = 'Sube un documento para generar sugerencias',
}) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className="material-symbols-outlined text-secondary text-[14px]">lightbulb</span>
        <span className={LABEL_CLASS}>{label}</span>
      </div>

      <div
        className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar"
        aria-busy={isLoading}
      >
        {isLoading && (
          <>
            {SKELETON_WIDTHS.map((width) => (
              <span
                key={width}
                aria-hidden="true"
                className={`${CHIP_SKELETON_CLASS} ${width}`}
              />
            ))}
          </>
        )}

        {!isLoading && suggestions.length === 0 && (
          <span className="text-on-surface-variant text-xs">{emptyMessage}</span>
        )}

        {!isLoading &&
          suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSelect(suggestion)}
              className={CHIP_CLASS}
            >
              <span className="material-symbols-outlined text-[14px] mr-1">{CHIP_ICON}</span>
              {suggestion}
            </button>
          ))}
      </div>
    </div>
  );
};