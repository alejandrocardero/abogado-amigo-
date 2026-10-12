import { Jurisdiction } from '../types';

/**
 * Curated detail content for the three GraphRAG flow buttons.
 * All content is jurisdiction-aware and designed to work without
 * user-uploaded documents (uses LAW_CATALOG metadata as anchor).
 */

// ==================== Type Definitions ====================

export interface StatuteArticle {
  number: string;
  title: string;
  summary: string;
  fullText?: string;
}

export interface StatuteContent {
  lawId: string;
  title: string;
  code: string;
  source: string;
  badge: 'Vigente' | 'Reformada' | 'En Revisión' | 'Derogada';
  description: string;
  articles: StatuteArticle[];
  keyArticles: string[]; // Article numbers to highlight
}

export interface ObligationStep {
  id: number;
  title: string;
  description: string;
  legalBasis: string; // e.g., "LFT Art. 15, 17, 23"
  deadline?: string; // e.g., "Al iniciar relación laboral"
  priority: 'Alta' | 'Media' | 'Informativa';
  completed?: boolean;
}

export interface ObligationContent {
  obligationTitle: string;
  description: string;
  legalFoundation: string;
  steps: ObligationStep[];
  relatedLaws: string[]; // lawIds from LAW_CATALOG
}

export interface SSRequirement {
  id: string;
  title: string;
  description: string;
  entity: string; // e.g., "IMSS", "INFONAVIT", "TSS"
  forms: string[]; // Form names/numbers
  deadlines: string; // e.g., "Mensual (días 1-17)"
  sanctions: string; // e.g., "Recargos 1.47% mensual + multas"
  appliesTo: string; // e.g., "Todos los patrones con trabajadores"
}

export interface SeguridadSocialContent {
  entityName: string;
  description: string;
  jurisdiction: Jurisdiction;
  requirements: SSRequirement[];
  relatedLaws: string[]; // lawIds from LAW_CATALOG
  contactInfo?: {
    portal: string;
    phone?: string;
    email?: string;
  };
}

// ==================== MÉXICO Content ====================

const MX_STATUTE: StatuteContent = {
  lawId: 'mx-lft',
  title: 'Ley Federal del Trabajo',
  code: 'LFT',
  source: 'DOF MÉXICO',
  badge: 'Vigente',
  description: 'Regula las relaciones laborales individuales y colectivas, contratos, jornada, salarios, prestaciones, terminación, huelga y organismos de conciliación.',
  keyArticles: ['15', '17', '23', '24', '25', '26', '27', '28', '29', '30'],
  articles: [
    {
      number: '15',
      title: 'Principio de irrenunciabilidad de derechos',
      summary: 'Los derechos laborales son irrenunciables; cualquier convenio que los limite es nulo.',
    },
    {
      number: '17',
      title: 'Definición de trabajo subordinado',
      summary: 'El trabajo subordinado es el que se presta a un patrón bajo su dirección y dependencia.',
    },
    {
      number: '23',
      title: 'Contrato de trabajo: elementos esenciales',
      summary: 'Debe constar por escrito y contener: datos de las partes, duración, servicios, lugar, jornada, salario, etc.',
    },
    {
      number: '24',
      title: 'Prueba del contrato',
      summary: 'La falta de escrito no priva de derechos al trabajador; la carga de la prueba recae en el patrón.',
    },
    {
      number: '25',
      title: 'Tipos de contrato',
      summary: 'Por tiempo indeterminado, por tiempo determinado, por obra o tiempo, de temporada, de prueba, de capacitación inicial.',
    },
    {
      number: '26',
      title: 'Contrato por tiempo indeterminado',
      summary: 'Es la regla general; se presume cuando no se prueba lo contrario.',
    },
    {
      number: '27',
      title: 'Contrato por tiempo determinado',
      summary: 'Solo procede cuando la naturaleza del trabajo lo justifique; máximo 4 años.',
    },
    {
      number: '28',
      title: 'Contrato de prueba',
      summary: 'Máximo 30 días (180 para directivos); evalúa aptitudes; si continua, se vuelve indeterminado.',
    },
    {
      number: '29',
      title: 'Contrato de capacitación inicial',
      summary: 'Para adquirir conocimientos; máximo 3 meses (6 para directivos); sin relación laboral plena.',
    },
    {
      number: '30',
      title: 'Contrato de temporada',
      summary: 'Para actividades discontinuas; mismos derechos que indeterminado durante la temporada.',
    },
  ],
};

