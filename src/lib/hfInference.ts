/**
 * Client-side Hugging Face inference using transformers.js
 * Runs entirely in the browser via WebGPU/WASM - no server needed
 */

import { pipeline, env, TextGenerationPipeline } from '@huggingface/transformers';

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

// Model configuration - 7 open-source models verified on HF Hub (weights ONNX q4 availables,
// public access, compatible with @huggingface/transformers v4 text-generation).
// NOTA: el antiguo default 'Xenova/Qwen2.5-1.5B-Instruct' ya no existe (401) -> espejo onnx-community.
const MODEL_OPTIONS = {
  // DEFAULT: ~1.5B params, excelente español, rápido con WebGPU
  qwen: 'onnx-community/Qwen2.5-1.5B-Instruct',
  // ~0.5B params, el más liviano, ideal para equipos modestos
  'qwen-mini': 'onnx-community/Qwen2.5-0.5B-Instruct',
  // ~1.7B params, generación 2025 con razonamiento, multilingüe fuerte
  qwen3: 'onnx-community/Qwen3-1.7B-ONNX',
  // ~0.6B params, Qwen3 ultrarrápido para respuestas breves
  'qwen3-mini': 'onnx-community/Qwen3-0.6B-ONNX',
  // ~1B params, muy rápido, buen bilingüe ES/EN
  llama: 'onnx-community/Llama-3.2-1B-Instruct',
  // ~3B params, mejor calidad de la familia ligera, bilingüe sólido
  'llama-plus': 'onnx-community/Llama-3.2-3B-Instruct',
  // ~3.8B params, mayor calidad de razonamiento, más lento en WASM
  phi3: 'Xenova/Phi-3-mini-4k-instruct',
} as const;

type ModelKey = keyof typeof MODEL_OPTIONS;

export type { ModelKey };

/** Prefijo de los modelos HF/SLM dentro de ModelSettings.selectedModel. */
export const HF_MODEL_PREFIX = 'hf:';

/** Extrae la clave del modelo HF de una selección tipo "hf:qwen". */
export function parseHfModelKey(selectedModel: string): ModelKey | null {
  if (!selectedModel.startsWith(HF_MODEL_PREFIX)) return null;
  const key = selectedModel.slice(HF_MODEL_PREFIX.length) as ModelKey;
  return key in MODEL_OPTIONS ? key : null;
}

/** Metadatos para el selector de la app (probados por qa-test-hf-models.mjs). */
export interface HfModelInfo {
  key: ModelKey;
  repo: string;
  label: string;
  params: string;
  sizeMB: number;
  note: string;
}

export const HF_SLM_MODELS: HfModelInfo[] = [
  {
    key: 'qwen',
    repo: MODEL_OPTIONS.qwen,
    label: 'Qwen2.5 1.5B Instruct',
    params: '1.5B',
    sizeMB: 1705,
    note: 'Balance recomendado: excelente español y rapidez',
  },
  {
    key: 'qwen-mini',
    repo: MODEL_OPTIONS['qwen-mini'],
    label: 'Qwen2.5 0.5B Instruct',
    params: '0.5B',
    sizeMB: 750,
    note: 'El más liviano, para equipos modestos',
  },
  {
    key: 'qwen3',
    repo: MODEL_OPTIONS.qwen3,
    label: 'Qwen3 1.7B',
    params: '1.7B',
    sizeMB: 2048,
    note: 'Generación 2025 con razonamiento, multilingüe fuerte',
  },
  {
    key: 'qwen3-mini',
    repo: MODEL_OPTIONS['qwen3-mini'],
    label: 'Qwen3 0.6B',
    params: '0.6B',
    sizeMB: 877,
    note: 'Qwen3 ultrarrápido para respuestas breves',
  },
  {
    key: 'llama',
    repo: MODEL_OPTIONS.llama,
    label: 'Llama 3.2 1B Instruct',
    params: '1B',
    sizeMB: 906,
    note: 'Muy rápido, buen bilingüe ES/EN',
  },
  {
    key: 'llama-plus',
    repo: MODEL_OPTIONS['llama-plus'],
    label: 'Llama 3.2 3B Instruct',
    params: '3B',
    sizeMB: 2018,
    note: 'Mejor calidad de la familia ligera',
  },
  {
    key: 'phi3',
    repo: MODEL_OPTIONS.phi3,
    label: 'Phi-3 mini 4k instruct',
    params: '3.8B',
    sizeMB: 1011,
    note: 'Mayor razonamiento, más lento',
  },
];

interface HFInferenceOptions {
  model?: ModelKey;
  maxNewTokens?: number;
  temperature?: number;
  topP?: number;
}

interface HFInferenceResult {
  text: string;
  model: string;
  tokensGenerated: number;
  timeMs: number;
}

let textGenerator: TextGenerationPipeline | null = null;
let currentModel: ModelKey = 'qwen';
let isLoading = false;
let loadPromise: Promise<void> | null = null;

/**
 * Initialize the text generation pipeline
 */
