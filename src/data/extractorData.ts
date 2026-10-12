import { GazetteSourceDoc, IndexedDocument, LangGraphNodeStatus } from '../types';

/**
 * Seed data for the PDF extractor agent and the RAG LangGraph indexer.
 *
 * Both collections start empty: documents are added by the user at runtime and
 * persisted in the browser through src/lib/db.ts. `defaultLangGraphNodes`
 * describes the pipeline structure (not user data) and is always present.
 */

export const sampleGazettes: GazetteSourceDoc[] = [];

export const sampleIndexedDocs: IndexedDocument[] = [];

export const defaultLangGraphNodes: LangGraphNodeStatus[] = [
  {
    id: 'loader',
    name: 'Document Loader',
    description: 'Detección de formato y normalización del documento fuente',
    icon: 'upload_file',
    status: 'idle',
  },
  {
    id: 'splitter',
    name: 'Text Splitter',
    description: 'Segmentación en chunks por artículos y secciones',
    icon: 'content_cut',
    status: 'idle',
  },
  {
    id: 'embeddings',
    name: 'Embeddings',
    description: 'Vectorización semántica de cada chunk',
    icon: 'bolt',
    status: 'idle',
  },
  {
    id: 'qdrant',
    name: 'Qdrant Upsert',
    description: 'Inserción en la colección vectorial HNSW',
    icon: 'database',
    status: 'idle',
  },
  {
    id: 'neo4j',
    name: 'Neo4j Graph',
    description: 'Extracción de entidades y relaciones normativas',
    icon: 'account_tree',
    status: 'idle',
  },
];