const MX_OBLIGATION: ObligationContent = {
  obligationTitle: 'Formalizar la relación laboral por escrito',
  description: 'El patrón debe celebrar contrato escrito con cada trabajador, registrarlo y entregar copia, so pena de que se presuma la relación por tiempo indeterminado y a jornada completa.',
  legalFoundation: 'LFT Art. 15, 17, 23, 24, 25; CFF Art. 29, 31, 33; LSS Art. 13, 15; NOM-035',
  steps: [
    {
      id: 1,
      title: 'Identificar el tipo de relación laboral',
      description: 'Determinar si es subordinado (LFT Art. 17), autónomo, o de otra naturaleza.',
      legalBasis: 'LFT Art. 17',
      deadline: 'Antes de iniciar prestación de servicios',
      priority: 'Alta',
    },
    {
      id: 2,
      title: 'Redactar contrato por escrito',
      description: 'Incluir: datos de las partes, duración, servicios, lugar, jornada, salario, día de pago, prestaciones, cláusulas especiales.',
      legalBasis: 'LFT Art. 23, 24, 25',
      deadline: 'Al iniciar relación laboral',
      priority: 'Alta',
    },
    {
      id: 3,
      title: 'Entregar copia al trabajador',
      description: 'El patrón debe entregar una copia firmada del contrato al trabajador.',
      legalBasis: 'LFT Art. 24',
      deadline: 'Inmediatamente tras firma',
      priority: 'Alta',
    },
    {
      id: 4,
      title: 'Registrar ante el IMSS (Alta de trabajador)',
      description: 'Dar de alta al trabajador en el IMSS dentro de los 5 días hábiles posteriores al inicio de labores.',
      legalBasis: 'LSS Art. 13, 15; Reglamento LSS Art. 12',
      deadline: '5 días hábiles post-inicio',
      priority: 'Alta',
    },
    {
      id: 5,
      title: 'Registrar ante INFONAVIT',
      description: 'Inscribir al trabajador en INFONAVIT para aportaciones de vivienda.',
      legalBasis: 'LINFONAVIT Art. 11, 15',
      deadline: 'Junto con alta IMSS',
      priority: 'Alta',
    },
    {
      id: 6,
      title: 'Llevar libro de control de asistencia y nómina',
      description: 'Mantener registros de asistencia, pagos, retenciones y constancias por 5 años.',
      legalBasis: 'LFT Art. 804; CFF Art. 30, 31; LSS Art. 21',
      deadline: 'Continuo (conservar 5 años)',
      priority: 'Media',
    },
    {
      id: 7,
      title: 'Evaluar riesgos psicosociales (NOM-035)',
      description: 'Aplicar cuestionario, identificar factores de riesgo, implementar medidas preventivas.',
      legalBasis: 'NOM-035-STPS-2018',
      deadline: 'Anual / Al detectar cambios',
      priority: 'Media',
    },
  ],
  relatedLaws: ['mx-lft', 'mx-cff', 'mx-lss', 'mx-lisf', 'mx-nom035'],
};

