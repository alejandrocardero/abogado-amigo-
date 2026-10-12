import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { SuggestionChips } from './components/SuggestionChips';

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="bg-surface-container-lowest rounded-2xl p-4 card-elevated border border-outline-variant/20 flex flex-col gap-3">
    <span className="font-label-md text-label-md text-on-surface font-bold flex items-center gap-1.5">
      <span className="material-symbols-outlined text-secondary text-[18px]">psychology</span>
      {title}
    </span>
    {children}
  </section>
);

const Harness = () => (
  <div className="w-full max-w-2xl mx-auto px-margin py-6 flex flex-col gap-4">
    <Card title="Estado: con sugerencias (default)">
      <SuggestionChips
        suggestions={[
          'Vacaciones LFT',
          'Decreto-Ley 88 Cuba',
          'Garantías RD',
          'Afiliación IMSS',
          'Responsabilidad civil de pymes',
        ]}
        onSelect={(s) => console.log('SELECTED:', s)}
      />
    </Card>

    <Card title="Estado: cargando">
      <SuggestionChips suggestions={[]} onSelect={() => {}} isLoading />
    </Card>

    <Card title="Estado: vacío (default message)">
      <SuggestionChips suggestions={[]} onSelect={() => {}} />
    </Card>

    <Card title="Estado: vacío (custom label + message)">
      <SuggestionChips
        suggestions={[]}
        onSelect={() => {}}
        label="Temas frecuentes:"
        emptyMessage="Aún no hay sugerencias para esta búsqueda"
      />
    </Card>
  </div>
);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Harness />
  </React.StrictMode>,
);