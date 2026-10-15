import { useCallback, useState, useSyncExternalStore } from 'react';
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
  const settings: ModelSettings = {
    selectedModel: stored.selectedModel ?? DEFAULT_SETTINGS.selectedModel,
    ollamaBaseUrl: stored.ollamaBaseUrl ?? DEFAULT_SETTINGS.ollamaBaseUrl,
    availableModels: stored.availableModels ?? [],
    modelStatuses: stored.modelStatuses ?? {},
  };

  // Slot de autolimpieza: un modelo guardado que ya se comprobó que no
  // responde (p. ej. dado de baja del catálogo cloud) no puede quedar activo.
  const selectedStatus = settings.modelStatuses[settings.selectedModel];
  if (
    settings.selectedModel &&
    !settings.selectedModel.startsWith('gemini-') &&
    selectedStatus &&
    selectedStatus.available === false
  ) {
    const fallback = settings.availableModels.find(
      (m) => settings.modelStatuses[m.name]?.available
    )?.name;
    settings.selectedModel = fallback ?? DEFAULT_SETTINGS.selectedModel;
  }

  return settings;
}

function saveSettingsToStorage(settings: ModelSettings): void {
  save(userKey('modelSettings'), settings);
}

// ==================== Shared store ====================
// Todas las instancias de useOllama (Header, ProfileModal, pantallas, etc.)
// comparten este mismo estado: al seleccionar o descubrir modelos desde
// cualquier punto de la app, el cambio se refleja inmediatamente en todas.

let sharedSettings: ModelSettings = loadSettingsFromStorage();
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function getSnapshot(): ModelSettings {
  return sharedSettings;
}

function setSharedSettings(
  updater: ModelSettings | ((prev: ModelSettings) => ModelSettings)
): void {
  const next =
    typeof updater === 'function'
      ? (updater as (prev: ModelSettings) => ModelSettings)(sharedSettings)
      : updater;
  if (next === sharedSettings) return;
  sharedSettings = next;
  saveSettingsToStorage(sharedSettings);
  notifyListeners();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  // Sincronización entre pestañas/ventanas abiertas.
  const storageHandler = (event: StorageEvent) => {
    if (event.key && event.key.endsWith('modelSettings')) {
      sharedSettings = loadSettingsFromStorage();
      notifyListeners();
    }
  };
  window.addEventListener('storage', storageHandler);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', storageHandler);
  };
}

export function useOllama() {
  const settings = useSyncExternalStore(subscribe, getSnapshot);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  const discoverModels = useCallback(async () => {
    setIsDiscovering(true);
    setDiscoverError(null);
    try {
      const models = await listOllamaModels(sharedSettings.ollamaBaseUrl);

      // Prueba de conexión real a cada modelo: solo se agregan a la lista
      // los que respondan (los dados de baja o de pago se descartan).
      const statuses = await Promise.all(
        models.map((m) => testOllamaModel(m.name, sharedSettings.ollamaBaseUrl))
      );
      const statusMap: Record<string, OllamaModelStatus> = {};
      models.forEach((m, i) => {
        statusMap[m.name] = statuses[i];
      });
      const working = models.filter((m, i) => statuses[i].available);

      setSharedSettings((prev) => ({
        ...prev,
        availableModels: working,
        modelStatuses: { ...prev.modelStatuses, ...statusMap },
        // Si el modelo seleccionado ya no responde, cambia al primero funcional
        // (sin tocar la ruta por defecto gemini-*).
        selectedModel:
          working.length > 0 &&
          !working.some((m) => m.name === prev.selectedModel) &&
          !prev.selectedModel.startsWith('gemini-')
            ? working[0].name
            : prev.selectedModel,
      }));

      if (models.length > 0 && working.length === 0) {
        setDiscoverError(
          `Ollama reporta ${models.length} modelo(s), pero ninguno respondió a la prueba de conexión (catálogo cloud dado de baja o de pago).`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDiscoverError(message);
    } finally {
      setIsDiscovering(false);
    }
  }, []);

  const testModel = useCallback(
    async (modelName: string): Promise<OllamaModelStatus> => {
      const status = await testOllamaModel(modelName, sharedSettings.ollamaBaseUrl);
      setSharedSettings((prev) => ({
        ...prev,
        modelStatuses: { ...prev.modelStatuses, [modelName]: status },
      }));
      return status;
    },
    []
  );

  const selectModel = useCallback((modelName: string) => {
    setSharedSettings((prev) => ({ ...prev, selectedModel: modelName }));
  }, []);

  return {
    settings,
    isDiscovering,
    discoverError,
    discoverModels,
    testModel,
    selectModel,
    setSettings: setSharedSettings,
  };
}