const MX_SEGURIDAD_SOCIAL: SeguridadSocialContent = {
  entityName: 'IMSS / INFONAVIT / AFORE',
  description: 'El Sistema de Seguridad Social mexicano (IMSS) cubre riesgos de trabajo, enfermedades, maternidad, retiro, cesantía/vejez y vivienda (INFONAVIT). Las AFORE administran el ahorro para el retiro.',
  jurisdiction: 'MX',
  requirements: [
    {
      id: 'imss-alta',
      title: 'Alta de trabajador en IMSS',
      description: 'Registrar al trabajador ante el IMSS para cobertura de riesgos de trabajo, enfermedades, maternidad e invalidez.',
      entity: 'IMSS',
      forms: ['IDSE (Inmoviliario Digital de Seguridad Social)', 'Escrito libre de alta'],
      deadlines: '5 días hábiles post-inicio de labores',
      sanctions: 'Multas de 20 a 350 UMAs por trabajador no dado de alta; recargos del 1.47% mensual sobre cuotas omitidas',
      appliesTo: 'Todos los patrones con al menos un trabajador',
    },
    {
      id: 'imss-cotizaciones',
      title: 'Pago oportuno de cuotas obrero-patronales',
      description: 'Enterar cuotas de riesgos de trabajo, enfermedades/maternidad, invalidez/vida, retiro, cesantía/vejez e INFONAVIT.',
      entity: 'IMSS / INFONAVIT',
      forms: ['SIPARE (Sistema de Pago Referenciado)', 'SUA (Sistema Único de Autodeterminación)'],
      deadlines: 'Mensual (días 1 al 17 del mes siguiente)',
      sanctions: 'Recargos 1.47% mensual; multas 5-100 UMAs; actualización inflacionaria; ejecución fiscal',
      appliesTo: 'Todos los patrones registrados',
    },
    {
      id: 'infona-vivienda',
      title: 'Aportaciones INFONAVIT (vivienda)',
      description: 'Aportación patronal del 5% del salario base de cotización para el fondo de vivienda.',
      entity: 'INFONAVIT',
      forms: ['SIPARE', 'Portal INFONAVIT Empresas'],
      deadlines: 'Mensual (días 1 al 17 del mes siguiente)',
      sanctions: 'Recargos 1.47% mensual; multas; restricción de créditos para trabajadores',
      appliesTo: 'Todos los patrones con trabajadores',
    },
    {
      id: 'afore-retiro',
      title: 'Aportaciones al SAR/AFORE (retiro)',
      description: 'Cuotas de retiro (2% patrón), cesantía/vejez (3.15% patrón + 1.125% trabajador).',
      entity: 'AFORE (CONSAR)',
      forms: ['SIPARE', 'Archivos XML envío masivo'],
      deadlines: 'Mensual (días 1 al 17 del mes siguiente)',
      sanctions: 'Recargos; multas CONSAR; afecta pensión del trabajador',
      appliesTo: 'Todos los patrones con trabajadores',
    },
  ],
  relatedLaws: ['mx-lss', 'mx-lisf'],
  contactInfo: {
    portal: 'www.imss.gob.mx / www.infonavit.org.mx / www.consar.gob.mx',
    phone: 'IMSS: 800 623 2323 | INFONAVIT: 800 008 3900',
  },
};

// ==================== CUBA Content ====================

const CU_STATUTE: StatuteContent = {
  lawId: 'cu-ley116',
  title: 'Ley No. 116 - Código de Trabajo',
  code: 'LEY-116',
  source: 'GACETA OFICIAL CUBA',
  badge: 'Vigente',
  description: 'Marco general de relaciones laborales: principios, derechos, obligaciones, contratos, jornada, salario, seguridad y salud, sindicatos.',
  keyArticles: ['15', '16', '17', '18', '19', '20', '21', '22', '23', '24'],
  articles: [
    {
      number: '15',
      title: 'Principios fundamentales',
      summary: 'El trabajo es un deber social; igualdad de oportunidades; no discriminación; estabilidad laboral.',
    },
    {
      number: '16',
      title: 'Relación de trabajo',
      summary: 'Existe cuando una persona física presta servicios a otra bajo subordinación y dependencia.',
    },
    {
      number: '17',
      title: 'Contrato de trabajo: forma y contenido',
      summary: 'Escrito obligatorio; datos de las partes, objeto, lugar, jornada, salario, duración, condiciones.',
    },
    {
      number: '18',
      title: 'Tipos de contrato',
      summary: 'Indefinido, temporal, por obra/servicio, de prueba, aprendizaje, tiempo parcial.',
    },
    {
      number: '19',
      title: 'Período de prueba',
      summary: 'Hasta 3 meses (6 para cargos de dirección); evalúa idoneidad; si supera, contrato indefinido.',
    },
    {
      number: '20',
      title: 'Contrato temporal',
      summary: 'Por necesidades transitorias; máximo 1 año prorrogable por 1 más; si excede, se torna indefinido.',
    },
    {
      number: '21',
      title: 'Contrato por obra o servicio',
      summary: 'Duración vinculada a la ejecución de obra/servicio determinado; finaliza al concluir.',
    },
    {
      number: '22',
      title: 'Contrato de aprendizaje',
      summary: 'Para formación teórico-práctica; duración según programa; no genera relación laboral plena.',
    },
    {
      number: '23',
      title: 'Contrato a tiempo parcial',
      summary: 'Jornada reducida; mismos derechos proporcionales; no puede exceder 4 horas diarias.',
    },
    {
      number: '24',
      title: 'Obligaciones del empleador',
      summary: 'Pagar salario, garantizar seguridad, capacitar, respetar derechos, facilitar organización sindical.',
    },
  ],
};

