import React from 'react';

export interface WatermarkInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Background text shown behind the input ONLY while the value is empty. */
  watermark: string;
  /** Native placeholder, kept for accessibility / native input hints. */
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Text input with an in-field watermark as the empty-state affordance.
 * Renders pixel-identically to the search-topic input in AgenteExtractorScreen.tsx:
 * the field background, border and focus treatment live on the wrapper (driven by
 * `focus-within:`) so the transparent input never paints over the watermark layer.
 */
export const WatermarkInput: React.FC<WatermarkInputProps> = ({
  value,
  onChange,
  watermark,
  placeholder,
  className = '',
  disabled = false,
}) => {
  const showWatermark = value === '';

  // The watermark already paints the empty-state hint, so the native placeholder is
  // kept in the DOM for accessibility but made invisible to avoid doubled text.
  const placeholderClass =
    showWatermark && placeholder ? 'placeholder:text-transparent' : 'placeholder:text-on-surface-variant/70';

  return (
    <div
      className={`relative bg-surface-container-low rounded-xl border border-outline-variant/30 focus-within:border-secondary focus-within:bg-surface-container-lowest transition-colors ${className}`}
    >
      {showWatermark && (
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center px-3.5 py-2.5 pointer-events-none text-on-surface-variant/50 font-body-md text-body-md"
        >
          <span className="truncate select-none">{watermark}</span>
        </div>
      )}

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`relative z-10 bg-transparent w-full px-3.5 py-2.5 rounded-xl text-on-surface font-body-md text-body-md ${placeholderClass} focus:outline-none disabled:opacity-50 disabled:cursor-default`}
      />
    </div>
  );
};

export default WatermarkInput;