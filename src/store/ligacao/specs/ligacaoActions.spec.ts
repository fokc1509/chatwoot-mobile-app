import { configureStore, type AnyAction, type Middleware } from '@reduxjs/toolkit';

import { ligacaoActions } from '../ligacaoActions';
import ligacaoReducer, { initialState as ligacaoInitialState } from '../ligacaoSlice';
import { LigacaoService } from '../ligacaoService';
import type { LigacaoState } from '../ligacaoTypes';
import { mockLigacaoLead, mockLigacaoListResponse } from './ligacaoMockData';

jest.mock('@/i18n', () => ({
  t: (key: string) => key,
}));

jest.mock('../ligacaoService', () => {
  const actual = jest.requireActual('../ligacaoService');
  return {
    ...actual,
    LigacaoService: {
      list: jest.fn(),
      reservar: jest.fn(),
      liberar: jest.fn(),
      puxar: jest.fn(),
      resumo: jest.fn(),
    },
  };
});

const mockedService = LigacaoService as jest.Mocked<typeof LigacaoService>;

const httpError = (status: number, data?: unknown) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });

const setupStore = (ligacoes: Partial<LigacaoState> = {}, accountId = 1) => {
  const dispatched: AnyAction[] = [];
  const recorder: Middleware = () => next => action => {
    dispatched.push(action as AnyAction);
    return next(action);
  };
  const authState = { user: { account_id: accountId } };
  const store = configureStore({
    reducer: {
      auth: (state: typeof authState = authState) => state,
      ligacoes: ligacaoReducer,
    },
    preloadedState: { auth: authState, ligacoes: { ...ligacaoInitialState, ...ligacoes } },
    middleware: getDefault => getDefault({ serializableCheck: false }).concat(recorder),
  });
  return { store, dispatched };
};

const types = (actions: AnyAction[]) => actions.map(action => action.type);

