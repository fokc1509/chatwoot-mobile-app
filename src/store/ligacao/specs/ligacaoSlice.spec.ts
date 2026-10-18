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

const pending = (accountId: number) => ({
  type: ligacaoActions.fetchLigacoes.pending.type,
  meta: { arg: undefined, requestId: 'r1', requestStatus: 'pending', accountId },
});

const fulfilled = (accountId: number, response: LigacaoListResponse) => ({
  type: ligacaoActions.fetchLigacoes.fulfilled.type,
  payload: { accountId, response },
  meta: { arg: undefined, requestId: 'r1', requestStatus: 'fulfilled' },
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

  it('fulfilled for a different account replaces the list, never merges', () => {
    const state = stateFor({ accountId: 1, leads: [mockLigacaoLead], minhaReserva });
    const next = reducer(
      state,
      fulfilled(2, { ...mockLigacaoListResponse, leads: [mockLigacaoLeadNulls] }),
    );
    expect(next.accountId).toBe(2);
    expect(next.leads).toEqual([mockLigacaoLeadNulls]);
    expect(next.minhaReserva).toBeNull();
    expect(next.isLoading).toBe(false);
  });

  it('fulfilled stores minha_reserva, window and available windows', () => {
    const next = reducer(
      initialState,
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
    const next = reducer(state, {
      type: ligacaoActions.fetchLigacoes.rejected.type,
      payload: { accountId: 1, status: undefined },
      meta: { arg: undefined, requestId: 'r1', requestStatus: 'rejected', rejectedWithValue: true },
      error: { message: 'Rejected' },
    });
    expect(next.isLoading).toBe(false);
    expect(next.leads).toEqual([mockLigacaoLead]);
  });
});
