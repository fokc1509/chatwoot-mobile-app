import { REHYDRATE } from 'redux-persist';
import autoMergeLevel1 from 'redux-persist/lib/stateReconciler/autoMergeLevel1';

import reducer, { initialState, setTab } from '../ligacaoSlice';
import { ligacaoActions } from '../ligacaoActions';
import type { LigacaoListResponse, LigacaoState } from '../ligacaoTypes';
import { mockLigacaoLead, mockLigacaoLeadNulls, mockLigacaoListResponse } from './ligacaoMockData';

const minhaReserva = {
  display_id: 42,
  lead: 'Maria Souza',
  until: '2026-10-18T15:30:00Z',
  telefone: '+5511999990000',
};

const pending = (accountId: number, arg?: 30 | 60 | 90 | 120) => ({
  type: ligacaoActions.fetchLigacoes.pending.type,
  meta: { arg, requestId: 'r1', requestStatus: 'pending', accountId },
});

const fulfilled = (accountId: number, response: LigacaoListResponse) => ({
  type: ligacaoActions.fetchLigacoes.fulfilled.type,
  payload: { accountId, response },
  meta: { arg: undefined, requestId: 'r1', requestStatus: 'fulfilled' },
});

const rejected = (accountId: number, status: number | undefined) => ({
  type: ligacaoActions.fetchLigacoes.rejected.type,
  payload: { accountId, status },
  meta: { arg: undefined, requestId: 'r1', requestStatus: 'rejected', rejectedWithValue: true },
  error: { message: 'Rejected' },
});

const stateFor = (overrides: Partial<LigacaoState>): LigacaoState => ({
  ...initialState,
  ...overrides,
});

