import type { LigacaoLead, LigacaoListResponse } from '../ligacaoTypes';

export const mockLigacaoLead: LigacaoLead = {
  id: 101,
  display_id: 42,
  lead: 'Maria Souza',
  empreendimentos: 'Residencial Aurora',
  respondeu_at: '2026-10-17T14:30:00Z',
  ia: 'fup-15d',
  cv: { estado: 'livre', nome: null, minha: false },
  ultima_tentativa: {
    agent_nome: 'João',
    at: '2026-10-16T10:00:00Z',
    resultado: 'nao_atendeu',
  },
  reserva: null,
  pode_reservar: true,
};

// Lead with every server-nullable field set to null.
export const mockLigacaoLeadNulls: LigacaoLead = {
  id: 102,
  display_id: 43,
  lead: null,
  empreendimentos: null,
  respondeu_at: null,
  ia: null,
  cv: { estado: 'vinculado_sem_usuario', nome: null, minha: false },
  ultima_tentativa: { agent_nome: null, at: null, resultado: null },
  reserva: { agent_id: 7, agent_nome: null, until: '2026-10-18T15:00:00Z', minha: false },
  pode_reservar: false,
};

export const mockLigacaoListResponse: LigacaoListResponse = {
  leads: [mockLigacaoLead, mockLigacaoLeadNulls],
  minha_reserva: null,
  meta: { total: 2, janela_dias: 30, ver_tudo: false, janelas: [30, 60, 90, 120] },
};