const CU_OBLIGATION: ObligationContent = {
  obligationTitle: 'Formalizar contrato de trabajo según Ley 116',
  description: 'El empleador debe suscribir contrato escrito con cada trabajador, registrando las condiciones esenciales y entregando copia, bajo apercibimiento de sanciones por la Inspección del Trabajo.',
  legalFoundation: 'Ley 116 Art. 15-24; DL-88 Art. 1-10; DL-364 Art. 5, 6; Res. MTSS salario mínimo',
  steps: [
    {
      id: 1,
      title: 'Definir modalidad contractual',
      description: 'Seleccionar: indefinido, temporal, por obra, prueba, aprendizaje o tiempo parcial según necesidad real.',
      legalBasis: 'Ley 116 Art. 18',
      deadline: 'Antes de iniciar labores',
      priority: 'Alta',
    },
    {
      id: 2,
      title: 'Suscribir contrato escrito',
      description: 'Incluir: identificación partes, objeto, lugar, jornada, salario, duración, categoría, condiciones especiales.',
      legalBasis: 'Ley 116 Art. 17; DL-88 Art. 5',
      deadline: 'Al iniciar relación laboral',
      priority: 'Alta',
    },
    {
      id: 3,
      title: 'Entregar copia al trabajador y registrar',
      description: 'Entregar copia firmada; llevar registro interno de contratos para inspección laboral.',
      legalBasis: 'Ley 116 Art. 17; DL-88 Art. 6',
      deadline: 'Inmediato',
      priority: 'Alta',
    },
    {
      id: 4,
      title: 'Inscribir en Seguridad Social (DL-364)',
      description: 'Registrar trabajador ante la Seguridad Social para pensiones, maternidad, enfermedad, riesgos laborales.',
      legalBasis: 'DL-364 Art. 5, 6, 12',
      deadline: '5 días hábiles',
      priority: 'Alta',
    },
    {
      id: 5,
      title: 'Cumplir salario mínimo sectorial (Res. MTSS)',
      description: 'Aplicar salario mínimo vigente según actividad económica y zona geográfica.',
      legalBasis: 'Resoluciones MTSS vigentes',
      deadline: 'Cada período de pago',
      priority: 'Alta',
    },
    {
      id: 6,
      title: 'Garantizar seguridad y salud en el trabajo',
      description: 'Implementar programa de prevención, capacitar, proveer EPP, notificar accidentes.',
      legalBasis: 'Ley 116 Art. 68-72; DL-88 Art. 45-50',
      deadline: 'Continuo',
      priority: 'Media',
    },
  ],
  relatedLaws: ['cu-ley116', 'cu-dl88', 'cu-dl364', 'cu-res-mtss'],
};

