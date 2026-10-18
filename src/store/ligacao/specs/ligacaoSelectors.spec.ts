import type { RootState } from '@/store';
import {
  getLeadCardState,
  selectIsLigacaoLoading,
  selectLigacaoAccess,
  selectLigacaoJanela,
  selectLigacaoJanelas,
  selectMinhaReserva,
  selectOrphanReservation,
  selectPendingDisplayId,
  selectVisibleLeads,
} from '../ligacaoSelectors';
import { initialState } from '../ligacaoSlice';
import type { LigacaoLead, LigacaoMinhaReserva, LigacaoState } from '../ligacaoTypes';
import { mockLigacaoLead, mockLigacaoLeadNulls } from './ligacaoMockData';

const meuCv: LigacaoLead = {
  ...mockLigacaoLead,
  id: 103,
  display_id: 44,
  cv: { estado: 'vinculado', nome: 'Eu', minha: true },
};
const cvDeOutro: LigacaoLead = {
  ...mockLigacaoLead,
  id: 104,
  display_id: 45,
  cv: { estado: 'vinculado', nome: 'Ana', minha: false },
};

const reserva: LigacaoMinhaReserva = {
  display_id: 42,
  lead: 'Maria Souza',
  until: '2026-10-18T15:30:00Z',
  telefone: '+5511999990000',
};

const buildState = (ligacoes: Partial<LigacaoState>, accountId: number | null = 1) =>
  ({
    auth: { user: accountId === null ? null : { account_id: accountId } },
    ligacoes: { ...initialState, ...ligacoes },
  }) as unknown as RootState;

describe('ligacao selectors', () => {
  describe('selectLigacaoAccess', () => {
    it('defaults to false for an unknown account', () => {
      expect(selectLigacaoAccess(buildState({ accessByAccount: { 2: true } }))).toBe(false);
    });

    it('reads the current account', () => {
      expect(selectLigacaoAccess(buildState({ accessByAccount: { 1: true } }))).toBe(true);
      expect(selectLigacaoAccess(buildState({ accessByAccount: { 1: false } }))).toBe(false);
    });

    it('is false without a user', () => {
      expect(selectLigacaoAccess(buildState({ accessByAccount: { 1: true } }, null))).toBe(false);
    });
  });

  describe('selectVisibleLeads', () => {
    const leads = [mockLigacaoLead, meuCv, cvDeOutro, mockLigacaoLeadNulls];

    it('returns every lead on "todos"', () => {
      expect(selectVisibleLeads(buildState({ leads, tab: 'todos' }))).toEqual(leads);
    });

    it('keeps only leads linked to me on "meus_cv"', () => {
      expect(selectVisibleLeads(buildState({ leads, tab: 'meus_cv' }))).toEqual([meuCv]);
    });
  });

  describe('selectOrphanReservation', () => {
    it('returns the reservation when its lead is not in the list', () => {
      const state = buildState({ leads: [meuCv], minhaReserva: reserva });
      expect(selectOrphanReservation(state)).toEqual(reserva);
    });

    it('returns null when the lead is in the list', () => {
      const state = buildState({ leads: [mockLigacaoLead], minhaReserva: reserva });
      expect(selectOrphanReservation(state)).toBeNull();
    });

    it('returns null without a reservation', () => {
      expect(selectOrphanReservation(buildState({ leads: [] }))).toBeNull();
    });
  });

  it('exposes the simple fields', () => {
    const state = buildState({
      minhaReserva: reserva,
      janela: 60,
      janelas: [30, 60],
      isLoading: true,
      pendingDisplayId: 42,
    });
    expect(selectMinhaReserva(state)).toEqual(reserva);
    expect(selectLigacaoJanela(state)).toBe(60);
    expect(selectLigacaoJanelas(state)).toEqual([30, 60]);
    expect(selectIsLigacaoLoading(state)).toBe(true);
    expect(selectPendingDisplayId(state)).toBe(42);
  });

  describe('getLeadCardState', () => {
    it('is "mine" when the lead reservation is mine', () => {
      const lead: LigacaoLead = {
        ...mockLigacaoLead,
        pode_reservar: false,
        reserva: { agent_id: 1, agent_nome: 'Eu', until: reserva.until, minha: true },
      };
      expect(getLeadCardState(lead, null)).toBe('mine');
    });

    it('is "mine" when minhaReserva points at the lead', () => {
      expect(getLeadCardState(mockLigacaoLead, reserva)).toBe('mine');
    });

    it('is "reserved_by_other" when someone else holds it', () => {
      expect(getLeadCardState(mockLigacaoLeadNulls, null)).toBe('reserved_by_other');
    });

    it('is "reservable" when it can be reserved', () => {
      expect(getLeadCardState(mockLigacaoLead, null)).toBe('reservable');
      expect(getLeadCardState(mockLigacaoLead, { ...reserva, display_id: 99 })).toBe('reservable');
    });

    it('is "disabled" otherwise', () => {
      expect(getLeadCardState({ ...mockLigacaoLead, pode_reservar: false }, null)).toBe('disabled');
    });
  });
});
