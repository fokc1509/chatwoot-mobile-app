import { REHYDRATE } from 'redux-persist';

import reducer, { initialState } from '../metaTemplateSlice';
import { metaTemplateActions } from '../metaTemplateActions';
import type { MetaTemplateState } from '../metaTemplateTypes';
import { normalizeTemplateRow } from '../metaTemplateNormalize';
import { mockMetaTemplateRow } from './metaTemplateMockData';

const template = normalizeTemplateRow(mockMetaTemplateRow);

const pending = (inboxId: number) => ({
  type: metaTemplateActions.fetchTemplates.pending.type,
  meta: { arg: inboxId, requestId: 'r1', requestStatus: 'pending' },
});

const fulfilled = (inboxId: number) => ({
  type: metaTemplateActions.fetchTemplates.fulfilled.type,
  payload: { inboxId, templates: [template] },
  meta: { arg: inboxId, requestId: 'r1', requestStatus: 'fulfilled' },
});

const rejected = (inboxId: number, status: number | undefined) => ({
  type: metaTemplateActions.fetchTemplates.rejected.type,
  payload: { inboxId, status },
  meta: { arg: inboxId, requestId: 'r1', requestStatus: 'rejected', rejectedWithValue: true },
});

describe('metaTemplateSlice', () => {
  it('starts empty', () => {
    expect(reducer(undefined, { type: '@@INIT' })).toEqual({ byInbox: {}, empreendimentos: [] });
  });

  it('creates the inbox entry as loading with unknown access', () => {
    const state = reducer(initialState, pending(5));
    expect(state.byInbox[5]).toEqual({ templates: [], access: null, isLoading: true });
  });

  it('keeps inboxes independent', () => {
    let state = reducer(initialState, pending(5));
    state = reducer(state, fulfilled(5));
    state = reducer(state, rejected(6, 403));
    expect(state.byInbox[5]).toEqual({ templates: [template], access: true, isLoading: false });
    expect(state.byInbox[6]).toEqual({ templates: [], access: false, isLoading: false });
  });

  it('clears the list when access is denied', () => {
    let state = reducer(initialState, fulfilled(5));
    state = reducer(state, rejected(5, 403));
    expect(state.byInbox[5]).toEqual({ templates: [], access: false, isLoading: false });
  });

  it('keeps access and list on other failures', () => {
    let state = reducer(initialState, fulfilled(5));
    state = reducer(state, pending(5));
    state = reducer(state, rejected(5, 500));
    expect(state.byInbox[5]).toEqual({ templates: [template], access: true, isLoading: false });
  });

  it('resets in-flight flags on rehydrate', () => {
    const persisted: MetaTemplateState = {
      byInbox: { 5: { templates: [template], access: true, isLoading: true } },
      empreendimentos: ['Alameda'],
    };
    const state = reducer(initialState, {
      type: REHYDRATE,
      key: 'root',
      payload: { metaTemplates: persisted },
    });
    expect(state.byInbox[5]).toEqual({ templates: [template], access: true, isLoading: false });
    expect(state.empreendimentos).toEqual(['Alameda']);
  });

  it('handles a rehydrate without a persisted slice', () => {
    const state = reducer(initialState, { type: REHYDRATE, key: 'root', payload: undefined });
    expect(state).toEqual(initialState);
  });
});
