import type {
  AttendanceApprovalContext,
  AttendanceApprovalOption,
  AttendanceStatus,
} from '@/store/attendance/attendanceTypes';

type PendingStatus = Extract<AttendanceStatus, { estado: 'aprovacao_pendente' }>;

export type ApprovalBannerModel = {
  tipo: PendingStatus['tipo'];
  contexto: AttendanceApprovalContext;
  opcoes: AttendanceApprovalOption[];
  /** The gate's buttons note; the decision is a click `in_reply_to` it. */
  messageId: number;
};

/**
 * Port of AttendanceActionSheet.vue `view === 'aprovacao'`: only a pending approval
 * this user may decide (`pode_aprovar`, computed by the server) shows the banner.
 * `opcoes` come already as `{label, value}` from the server (concern gate_opcoes);
 * values are never hardcoded.
 */
export const approvalBannerModel = (
  status: AttendanceStatus | null | undefined,
): ApprovalBannerModel | null => {
  if (!status || status.estado !== 'aprovacao_pendente' || status.pode_aprovar !== true) {
    return null;
  }
  if (typeof status.message_id !== 'number') return null;
  const opcoes = (Array.isArray(status.opcoes) ? status.opcoes : [])
    .filter(
      (o): o is AttendanceApprovalOption =>
        !!o && typeof o.label === 'string' && o.label.length > 0 && typeof o.value === 'string',
    )
    .map(({ label, value }) => ({ label, value }));
  if (opcoes.length === 0) return null;
  return {
    tipo: status.tipo,
    contexto: status.contexto ?? {},
    opcoes,
    messageId: status.message_id,
  };
};

/** Same choice as the web: discard title for `descarte`, postponement title otherwise. */
export const approvalTitleKey = (tipo: PendingStatus['tipo']): string =>
  tipo === 'descarte'
    ? 'ATTENDANCE.APPROVAL.DESCARTE_TITLE'
    : 'ATTENDANCE.APPROVAL.ADIAMENTO_TITLE';

export type ApprovalContextLine = { key: string; params: Record<string, string> };

/** Context lines in the web's order (solicitante, motivo, bucket), only those present. */
export const approvalContextLines = (
  contexto: AttendanceApprovalContext,
): ApprovalContextLine[] => {
  const lines: ApprovalContextLine[] = [];
  if (contexto.solicitante) {
    lines.push({ key: 'ATTENDANCE.APPROVAL.SOLICITANTE', params: { nome: contexto.solicitante } });
  }
  if (contexto.motivo) {
    lines.push({ key: 'ATTENDANCE.APPROVAL.MOTIVO', params: { motivo: contexto.motivo } });
  }
  if (contexto.bucket) {
    lines.push({ key: 'ATTENDANCE.APPROVAL.BUCKET', params: { bucket: contexto.bucket } });
  }
  return lines;
};

type RefreshSource = {
  id?: number;
  status?: string;
  updatedAt?: unknown;
  lastActivityAt?: unknown;
};

/** Changes whenever the conversation's status, updatedAt or lastActivityAt change. */
export const approvalRefreshKey = (conversation: RefreshSource | null | undefined): string =>
  conversation
    ? [
        conversation.id,
        conversation.status,
        conversation.updatedAt ?? '',
        conversation.lastActivityAt ?? '',
      ].join('|')
    : '';

export type RequestToken = { seq: number; conversationId: number };

/** Drops stale status responses (older request or another conversation). */
export const createLatestRequestGuard = () => {
  let latest = 0;
  return {
    begin: (conversationId: number): RequestToken => ({ seq: ++latest, conversationId }),
    isCurrent: (token: RequestToken, conversationId: number): boolean =>
      token.seq === latest && token.conversationId === conversationId,
  };
};
