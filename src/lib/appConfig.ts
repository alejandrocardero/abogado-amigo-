/**
 * Configuración centralizada de la aplicación.
 * Single source of truth para todos los valores hardcoded extraídos de:
 * - AuthScreen.tsx (VALID_EMAIL_DOMAINS, COUNTRY_CONFIG)
 * - gemini.ts (JURISDICTION_PROMPTS, defaultModel, SYSTEM_PROMPT)
 * - gazetteFetcher.ts (GAZETTE_SOURCES, ALLOWED_DOMAINS)
 * - legalData.ts (lawCatalog)
 */

import { AppConfig, CountryConfig, Jurisdiction, LawCatalogItem } from '../types';

// ==================== Valid Email Domains ====================

export const VALID_EMAIL_DOMAINS: string[] = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.es',
  'yahoo.com.mx',
  'ymail.com',
  'outlook.com',
  'outlook.es',
  'hotmail.com',
  'hotmail.es',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'aol.com',
];

// ==================== Country Configuration ====================

export const COUNTRY_CONFIG: Record<Jurisdiction, CountryConfig> = {
  MX: {
    name: 'México',
    flag: '🇲🇽',
    gazette: 'Diario Oficial de la Federación (DOF)',
    defaultCurrency: 'MXN',
    currencySymbol: '$',
    currencies: [
      { code: 'MXN', label: 'MXN · Peso Mexicano ($)', symbol: '$' },
      { code: 'USD', label: 'USD · Dólar Estadounidense ($)', symbol: 'US$' },
    ],
  },
  CU: {
    name: 'Cuba',
    flag: '🇨🇺',
    gazette: 'Gaceta Oficial de la República (MINJUS)',
    defaultCurrency: 'CUP',
    currencySymbol: '$',
    currencies: [
      { code: 'CUP', label: 'CUP · Peso Cubano ($)', symbol: '$' },
      { code: 'USD', label: 'USD · Moneda Libremente Convertible ($)', symbol: 'US$' },
      { code: 'EUR', label: 'EUR · Euro (€)', symbol: '€' },
    ],
  },
  DO: {
    name: 'República Dominicana',
    flag: '🇩🇴',
    gazette: 'Gaceta Oficial Dominicana',
    defaultCurrency: 'DOP',
    currencySymbol: 'RD$',
    currencies: [
      { code: 'DOP', label: 'DOP · Peso Dominicano (RD$)', symbol: 'RD$' },
      { code: 'USD', label: 'USD · Dólar Estadounidense ($)', symbol: 'US$' },
    ],
  },
};

// ==================== Jurisdiction Prompts ====================

const JURISDICTION_PROMPTS: Record<Jurisdiction, string> = {
  MX: `Eres un asesor legal especializado en derecho mexicano para MiPyMEs.
Fuentes primarias: Ley Federal del Trabajo (LFT), Código Fiscal de la Federación (CFF),
Ley del Seguro Social, Ley del INFONAVIT, Reglamento del Trabajo, NOM-035-STPS-2018.
Diario Oficial de la Federación (DOF) como fuente oficial.`,
  CU: `Eres un asesor legal especializado en derecho cubano para MiPyMEs.
Fuentes primarias: Decreto-Ley No. 88 "Reglamento General de la Ley del Trabajo",
Ley No. 116 "Código de Trabajo", Decreto-Ley No. 364 "Seguridad Social",
Resoluciones del MTSS y MINJUS. Gaceta Oficial de la República como fuente oficial.`,
  DO: `Eres un asesor legal especializado en derecho dominicano para MiPyMEs.
Fuentes primarias: Código de Trabajo Ley 16-92, Ley 87-01 Seguridad Social,
Ley 141-15 (derogada por Ley 45-23), Ley 45-23 Garantías Mobiliarias,
Código de Comercio. Gaceta Oficial como fuente oficial.`,
};

/**
 * Genera un prompt de jurisdicción generalizado basado en el país y gaceta.
 * Reemplaza los prompts hardcoded por una función dinámica.
 */
