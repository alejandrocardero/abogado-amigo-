/**
 * Servicio de generación de dictámenes legales.
 * Prioridad: 1) HF transformers.js (client-side) → 2) Ollama (local) → 3) Static fallback
 */

import { Jurisdiction, LegalOpinion, LegalCitation, ModelSettings } from '../types';
import { generateWithOllama } from './ollama';
import { generateWithHF, buildLegalPrompt } from './hfInference';
import { APP_CONFIG, getJurisdictionPrompt } from './appConfig';
import { storage } from './db';

const DEFAULT_MODEL = 'gemini-2.0-flash-exp';

interface ParsedResponse {
  summary: string;
  citations: LegalCitation[];
  takeaways: { id: number; title: string; description: string; boldHighlight?: string }[];
  disclaimer: string;
}

function getActiveModelSettings(): ModelSettings | null {
  return storage.modelSettings.get();
}

function parseAIResponse(text: string, jurisdiction: Jurisdiction): ParsedResponse {
  const citations: LegalCitation[] = [];
  const takeaways: { id: number; title: string; description: string; boldHighlight?: string }[] = [];

  // Extract citations: [CITA: Ley | Artículo | "Cita"]
  const citationPattern = /\[CITA:\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^\]]+)\]/g;
  let match;
  while ((match = citationPattern.exec(text)) !== null) {
    citations.push({
      lawName: match[1].trim(),
      article: match[2].trim(),
      sourceRef: 'Gaceta Oficial Indexada',
      quote: match[3].trim(),
    });
  }

  // Extract takeaways: [IMPACTO: Título | Descripción]
  const takeawayPattern = /\[IMPACTO:\s*([^|]+)\s*\|\s*([^\]]+)\]/g;
  let takeawayMatch;
  let takeawayIndex = 0;
  while ((takeawayMatch = takeawayPattern.exec(text)) !== null) {
    takeaways.push({
      id: ++takeawayIndex,
      title: takeawayMatch[1].trim(),
      description: takeawayMatch[2].trim(),
    });
  }

  // Fallback citations if none found
  if (citations.length === 0) {
    const fallbackLaw = jurisdiction === 'MX' ? 'Ley Federal del Trabajo' : jurisdiction === 'CU' ? 'Decreto-Ley No. 88' : 'Código de Trabajo Ley 16-92';
    citations.push({
      lawName: fallbackLaw,
      article: 'Normativa General Vigente',
      sourceRef: 'Gaceta Oficial Indexada',
      quote: 'La legislación vigente establece obligaciones y derechos para empleadores y trabajadores.',
    });
  }

  // Fallback takeaways if none found
  const finalTakeaways = takeaways.length > 0 ? takeaways : [
    { id: 1, title: 'Revisar obligaciones', description: 'Verifica el cumplimiento de la normativa aplicable a tu caso.', boldHighlight: 'cumplimiento' },
    { id: 2, title: 'Documentar todo', description: 'Conserva evidencia escrita de contratos, pagos y comunicaciones.', boldHighlight: 'evidencia escrita' },
  ];

  const paragraphs = text.split('\n\n').filter(p => p.trim().length > 20);
  const summary = paragraphs[0]?.trim() ?? 'Consulta procesada con IA legal.';

  return {
    summary: summary.slice(0, 500),
    citations,
    takeaways: finalTakeaways,
    disclaimer: 'Esta orientación es informativa y sustentada en legislación oficial indexada. No sustituye el mandato ni patrocinio letrado de un abogado certificado.',
  };
}

