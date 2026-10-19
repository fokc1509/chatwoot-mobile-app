import { configureStore, type AnyAction, type Middleware } from '@reduxjs/toolkit';

import { metaTemplateActions } from '../metaTemplateActions';
import metaTemplateReducer, {
  initialState as metaTemplateInitialState,
} from '../metaTemplateSlice';
import { MetaTemplateService } from '../metaTemplateService';
import { shouldShowTemplateButton } from '../metaTemplateSelectors';
import type { MetaInboxConfig } from '../metaTemplateTypes';
import { mockMetaTemplateRow } from './metaTemplateMockData';

jest.mock('@/i18n', () => ({
  t: (key: string) => key,
}));

jest.mock('../metaTemplateService', () => {
  const actual = jest.requireActual('../metaTemplateService');
  return {
    ...actual,
    MetaTemplateService: {
      list: jest.fn(),
      sync: jest.fn(),
      empreendimentos: jest.fn(),
    },
  };
});

const mockedService = MetaTemplateService as jest.Mocked<typeof MetaTemplateService>;

const httpError = (status: number, data?: unknown) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });

const INBOX_ID = 5;

const setupStore = (metaInboxConfig?: MetaInboxConfig) => {
  const dispatched: AnyAction[] = [];
  const recorder: Middleware = () => next => action => {
    dispatched.push(action as AnyAction);
    return next(action);
  };
  const inbox = { id: INBOX_ID, name: 'WABA', metaInboxConfig };
  const inboxesState = { ids: [INBOX_ID], entities: { [INBOX_ID]: inbox }, isLoading: false };
  const store = configureStore({
    reducer: {
      inboxes: (state: typeof inboxesState = inboxesState) => state,
      metaTemplates: metaTemplateReducer,
    },
    preloadedState: { inboxes: inboxesState, metaTemplates: metaTemplateInitialState },
    middleware: getDefault => getDefault({ serializableCheck: false }).concat(recorder),
  });
  return { store, dispatched, inbox };
};

const types = (actions: AnyAction[]) => actions.map(action => action.type);

const row = (id: number, name: string) => ({ ...mockMetaTemplateRow, id, name });

