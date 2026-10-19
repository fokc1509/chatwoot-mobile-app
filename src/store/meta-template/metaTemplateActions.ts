import { createAsyncThunk } from '@reduxjs/toolkit';

import { getHttpStatus } from '@/utils/httpUtils';
import { filterVisibleTemplates, normalizeTemplateRow } from './metaTemplateNormalize';
import { getTemplateErrorMessage, MetaTemplateService } from './metaTemplateService';
import type { MetaInboxConfig, MetaTemplate } from './metaTemplateTypes';

// Minimal view of the root state. Using RootState here would make the store
// type depend on itself (the slice imports these thunks).
interface MetaTemplateThunkState {
  inboxes: { entities: Record<number, { metaInboxConfig?: MetaInboxConfig } | undefined> };
}

export interface MetaTemplateListPayload {
  inboxId: number;
  templates: MetaTemplate[];
}

export interface MetaTemplateListError {
  inboxId: number;
  status: number | undefined;
}

const inboxConfig = (getState: () => unknown, inboxId: number) =>
  (getState() as MetaTemplateThunkState).inboxes.entities[inboxId]?.metaInboxConfig;

const fetchTemplates = createAsyncThunk<
  MetaTemplateListPayload,
  number,
  { rejectValue: MetaTemplateListError }
>('metaTemplates/fetchTemplates', async (inboxId, { getState, rejectWithValue }) => {
  try {
    const rows = await MetaTemplateService.list(inboxId);
    const templates = filterVisibleTemplates(
      rows.map(normalizeTemplateRow),
      inboxConfig(getState, inboxId),
    );
    return { inboxId, templates };
  } catch (error) {
    return rejectWithValue({ inboxId, status: getHttpStatus(error) });
  }
});

export const metaTemplateActions = {
  /** 2xx → access=true + visible list; 401/403 → access=false (button hidden). */
  fetchTemplates,

  /** Pulls templates from Meta, then refetches the list (also after a failure). */
  syncTemplates: createAsyncThunk<void, number, { rejectValue: string }>(
    'metaTemplates/syncTemplates',
    async (inboxId, { dispatch, rejectWithValue }) => {
      try {
        await MetaTemplateService.sync(inboxId);
      } catch (error) {
        return rejectWithValue(getTemplateErrorMessage(error));
      } finally {
        await dispatch(fetchTemplates(inboxId));
      }
    },
  ),

  /** Never fails: a missing endpoint or any error means "free text only". */
  fetchEmpreendimentos: createAsyncThunk<string[]>(
    'metaTemplates/fetchEmpreendimentos',
    async () => {
      try {
        return await MetaTemplateService.empreendimentos();
      } catch {
        return [];
      }
    },
  ),
};