const CU_SEGURIDAD_SOCIAL: SeguridadSocialContent = {
  entityName: 'Seguridad Social (MTSS / MINSAP / ONAT)',
  description: 'El régimen de seguridad social cubano (DL-364) cubre pensiones (vejez, invalidez, sobrevivientes), maternidad, enfermedad común, riesgos laborales, subsidios y asistencia social. Administrado por MTSS con apoyo de MINSAP y ONAT.',
  jurisdiction: 'CU',
  requirements: [
    {
      id: 'ss-inscripcion',
      title: 'Inscripción del trabajador en Seguridad Social',
      description: 'Registrar al trabajador para cobertura de pensiones, maternidad, enfermedad, riesgos laborales y subsidios.',
      entity: 'MTSS / Seguridad Social',
      forms: ['Planilla de inscripción', 'Declaración de alta'],
      deadlines: '5 días hábiles post-inicio',
      sanctions: 'Multas por omisión; responsabilidad solidaria por prestaciones no cubiertas',
      appliesTo: 'Todos los empleadores (estatales, no estatales, TCP)',
    },
    {
      id: 'ss-aportes',
      title: 'Aportes a la Seguridad Social',
      description: 'Aporte patronal según actividad (generalmente 14% del salario) + aporte trabajador (5%). Incluye fondo de pensiones, maternidad, riesgos laborales.',
      entity: 'ONAT / MTSS',
      forms: ['Declaración jurada mensual', 'Planilla de liquidación'],
      deadlines: 'Mensual (primeros 10 días hábiles del mes siguiente)',
      sanctions: 'Intereses moratorios; multas; ejecución fiscal; responsabilidad penal en casos graves',
      appliesTo: 'Todos los empleadores',
    },
    {
      id: 'ss-riesgos',
      title: 'Cobertura de riesgos laborales',
      description: 'Protección ante accidentes de trabajo y enfermedades profesionales: atención médica, subsidios, pensiones por invalidez/muerte.',
      entity: 'MTSS / MINSAP',
      forms: ['Parte de accidente de trabajo', 'Historia clínica laboral'],
      deadlines: 'Notificación inmediata (24h); calificación en 30 días',
      sanctions: 'Multas por no notificar; recargos por mora en subsidios',
      appliesTo: 'Todos los empleadores',
    },
  ],
  relatedLaws: ['cu-dl364', 'cu-ley116'],
  contactInfo: {
    portal: 'www.mtss.gob.cu / www.onat.gob.cu',
    phone: 'MTSS: +53 7 838-XXXX',
  },
};

// ==================== REPÚBLICA DOMINICANA Content ====================

const DO_STATUTE: StatuteContent = {
  lawId: 'do-codigo-trabajo',
  title: 'Código de Trabajo Ley 16-92',
  code: 'CT-16-92',
  source: 'GACETA OFICIAL DO',
  badge: 'Vigente',
  description: 'Regula el trabajo subordinado: contratos, jornada, salario, prestaciones, riesgos laborales, sindicatos, huelga y procedimientos judiciales.',
  keyArticles: ['16', '17', '18', '19', '20', '21', '22', '23', '24', '25'],
  articles: [
    {
      number: '16',
      title: 'Definición de contrato de trabajo',
      summary: 'Convenio por el cual una persona se obliga a prestar un servicio a otra bajo dependencia y subordinación.',
    },
    {
      number: '17',
      title: 'Forma del contrato',
      summary: 'Debe constar por escrito; tres ejemplares (trabajador, empleador, Ministerio de Trabajo).',
    },
    {
      number: '18',
      title: 'Contenido mínimo',
      summary: 'Datos de las partes, naturaleza del trabajo, lugar, jornada, salario, forma de pago, duración, condiciones.',
    },
    {
      number: '19',
      title: 'Presunción de contrato',
      summary: 'La prestación de servicios crea presunción de contrato por tiempo indefinido y jornada completa.',
    },
    {
      number: '20',
      title: 'Tipos de contrato',
      summary: 'Indefinido, plazo fijo, obra/servicio determinado, aprendizaje, temporada, tiempo parcial.',
    },
    {
      number: '21',
      title: 'Contrato de aprendizaje',
      summary: 'Para formación; máximo 2 años; 60% salario mínimo primer año, 75% segundo; no genera indemnización.',
    },
    {
      number: '22',
      title: 'Contrato a plazo fijo',
      summary: 'Solo por causa justificada; máximo 1 año (prorrogable 1 más); si continua, se torna indefinido.',
    },
    {
      number: '23',
      title: 'Contrato por obra o servicio',
      summary: 'Duración vinculada a la obra/servicio; finaliza automáticamente al concluir.',
    },
    {
      number: '24',
      title: 'Obligaciones del empleador',
      summary: 'Pagar salario, dar trabajo, proporcionar herramientas, seguridad, capacitación, respetar dignidad.',
    },
    {
      number: '25',
      title: 'Prohibiciones al empleador',
      summary: 'No retener salarios, no discriminar, no obligar a comprar en establecimientos determinados, no coaccionar.',
    },
  ],
};

