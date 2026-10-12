import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { ModelSettingsModal } from './components/ModelSettingsModal';
import { ModelSettings } from './types';

const MOCK_MODELS = [
  {
    name: 'llama3.1:8b',
    model: 'llama3.1:8b',
    size: 4661224676,
    digest: 'a80c4f17acd55265feec403c7aef86be0c25983ab279d83f3bcd3abbcb5b8b72',
    modified_at: '2026-02-11T10:00:00Z',
    details: { format: 'gguf', family: 'llama', parameter_size: '8.0B', quantization_level: 'Q4_K_M' },
  },
  {
    name: 'qwen2.5:14b-instruct',
    model: 'qwen2.5:14b-instruct',
    size: 8988112098,
    digest: 'b1c2d3e4f5061728394a5b6c7d8e9f00112233445566778899aabbccddeeff00',
    modified_at: '2026-03-02T08:30:00Z',
    details: { format: 'gguf', family: 'qwen2', parameter_size: '14.8B', quantization_level: 'Q4_K_M' },
  },
  {
    name: 'mistral:latest',
    model: 'mistral:latest',
    size: 4175965110,
    digest: 'cc11dd22ee33ff44556677889900112233445566778899aabbccddeeff0011',
    modified_at: '2026-01-20T18:45:00Z',
    details: { format: 'gguf', family: 'llama', parameter_size: '7.2B', quantization_level: 'Q4_0' },
  },
];

const BASE: ModelSettings = {
  selectedModel: 'llama3.1:8b',
  ollamaBaseUrl: 'http://localhost:11434',
  availableModels: MOCK_MODELS,
  modelStatuses: {
    'llama3.1:8b': { model: 'llama3.1:8b', available: true, testedAt: '2026-04-01T10:00:00Z', latencyMs: 412 },
    'mistral:latest': {
      model: 'mistral:latest',
      available: false,
      testedAt: '2026-04-01T10:01:00Z',
      latencyMs: 1800,
      error: 'HTTP 503 Service Unavailable: model runner is not loaded',
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