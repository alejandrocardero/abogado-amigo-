import { ChatMessage, GazetteFeedItem, Jurisdiction, LegalOpinion, LawCatalogItem } from '../types';
import { LAW_CATALOG } from '../lib/appConfig';

/**
 * Seed data for the assistant.
 *
 * Everything here starts empty: conversations, opinions, the gazette feed and
 * the law catalog are created by the user at runtime and persisted in the
 * browser through src/lib/db.ts.
 */

export const initialMessages: ChatMessage[] = [];

export const gazetteFeedItems: GazetteFeedItem[] = [];

/**
 * Keyword-routed canned opinions used by the assistant. Empty by default; the
 * assistant falls back to a generic jurisdiction-aware opinion when no entry
 * matches.
 */
export const sampleKnowledgeBase: Record<string, LegalOpinion> = {};

/**
 * The law catalog lives in src/lib/appConfig.ts as LAW_CATALOG (single
 * source of truth). Re-exported under the historical `lawCatalog` name so
 * existing consumers keep working unchanged.
 */
export const lawCatalog: LawCatalogItem[] = LAW_CATALOG;

export { LAW_CATALOG };