describe('ligacaoActions', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('checkAccess', () => {
    it('marks the account as allowed and fills the list on 200', async () => {
      mockedService.list.mockResolvedValue(mockLigacaoListResponse);
      const { store } = setupStore();

      await store.dispatch(ligacaoActions.checkAccess());

      const state = store.getState().ligacoes;
      expect(state.accessByAccount[1]).toBe(true);
      expect(state.leads).toEqual(mockLigacaoListResponse.leads);
      expect(state.janela).toBe(30);
      expect(state.accountId).toBe(1);
    });

    it('marks the account as denied on 401 without logging out', async () => {
      mockedService.list.mockRejectedValue(httpError(401));
      const { store, dispatched } = setupStore({ accessByAccount: { 1: true } });

      await store.dispatch(ligacaoActions.checkAccess());

      expect(store.getState().ligacoes.accessByAccount[1]).toBe(false);
      expect(types(dispatched)).not.toContain('auth/logout');
    });

    it.each([403, 404])('marks the account as denied on %i', async status => {
      mockedService.list.mockRejectedValue(httpError(status));
      const { store } = setupStore({ accessByAccount: { 1: true } });

      await store.dispatch(ligacaoActions.checkAccess());

      expect(store.getState().ligacoes.accessByAccount[1]).toBe(false);
    });

    it('keeps the last known value on a network error (no response)', async () => {
      mockedService.list.mockRejectedValue(new Error('Network Error'));
      const { store } = setupStore({ accessByAccount: { 1: true } });

      await store.dispatch(ligacaoActions.checkAccess());

      expect(store.getState().ligacoes.accessByAccount[1]).toBe(true);
    });

    it('keeps the last known value on 5xx', async () => {
      mockedService.list.mockRejectedValue(httpError(503));
      const { store } = setupStore({ accessByAccount: { 1: true, 2: false } });

      await store.dispatch(ligacaoActions.checkAccess());

      expect(store.getState().ligacoes.accessByAccount).toEqual({ 1: true, 2: false });
    });

    it('keeps the selected window when re-checking the same account', async () => {
      mockedService.list.mockResolvedValue(mockLigacaoListResponse);
      const { store } = setupStore({ accountId: 1, janela: 90 });

      await store.dispatch(ligacaoActions.checkAccess());

      expect(mockedService.list).toHaveBeenCalledWith(90);
    });

    it('uses the server default window for another account', async () => {
      mockedService.list.mockResolvedValue(mockLigacaoListResponse);
      const { store } = setupStore({ accountId: 1, janela: 90 }, 2);

      await store.dispatch(ligacaoActions.checkAccess());

      expect(mockedService.list).toHaveBeenCalledWith(undefined);
    });

    it('only touches the current account', async () => {
      mockedService.list.mockRejectedValue(httpError(401));
      const { store } = setupStore({ accessByAccount: { 1: true, 2: true } }, 2);

      await store.dispatch(ligacaoActions.checkAccess());

      expect(store.getState().ligacoes.accessByAccount).toEqual({ 1: true, 2: false });
    });
  });

  describe('fetchLigacoes', () => {
    it('requests the given window and stores the response', async () => {
      mockedService.list.mockResolvedValue({
        ...mockLigacaoListResponse,
        meta: { ...mockLigacaoListResponse.meta, janela_dias: 60 },
      });
      const { store } = setupStore();

      await store.dispatch(ligacaoActions.fetchLigacoes(60));

      expect(mockedService.list).toHaveBeenCalledWith(60);
      const state = store.getState().ligacoes;
      expect(state.janela).toBe(60);
      expect(state.janelas).toEqual([30, 60, 90, 120]);
      expect(state.isLoading).toBe(false);
    });

    it('hides the queue when the list answers 403', async () => {
      mockedService.list.mockRejectedValue(httpError(403));
      const { store } = setupStore({ accessByAccount: { 1: true } });

      await store.dispatch(ligacaoActions.fetchLigacoes());

      expect(store.getState().ligacoes.accessByAccount[1]).toBe(false);
    });

    it('keeps the current list on a network error', async () => {
      mockedService.list.mockRejectedValue(new Error('Network Error'));
      const { store } = setupStore({ accountId: 1, leads: [mockLigacaoLead] });

      await store.dispatch(ligacaoActions.fetchLigacoes());

      expect(store.getState().ligacoes.leads).toEqual([mockLigacaoLead]);
      expect(store.getState().ligacoes.isLoading).toBe(false);
    });
  });

  describe('reservar', () => {
    it('stores my reservation and refetches the current window on success', async () => {
      mockedService.reservar.mockResolvedValue({
        telefone: '+5511999990000',
        until: '2026-10-18T15:30:00Z',
      });
      // Refetch never resolves, so we can observe the state written before it.
      mockedService.list.mockReturnValue(new Promise(() => undefined));
      const { store } = setupStore({ accountId: 1, janela: 90, leads: [mockLigacaoLead] });

      void store.dispatch(ligacaoActions.reservar(42));
      await new Promise(resolve => setImmediate(resolve));

      expect(store.getState().ligacoes.minhaReserva).toEqual({
        display_id: 42,
        lead: 'Maria Souza',
        until: '2026-10-18T15:30:00Z',
        telefone: '+5511999990000',
      });
      expect(mockedService.list).toHaveBeenCalledWith(90);
    });

    it('rejects with the server message on 422 and still refetches', async () => {
      mockedService.reservar.mockRejectedValue(
        httpError(422, { error: 'ligacoes.reservada', message: 'Lead já reservado por Ana' }),
      );
      mockedService.list.mockResolvedValue(mockLigacaoListResponse);
      const { store, dispatched } = setupStore({ accountId: 1, janela: 30 });

      const result = await store.dispatch(ligacaoActions.reservar(42));

      expect(result.type).toBe('ligacoes/reservar/rejected');
      expect(result.payload).toBe('Lead já reservado por Ana');
      expect(types(dispatched)).toContain('ligacoes/fetchLigacoes/pending');
      expect(mockedService.list).toHaveBeenCalledWith(30);
      expect(store.getState().ligacoes.pendingDisplayId).toBeNull();
    });

    it('rejects with the generic message on a network error', async () => {
      mockedService.reservar.mockRejectedValue(new Error('Network Error'));
      mockedService.list.mockResolvedValue(mockLigacaoListResponse);
      const { store } = setupStore();

      const result = await store.dispatch(ligacaoActions.reservar(42));

      expect(result.payload).toBe('LIGACOES.ERRORS.GENERIC');
    });

    it('tracks the display id while the request is in flight', async () => {
      let resolveReservar: (value: { telefone: string; until: string }) => void = () => {};
      mockedService.reservar.mockReturnValue(
        new Promise(resolve => {
          resolveReservar = resolve;
        }),
      );
      mockedService.list.mockResolvedValue(mockLigacaoListResponse);
      const { store } = setupStore();

      const pending = store.dispatch(ligacaoActions.reservar(42));
      expect(store.getState().ligacoes.pendingDisplayId).toBe(42);

      resolveReservar({ telefone: '1', until: '2026-10-18T15:30:00Z' });
      await pending;
      expect(store.getState().ligacoes.pendingDisplayId).toBeNull();
    });
  });

  describe('liberar', () => {
    it('refetches after success', async () => {
      mockedService.liberar.mockResolvedValue(undefined);
      mockedService.list.mockResolvedValue(mockLigacaoListResponse);
      const { store } = setupStore({ janela: 120 });

      const result = await store.dispatch(ligacaoActions.liberar(42));

      expect(result.type).toBe('ligacoes/liberar/fulfilled');
      expect(mockedService.liberar).toHaveBeenCalledWith(42);
      expect(mockedService.list).toHaveBeenCalledWith(120);
    });

    it('refetches and rejects on error', async () => {
      mockedService.liberar.mockRejectedValue(
        httpError(422, { error: 'ligacoes.sem_reserva', message: 'Sem reserva' }),
      );
      mockedService.list.mockResolvedValue(mockLigacaoListResponse);
      const { store } = setupStore();

      const result = await store.dispatch(ligacaoActions.liberar(42));

      expect(result.payload).toBe('Sem reserva');
      expect(mockedService.list).toHaveBeenCalledWith(undefined);
    });
  });

  describe('puxar', () => {
    it('resolves with the display id and refetches', async () => {
      mockedService.puxar.mockResolvedValue({ id: 101, display_id: 42 });
      mockedService.list.mockResolvedValue(mockLigacaoListResponse);
      const { store } = setupStore();

      const result = await store.dispatch(ligacaoActions.puxar(42));

      expect(result.type).toBe('ligacoes/puxar/fulfilled');
      expect(result.payload).toBe(42);
      expect(mockedService.list).toHaveBeenCalled();
    });

    it('refetches and rejects on error', async () => {
      mockedService.puxar.mockRejectedValue(httpError(500));
      mockedService.list.mockResolvedValue(mockLigacaoListResponse);
      const { store } = setupStore();

      const result = await store.dispatch(ligacaoActions.puxar(42));

      expect(result.payload).toBe('LIGACOES.ERRORS.GENERIC');
      expect(mockedService.list).toHaveBeenCalled();
    });
  });

  describe('resumo', () => {
    it('sends the summary and refetches', async () => {
      mockedService.resumo.mockResolvedValue(undefined);
      mockedService.list.mockResolvedValue(mockLigacaoListResponse);
      const { store } = setupStore();

      const pending = store.dispatch(ligacaoActions.resumo({ displayId: 42, texto: 'Falei' }));
      expect(store.getState().ligacoes.pendingDisplayId).toBe(42);
      const result = await pending;

      expect(result.type).toBe('ligacoes/resumo/fulfilled');
      expect(mockedService.resumo).toHaveBeenCalledWith(42, 'Falei');
      expect(mockedService.list).toHaveBeenCalled();
    });

    it('refetches and rejects with the server message on 422', async () => {
      mockedService.resumo.mockRejectedValue(
        httpError(422, { error: 'ligacoes.resumo_duplicado', message: 'Resumo já registrado' }),
      );
      mockedService.list.mockResolvedValue(mockLigacaoListResponse);
      const { store } = setupStore();

      const result = await store.dispatch(ligacaoActions.resumo({ displayId: 42, texto: 'x' }));

      expect(result.payload).toBe('Resumo já registrado');
      expect(mockedService.list).toHaveBeenCalled();
    });
  });
});