const DO_OBLIGATION: ObligationContent = {
  obligationTitle: 'Celebrar y registrar contrato de trabajo (Ley 16-92)',
  description: 'El empleador debe formalizar por escrito todo contrato laboral, entregando copia al trabajador y depositando ejemplar en el Ministerio de Trabajo, bajo sanción de multas y presunción de contrato indefinido.',
  legalFoundation: 'Código Trabajo Art. 16-25; Ley 87-01 Art. 8, 9, 11, 13; Ley 188-07; Ley 370-10',
  steps: [
    {
      id: 1,
      title: 'Determinar tipo de contrato',
      description: 'Indefinido (regla), plazo fijo (causa justificada), obra/servicio, aprendizaje, temporada.',
      legalBasis: 'Código Trabajo Art. 19, 20, 21, 22',
      deadline: 'Antes de iniciar labores',
      priority: 'Alta',
    },
    {
      id: 2,
      title: 'Redactar contrato por escrito (triplicado)',
      description: 'Tres ejemplares: trabajador, empleador, Ministerio de Trabajo. Contenido Art. 18.',
      legalBasis: 'Código Trabajo Art. 17, 18',
      deadline: 'Al iniciar relación',
      priority: 'Alta',
    },
    {
      id: 3,
      title: 'Depositar ejemplar en Ministerio de Trabajo',
      description: 'Entregar un ejemplar al Ministerio de Trabajo para registro y control.',
      legalBasis: 'Código Trabajo Art. 17',
      deadline: '3 días hábiles post-firma',
      priority: 'Alta',
    },
    {
      id: 4,
      title: 'Registrar en TSS (Tesorería de la Seguridad Social)',
      description: 'Afiliar trabajador al SDSS: salud (ARS), pensiones (AFP), riesgos laborales.',
      legalBasis: 'Ley 87-01 Art. 8, 9, 11, 13',
      deadline: '3 días hábiles post-inicio',
      priority: 'Alta',
    },
    {
      id: 5,
      title: 'Contratar Seguro de Riesgos Laborales (SRL)',
      description: 'Obligatorio para todo empleador; cubre accidentes de trabajo y enfermedades profesionales.',
      legalBasis: 'Ley 87-01 Art. 62-72',
      deadline: 'Antes de iniciar operaciones',
      priority: 'Alta',
    },
    {
      id: 6,
      title: 'Llevar libros de nómina y asistencia',
      description: 'Registros de nómina, asistencia, vacaciones, licencias; conservación 10 años.',
      legalBasis: 'Código Trabajo Art. 62, 63; Ley 87-01 Art. 73',
      deadline: 'Continuo (10 años)',
      priority: 'Media',
    },
    {
      id: 7,
      title: 'Cumplir salario mínimo sectorial',
      description: 'Aplicar salario mínimo según Comité Nacional de Salarios (Resoluciones vigentes).',
      legalBasis: 'Código Trabajo Art. 179-186; Res. CNS',
      deadline: 'Cada pago',
      priority: 'Alta',
    },
  ],
  relatedLaws: ['do-codigo-trabajo', 'do-ley87-01', 'do-ley16-92-mod'],
};

