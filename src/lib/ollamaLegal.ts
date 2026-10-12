/**
 * Servicio de generación de dictámenes legales.
 * Usa Ollama como motor de IA principal, con prompts centralizados en APP_CONFIG.
 */

import { Jurisdiction, LegalOpinion, LegalCitation, ModelSettings } from '../types';
import { generateWithOllama } from './ollama';
import { APP_CONFIG, getJurisdictionPrompt } from './appConfig';
import { storage } from './db';

const DEFAULT_MODEL = 'gemini-2.0-flash-exp';

interface OllamaResponse {
  summary: string;
  citations: LegalCitation[];
  takeaways: { id: number; title: string; description: string; boldHighlight?: string }[];
  disclaimer: string;
}

function getActiveModelSettings(): ModelSettings | null {
  return storage.modelSettings.get();
}

function parseOllamaResponse(text: string, jurisdiction: Jurisdiction): OllamaResponse {
  const citations: LegalCitation[] = [];
  const takeaways: { id: number; title: string; description: string; boldHighlight?: string }[] = [];

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

  if (citations.length === 0) {
    const fallbackLaw = jurisdiction === 'MX' ? 'Ley Federal del Trabajo' : jurisdiction === 'CU' ? 'Decreto-Ley No. 88' : 'Código de Trabajo Ley 16-92';
    citations.push({
      lawName: fallbackLaw,
      article: 'Normativa General Vigente',
      sourceRef: 'Gaceta Oficial Indexada',
      quote: 'La legislación vigente establece obligaciones y derechos para empleadores y trabajadores.',
    });
  }

  const paragraphs = text.split('\n\n').filter(p => p.trim().length > 20);
  const summary = paragraphs[0]?.trim() ?? 'Consulta procesada con IA legal.';

  return {
    summary: summary.slice(0, 500),
    citations,
    takeaways: takeaways.length > 0 ? takeaways : [
      { id: 1, title: 'Revisar obligaciones', description: 'Verifica el cumplimiento de la normativa aplicable a tu caso.', boldHighlight: 'cumplimiento' },
      { id: 2, title: 'Documentar todo', description: 'Conserva evidencia escrita de contratos, pagos y comunicaciones.', boldHighlight: 'evidencia escrita' },
    ],
    disclaimer: 'Esta orientación es informativa y sustentada en legislación oficial indexada. No sustituye el mandato ni patrocinio letrado de un abogado certificado.',
  };
}

export async function generateLegalOpinion(
  query: string,
  jurisdiction: Jurisdiction,
  userContext?: { businessName: string; userName: string },
  documentContext?: string
): Promise<LegalOpinion> {
  const settings = getActiveModelSettings();

  if (!settings || !settings.selectedModel || settings.selectedModel === DEFAULT_MODEL) {
    throw new Error('No hay modelo Ollama configurado. Ve a Configuración > Configurar Modelos y selecciona uno.');
  }

  const countryName = APP_CONFIG.countryConfig[jurisdiction]?.name ?? jurisdiction;
  const gazette = APP_CONFIG.countryConfig[jurisdiction]?.gazette ?? 'Gaceta Oficial';
  const jurisdictionPrompt = getJurisdictionPrompt(countryName, gazette);

  const context = userContext
    ? `\nContexto del usuario: ${userContext.userName}, empresa: ${userContext.businessName}.`
    : '';

  const docContext = documentContext
    ? `\n\nCONTEXTO DE DOCUMENTOS INDEXADOS:\n${documentContext}\n`
    : '\n\nIMPORTANTE: No hay documentos indexados disponibles para esta consulta. Debes informar al usuario que no tienes acceso a la información específica solicitada y sugerirle actualizar gacetas oficiales o subir documentos relevantes para su país.';

  const prompt = `${APP_CONFIG.systemPrompt}

${jurisdictionPrompt}${context}${docContext}

CONSULTA DEL USUARIO: "${query}"

INSTRUCCIONES DE FORMATO:
- Responde en español, tono profesional pero accesible para emprendedores.
- Incluye citas en formato: [CITA: Nombre de la Ley | Artículo X | "Texto literal de la norma"]
- Incluye impactos operativos en formato: [IMPACTO: Título corto | Descripción práctica para el negocio]
- Máximo 3 citas y 3 impactos operativos.
- No uses markdown, solo texto plano.
- SI NO HAY DOCUMENTOS INDEXADOS: Indica claramente que no tienes acceso a esa información y sugiere actualizar gacetas oficiales o subir documentos para su jurisdicción (México, Cuba o República Dominicana).`;

  try {
    const text = await generateWithOllama(settings.selectedModel, prompt, settings.ollamaBaseUrl);
    const parsed = parseOllamaResponse(text, jurisdiction);

    return {
      id: `opinion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      jurisdiction,
      topic: query.slice(0, 50),
      badgeTitle:
        jurisdiction === 'MX'
          ? 'DICTAMEN IA · LFT & CFF (MÉXICO)'
          : jurisdiction === 'CU'
          ? 'DICTAMEN IA · DECRETO-LEY 88 & LEY 116 (CUBA)'
          : 'DICTAMEN IA · CÓDIGO DE TRABAJO (REP. DOMINICANA)',
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
  } catch (error) {
    console.error('[Ollama] Error generando dictamen:', error);
    throw new Error(
      `Error generando dictamen con Ollama: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
