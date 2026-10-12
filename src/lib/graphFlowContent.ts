import { Jurisdiction, LawCatalogItem } from '../types';
import { LAW_CATALOG } from './appConfig';
import {
  StatuteContent,
  ObligationContent,
  SeguridadSocialContent,
  GraphFlowContentType,
  GRAPH_FLOW_LABELS,
  GraphFlowLabel,
  getStatuteContent,
  getObligationContent,
  getSeguridadSocialContent,
  getGraphFlowContent,
  getContentTypeFromLabel,
} from '../data/graphFlowContent';

/**
 * Library functions for resolving GraphRAG flow button content.
 * Bridges LAW_CATALOG metadata with curated detail content.
 */

export interface ResolvedStatuteData extends StatuteContent {
  catalogItem: LawCatalogItem | null;
}

export interface ResolvedObligationData extends ObligationContent {
  catalogItems: LawCatalogItem[];
}

export interface ResolvedSeguridadSocialData extends SeguridadSocialContent {
  catalogItems: LawCatalogItem[];
}

export type ResolvedGraphFlowData =
  | ResolvedStatuteData
  | ResolvedObligationData
  | ResolvedSeguridadSocialData;

/**
 * Finds the primary LawCatalogItem for a given content type and jurisdiction.
 */
function findPrimaryLaw(type: GraphFlowContentType, jurisdiction: Jurisdiction): LawCatalogItem | null {
  const content = getGraphFlowContent(type, jurisdiction);
  if ('lawId' in content) {
    return LAW_CATALOG.find((law) => law.id === content.lawId) ?? null;
  }
  return null;
}

/**
 * Finds related LawCatalogItems for obligation/seguridad-social types.
 */
function findRelatedLaws(type: GraphFlowContentType, jurisdiction: Jurisdiction): LawCatalogItem[] {
  const content = getGraphFlowContent(type, jurisdiction);
  if ('relatedLaws' in content) {
    return content.relatedLaws
      .map((id: string) => LAW_CATALOG.find((law) => law.id === id))
      .filter((law): law is LawCatalogItem => law !== undefined);
  }
  return [];
}

/**
 * Resolves full data for the "Estatuto Principal" button.
 */
export function resolveStatuteData(jurisdiction: Jurisdiction): ResolvedStatuteData {
  const content = getStatuteContent(jurisdiction);
  const catalogItem = findPrimaryLaw('statute', jurisdiction);
  return {
    ...content,
    catalogItem,
  };
}

/**
 * Resolves full data for the "Obligación Patronal" button.
 */
export function resolveObligationData(jurisdiction: Jurisdiction): ResolvedObligationData {
  const content = getObligationContent(jurisdiction);
  const catalogItems = findRelatedLaws('obligation', jurisdiction);
  return {
    ...content,
    catalogItems,
  };
}

/**
 * Resolves full data for the "Seguridad Social" button.
 */
export function resolveSeguridadSocialData(jurisdiction: Jurisdiction): ResolvedSeguridadSocialData {
  const content = getSeguridadSocialContent(jurisdiction);
  const catalogItems = findRelatedLaws('seguridad-social', jurisdiction);
  return {
    ...content,
    catalogItems,
  };
}

/**
 * Generic resolver by content type.
 */
export function resolveGraphFlowData(
  type: GraphFlowContentType,
  jurisdiction: Jurisdiction
): ResolvedGraphFlowData {
  switch (type) {
    case 'statute':
      return resolveStatuteData(jurisdiction);
    case 'obligation':
      return resolveObligationData(jurisdiction);
    case 'seguridad-social':
      return resolveSeguridadSocialData(jurisdiction);
  }
}

/**
 * Resolves data from a button label (as appears in graphConnections).
 */
export function resolveGraphFlowDataFromLabel(
  label: string,
  jurisdiction: Jurisdiction
): ResolvedGraphFlowData | null {
  const type = getContentTypeFromLabel(label);
  if (!type) return null;
  return resolveGraphFlowData(type, jurisdiction);
}

/**
 * Gets the display label for a content type.
 */
export function getLabelForType(type: GraphFlowContentType): string {
  return GRAPH_FLOW_LABELS[type];
}

/**
 * Checks if a label corresponds to one of our three main buttons.
 */
export function isMainGraphFlowLabel(label: string): boolean {
  return getContentTypeFromLabel(label) !== null;
}