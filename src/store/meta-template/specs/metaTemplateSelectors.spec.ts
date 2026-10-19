import type { RootState } from '@/store';
import type { Inbox } from '@/types/Inbox';
import {
  selectEmpreendimentos,
  selectTemplateAccess,
  selectTemplates,
  selectTemplatesLoading,
  shouldShowTemplateButton,
} from '../metaTemplateSelectors';
import { initialState } from '../metaTemplateSlice';
import { normalizeTemplateRow } from '../metaTemplateNormalize';
import type { MetaTemplateState } from '../metaTemplateTypes';
import { mockMetaTemplateRow } from './metaTemplateMockData';

const template = normalizeTemplateRow(mockMetaTemplateRow);

const buildState = (metaTemplates: Partial<MetaTemplateState>) =>
  ({ metaTemplates: { ...initialState, ...metaTemplates } }) as unknown as RootState;

const inbox = (metaInboxConfig?: Inbox['metaInboxConfig']) =>
  ({ id: 5, name: 'WABA', metaInboxConfig }) as Inbox;

describe('metaTemplateSelectors', () => {
  const state = buildState({
    byInbox: { 5: { templates: [template], access: true, isLoading: true } },
    empreendimentos: ['Alameda'],
  });

  it('selects access per inbox, null when unknown', () => {
    expect(selectTemplateAccess(5)(state)).toBe(true);
    expect(selectTemplateAccess(6)(state)).toBeNull();
    expect(selectTemplateAccess(undefined)(state)).toBeNull();
  });

  it('selects templates per inbox with a stable empty fallback', () => {
    expect(selectTemplates(5)(state)).toEqual([template]);
    expect(selectTemplates(6)(state)).toEqual([]);
    expect(selectTemplates(6)(state)).toBe(selectTemplates(7)(state));
  });

  it('selects loading per inbox', () => {
    expect(selectTemplatesLoading(5)(state)).toBe(true);
    expect(selectTemplatesLoading(6)(state)).toBe(false);
  });

  it('selects empreendimentos', () => {
    expect(selectEmpreendimentos(state)).toEqual(['Alameda']);
  });
});

describe('shouldShowTemplateButton', () => {
  it('shows when the inbox has the feature on and access is not denied', () => {
    expect(shouldShowTemplateButton(inbox({ enabled: true }), null, false)).toBe(true);
    expect(shouldShowTemplateButton(inbox({ enabled: true }), true, false)).toBe(true);
  });

  it('hides on private notes', () => {
    expect(shouldShowTemplateButton(inbox({ enabled: true }), true, true)).toBe(false);
  });

  it('hides after a 401/403 (access=false)', () => {
    expect(shouldShowTemplateButton(inbox({ enabled: true }), false, false)).toBe(false);
  });

  it('hides when the inbox does not have the feature', () => {
    expect(shouldShowTemplateButton(inbox(undefined), true, false)).toBe(false);
    expect(shouldShowTemplateButton(inbox({ enabled: false }), true, false)).toBe(false);
    expect(shouldShowTemplateButton(undefined, true, false)).toBe(false);
  });
});