describe('metaTemplateActions', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('fetchTemplates', () => {
    it('marks the inbox as denied on 403, hides the button and never logs out', async () => {
      mockedService.list.mockRejectedValue(httpError(403));
      const { store, dispatched, inbox } = setupStore({ enabled: true });

      await store.dispatch(metaTemplateActions.fetchTemplates(INBOX_ID));

      const entry = store.getState().metaTemplates.byInbox[INBOX_ID];
      expect(entry.access).toBe(false);
      expect(entry.isLoading).toBe(false);
      expect(entry.templates).toEqual([]);
      expect(shouldShowTemplateButton(inbox, entry.access, false)).toBe(false);
      expect(types(dispatched)).not.toContain('auth/logout');
    });

    it('marks the inbox as denied on 401 too', async () => {
      mockedService.list.mockRejectedValue(httpError(401));
      const { store } = setupStore({ enabled: true });

      await store.dispatch(metaTemplateActions.fetchTemplates(INBOX_ID));

      expect(store.getState().metaTemplates.byInbox[INBOX_ID].access).toBe(false);
    });

    it('hides the button on 404 (Meta enabled but no credential)', async () => {
      mockedService.list.mockRejectedValue(httpError(404));
      const { store, inbox } = setupStore({ enabled: true });

      await store.dispatch(metaTemplateActions.fetchTemplates(INBOX_ID));

      const entry = store.getState().metaTemplates.byInbox[INBOX_ID];
      expect(entry.access).toBe(false);
      expect(shouldShowTemplateButton(inbox, entry.access, false)).toBe(false);
    });

    it('keeps the last known access on network errors and 5xx', async () => {
      const { store } = setupStore({ enabled: true });
      mockedService.list.mockRejectedValueOnce(new Error('Network Error'));
      await store.dispatch(metaTemplateActions.fetchTemplates(INBOX_ID));
      expect(store.getState().metaTemplates.byInbox[INBOX_ID].access).toBeNull();

      mockedService.list.mockResolvedValueOnce([]);
      await store.dispatch(metaTemplateActions.fetchTemplates(INBOX_ID));
      mockedService.list.mockRejectedValueOnce(httpError(500));
      await store.dispatch(metaTemplateActions.fetchTemplates(INBOX_ID));
      expect(store.getState().metaTemplates.byInbox[INBOX_ID].access).toBe(true);
    });

    it('stores the normalized list filtered by the inbox visibility on 200', async () => {
      mockedService.list.mockResolvedValue([
        row(1, 'lancamento_venda_imagem_convite'),
        row(2, 'lancamento_aluguel_texto_aviso'),
        row(3, 'estoque_venda_texto_oferta'),
      ]);
      const { store, inbox } = setupStore({ enabled: true, visibleDefinitions: ['lancamento'] });

      await store.dispatch(metaTemplateActions.fetchTemplates(INBOX_ID));

      const entry = store.getState().metaTemplates.byInbox[INBOX_ID];
      expect(entry.access).toBe(true);
      expect(entry.isLoading).toBe(false);
      expect(entry.templates.map(t => t.id)).toEqual([1, 2]);
      // normalized like the web normalizeRow
      expect(entry.templates[0].body_text).toBe(
        'Olá {{name}}, conheça o {{empreendimento}}: {{msg_body}}',
      );
      expect(shouldShowTemplateButton(inbox, entry.access, false)).toBe(true);
    });

    it('shows everything when the inbox has no visibility lists', async () => {
      mockedService.list.mockResolvedValue([row(1, 'a_b_c_d'), row(2, 'e_f_g_h')]);
      const { store } = setupStore({ enabled: true });

      await store.dispatch(metaTemplateActions.fetchTemplates(INBOX_ID));

      expect(store.getState().metaTemplates.byInbox[INBOX_ID].templates).toHaveLength(2);
    });
  });

  describe('syncTemplates', () => {
    it('syncs and then refetches the list', async () => {
      mockedService.sync.mockResolvedValue();
      mockedService.list.mockResolvedValue([row(1, 'a_b_c_d')]);
      const { store } = setupStore({ enabled: true });

      const result = await store.dispatch(metaTemplateActions.syncTemplates(INBOX_ID));

      expect(result.meta.requestStatus).toBe('fulfilled');
      expect(mockedService.sync).toHaveBeenCalledWith(INBOX_ID);
      expect(mockedService.list).toHaveBeenCalledWith(INBOX_ID);
      const entry = store.getState().metaTemplates.byInbox[INBOX_ID];
      expect(entry.templates).toHaveLength(1);
      expect(entry.isLoading).toBe(false);
    });

    it('rejects with the server error and still refetches', async () => {
      mockedService.sync.mockRejectedValue(httpError(422, { error: 'Falha na Meta' }));
      mockedService.list.mockResolvedValue([]);
      const { store, dispatched } = setupStore({ enabled: true });

      const result = await store.dispatch(metaTemplateActions.syncTemplates(INBOX_ID));

      expect(result.meta.requestStatus).toBe('rejected');
      expect(result.payload).toBe('Falha na Meta');
      expect(mockedService.list).toHaveBeenCalledWith(INBOX_ID);
      expect(store.getState().metaTemplates.byInbox[INBOX_ID].isLoading).toBe(false);
      expect(types(dispatched)).not.toContain('auth/logout');
    });
  });

  describe('fetchEmpreendimentos', () => {
    it('stores the names', async () => {
      mockedService.empreendimentos.mockResolvedValue(['Alameda', 'Bosque']);
      const { store } = setupStore();

      await store.dispatch(metaTemplateActions.fetchEmpreendimentos());

      expect(store.getState().metaTemplates.empreendimentos).toEqual(['Alameda', 'Bosque']);
    });

    it('falls back to [] on error', async () => {
      mockedService.empreendimentos.mockRejectedValue(httpError(404));
      const { store, dispatched } = setupStore();

      await store.dispatch(metaTemplateActions.fetchEmpreendimentos());

      expect(store.getState().metaTemplates.empreendimentos).toEqual([]);
      expect(types(dispatched)).not.toContain('auth/logout');
    });
  });
});
