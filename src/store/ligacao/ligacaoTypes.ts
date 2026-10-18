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
  agent_nome: string | null;
  at: string | null;
  resultado: LigacaoResultado | null;
}

export interface LigacaoReserva {
  agent_id: number;
  agent_nome: string | null;
  until: string;
  minha: boolean;
}

export interface LigacaoLead {
  id: number;
  display_id: number;
  lead: string | null;
  empreendimentos: string | null;
  respondeu_at: string | null;
  /** Name of the AI follow-up workflow handling the lead, or null. */
  ia: string | null;
  cv: LigacaoCv;
  ultima_tentativa: LigacaoUltimaTentativa | null;
  reserva: LigacaoReserva | null;
  pode_reservar: boolean;
}

export interface LigacaoMinhaReserva {
  display_id: number;
  lead: string | null;
  until: string;
  telefone: string | null;
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
  telefone: string | null;
  until: string;
}

export interface LigacaoPuxarResponse {
  id: number;
  display_id: number;
}

export type LigacaoTab = 'todos' | 'meus_cv';

export type LigacaoCardState = 'mine' | 'reserved_by_other' | 'reservable' | 'disabled';

export interface LigacaoState {
  /** Account the stored list belongs to. */
  accountId: number | null;
  leads: LigacaoLead[];
  minhaReserva: LigacaoMinhaReserva | null;
  janela: LigacaoJanela | null;
  janelas: LigacaoJanela[];
  tab: LigacaoTab;
  isLoading: boolean;
  /** display_id of the lead whose action (reservar/liberar/puxar/resumo) is in flight. */
  pendingDisplayId: number | null;
  /** Last known queue access per account (true only after a 2xx). */
  accessByAccount: Record<number, boolean>;
}
