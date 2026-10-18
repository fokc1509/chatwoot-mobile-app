// Shapes returned by the cw-arqos `ligacoes` API. Keys are kept in snake_case,
// exactly as the server sends them.

export type LigacaoJanela = 30 | 60 | 90 | 120;

export type LigacaoResultado = 'nao_atendeu' | 'expirou' | 'falei';

export type LigacaoCvEstado = 'livre' | 'vinculado' | 'vinculado_sem_usuario';

export interface LigacaoCv {
  estado: LigacaoCvEstado;
  nome: string | null;
  minha: boolean;
}

export interface LigacaoUltimaTentativa {
  agent_nome: string;
  at: string;
  resultado: LigacaoResultado;
}

export interface LigacaoReserva {
  agent_id: number;
  agent_nome: string;
  until: string;
  minha: boolean;
}

export interface LigacaoLead {
  id: number;
  display_id: number;
  lead: string;
  empreendimentos: string;
  respondeu_at: string;
  ia: boolean;
  cv: LigacaoCv;
  ultima_tentativa: LigacaoUltimaTentativa | null;
  reserva: LigacaoReserva | null;
  pode_reservar: boolean;
}

export interface LigacaoMinhaReserva {
  display_id: number;
  lead: string;
  until: string;
  telefone: string;
}

export interface LigacaoListMeta {
  total: number;
  janela_dias: LigacaoJanela;
  ver_tudo: boolean;
  janelas: LigacaoJanela[];
}

export interface LigacaoListResponse {
  leads: LigacaoLead[];
  minha_reserva: LigacaoMinhaReserva | null;
  meta: LigacaoListMeta;
}

export interface LigacaoReservarResponse {
  telefone: string;
  until: string;
}

export interface LigacaoPuxarResponse {
  id: number;
  display_id: number;
}