function buildFallbackOpinion(query: string, jurisdiction: Jurisdiction): LegalOpinion {
  const fallbackLaw = jurisdiction === 'MX' ? 'Ley Federal del Trabajo' : jurisdiction === 'CU' ? 'Decreto-Ley No. 88' : 'Código de Trabajo Ley 16-92';
  const badgeTitle =
    jurisdiction === 'MX'
      ? 'DICTAMEN FUNDAMENTADO · LFT & CFF (MÉXICO)'
      : jurisdiction === 'CU'
      ? 'DICTAMEN FUNDAMENTADO · DECRETO-LEY 88 & LEY 116 (CUBA)'
      : 'DICTAMEN FUNDAMENTADO · CÓDIGO DE TRABAJO (REP. DOMINICANA)';

  return {
    id: `opinion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    jurisdiction,
    topic: query.slice(0, 50),
    badgeTitle,
    summary: `Para tu consulta sobre "${query}", la legislación vigente establece obligaciones específicas. Se recomienda revisar la normativa aplicable. (Modo offline)`,
    citations: [
      {
        lawName: fallbackLaw,
        article: 'Normativa General Vigente',
        sourceRef: 'Gaceta Oficial Indexada',
        quote: 'Toda relación de prestación de servicios remunerados subordinados goza de presunción legal de relación contractual con todas las prerrogativas de ley.',
      },
    ],
    graphConnections: [
      { label: 'Estatuto Principal', icon: 'gavel', type: 'primary' },
      { label: 'Obligación Patronal', icon: 'schedule', type: 'neutral' },
      { label: 'Seguridad Social', icon: 'shield', type: 'secondary' },
    ],
    takeaways: [
      { id: 1, title: 'Formalización de Expediente', description: 'Conserva copia firmada de identificación, comprobante y contrato debidamente foliado.', boldHighlight: 'copia firmada' },
      { id: 2, title: 'Calendario de Vencimientos', description: 'Programa alertas periódicas para evitar recargos y multas de las autoridades fiscales.', boldHighlight: 'alertas periódicas' },
    ],
    disclaimer: 'Esta orientación es informativa y sustentada en legislación oficial indexada. No sustituye el mandato ni patrocinio letrado de un abogado certificado.',
  };
}

function buildPrompt(
  query: string,
  jurisdiction: Jurisdiction,
  userContext?: { businessName: string; userName: string },
  documentContext?: string
): string {
  const countryName = APP_CONFIG.countryConfig[jurisdiction]?.name ?? jurisdiction;
  const gazette = APP_CONFIG.countryConfig[jurisdiction]?.gazette ?? 'Gaceta Oficial';
  const jurisdictionPrompt = getJurisdictionPrompt(countryName, gazette);

  const context = userContext
    ? `\nContexto del usuario: ${userContext.userName}, empresa: ${userContext.businessName}.`
    : '';

  const docContext = documentContext
    ? `\n\nCONTEXTO DE DOCUMENTOS INDEXADOS:\n${documentContext}\n`
    : '\n\nIMPORTANTE: No hay documentos indexados disponibles para esta consulta. Debes informar al usuario que no tienes acceso a la información específica solicitada y sugerirle actualizar gacetas oficiales o subir documentos relevantes para su país.';

  return `${APP_CONFIG.systemPrompt}

${jurisdictionPrompt}${context}${docContext}

CONSULTA DEL USUARIO: "${query}"

INSTRUCCIONES DE FORMATO:
- Responde en español, tono profesional pero accesible para emprendedores.
- Incluye citas en formato: [CITA: Nombre de la Ley | Artículo X | "Texto literal de la norma"]
- Incluye impactos operativos en formato: [IMPACTO: Título corto | Descripción práctica para el negocio]
- Máximo 3 citas y 3 impactos operativos.
- No uses markdown, solo texto plano.
- SI NO HAY DOCUMENTOS INDEXADOS: Indica claramente que no tienes acceso a esa información y sugiere actualizar gacetas oficiales o subir documentos para su jurisdicción (México, Cuba o República Dominicana).`;
}

function buildLegalOpinion(
  parsed: ParsedResponse,
  query: string,
  jurisdiction: Jurisdiction,
  modelName: string
): LegalOpinion {
  const badgeTitle =
    jurisdiction === 'MX'
      ? `DICTAMEN IA (${modelName}) · LFT & CFF (MÉXICO)`
      : jurisdiction === 'CU'
      ? `DICTAMEN IA (${modelName}) · DECRETO-LEY 88 & LEY 116 (CUBA)`
      : `DICTAMEN IA (${modelName}) · CÓDIGO DE TRABAJO (REP. DOMINICANA)`;

  return {
    id: `opinion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    jurisdiction,
    topic: query.slice(0, 50),
    badgeTitle,
    summary: parsed.summary,
    citations: parsed.citations,
    graphConnections: [
      { label: 'Estatuto Principal', icon: 'gavel', type: 'primary' },
      { label: 'Obligación Patronal', icon: 'schedule', type: 'neutral' },
      { label: 'Seguridad Social', icon: 'shield', type: 'secondary' },
    ],
    takeaways: parsed.takeaways,
    disclaimer: parsed.disclaimer,
  };
}