export function getJurisdictionPrompt(countryName: string, gazette: string): string {
  const jurisdictionKey = Object.keys(COUNTRY_CONFIG).find(
    (key) => COUNTRY_CONFIG[key as Jurisdiction].name === countryName
  ) as Jurisdiction | undefined;

  if (jurisdictionKey && JURISDICTION_PROMPTS[jurisdictionKey]) {
    return JURISDICTION_PROMPTS[jurisdictionKey];
  }

  return `Eres un asesor legal especializado en derecho para MiPyMEs.
Fuentes primarias: legislación oficial vigente de ${countryName}.
Fuente oficial: ${gazette}.`;
}

// ==================== System Prompt (Generalized) ====================

export const SYSTEM_PROMPT = `Eres "Abogado Amigo", un asistente legal para Micro, Pequeñas y Medianas Empresas (MiPyMEs).
Tu objetivo: dar orientación legal preventiva, práctica y fundamentada en legislación oficial vigente.

REGLAS ESTRICTAS:
1. SIEMPRE cita la norma específica (ley, artículo, reglamento) que fundamenta tu respuesta.
2. Indica la jurisdicción aplicable según el país del usuario.
3. Si no hay certeza absoluta, di "Según la legislación vigente..." y sugiere consultar abogado.
4. NUNCA inventes artículos, leyes o jurisprudencia inexistente.
5. Incluye siempre el disclaimer: "Esta orientación es informativa. No sustituye patrocinio letrado."
6. Formato de respuesta: Resumen ejecutivo → Fundamento normativo (citaciones) → Impacto operativo → Disclaimer.`;

// ==================== Suggestion Prompt ====================

export const SUGGESTION_PROMPT = `Analiza el siguiente contenido de un documento legal y genera sugerencias prácticas para el negocio del usuario.

INSTRUCCIONES:
1. Identifica las obligaciones, plazos y requisitos mencionados en el documento.
2. Genera recomendaciones accionables y específicas para el cumplimiento.
3. Prioriza las sugerencias por nivel de urgencia (Alto, Medio, Informativo).
4. Cada sugerencia debe incluir: título corto, descripción práctica, y fundamento normativo.
5. Si el documento menciona fechas límite o montos, destácalos en las sugerencias.
6. Responde en español, tono profesional pero accesible para emprendedores.

FORMATO DE SALIDA:
- Sugerencia 1: [Título] | [Descripción] | [Fundamento]
- Sugerencia 2: [Título] | [Descripción] | [Fundamento]
- Sugerencia 3: [Título] | [Descripción] | [Fundamento]

CONTENIDO DEL DOCUMENTO:`;

// ==================== Default Model ====================

export const DEFAULT_MODEL = 'gemini-2.0-flash-exp';

// ==================== Gazette Sources ====================

export const GAZETTE_SOURCES: Record<Jurisdiction, { name: string; urls: string[] }> = {
  MX: {
    name: 'Diario Oficial de la Federación',
    urls: ['https://www.dof.gob.mx/'],
  },
  CU: {
    name: 'Gaceta Oficial de la República de Cuba',
    urls: ['https://www.gacetaoficial.cu/'],
  },
  DO: {
    name: 'Gaceta Oficial de la República Dominicana',
    urls: ['https://www.gacetaoficial.gob.do/'],
  },
};

// ==================== Allowed Domains (SSRF Protection) ====================

export const ALLOWED_DOMAINS: Record<Jurisdiction, string[]> = {
  MX: ['dof.gob.mx'],
  CU: ['gacetaoficial.cu'],
  DO: ['gacetaoficial.gob.do'],
};

// ==================== Law Catalog ====================

