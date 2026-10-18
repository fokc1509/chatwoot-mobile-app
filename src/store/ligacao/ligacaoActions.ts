import { createAction, createAsyncThunk } from '@reduxjs/toolkit';

import { getHttpStatus, getLigacaoErrorMessage, LigacaoService } from './ligacaoService';
import type {
  LigacaoJanela,
  LigacaoListResponse,
  LigacaoMinhaReserva,
  LigacaoState,
} from './ligacaoTypes';

// Minimal view of the root state. Using RootState here would make the store
// type depend on itself (the slice imports these thunks).
interface LigacaoThunkState {
  auth: { user: { account_id: number } | null };
  ligacoes: LigacaoState;
}

export interface LigacaoListPayload {
  accountId: number | null;
  response: LigacaoListResponse;
}

export interface LigacaoListError {
  accountId: number | null;
  status: number | undefined;
}

const currentAccountId = (getState: () => unknown): number | null =>
  (getState() as LigacaoThunkState).auth.user?.account_id ?? null;

const currentJanela = (getState: () => unknown): LigacaoJanela | undefined =>
  (getState() as LigacaoThunkState).ligacoes.janela ?? undefined;

const listThunk = <Arg>(
  type: string,
  resolveDias: (arg: Arg, getState: () => unknown) => LigacaoJanela | undefined,
) =>
  createAsyncThunk<
    LigacaoListPayload,
    Arg,
    { rejectValue: LigacaoListError; pendingMeta: { accountId: number | null } }
  >(
    type,
    async (arg, { getState, rejectWithValue }) => {
      const accountId = currentAccountId(getState);
      try {
        const response = await LigacaoService.list(resolveDias(arg, getState));
        return { accountId, response };
      } catch (error) {
        return rejectWithValue({ accountId, status: getHttpStatus(error) });
      }
    },
    {
      getPendingMeta: (_, { getState }) => ({ accountId: currentAccountId(getState) }),
    },
  );

const fetchLigacoes = listThunk<LigacaoJanela | undefined>('ligacoes/fetchLigacoes', dias => dias);
// Re-checks keep the selected window; after an account switch the slice has
// already reset it, so the server default is used.
const checkAccess = listThunk<void>('ligacoes/checkAccess', (_, getState) =>
  currentJanela(getState),
);

/** Written by `reservar` on success, before the list is refetched. */
const reservaConfirmada = createAction<LigacaoMinhaReserva>('ligacoes/reservaConfirmada');

export const ligacaoActions = {
  fetchLigacoes,
  /** Same request as fetchLigacoes; also decides whether the tab is shown. */
  checkAccess,
  reservaConfirmada,

  reservar: createAsyncThunk<void, number, { rejectValue: string }>(
    'ligacoes/reservar',
    async (displayId, { dispatch, getState, rejectWithValue }) => {
      try {
        const { telefone, until } = await LigacaoService.reservar(displayId);
        const lead =
          (getState() as LigacaoThunkState).ligacoes.leads.find(
            item => item.display_id === displayId,
          )?.lead ?? null;
        dispatch(reservaConfirmada({ display_id: displayId, lead, until, telefone }));
      } catch (error) {
        return rejectWithValue(getLigacaoErrorMessage(error));
      } finally {
        await dispatch(fetchLigacoes(currentJanela(getState)));
      }
    },
  ),

  liberar: createAsyncThunk<void, number, { rejectValue: string }>(
    'ligacoes/liberar',
    async (displayId, { dispatch, getState, rejectWithValue }) => {
      try {
        await LigacaoService.liberar(displayId);
      } catch (error) {
        return rejectWithValue(getLigacaoErrorMessage(error));
      } finally {
        await dispatch(fetchLigacoes(currentJanela(getState)));
      }
    },
  ),

  /** Resolves with the display_id of the pulled conversation. */
  puxar: createAsyncThunk<number, number, { rejectValue: string }>(
    'ligacoes/puxar',
    async (displayId, { dispatch, getState, rejectWithValue }) => {
      try {
        const response = await LigacaoService.puxar(displayId);
        return response.display_id;
      } catch (error) {
        return rejectWithValue(getLigacaoErrorMessage(error));
      } finally {
        await dispatch(fetchLigacoes(currentJanela(getState)));
      }
    },
  ),

  resumo: createAsyncThunk<void, { displayId: number; texto: string }, { rejectValue: string }>(
    'ligacoes/resumo',
    async ({ displayId, texto }, { dispatch, getState, rejectWithValue }) => {
      try {
        await LigacaoService.resumo(displayId, texto);
      } catch (error) {
        return rejectWithValue(getLigacaoErrorMessage(error));
      } finally {
        await dispatch(fetchLigacoes(currentJanela(getState)));
      }
    },
  ),
};