export async function generateLegalOpinion(
  query: string,
  jurisdiction: Jurisdiction,
  userContext?: { businessName: string; userName: string },
  documentContext?: string
): Promise<LegalOpinion> {
  const settings = getActiveModelSettings();
  const prompt = buildPrompt(query, jurisdiction, userContext, documentContext);
  const selected = settings?.selectedModel ?? '';
  const hfKey = parseHfModelKey(selected);

  // PRIORIDAD 1a: SLM de HuggingFace seleccionado explícitamente ("hf:<key>")
  if (hfKey) {
    try {
      console.log(`[LegalOpinion] Trying HF SLM "${hfKey}" (selección del usuario)...`);
      const hfResult = await generateWithHF(prompt, {
        model: hfKey,
        maxNewTokens: 600,
        temperature: 0.3,
        topP: 0.9,
      });
      const parsed = parseAIResponse(hfResult.text, jurisdiction);
      return buildLegalOpinion(parsed, query, jurisdiction, hfResult.model);
    } catch (hfError) {
      console.warn('[LegalOpinion] HF SLM failed:', hfError instanceof Error ? hfError.message : String(hfError));
    }
  }

  // PRIORIDAD 1b: modelo Ollama seleccionado explícitamente (se respeta al usuario)
  if (!hfKey && selected && selected !== DEFAULT_MODEL && !selected.startsWith(HF_MODEL_PREFIX)) {
    try {
      console.log(`[LegalOpinion] Trying Ollama "${selected}" (selección del usuario)...`);
      const text = await generateWithOllama(selected, prompt, settings?.ollamaBaseUrl);
      const parsed = parseAIResponse(text, jurisdiction);
      return buildLegalOpinion(parsed, query, jurisdiction, selected);
    } catch (ollamaError) {
      console.warn('[LegalOpinion] Ollama failed:', ollamaError instanceof Error ? ollamaError.message : String(ollamaError));
    }
  }

  // PRIORIDAD 2: HF transformers.js por defecto (client-side, sin servidor)
  try {
    console.log('[LegalOpinion] Trying HF transformers.js (default qwen)...');
    const hfResult = await generateWithHF(prompt, {
      model: 'qwen', // Qwen2.5-1.5B-Instruct - excellent Spanish
      maxNewTokens: 600,
      temperature: 0.3,
      topP: 0.9,
    });
    console.log(`[LegalOpinion] HF success: ${hfResult.tokensGenerated} tokens in ${hfResult.timeMs}ms`);
    const parsed = parseAIResponse(hfResult.text, jurisdiction);
    return buildLegalOpinion(parsed, query, jurisdiction, hfResult.model);
  } catch (hfError) {
    console.warn('[LegalOpinion] HF failed:', hfError instanceof Error ? hfError.message : String(hfError));
  }

  // PRIORIDAD 3: Static fallback (always works)
  console.log('[LegalOpinion] Using static fallback');
  return buildFallbackOpinion(query, jurisdiction);
}