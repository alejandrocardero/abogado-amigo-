import { describe, it, expect } from 'vitest';
import {
  getStatuteContent,
  getObligationContent,
  getSeguridadSocialContent,
  getGraphFlowContent,
  getContentTypeFromLabel,
  GRAPH_FLOW_LABELS,
} from '../data/graphFlowContent';
import {
  resolveStatuteData,
  resolveObligationData,
  resolveSeguridadSocialData,
  resolveGraphFlowData,
  resolveGraphFlowDataFromLabel,
  getLabelForType,
  isMainGraphFlowLabel,
} from './graphFlowContent';
import { Jurisdiction } from '../types';

describe('graphFlowContent - Data Module', () => {
  const jurisdictions: Jurisdiction[] = ['MX', 'CU', 'DO'];

  describe('getStatuteContent', () => {
    it('returns statute content for all jurisdictions', () => {
      jurisdictions.forEach((jur) => {
        const content = getStatuteContent(jur);
        expect(content).toBeDefined();
        expect(content.lawId).toBeTruthy();
        expect(content.title).toBeTruthy();
        expect(content.code).toBeTruthy();
        expect(content.source).toBeTruthy();
        expect(content.badge).toBeTruthy();
        expect(content.description).toBeTruthy();
        expect(content.articles).toBeInstanceOf(Array);
        expect(content.articles.length).toBeGreaterThan(0);
        expect(content.keyArticles).toBeInstanceOf(Array);
      });
    });

    it('returns correct lawId for each jurisdiction', () => {
      expect(getStatuteContent('MX').lawId).toBe('mx-lft');
      expect(getStatuteContent('CU').lawId).toBe('cu-ley116');
      expect(getStatuteContent('DO').lawId).toBe('do-codigo-trabajo');
    });

    it('has required fields on each article', () => {
      jurisdictions.forEach((jur) => {
        const content = getStatuteContent(jur);
        content.articles.forEach((article) => {
          expect(article.number).toBeTruthy();
          expect(article.title).toBeTruthy();
          expect(article.summary).toBeTruthy();
        });
      });
    });
  });

  describe('getObligationContent', () => {
    it('returns obligation content for all jurisdictions', () => {
      jurisdictions.forEach((jur) => {
        const content = getObligationContent(jur);
        expect(content).toBeDefined();
        expect(content.obligationTitle).toBeTruthy();
        expect(content.description).toBeTruthy();
        expect(content.legalFoundation).toBeTruthy();
        expect(content.steps).toBeInstanceOf(Array);
        expect(content.steps.length).toBeGreaterThan(0);
        expect(content.relatedLaws).toBeInstanceOf(Array);
      });
    });

    it('has required fields on each step', () => {
      jurisdictions.forEach((jur) => {
        const content = getObligationContent(jur);
        content.steps.forEach((step) => {
          expect(step.id).toBeGreaterThan(0);
          expect(step.title).toBeTruthy();
          expect(step.description).toBeTruthy();
          expect(step.legalBasis).toBeTruthy();
          expect(['Alta', 'Media', 'Informativa']).toContain(step.priority);
        });
      });
    });
  });

  describe('getSeguridadSocialContent', () => {
    it('returns seguridad social content for all jurisdictions', () => {
      jurisdictions.forEach((jur) => {
        const content = getSeguridadSocialContent(jur);
        expect(content).toBeDefined();
        expect(content.entityName).toBeTruthy();
        expect(content.description).toBeTruthy();
        expect(content.jurisdiction).toBe(jur);
        expect(content.requirements).toBeInstanceOf(Array);
        expect(content.requirements.length).toBeGreaterThan(0);
        expect(content.relatedLaws).toBeInstanceOf(Array);
      });
    });

    it('has required fields on each requirement', () => {
      jurisdictions.forEach((jur) => {
        const content = getSeguridadSocialContent(jur);
        content.requirements.forEach((req) => {
          expect(req.id).toBeTruthy();
          expect(req.title).toBeTruthy();
          expect(req.description).toBeTruthy();
          expect(req.entity).toBeTruthy();
          expect(req.forms).toBeInstanceOf(Array);
          expect(req.deadlines).toBeTruthy();
          expect(req.sanctions).toBeTruthy();
          expect(req.appliesTo).toBeTruthy();
        });
      });
    });
  });

  describe('getGraphFlowContent', () => {
    it('returns correct type for statute', () => {
      const content = getGraphFlowContent('statute', 'MX');
      expect('articles' in content).toBe(true);
    });

    it('returns correct type for obligation', () => {
      const content = getGraphFlowContent('obligation', 'MX');
      expect('steps' in content).toBe(true);
    });

    it('returns correct type for seguridad-social', () => {
      const content = getGraphFlowContent('seguridad-social', 'MX');
      expect('requirements' in content).toBe(true);
    });
  });

  describe('getContentTypeFromLabel', () => {
    it('maps Estatuto Principal variations to statute', () => {
      expect(getContentTypeFromLabel('Estatuto Principal')).toBe('statute');
      expect(getContentTypeFromLabel('estatuto principal')).toBe('statute');
      expect(getContentTypeFromLabel('ESTATUTO PRINCIPAL')).toBe('statute');
      expect(getContentTypeFromLabel('Estatuto')).toBe('statute');
      expect(getContentTypeFromLabel('Principal')).toBe('statute');
    });

    it('maps Obligación Patronal variations to obligation', () => {
      expect(getContentTypeFromLabel('Obligación Patronal')).toBe('obligation');
      expect(getContentTypeFromLabel('obligacion patronal')).toBe('obligation');
      expect(getContentTypeFromLabel('OBLIGACIÓN PATRONAL')).toBe('obligation');
      expect(getContentTypeFromLabel('Obligación')).toBe('obligation');
      expect(getContentTypeFromLabel('Patronal')).toBe('obligation');
    });

    it('maps Seguridad Social variations to seguridad-social', () => {
      expect(getContentTypeFromLabel('Seguridad Social')).toBe('seguridad-social');
      expect(getContentTypeFromLabel('seguridad social')).toBe('seguridad-social');
      expect(getContentTypeFromLabel('SEGURIDAD SOCIAL')).toBe('seguridad-social');
      expect(getContentTypeFromLabel('Seguridad')).toBe('seguridad-social');
      expect(getContentTypeFromLabel('Social')).toBe('seguridad-social');
    });

    it('returns null for unknown labels', () => {
      expect(getContentTypeFromLabel('Unknown Label')).toBeNull();
      expect(getContentTypeFromLabel('')).toBeNull();
      expect(getContentTypeFromLabel('Other')).toBeNull();
    });
  });

  describe('getLabelForType', () => {
    it('returns correct display labels', () => {
      expect(getLabelForType('statute')).toBe('Estatuto Principal');
      expect(getLabelForType('obligation')).toBe('Obligación Patronal');
      expect(getLabelForType('seguridad-social')).toBe('Seguridad Social');
    });
  });

  describe('isMainGraphFlowLabel', () => {
    it('returns true for main three labels', () => {
      expect(isMainGraphFlowLabel('Estatuto Principal')).toBe(true);
      expect(isMainGraphFlowLabel('Obligación Patronal')).toBe(true);
      expect(isMainGraphFlowLabel('Seguridad Social')).toBe(true);
    });

    it('returns false for other labels', () => {
      expect(isMainGraphFlowLabel('Other')).toBe(false);
      expect(isMainGraphFlowLabel('')).toBe(false);
    });
  });

  describe('GRAPH_FLOW_LABELS constant', () => {
    it('has all three required labels', () => {
      expect(GRAPH_FLOW_LABELS.statute).toBe('Estatuto Principal');
      expect(GRAPH_FLOW_LABELS.obligation).toBe('Obligación Patronal');
      expect(GRAPH_FLOW_LABELS['seguridad-social']).toBe('Seguridad Social');
    });
  });
});

