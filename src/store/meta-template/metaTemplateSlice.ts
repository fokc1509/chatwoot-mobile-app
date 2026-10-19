import { createSlice, type AnyAction } from '@reduxjs/toolkit';
import { REHYDRATE } from 'redux-persist';

import { metaTemplateActions } from './metaTemplateActions';
import type { MetaTemplateInboxState, MetaTemplateState } from './metaTemplateTypes';

export const initialState: MetaTemplateState = {
  byInbox: {},
  empreendimentos: [],
};

// Permission denials (custom role without `meta_template_view`), plus 404: the inbox has
// Meta enabled but no meta_credential (MetaTemplatesController heads :not_found), so
// there is nothing to list or send — hide the button instead of a dead-end picker.
const DENIED_STATUSES = [401, 403, 404];

const entryFor = (state: MetaTemplateState, inboxId: number): MetaTemplateInboxState => {
  if (!state.byInbox[inboxId]) {
    state.byInbox[inboxId] = { templates: [], access: null, isLoading: false };
  }
  return state.byInbox[inboxId];
};

const metaTemplateSlice = createSlice({
  name: 'metaTemplates',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      // The whole store is persisted: drop in-flight flags that may have been
      // saved mid-request. Built from the inbound payload, since redux-persist
      // keeps the reducer's value when it changes a key.
      .addCase(REHYDRATE, (state, action: AnyAction) => {
        const persisted = (
          action.payload as { metaTemplates?: Partial<MetaTemplateState> } | undefined
        )?.metaTemplates;
        const merged: MetaTemplateState = { ...initialState, ...state, ...persisted };
        const byInbox: MetaTemplateState['byInbox'] = {};
        Object.entries(merged.byInbox || {}).forEach(([inboxId, entry]) => {
          byInbox[Number(inboxId)] = { ...entry, isLoading: false };
        });
        return { ...merged, byInbox };
      })
      .addCase(metaTemplateActions.fetchTemplates.pending, (state, action) => {
        entryFor(state, action.meta.arg).isLoading = true;
      })
      .addCase(metaTemplateActions.fetchTemplates.fulfilled, (state, action) => {
        const entry = entryFor(state, action.payload.inboxId);
        entry.templates = action.payload.templates;
        entry.access = true;
        entry.isLoading = false;
      })
      .addCase(metaTemplateActions.fetchTemplates.rejected, (state, action) => {
        const entry = entryFor(state, action.payload?.inboxId ?? action.meta.arg);
        entry.isLoading = false;
        // Network errors, timeouts and 5xx keep the last known access and list.
        if (DENIED_STATUSES.includes(action.payload?.status ?? 0)) {
          entry.access = false;
          entry.templates = [];
        }
      })
      .addCase(metaTemplateActions.syncTemplates.pending, (state, action) => {
        entryFor(state, action.meta.arg).isLoading = true;
      })
      // The refetch dispatched by sync settles before sync itself does.
      .addCase(metaTemplateActions.syncTemplates.fulfilled, (state, action) => {
        entryFor(state, action.meta.arg).isLoading = false;
      })
      .addCase(metaTemplateActions.syncTemplates.rejected, (state, action) => {
        entryFor(state, action.meta.arg).isLoading = false;
      })
      .addCase(metaTemplateActions.fetchEmpreendimentos.fulfilled, (state, action) => {
        state.empreendimentos = action.payload;
      })
      .addCase(metaTemplateActions.fetchEmpreendimentos.rejected, state => {
        state.empreendimentos = [];
      });
  },
});

export default metaTemplateSlice.reducer;
