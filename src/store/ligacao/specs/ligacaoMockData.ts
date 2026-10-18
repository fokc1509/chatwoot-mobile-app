import type { LigacaoLead, LigacaoListResponse } from '../ligacaoTypes';

export const mockLigacaoLead: LigacaoLead = {
  id: 101,
  display_id: 42,
  lead: 'Maria Souza',
  empreendimentos: 'Residencial Aurora',
  respondeu_at: '2026-10-17T14:30:00Z',
  ia: true,
  cv: { estado: 'livre', nome: null, minha: false },
  ultima_tentativa: {
    agent_nome: 'João',
    at: '2026-10-16T10:00:00Z',
    resultado: 'nao_atendeu',
  },
  reserva: null,
  pode_reservar: true,
};

export const mockLigacaoListResponse: LigacaoListResponse = {
  leads: [mockLigacaoLead],
  minha_reserva: null,
  meta: { total: 1, janela_dias: 30, ver_tudo: false, janelas: [30, 60, 90, 120] },
};
