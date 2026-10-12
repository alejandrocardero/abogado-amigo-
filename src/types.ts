export type Jurisdiction = 'CU' | 'DO' | 'MX';

export type NavTab = 'asistente' | 'gacetas' | 'extractor' | 'rag_indexer' | 'leyes';

export interface UserProfile {
  userName: string;
  businessName: string;
  country: Jurisdiction;
  countryName: string;
  currency: string;
  currencySymbol: string;
  email: string;
  acceptedTermsAt: string;
}

// ==================== Multi-account auth ====================

export interface AccountRecord {
  email: string;
  passwordHash: string;
  salt: string;
  userName: string;
  businessName: string;
  country: Jurisdiction;
  countryName: string;
  currency: string;
  currencySymbol: string;
  createdAt: string;
  acceptedTermsAt: string;
}

// ==================== Indexer runtime ====================

export interface DocumentVersion {
  docId: string;
  version: number;
  hash: string;
  uploadedAt: string;
  content: string;
  chunks: IndexedDocumentChunk[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'error';
  message: string;
}

export interface NotificationItem {
  id: string;
  timestamp: string;
  title: string;
  message: string;
  read: boolean;
}

export type ReviewState = Record<string, 'pending' | 'validated' | 'discarded'>;

export interface LawCatalogItem {
  id: string;
  country: Jurisdiction;
  title: string;
  source: string;
  code: string;
  articlesCount: number;
  lastUpdated: string;
  badge: 'Vigente' | 'Reformada' | 'En Revisión' | 'Derogada';
  description: string;
}

export interface LegalCitation {
  lawName: string;
  article: string;
  sourceRef: string;
  quote: string;
}

export interface GraphRAGConnection {
  label: string;
  icon?: string;
  type?: 'primary' | 'secondary' | 'neutral';
}

export interface OperationalTakeaway {
  id: number;
  title: string;
  description: string;
  boldHighlight?: string;
}

export interface LegalOpinion {
  id: string;
  jurisdiction: Jurisdiction;
  topic: string;
  badgeTitle: string;
  summary: string;
  citations: LegalCitation[];
  graphConnections: GraphRAGConnection[];
  takeaways: OperationalTakeaway[];
  disclaimer: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  authorLabel?: string;
  text?: string;
  opinion?: LegalOpinion;
  attachment?: { name: string; snippet: string };
}

export interface GazetteFeedItem {
  id: string;
  jurisdiction: Jurisdiction;
  typeLabel: string;
  ragScore: string;
  title: string;
  quote?: string;
  summary?: string;
  category: 'reforma' | 'nueva' | 'derogacion' | 'revision';
  impact?: {
    level: 'Alto' | 'Medio' | 'Informativo';
    details: string;
    articlesModified?: string;
  };
  tags: string[];
  derogationDetails?: {
    replacesWith: string;
    isCurrent: boolean;
  };
  conflictDetails?: {
    article: string;
    conflictText: string;
  };
}

// ==================== Requirements 3 & 4: PDF Gazette Extractor ====================

export interface ExtractedLawMetadata {
  title: string;
  officialNumber: string;
  jurisdiction: Jurisdiction;
  publishedDate: string;
  gazetteSource: string;
  volumeOrNumber: string;
  issuer: string;
  articlesCount: number;
  thematicArea: string;
  extractedAt: string;
  sha256Hash: string;
  isCurrent: boolean;
  articlesSummary: { number: string; heading: string }[];
}

export interface ExtractedLawArtifact {
  id: string;
  lawSlug: string;
  directoryPath: string;
  title: string;
  officialNumber: string;
  topic: string;
  isPresent: boolean;
  detectionReasoning: string;
  markdownContent: string;
  metadataJson: ExtractedLawMetadata;
}

export interface GazetteSourceDoc {
  id: string;
  title: string;
  jurisdiction: Jurisdiction;
  filename: string;
  date: string;
  edition: string;
  totalPages: number;
  detectedLaws: ExtractedLawArtifact[];
}

export interface AgentToolCallStep {
  step: number;
  toolName: string;
  input: Record<string, any>;
  output: Record<string, any>;
  status: 'running' | 'success' | 'failed';
  timestamp: string;
}

// ==================== RAG LangGraph Universal Indexer ====================

export type DocumentFormat = 'pdf' | 'docx' | 'txt' | 'md' | 'json' | 'xml' | 'html' | 'csv' | 'ocr';

export interface IndexedDocumentChunk {
  id: string;
  index: number;
  articleRef?: string;
  content: string;
  tokens: number;
}

export interface IndexedDocument {
  id: string;
  name: string;
  format: DocumentFormat;
  sizeBytes: number;
  uploadedAt: string;
  status: 'idle' | 'processing' | 'indexed' | 'failed';
  content: string;
  chunks: IndexedDocumentChunk[];
  chunksCount: number;
  tokensCount: number;
}

export interface LangGraphNodeStatus {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  latencyMs?: number;
  outputSummary?: string;
}

// ==================== Ollama & Config ====================

export interface OllamaModel {
  name: string;
  model: string;
  size: number;
  digest: string;
  modified_at: string;
  details: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaModelStatus {
  model: string;
  available: boolean;
  testedAt: string;
  latencyMs?: number;
  error?: string;
}

export interface CountryConfig {
  name: string;
  flag: string;
  gazette: string;
  defaultCurrency: string;
  currencySymbol: string;
  currencies: { code: string; label: string; symbol: string }[];
}

export interface AppConfig {
  validEmailDomains: string[];
  countryConfig: Record<string, CountryConfig>;
  defaultModel: string;
  systemPrompt: string;
  suggestionPrompt: string;
}

export interface ModelSettings {
  selectedModel: string;
  ollamaBaseUrl: string;
  availableModels: OllamaModel[];
  modelStatuses: Record<string, OllamaModelStatus>;
}
