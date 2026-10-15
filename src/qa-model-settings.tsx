import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { ModelSettingsModal } from './components/ModelSettingsModal';
import { ModelSettings } from './types';

// Modelos reales verificados contra el servidor Ollama local (13-oct-2026).
// Solo estos 2 responden: el resto del catálogo cloud fue dado de baja (410) o es de pago (402).
const MOCK_MODELS = [
  {
    name: 'gpt-oss:120b-cloud',
    model: 'gpt-oss:120b-cloud',
    size: 0,
    digest: 'a21f0c4f17acd55265feec403c7aef86be0c25983ab279d83f3bcd3abbcb5b8b',
    modified_at: '2026-10-13T10:00:00Z',
    details: { format: 'cloud', family: 'gpt-oss', parameter_size: '117B', quantization_level: 'cloud' },
  },
  {
    name: 'gpt-oss:20b-cloud',
    model: 'gpt-oss:20b-cloud',
    size: 0,
    digest: 'b32e1d5061728394a5b6c7d8e9f00112233445566778899aabbccddeeff0011',
    modified_at: '2026-10-13T10:00:00Z',
    details: { format: 'cloud', family: 'gptoss', parameter_size: '20.9B', quantization_level: 'cloud' },
  },
];

const BASE: ModelSettings = {
  selectedModel: 'gpt-oss:120b-cloud',
  ollamaBaseUrl: 'http://localhost:11434',
  availableModels: MOCK_MODELS,
  modelStatuses: {
    'gpt-oss:120b-cloud': {
      model: 'gpt-oss:120b-cloud',
      available: true,
      testedAt: '2026-10-13T10:00:00Z',
      latencyMs: 6403,
    },
    'gpt-oss:20b-cloud': {
      model: 'gpt-oss:20b-cloud',
      available: true,
      testedAt: '2026-10-13T10:01:00Z',
      latencyMs: 11512,
    },
  },
};

const Qa = () => {
  const [settings, setSettings] = useState<ModelSettings>(BASE);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  const scenario = new URLSearchParams(window.location.search).get('s') ?? 'full';

  const discover = () => {
    setIsDiscovering(true);
    setDiscoverError(null);
    window.setTimeout(() => setIsDiscovering(false), 1200);
  };

  const test = async (name: string) => {
    await new Promise((r) => window.setTimeout(r, 900));
    setSettings((prev) => ({
      ...prev,
      modelStatuses: {
        ...prev.modelStatuses,
        [name]: { model: name, available: true, testedAt: new Date().toISOString(), latencyMs: 260 },
      },
    }));
  };

  const shown =
    scenario === 'empty'
      ? { ...settings, availableModels: [] }
      : scenario === 'error'
        ? { ...settings, availableModels: [] }
        : scenario === 'loading'
          ? settings
          : settings;

  return (
    <>
      <ModelSettingsModal
        isOpen
        onClose={() => undefined}
        settings={shown}
        isDiscovering={scenario === 'loading' ? true : isDiscovering}
        discoverError={scenario === 'error' ? '[Ollama] Failed to list models: Cannot reach Ollama at http://localhost:11434. Is the Ollama server running? (TypeError: Failed to fetch)' : discoverError}
        onDiscoverModels={discover}
        onTestModel={test}
        onSelectModel={(m) => setSettings((p) => ({ ...p, selectedModel: m }))}
      />
    </>
  );
};

createRoot(document.getElementById('root')!).render(<Qa />);