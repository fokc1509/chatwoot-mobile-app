// Pure helpers behind the "Fila de Ligações" screen. Kept free of React so the
// card logic can be unit tested without a renderer.
import I18n from '@/i18n';
import { getLeadCardState } from '@/store/ligacao/ligacaoSelectors';
import type {
  LigacaoCardState,
  LigacaoCv,
  LigacaoLead,
  LigacaoMinhaReserva,
  LigacaoUltimaTentativa,
} from '@/store/ligacao/ligacaoTypes';

/** Same ceiling as the server (Conversations::Ligacao::RESUMO_MAX). */
export const RESUMO_MAX = 2000;

/** Placeholder for missing values. */
export const VAZIO = '—';
const SEPARADOR = ' · ';

export type LigacaoCardAction = 'reservar' | 'ligar' | 'abrir' | 'puxar' | 'liberar';

export interface LigacaoCardView {
  state: LigacaoCardState;
  nome: string;
  empreendimentos: string;
  respondeuLabel: string;
  ia: string;
  cvLabel: string;
  tentativaLabel: string;
  /** Only for `mine`; null when the phone is unknown. */
  telefone?: string | null;
  /** Only for `reserved_by_other`. */
  reservedLabel?: string;
  /** Only for `mine`. */
  untilLabel?: string;
  actions: LigacaoCardAction[];
}

const parse = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

const pad = (n: number) => String(n).padStart(2, '0');

/** "HH:mm" in the device's local time. */
export const formatHora = (iso: string | null | undefined): string => {
  const date = parse(iso);
  return date ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : VAZIO;
};

/** Short elapsed time: "agora", "45 min", "3 h", "2 d". */
export const formatRelativo = (iso: string | null | undefined, now: Date): string => {
  const date = parse(iso);
  if (!date) return VAZIO;
  const min = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60000));
  if (min < 1) return I18n.t('LIGACOES.TEMPO.AGORA');
  if (min < 60) return I18n.t('LIGACOES.TEMPO.MIN', { n: min });
  if (min < 1440) return I18n.t('LIGACOES.TEMPO.HORAS', { n: Math.round(min / 60) });
  return I18n.t('LIGACOES.TEMPO.DIAS', { n: Math.round(min / 1440) });
};

const ha = (iso: string | null | undefined, now: Date): string | null => {
  const tempo = formatRelativo(iso, now);
  if (tempo === VAZIO) return null;
  return tempo === I18n.t('LIGACOES.TEMPO.AGORA') ? tempo : I18n.t('LIGACOES.CARD.HA', { tempo });
};

export const getCvLabel = (cv: LigacaoCv | null | undefined): string => {
  if (cv?.estado === 'vinculado' && cv.minha) return I18n.t('LIGACOES.CV.VINCULADO_VOCE');
  if (cv?.estado === 'vinculado' && cv.nome)
    return I18n.t('LIGACOES.CV.VINCULADO', { nome: cv.nome });
  if (cv?.estado === 'vinculado' || cv?.estado === 'vinculado_sem_usuario') {
    return I18n.t('LIGACOES.CV.VINCULADO_SEM_USUARIO');
  }
  return I18n.t('LIGACOES.CV.LIVRE');
};

/** "Fulano · não atendeu · há 2 d"; "—" when the attempt has no result. */
export const getTentativaLabel = (
  tentativa: LigacaoUltimaTentativa | null | undefined,
  now: Date,
): string => {
  if (!tentativa?.resultado) return VAZIO;
  const parts = [
    tentativa.agent_nome || '?',
    I18n.t(`LIGACOES.TENTATIVA.${tentativa.resultado.toUpperCase()}`),
    ha(tentativa.at, now),
  ];
  return parts.filter(Boolean).join(SEPARADOR);
};

const getRespondeuLabel = (iso: string | null, now: Date): string => {
  const tempo = formatRelativo(iso, now);
  if (tempo === VAZIO) return VAZIO;
  if (tempo === I18n.t('LIGACOES.TEMPO.AGORA')) return I18n.t('LIGACOES.CARD.RESPONDEU_AGORA');
  return I18n.t('LIGACOES.CARD.RESPONDEU', { tempo });
};

const ACTIONS_BY_STATE: Record<LigacaoCardState, LigacaoCardAction[]> = {
  mine: ['ligar', 'abrir', 'puxar', 'liberar'],
  reserved_by_other: [],
  reservable: ['reservar'],
  disabled: [],
};

export const getCardView = (
  lead: LigacaoLead,
  minhaReserva: LigacaoMinhaReserva | null,
  now: Date,
): LigacaoCardView => {
  const state = getLeadCardState(lead, minhaReserva);
  const view: LigacaoCardView = {
    state,
    nome: lead.lead || VAZIO,
    empreendimentos: lead.empreendimentos || VAZIO,
    respondeuLabel: getRespondeuLabel(lead.respondeu_at, now),
    ia: lead.ia || VAZIO,
    cvLabel: getCvLabel(lead.cv),
    tentativaLabel: getTentativaLabel(lead.ultima_tentativa, now),
    actions: [...ACTIONS_BY_STATE[state]],
  };

  if (state === 'mine') {
    // The phone only comes with my reservation; never borrow it from another lead.
    const reservaDaLinha = minhaReserva?.display_id === lead.display_id ? minhaReserva : null;
    view.telefone = reservaDaLinha?.telefone ?? null;
    view.untilLabel = I18n.t('LIGACOES.RESERVA.SUA_ATE', {
      hora: formatHora(reservaDaLinha?.until ?? lead.reserva?.until),
    });
  } else if (state === 'reserved_by_other') {
    view.reservedLabel = I18n.t('LIGACOES.RESERVA.RESERVADO_POR', {
      nome: lead.reserva?.agent_nome || I18n.t('LIGACOES.RESERVA.OUTRO_CORRETOR'),
      hora: formatHora(lead.reserva?.until),
    });
  }
  return view;
};

export const canSaveResumo = (texto: string): boolean => texto.trim().length > 0;

export const normalizeResumo = (texto: string): string => texto.trim().slice(0, RESUMO_MAX);

/** Actions that change the queue on the server; only these lock while one is in flight. */
const WRITE_ACTIONS: readonly LigacaoCardAction[] = ['reservar', 'puxar', 'liberar'];

export const isWriteAction = (action: LigacaoCardAction): boolean => WRITE_ACTIONS.includes(action);

/**
 * Full-screen spinner only before the first response for the account
 * (`janela` is null until then). Polls and pull-to-refresh keep the list —
 * or the empty state — on screen instead of flashing the spinner.
 */
export const shouldShowInitialLoader = ({
  isLoading,
  isRefreshing,
  hasItems,
  janela,
}: {
  isLoading: boolean;
  isRefreshing: boolean;
  hasItems: boolean;
  janela: number | null;
}): boolean => isLoading && !isRefreshing && !hasItems && janela === null;