async function ensureModelLoaded(model: ModelKey = 'qwen'): Promise<void> {
  if (textGenerator && currentModel === model) return;

  if (isLoading && loadPromise) {
    await loadPromise;
    if (textGenerator && currentModel === model) return;
  }

  isLoading = true;
  loadPromise = (async () => {
    try {
      console.log(`[HF] Loading model: ${MODEL_OPTIONS[model]}...`);
      const start = performance.now();
      
      textGenerator = await pipeline(
        'text-generation',
        MODEL_OPTIONS[model],
        {
          device: 'webgpu', // Use WebGPU if available, falls back to WASM
          dtype: 'q4', // Quantized for speed
          progress_callback: (progress: { status: string; progress?: number }) => {
            if (progress.status === 'download') {
              console.log(`[HF] Downloading: ${Math.round((progress.progress ?? 0) * 100)}%`);
            } else if (progress.status === 'progress') {
              console.log(`[HF] Loading: ${Math.round((progress.progress ?? 0) * 100)}%`);
            }
          },
        }
      );
      
      currentModel = model;
      console.log(`[HF] Model loaded in ${Math.round(performance.now() - start)}ms`);
    } catch (error) {
      console.error('[HF] Failed to load model:', error);
      textGenerator = null;
      throw error;
    } finally {
      isLoading = false;
    }
  })();

  await loadPromise;
}

/**
 * Generate text using the loaded model
 */
export async function generateWithHF(
  prompt: string,
  options: HFInferenceOptions = {}
): Promise<HFInferenceResult> {
  const model = options.model ?? 'qwen';
  const maxNewTokens = options.maxNewTokens ?? 500;
  const temperature = options.temperature ?? 0.3;
  const topP = options.topP ?? 0.9;

  await ensureModelLoaded(model);

  if (!textGenerator) {
    throw new Error('Model failed to load');
  }

  const start = performance.now();
  
  try {
    const result = await textGenerator(prompt, {
      max_new_tokens: maxNewTokens,
      temperature,
      top_p: topP,
      do_sample: temperature > 0,
      return_full_text: false,
      repetition_penalty: 1.1,
    });

    const generatedText = result[0]?.generated_text ?? '';
    const timeMs = performance.now() - start;

    return {
      text: generatedText.trim(),
      model: MODEL_OPTIONS[model],
      tokensGenerated: generatedText.length / 4, // rough estimate
      timeMs: Math.round(timeMs),
    };
  } catch (error) {
    console.error('[HF] Generation error:', error);
    throw new Error(`HF generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Build a legal opinion prompt for the HF model
 */
export function buildLegalPrompt(
  query: string,
  jurisdiction: 'MX' | 'CU' | 'DO',
  userContext?: { userName: string; businessName: string },
  documentContext?: string
): string {
  const countryNames = { MX: 'México', CU: 'Cuba', DO: 'República Dominicana' };
  const gazettes = {
    MX: 'Diario Oficial de la Federación (DOF)',
    CU: 'Gaceta Oficial de la República (MINJUS)',
    DO: 'Gaceta Oficial Dominicana',
  };

  const countryName = countryNames[jurisdiction];
  const gazette = gazettes[jurisdiction];

  const context = userContext
    ? `\nContexto: ${userContext.userName}, empresa: ${userContext.businessName}.`
    : '';

  const docContext = documentContext
    ? `\n\nDOCUMENTOS INDEXADOS:\n${documentContext}\n`
    : '\n\n(Sin documentos indexados para esta consulta)';

  return `<|im_start|>system
Eres "Abogado Amigo", un asistente legal para MiPyMEs en ${countryName}.
Tu objetivo: dar orientación legal preventiva, práctica y fundamentada en legislación oficial vigente.
Fuente oficial: ${gazette}.

REGLAS ESTRICTAS:
1. SIEMPRE cita la norma específica (ley, artículo, reglamento).
2. Indica la jurisdicción aplicable (${countryName}).
3. Si no hay certeza, di "Según la legislación vigente..." y sugiere consultar abogado.
4. NUNCA inventes artículos, leyes o jurisprudencia inexistente.
5. Incluye disclaimer: "Esta orientación es informativa. No sustituye patrocinio letrado."
6. Formato: Resumen ejecutivo → Fundamento normativo (citaciones) → Impacto operativo → Disclaimer.
<|im_end|>
<|im_start|>user
${query}${context}${docContext}
<|im_end|>
<|im_start|>assistant
`;
}

/**
 * Check if WebGPU is available
 */
export function isWebGPUSupported(): boolean {
  return 'gpu' in navigator && typeof (navigator as any).gpu?.requestAdapter === 'function';
}

/**
 * Get current model info
 */
export function getModelInfo(): { current: string; available: string[]; webgpu: boolean } {
  return {
    current: currentModel ? MODEL_OPTIONS[currentModel] : 'none',
    available: Object.entries(MODEL_OPTIONS).map(([k, v]) => `${k}: ${v}`),
    webgpu: isWebGPUSupported(),
  };
}

/**
 * Preload model in background (call on app start)
 */
export function preloadModel(model: ModelKey = 'qwen'): Promise<void> {
  return ensureModelLoaded(model);
}