describe('graphFlowContent - Lib Module (Resolvers)', () => {
  const jurisdictions: Jurisdiction[] = ['MX', 'CU', 'DO'];

  describe('resolveStatuteData', () => {
    it('returns resolved statute data with catalogItem', () => {
      jurisdictions.forEach((jur) => {
        const data = resolveStatuteData(jur);
        expect(data).toBeDefined();
        expect(data.catalogItem).toBeDefined();
        expect(data.catalogItem).not.toBeNull();
        expect(data.catalogItem!.id).toBe(getStatuteContent(jur).lawId);
        expect(data.articles).toBeInstanceOf(Array);
      });
    });
  });

  describe('resolveObligationData', () => {
    it('returns resolved obligation data with catalogItems', () => {
      jurisdictions.forEach((jur) => {
        const data = resolveObligationData(jur);
        expect(data).toBeDefined();
        expect(data.catalogItems).toBeInstanceOf(Array);
        expect(data.catalogItems.length).toBeGreaterThan(0);
        expect(data.steps).toBeInstanceOf(Array);
      });
    });

    it('catalogItems match relatedLaws', () => {
      jurisdictions.forEach((jur) => {
        const data = resolveObligationData(jur);
        const content = getObligationContent(jur);
        expect(data.catalogItems.length).toBe(content.relatedLaws.length);
        data.catalogItems.forEach((law, i) => {
          expect(law.id).toBe(content.relatedLaws[i]);
        });
      });
    });
  });

  describe('resolveSeguridadSocialData', () => {
    it('returns resolved seguridad social data with catalogItems', () => {
      jurisdictions.forEach((jur) => {
        const data = resolveSeguridadSocialData(jur);
        expect(data).toBeDefined();
        expect(data.catalogItems).toBeInstanceOf(Array);
        expect(data.catalogItems.length).toBeGreaterThan(0);
        expect(data.requirements).toBeInstanceOf(Array);
      });
    });

    it('catalogItems match relatedLaws', () => {
      jurisdictions.forEach((jur) => {
        const data = resolveSeguridadSocialData(jur);
        const content = getSeguridadSocialContent(jur);
        expect(data.catalogItems.length).toBe(content.relatedLaws.length);
        data.catalogItems.forEach((law, i) => {
          expect(law.id).toBe(content.relatedLaws[i]);
        });
      });
    });
  });

  describe('resolveGraphFlowData', () => {
    it('resolves correct type for each content type', () => {
      const statute = resolveGraphFlowData('statute', 'MX');
      expect('articles' in statute).toBe(true);

      const obligation = resolveGraphFlowData('obligation', 'MX');
      expect('steps' in obligation).toBe(true);

      const ss = resolveGraphFlowData('seguridad-social', 'MX');
      expect('requirements' in ss).toBe(true);
    });
  });

  describe('resolveGraphFlowDataFromLabel', () => {
    it('resolves from label for all three main types', () => {
      const statute = resolveGraphFlowDataFromLabel('Estatuto Principal', 'MX');
      expect(statute).not.toBeNull();
      expect('articles' in statute!).toBe(true);

      const obligation = resolveGraphFlowDataFromLabel('Obligación Patronal', 'MX');
      expect(obligation).not.toBeNull();
      expect('steps' in obligation!).toBe(true);

      const ss = resolveGraphFlowDataFromLabel('Seguridad Social', 'MX');
      expect(ss).not.toBeNull();
      expect('requirements' in ss!).toBe(true);
    });

    it('handles case-insensitive labels', () => {
      const data = resolveGraphFlowDataFromLabel('estatuto principal', 'MX');
      expect(data).not.toBeNull();

      const data2 = resolveGraphFlowDataFromLabel('OBLIGACIÓN PATRONAL', 'MX');
      expect(data2).not.toBeNull();

      const data3 = resolveGraphFlowDataFromLabel('seguridad social', 'MX');
      expect(data3).not.toBeNull();
    });

    it('returns null for unknown labels', () => {
      expect(resolveGraphFlowDataFromLabel('Unknown', 'MX')).toBeNull();
      expect(resolveGraphFlowDataFromLabel('', 'MX')).toBeNull();
    });
  });
});