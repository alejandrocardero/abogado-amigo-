import { useState, useCallback } from 'react';
import { ModelSettings, OllamaModel, OllamaModelStatus } from '../types';
import { listOllamaModels, testOllamaModel } from '../lib/ollama';
import { userKey, load, save } from '../lib/db';

const DEFAULT_SETTINGS: ModelSettings = {
  selectedModel: 'gemini-2.0-flash-exp',
  ollamaBaseUrl: 'http://localhost:11434',
  availableModels: [],
  modelStatuses: {},
};

function loadSettingsFromStorage(): ModelSettings {
  const stored = load<ModelSettings>(userKey('modelSettings'), DEFAULT_SETTINGS);
  return {
    selectedModel: stored.selectedModel ?? DEFAULT_SETTINGS.selectedModel,
    ollamaBaseUrl: stored.ollamaBaseUrl ?? DEFAULT_SETTINGS.ollamaBaseUrl,
    availableModels: stored.availableModels ?? [],
    modelStatuses: stored.modelStatuses ?? {},
  };
}

function saveSettingsToStorage(settings: ModelSettings): void {
  save(userKey('modelSettings'), settings);
}

export function useOllama() {
  const [settings, setSettings] = useState<ModelSettings>(loadSettingsFromStorage);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  const discoverModels = useCallback(async () => {
    setIsDiscovering(true);
    setDiscoverError(null);
    try {
      const models = await listOllamaModels(settings.ollamaBaseUrl);
      setSettings((prev) => {
        const next = { ...prev, availableModels: models };
        saveSettingsToStorage(next);
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDiscoverError(message);
    } finally {
      setIsDiscovering(false);
    }
  }, [settings.ollamaBaseUrl]);

  const testModel = useCallback(
    async (modelName: string): Promise<OllamaModelStatus> => {
      const status = await testOllamaModel(modelName, settings.ollamaBaseUrl);
      setSettings((prev) => {
        const next = {
          ...prev,
          modelStatuses: { ...prev.modelStatuses, [modelName]: status },
        };
        saveSettingsToStorage(next);
        return next;
      });
      return status;
    },
    [settings.ollamaBaseUrl]
  );

  const selectModel = useCallback((modelName: string) => {
    setSettings((prev) => {
      const next = { ...prev, selectedModel: modelName };
      saveSettingsToStorage(next);
      return next;
    });
  }, []);

  const updateSettings = useCallback(
    (updater: ModelSettings | ((prev: ModelSettings) => ModelSettings)) => {
      setSettings((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        saveSettingsToStorage(next);
        return next;
      });
    },
    []
  );

  return {
    settings,
    isDiscovering,
    discoverError,
    discoverModels,
    testModel,
    selectModel,
    setSettings: updateSettings,
  };
}
