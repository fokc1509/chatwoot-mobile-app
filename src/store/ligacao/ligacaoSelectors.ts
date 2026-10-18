import { createSelector } from '@reduxjs/toolkit';

import type { RootState } from '@/store';
import type { LigacaoCardState, LigacaoLead, LigacaoMinhaReserva } from './ligacaoTypes';

export const selectLigacoesState = (state: RootState) => state.ligacoes;
const selectAccountId = (state: RootState) => state.auth.user?.account_id;

export const selectLigacaoAccess = (state: RootState): boolean => {
  const accountId = selectAccountId(state);
  return accountId === undefined ? false : (state.ligacoes.accessByAccount[accountId] ?? false);
};

export const selectLigacaoLeads = (state: RootState) => state.ligacoes.leads;
export const selectLigacaoTab = (state: RootState) => state.ligacoes.tab;
export const selectMinhaReserva = (state: RootState) => state.ligacoes.minhaReserva;
export const selectLigacaoJanela = (state: RootState) => state.ligacoes.janela;
export const selectLigacaoJanelas = (state: RootState) => state.ligacoes.janelas;
export const selectIsLigacaoLoading = (state: RootState) => state.ligacoes.isLoading;
export const selectPendingDisplayId = (state: RootState) => state.ligacoes.pendingDisplayId;

export const selectVisibleLeads = createSelector(
  [selectLigacaoLeads, selectLigacaoTab],
  (leads, tab) =>
    tab === 'meus_cv'
      ? leads.filter(lead => lead.cv.estado === 'vinculado' && lead.cv.minha)
      : leads,
);

/** My reservation whose lead is no longer in the list (shown as a banner). */
export const selectOrphanReservation = createSelector(
  [selectLigacaoLeads, selectMinhaReserva],
  (leads, minhaReserva) =>
    minhaReserva && !leads.some(lead => lead.display_id === minhaReserva.display_id)
      ? minhaReserva
      : null,
);

export const getLeadCardState = (
  lead: LigacaoLead,
  minhaReserva: LigacaoMinhaReserva | null,
): LigacaoCardState => {
  if (lead.reserva?.minha || minhaReserva?.display_id === lead.display_id) {
    return 'mine';
  }
  if (lead.reserva) {
    return 'reserved_by_other';
  }
  return lead.pode_reservar ? 'reservable' : 'disabled';
};