export const LAW_CATALOG: LawCatalogItem[] = [
  // ==================== MÉXICO (DOF) ====================
  {
    id: 'mx-lft',
    country: 'MX',
    title: 'Ley Federal del Trabajo',
    source: 'DOF MÉXICO',
    code: 'LFT',
    articlesCount: 1010,
    lastUpdated: '2024-12-15',
    badge: 'Vigente',
    description: 'Regula las relaciones laborales individuales y colectivas, contratos, jornada, salarios, prestaciones, terminación, huelga y organismos de conciliación.',
  },
  {
    id: 'mx-cff',
    country: 'MX',
    title: 'Código Fiscal de la Federación',
    source: 'DOF MÉXICO',
    code: 'CFF',
    articlesCount: 180,
    lastUpdated: '2024-11-20',
    badge: 'Vigente',
    description: 'Norma los procedimientos fiscales, obligaciones de contribuyentes, facultades de comprobación, medios de defensa y delitos fiscales.',
  },
  {
    id: 'mx-lss',
    country: 'MX',
    title: 'Ley del Seguro Social',
    source: 'DOF MÉXICO',
    code: 'LSS',
    articlesCount: 304,
    lastUpdated: '2024-10-05',
    badge: 'Vigente',
    description: 'Establece el régimen obligatorio de seguridad social: riesgos de trabajo, enfermedades, maternidad, guarderías, retiro y vivienda (INFONAVIT).',
  },
  {
    id: 'mx-lisf',
    country: 'MX',
    title: 'Ley del INFONAVIT',
    source: 'DOF MÉXICO',
    code: 'LINFONAVIT',
    articlesCount: 85,
    lastUpdated: '2024-09-12',
    badge: 'Vigente',
    description: 'Regula el Instituto del Fondo Nacional de la Vivienda para los Trabajadores: aportaciones, créditos, subcuentas y procedimientos.',
  },
  {
    id: 'mx-nom035',
    country: 'MX',
    title: 'NOM-035-STPS-2018',
    source: 'DOF MÉXICO',
    code: 'NOM-035',
    articlesCount: 28,
    lastUpdated: '2023-10-23',
    badge: 'Vigente',
    description: 'Factores de riesgo psicosocial en el trabajo: identificación, análisis, prevención y evaluación del entorno organizacional.',
  },
  {
    id: 'mx-lft-2019',
    country: 'MX',
    title: 'Reforma Laboral 2019 (Justicia Laboral)',
    source: 'DOF MÉXICO',
    code: 'LFT-REF-2019',
    articlesCount: 50,
    lastUpdated: '2019-05-01',
    badge: 'Reformada',
    description: 'Transforma la justicia laboral: Juntas de Conciliación → Tribunales Laborales, conciliación prejudicial obligatoria, democracia sindical.',
  },
  {
    id: 'mx-lfte',
    country: 'MX',
    title: 'Ley Federal del Trabajo - Teletrabajo (Cap. XII Bis)',
    source: 'DOF MÉXICO',
    code: 'LFT-TELE',
    articlesCount: 12,
    lastUpdated: '2023-06-07',
    badge: 'Reformada',
    description: 'Regula el trabajo a distancia: derecho a desconexión, equipos, gastos, voluntariedad y reversibilidad. Reforma 2023.',
  },

  // ==================== CUBA (GACETA OFICIAL) ====================
  {
    id: 'cu-dl88',
    country: 'CU',
    title: 'Decreto-Ley No. 88 - Reglamento General de la Ley del Trabajo',
    source: 'GACETA OFICIAL CUBA',
    code: 'DL-88',
    articlesCount: 156,
    lastUpdated: '2023-02-15',
    badge: 'Vigente',
    description: 'Desarrolla la Ley No. 116: contratos, jornada, descanso, salario, seguridad social, trabajo femenino, juvenil y solución de conflictos.',
  },
  {
    id: 'cu-ley116',
    country: 'CU',
    title: 'Ley No. 116 - Código de Trabajo',
    source: 'GACETA OFICIAL CUBA',
    code: 'LEY-116',
    articlesCount: 132,
    lastUpdated: '2019-12-20',
    badge: 'Vigente',
    description: 'Marco general de relaciones laborales: principios, derechos, obligaciones, contratos, jornada, salario, seguridad y salud, sindicatos.',
  },
  {
    id: 'cu-dl364',
    country: 'CU',
    title: 'Decreto-Ley No. 364 - Seguridad Social',
    source: 'GACETA OFICIAL CUBA',
    code: 'DL-364',
    articlesCount: 89,
    lastUpdated: '2019-10-10',
    badge: 'Vigente',
    description: 'Régimen de seguridad social: pensiones, maternidad, enfermedad, riesgos laborales, subsidios y asistencia social.',
  },
  {
    id: 'cu-dl370',
    country: 'CU',
    title: 'Decreto-Ley No. 370 - Trabajo por Cuenta Propia',
    source: 'GACETA OFICIAL CUBA',
    code: 'DL-370',
    articlesCount: 72,
    lastUpdated: '2021-08-18',
    badge: 'Vigente',
    description: 'Regula el trabajo por cuenta propia (TCP): licencias, obligaciones fiscales, seguridad social, actividades permitidas y prohibidas.',
  },
  {
    id: 'cu-res-mtss',
    country: 'CU',
    title: 'Resoluciones MTSS - Salario Mínimo y Jornadas',
    source: 'GACETA OFICIAL CUBA',
    code: 'RES-MTSS',
    articlesCount: 45,
    lastUpdated: '2024-01-15',
    badge: 'Reformada',
    description: 'Actualizaciones de salario mínimo por actividad, jornadas especiales, trabajo nocturno y horas extraordinarias.',
  },

  // ==================== REPÚBLICA DOMINICANA (GACETA OFICIAL) ====================
  {
    id: 'do-codigo-trabajo',
    country: 'DO',
    title: 'Código de Trabajo Ley 16-92',
    source: 'GACETA OFICIAL DO',
    code: 'CT-16-92',
    articlesCount: 255,
    lastUpdated: '2024-03-20',
    badge: 'Vigente',
    description: 'Regula el trabajo subordinado: contratos, jornada, salario, prestaciones, riesgos laborales, sindicatos, huelga y procedimientos judiciales.',
  },
  {
    id: 'do-ley87-01',
    country: 'DO',
    title: 'Ley 87-01 - Sistema Dominicano de Seguridad Social',
    source: 'GACETA OFICIAL DO',
    code: 'LEY-87-01',
    articlesCount: 112,
    lastUpdated: '2023-11-10',
    badge: 'Vigente',
    description: 'Crea el SDSS: salud, pensiones, riesgos laborales. AFP, ARS, CNSS, Tesorería de la Seguridad Social (TSS).',
  },
  {
    id: 'do-ley45-23',
    country: 'DO',
    title: 'Ley Orgánica 45-23 - Garantías Mobiliarias (SEGM)',
    source: 'GACETA OFICIAL DO',
    code: 'LEY-45-23',
    articlesCount: 98,
    lastUpdated: '2023-02-28',
    badge: 'Vigente',
    description: 'Sustituye Ley 141-15. Crea el Sistema Electrónico de Garantías Mobiliarias (SEGM): prendas, hipotecas mobiliarias, registro único, prioridad crediticia.',
  },
  {
    id: 'do-ley141-15',
    country: 'DO',
    title: 'Ley 141-15 - Reestructuración y Liquidación (DERogada)',
    source: 'GACETA OFICIAL DO',
    code: 'LEY-141-15',
    articlesCount: 180,
    lastUpdated: '2023-02-28',
    badge: 'Derogada',
    description: 'Derogada por Ley 45-23. Regulaba quiebras, concordatos y liquidación judicial. Vigente hasta febrero 2023.',
  },
  {
    id: 'do-codigo-comercio',
    country: 'DO',
    title: 'Código de Comercio',
    source: 'GACETA OFICIAL DO',
    code: 'COD-COM',
    articlesCount: 1200,
    lastUpdated: '2022-06-15',
    badge: 'Vigente',
    description: 'Actos de comercio, sociedades mercantiles, títulos valores, contratos mercantiles, quiebra y prescripción comercial.',
  },
  {
    id: 'do-ley16-92-mod',
    country: 'DO',
    title: 'Modificaciones Ley 16-92 (Ley 188-07, 370-10)',
    source: 'GACETA OFICIAL DO',
    code: 'CT-MOD',
    articlesCount: 35,
    lastUpdated: '2024-01-30',
    badge: 'Reformada',
    description: 'Reformas a licencia por maternidad/paternidad, teletrabajo, acoso laboral, salario mínimo sectorial y procedimientos inspectivos.',
  },
];

// ==================== APP_CONFIG (Single Source of Truth) ====================

export const APP_CONFIG: AppConfig = {
  validEmailDomains: VALID_EMAIL_DOMAINS,
  countryConfig: COUNTRY_CONFIG,
  defaultModel: DEFAULT_MODEL,
  systemPrompt: SYSTEM_PROMPT,
  suggestionPrompt: SUGGESTION_PROMPT,
};
