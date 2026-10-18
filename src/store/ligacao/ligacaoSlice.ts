import { createSlice, isAnyOf, type AnyAction, type PayloadAction } from '@reduxjs/toolkit';
import { REHYDRATE } from 'redux-persist';

import { ligacaoActions, type LigacaoListError, type LigacaoListPayload } from './ligacaoActions';
import type { LigacaoState, LigacaoTab } from './ligacaoTypes';

export const initialState: LigacaoState = {
  accountId: null,
  leads: [],
  minhaReserva: null,
  janela: null,
  janelas: [],
  tab: 'todos',
  isLoading: false,
  pendingDisplayId: null,
  accessByAccount: {},
};

// Statuses that mean "this user/account has no queue" (the server answers
// permission denials with 401; 404 = server without the endpoint).
const DENIED_STATUSES = [401, 403, 404];

const switchAccount = (state: LigacaoState, accountId: number | null) => {
  if (state.accountId !== accountId) {
    state.accountId = accountId;
    state.leads = [];
    state.minhaReserva = null;
    state.janela = null;
  }
};

const fetchActions = [ligacaoActions.fetchLigacoes, ligacaoActions.checkAccess] as const;
const itemActions = [
  ligacaoActions.reservar,
  ligacaoActions.liberar,
  ligacaoActions.puxar,
  ligacaoActions.resumo,
] as const;

const ligacaoSlice = createSlice({
  name: 'ligacoes',
  initialState,
  reducers: {
    setTab: (state, action: PayloadAction<LigacaoTab>) => {
      state.tab = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(ligacaoActions.reservaConfirmada, (state, action) => {
        state.minhaReserva = action.payload;
      })
      // The whole store is persisted: drop in-flight flags that may have been
      // saved mid-request. The slice must be built from the inbound payload,
      // since redux-persist keeps the reducer's value when it changes a key.
      .addCase(REHYDRATE, (state, action: AnyAction) => {
        const persisted = (action.payload as { ligacoes?: Partial<LigacaoState> } | undefined)
          ?.ligacoes;
        return {
          ...initialState,
          ...state,
          ...persisted,
          isLoading: false,
          pendingDisplayId: null,
        };
      })
      .addMatcher(isAnyOf(...fetchActions.map(thunk => thunk.pending)), (state, action) => {
        switchAccount(state, (action.meta as { accountId: number | null }).accountId);
        state.isLoading = true;
      })
      .addMatcher(isAnyOf(...fetchActions.map(thunk => thunk.fulfilled)), (state, action) => {
        const { accountId, response } = action.payload as LigacaoListPayload;
        // Pending already moved state.accountId to the latest account: a late
        // response from a previous account is dropped.
        if (accountId !== state.accountId) {
          return;
        }
        // Always a full replacement.
        state.leads = response.leads;
        state.minhaReserva = response.minha_reserva;
        state.janela = response.meta.janela_dias;
        state.janelas = response.meta.janelas;
        state.isLoading = false;
        if (accountId !== null) {
          state.accessByAccount[accountId] = true;
        }
      })
      .addMatcher(isAnyOf(...fetchActions.map(thunk => thunk.rejected)), (state, action) => {
        const error = action.payload as LigacaoListError | undefined;
        if (error && error.accountId !== state.accountId) {
          return; // late failure from a previous account
        }
        state.isLoading = false;
        // Network errors, timeouts and 5xx keep the last known access.
        if (error && error.accountId !== null && DENIED_STATUSES.includes(error.status ?? 0)) {
          state.accessByAccount[error.accountId] = false;
        }
      })
      // Assumes one item action at a time (the UI enforces it).
      .addMatcher(isAnyOf(...itemActions.map(thunk => thunk.pending)), (state, action) => {
        const arg = action.meta.arg as number | { displayId: number };
        state.pendingDisplayId = typeof arg === 'number' ? arg : arg.displayId;
      })
      .addMatcher(
        isAnyOf(
          ...itemActions.map(thunk => thunk.fulfilled),
          ...itemActions.map(thunk => thunk.rejected),
        ),
        state => {
          state.pendingDisplayId = null;
        },
      );
  },
});

export const { setTab } = ligacaoSlice.actions;
export default ligacaoSlice.reducer;