describe('ligacaoSlice', () => {
  it('returns the initial state', () => {
    expect(reducer(undefined, { type: '@@INIT' })).toEqual({
      accountId: null,
      leads: [],
      minhaReserva: null,
      janela: null,
      janelas: [],
      tab: 'todos',
      isLoading: false,
      pendingDisplayId: null,
      accessByAccount: {},
    });
  });

  it('setTab switches the local filter', () => {
    expect(reducer(initialState, setTab('meus_cv')).tab).toBe('meus_cv');
  });

  it('pending for the same account keeps the current list', () => {
    const state = stateFor({ accountId: 1, leads: [mockLigacaoLead], minhaReserva });
    const next = reducer(state, pending(1));
    expect(next.leads).toEqual([mockLigacaoLead]);
    expect(next.minhaReserva).toEqual(minhaReserva);
    expect(next.isLoading).toBe(true);
  });

  it('pending for another account clears leads and minhaReserva', () => {
    const state = stateFor({ accountId: 1, leads: [mockLigacaoLead], minhaReserva, janela: 90 });
    const next = reducer(state, pending(2));
    expect(next.accountId).toBe(2);
    expect(next.leads).toEqual([]);
    expect(next.minhaReserva).toBeNull();
    expect(next.janela).toBeNull();
  });

  it('pending with a window selects it before the response', () => {
    const state = stateFor({ accountId: 1, janela: 30 });
    const next = reducer(state, pending(1, 60));
    expect(next.janela).toBe(60);
    expect(next.isLoading).toBe(true);
  });

  it('pending without a window keeps the current one', () => {
    const state = stateFor({ accountId: 1, janela: 90 });
    expect(reducer(state, pending(1)).janela).toBe(90);
  });

  it('pending with a window for another account resets, then applies the requested window', () => {
    const state = stateFor({ accountId: 1, leads: [mockLigacaoLead], janela: 90 });
    const next = reducer(state, pending(2, 60));
    expect(next.accountId).toBe(2);
    expect(next.leads).toEqual([]);
    expect(next.janela).toBe(60);
  });

  it('checkAccess pending never sets the window', () => {
    const state = stateFor({ accountId: 1, janela: 90 });
    const next = reducer(state, {
      type: ligacaoActions.checkAccess.pending.type,
      meta: { arg: undefined, requestId: 'r2', requestStatus: 'pending', accountId: 2 },
    });
    expect(next.janela).toBeNull();
  });

  it('fulfilled for a different account replaces the list, never merges', () => {
    const state = stateFor({ accountId: 1, leads: [mockLigacaoLead], minhaReserva });
    const next = [
      pending(2),
      fulfilled(2, { ...mockLigacaoListResponse, leads: [mockLigacaoLeadNulls] }),
    ].reduce(reducer, state);
    expect(next.accountId).toBe(2);
    expect(next.leads).toEqual([mockLigacaoLeadNulls]);
    expect(next.minhaReserva).toBeNull();
    expect(next.isLoading).toBe(false);
  });

  it('drops a late response from the previous account', () => {
    const listA = {
      ...mockLigacaoListResponse,
      leads: [mockLigacaoLead],
      minha_reserva: minhaReserva,
    };
    const listB = { ...mockLigacaoListResponse, leads: [mockLigacaoLeadNulls] };
    const next = [pending(1), pending(2), fulfilled(2, listB), fulfilled(1, listA)].reduce(
      reducer,
      initialState,
    );
    expect(next.accountId).toBe(2);
    expect(next.leads).toEqual([mockLigacaoLeadNulls]);
    expect(next.minhaReserva).toBeNull();
    expect(next.accessByAccount).toEqual({ 2: true });
  });

  it('a late failure from the previous account neither hides it nor stops loading', () => {
    const state = stateFor({ accessByAccount: { 1: true, 2: true } });
    const next = [pending(1), pending(2), rejected(1, 401)].reduce(reducer, state);
    expect(next.accessByAccount).toEqual({ 1: true, 2: true });
    expect(next.isLoading).toBe(true);
  });

  it('REHYDRATE keeps persisted data but clears in-flight flags', () => {
    const persisted = stateFor({
      accountId: 1,
      leads: [mockLigacaoLead],
      accessByAccount: { 1: true },
      isLoading: true,
      pendingDisplayId: 42,
    });
    const next = reducer(initialState, {
      type: REHYDRATE,
      key: 'Root',
      payload: { ligacoes: persisted },
    });
    expect(next).toEqual({ ...persisted, isLoading: false, pendingDisplayId: null });
  });

  it('REHYDRATE result survives the redux-persist level-1 merge', () => {
    const persisted = stateFor({ accessByAccount: { 1: true }, isLoading: true });
    const inbound = { ligacoes: persisted };
    const original = { ligacoes: initialState };
    const reduced = {
      ligacoes: reducer(initialState, { type: REHYDRATE, key: 'Root', payload: inbound }),
    };
    const merged = autoMergeLevel1(inbound, original, reduced, { debug: false } as never);
    expect(merged.ligacoes).toEqual({ ...persisted, isLoading: false });
  });

  it('REHYDRATE without persisted data keeps the state', () => {
    const next = reducer(initialState, { type: REHYDRATE, key: 'Root', payload: undefined });
    expect(next).toEqual(initialState);
  });

  it('fulfilled stores minha_reserva, window and available windows', () => {
    const next = reducer(
      stateFor({ accountId: 1 }),
      fulfilled(1, {
        ...mockLigacaoListResponse,
        minha_reserva: minhaReserva,
        meta: { total: 2, janela_dias: 90, ver_tudo: true, janelas: [30, 90] },
      }),
    );
    expect(next.minhaReserva).toEqual(minhaReserva);
    expect(next.janela).toBe(90);
    expect(next.janelas).toEqual([30, 90]);
    expect(next.accessByAccount[1]).toBe(true);
  });

  it('rejected stops loading and keeps the list', () => {
    const state = stateFor({ accountId: 1, leads: [mockLigacaoLead], isLoading: true });
    const next = reducer(state, rejected(1, undefined));
    expect(next.isLoading).toBe(false);
    expect(next.leads).toEqual([mockLigacaoLead]);
  });
});
