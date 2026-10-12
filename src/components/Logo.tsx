import React, { useState } from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({ className = 'h-8 w-auto', size = 'md' }) => {
  const [imgError, setImgError] = useState(false);

  // Exact Google User Content asset provided in the design
  const primaryLogoUrl =
    'https://lh3.googleusercontent.com/aida/AEtjO1WWieP5_GXgS78SRouskiZXIL6xB0sixHRGTIRJZmu_ajkRNEUyAibH6a3FbZcEbKEg9TB5brJP9jgOCfnp7kF9njb2e1SYCyF228EsYuV2pLUAFD6kcKn54tpytkT5jJG6X82Td914LKlZPOFVL6RK8g_iz5m8h15bc26-7a2yJaCOHrZ_5Djg3Y5OeQE1wDJU94Ifsw1PAvHeoX2Fu1tNWbg2DSOUZgkfyBS_0Iqqad6eoJBPQcfo-NY';

  if (!imgError) {
    return (
      <img
        src={primaryLogoUrl}
        alt="Abogado Amigo Logo"
        className={`${className} object-contain`}
        onError={() => setImgError(true)}
      />
    );
  }

  // High-fidelity vector shield logo matching Image 4.svg+xml / Image 5.png
  const dim = size === 'sm' ? 28 : size === 'lg' ? 48 : 36;
  return (
    <div
      style={{ width: dim, height: dim }}
      className={`relative rounded-xl bg-[#081225] p-1 flex items-center justify-center shadow-sm flex-shrink-0 ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Shield Outline */}
        <path
          d="M50 12 L82 24 V52 C82 72 50 88 50 88 C50 88 18 72 18 52 V24 L50 12 Z"
          stroke="#38bdf8"
          strokeWidth="6"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Scale Vertical Pillar */}
        <line x1="50" y1="26" x2="50" y2="70" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" />
        <line x1="38" y1="70" x2="62" y2="70" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" />
        
        {/* Balance Horizontal Beam */}
        <line x1="28" y1="42" x2="72" y2="42" stroke="#38bdf8" strokeWidth="5" strokeLinecap="round" />
        
        {/* Left Scale Pan Strings & Pan */}
        <line x1="28" y1="42" x2="22" y2="54" stroke="#94a3b8" strokeWidth="3" />
        <line x1="28" y1="42" x2="34" y2="54" stroke="#94a3b8" strokeWidth="3" />
        <path d="M20 54 Q28 62 36 54 Z" fill="none" stroke="#38bdf8" strokeWidth="3" />

        {/* Right Scale Pan Strings & Pan */}
        <line x1="72" y1="42" x2="66" y2="54" stroke="#94a3b8" strokeWidth="3" />
        <line x1="72" y1="42" x2="78" y2="54" stroke="#94a3b8" strokeWidth="3" />
        <path d="M64 54 Q72 62 80 54 Z" fill="none" stroke="#38bdf8" strokeWidth="3" />

        {/* Central Star / Spark */}
        <path
          d="M50 44 L52 48 L56 50 L52 52 L50 56 L48 52 L44 50 L48 48 Z"
          fill="#eab308"
        />
      </svg>
    </div>
  );
};