const DO_SEGURIDAD_SOCIAL: SeguridadSocialContent = {
  entityName: 'TSS / ARS / AFP / SISALRIL',
  description: 'El Sistema Dominicano de Seguridad Social (Ley 87-01) tiene tres regímenes: Salud (ARS), Pensiones (AFP) y Riesgos Laborales (SRL). La TSS recauda y distribuye; SISALRIL supervisa.',
  jurisdiction: 'DO',
  requirements: [
    {
      id: 'tss-afiliacion',
      title: 'Afiliación al SDSS (TSS)',
      description: 'Registrar empresa y trabajadores en la Tesorería de la Seguridad Social para los tres regímenes.',
      entity: 'TSS (Tesorería de la Seguridad Social)',
      forms: ['Formulario afiliación empresa', 'Formulario afiliación trabajador', 'Copia RNC, cédula'],
      deadlines: 'Empresa: antes de operar | Trabajador: 3 días hábiles post-inicio',
      sanctions: 'Multas 1-50 salarios mínimos; responsabilidad solidaria por prestaciones; cierre temporal',
      appliesTo: 'Todos los empleadores con uno o más trabajadores',
    },
    {
      id: 'ars-salud',
      title: 'Seguro Familiar de Salud (ARS)',
      description: 'Cobertura de salud: consultas, emergencias, hospitalización, medicamentos, maternidad, prevención. Aporte: 7.09% patrón + 3.04% trabajador = 10.13%.',
      entity: 'ARS (Administradora de Riesgos de Salud) / SISALRIL',
      forms: ['Afiliación ARS', 'Carné de afiliado', 'Autorizaciones médicas'],
      deadlines: 'Mensual (días 1-10 del mes siguiente vía TSS)',
      sanctions: 'Multas; suspensión servicios; recargos; ejecución fiscal TSS',
      appliesTo: 'Todos los trabajadores dependientes y sus dependientes',
    },
    {
      id: 'afp-pensiones',
      title: 'Fondo de Pensiones (AFP)',
      description: 'Capitalización individual: vejez, discapacidad, sobrevivencia. Aporte: 7.1% patrón + 2.87% trabajador = 9.97%. Comisiones AFP ~1.14%.',
      entity: 'AFP (Administradora de Fondos de Pensiones) / SISALRIL',
      forms: ['Afiliación AFP', 'Cuenta individual', 'Estados de cuenta cuatrimestrales'],
      deadlines: 'Mensual (días 1-10 del mes siguiente vía TSS)',
      sanctions: 'Multas; intereses moratorios; afecta pensión futura; ejecución fiscal',
      appliesTo: 'Todos los trabajadores dependientes',
    },
    {
      id: 'srl-riesgos',
      title: 'Seguro de Riesgos Laborales (SRL)',
      description: 'Cubre accidentes de trabajo y enfermedades profesionales: atención médica, subsidios, indemnizaciones, pensiones. Prima según riesgo de actividad (0.6%-6.04%).',
      entity: 'SRL (Seguro de Riesgos Laborales) / TSS / SISALRIL',
      forms: ['Póliza SRL', 'Denuncia accidente trabajo', 'Calificación incapacidad'],
      deadlines: 'Denuncia: 24h | Calificación: 30 días | Pago prima: mensual vía TSS',
      sanctions: 'Multas 10-100 salarios mínimos; responsabilidad patronal directa; ejecución fiscal; penal si dolo',
      appliesTo: 'Todos los empleadores (obligatorio contratar SRL)',
    },
  ],
  relatedLaws: ['do-ley87-01', 'do-codigo-trabajo'],
  contactInfo: {
    portal: 'www.tss.gob.do / www.sisalril.gob.do',
    phone: 'TSS: 809-221-4848 | SISALRIL: 809-689-3434',
  },
};

// ==================== Resolution Functions ====================

export function getStatuteContent(jurisdiction: Jurisdiction): StatuteContent {
  switch (jurisdiction) {
    case 'MX': return MX_STATUTE;
    case 'CU': return CU_STATUTE;
    case 'DO': return DO_STATUTE;
  }
}

export function getObligationContent(jurisdiction: Jurisdiction): ObligationContent {
  switch (jurisdiction) {
    case 'MX': return MX_OBLIGATION;
    case 'CU': return CU_OBLIGATION;
    case 'DO': return DO_OBLIGATION;
  }
}

export function getSeguridadSocialContent(jurisdiction: Jurisdiction): SeguridadSocialContent {
  switch (jurisdiction) {
    case 'MX': return MX_SEGURIDAD_SOCIAL;
    case 'CU': return CU_SEGURIDAD_SOCIAL;
    case 'DO': return DO_SEGURIDAD_SOCIAL;
  }
}

export type GraphFlowContentType = 'statute' | 'obligation' | 'seguridad-social';

export function getGraphFlowContent(
  type: GraphFlowContentType,
  jurisdiction: Jurisdiction
): StatuteContent | ObligationContent | SeguridadSocialContent {
  switch (type) {
    case 'statute': return getStatuteContent(jurisdiction);
    case 'obligation': return getObligationContent(jurisdiction);
    case 'seguridad-social': return getSeguridadSocialContent(jurisdiction);
  }
}

// ==================== Label Mapping ====================

export const GRAPH_FLOW_LABELS = {
  statute: 'Estatuto Principal',
  obligation: 'Obligación Patronal',
  'seguridad-social': 'Seguridad Social',
} as const;

export type GraphFlowLabel = keyof typeof GRAPH_FLOW_LABELS;

export function getContentTypeFromLabel(label: string): GraphFlowContentType | null {
  const normalized = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (normalized.includes('estatuto') || normalized.includes('principal')) return 'statute';
  if (normalized.includes('obligacion') || normalized.includes('patronal')) return 'obligation';
  if (normalized.includes('seguridad') || normalized.includes('social')) return 'seguridad-social';
  return null;
}