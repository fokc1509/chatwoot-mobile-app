import type { Inbox } from '@/types/Inbox';
import type { Message } from '@/types/Message';
import type { User } from '@/types/User';
import { getCurrentAccount, getUserPermissions } from '@/utils/permissionUtils';
import type {
  AttendanceActionBody,
  DiscardBucket,
  InteractiveClickBody,
  MessageOptionItem,
  OptionFlow,
} from './attendanceTypes';

// Port of cw-arqos `helper/comercial.js` (isBotoesEnabled / Comercial.botoes?): the new
// `automacoes_comerciais` setting governs when present; the legacy
// `custom_button_labels` flag is only a fallback when the setting is absent.
export const isCommercialInbox = (inbox: Inbox | null | undefined): boolean => {
  const ac = inbox?.automacoesComerciais;
  if (ac && 'enabled' in ac) {
    return ac.enabled === true && ac.botoes?.enabled === true;
  }
  return inbox?.customButtonLabels?.enabled === true;
};

export const DIRECT_DISCARD_PERMISSION = 'conversation_direct_discard';

// Same rule as the web client (useCustomRolePermissions.canDirectDiscard) and the server
// (attendance_actions_controller#direct_discard_allowed?): administrators and agents
// without a custom role discard directly; a custom role needs conversation_direct_discard.
export const canDirectDiscard = (
  user: User | null | undefined,
  accountId: number | null,
): boolean => {
  if (!user) return false;
  const account = getCurrentAccount(user, accountId);
  if (!account) return false;
  if (account.role === 'administrator') return true;
  if (!account.custom_role_id) return true;
  return getUserPermissions(user, accountId).includes(DIRECT_DISCARD_PERMISSION);
};

// Port of `helper/attendanceFlow.js` FRAME_FLOWS: a button's declared frame decides.
const FRAME_FLOWS: Record<string, OptionFlow> = {
  discard: 'discard',
  adiar_modal: 'adiar',
  ia_confirm: 'ia',
  enviar_msg_confirm: 'enviar_msg',
};

// Legacy fallback (INTERCEPT_ACTION_TYPES): buttons without a frame routed by value.
const LEGACY_VALUE_FLOWS: Record<string, OptionFlow> = {
  descartar: 'discard',
  adiar: 'adiar',
  mover_ia: 'ia',
  enviar_msg: 'enviar_msg',
};

const lookup = (map: Record<string, OptionFlow>, key: string): OptionFlow | undefined =>
  Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;

export type OptionFlowContext = {
  inbox: Inbox | null | undefined;
  message: Pick<Message, 'contentAttributes'> | null | undefined;
  conversation: { customAttributes?: Record<string, unknown> | null } | null | undefined;
};

// Port of OptionsBubble.vue `shouldInterceptClick` + buildAttendanceFlowPayload: only
// follow-up notes (followupExecutionId) in a commercial inbox are intercepted. A declared
// frame decides outright (unknown frame → direct); otherwise the legacy values open their
// flow, and legacy `aprovar` opens the discard request (suggest_discard) unless a discard
// was already suggested.
export const resolveOptionFlow = (
  item: MessageOptionItem,
  { inbox, message, conversation }: OptionFlowContext,
): OptionFlow => {
  if (!isCommercialInbox(inbox) || !message?.contentAttributes?.followupExecutionId) {
    return 'direct';
  }
  if (item.frame) return lookup(FRAME_FLOWS, item.frame) ?? 'direct';
  const legacy = lookup(LEGACY_VALUE_FLOWS, item.value);
  if (legacy) return legacy;
  if (item.value === 'aprovar' && !conversation?.customAttributes?.descarteSolicitado) {
    return 'discard_request_legacy';
  }
  return 'direct';
};

// Canonical discard motivos (ConversationWorkflow/attendanceMotivos.js). `value` is the
// pt-BR string persisted to the backend / CV; "Outro" sends the free text instead.
export const DISCARD_MOTIVOS = [
  { key: 'NAO_RESPONDE', value: 'Não responde' },
  { key: 'OUTRAS_METRAGENS', value: 'Deseja outras metragens' },
  { key: 'SEM_PERFIL_FINANCEIRO', value: 'Não tem perfil financeiro' },
  { key: 'SEM_INTERESSE_REGIAO', value: 'Não tem interesse na região' },
] as const;

/** Server minimum for the adiar motivo (AttendanceActionService::MOTIVO_MIN). */
export const ADIAR_MOTIVO_MIN = 5;

// Bodies mirror the web's ConversationApi.attendanceAction, which always sends the three
// keys (bucket/motivo null when unused).
export const buildDiscardBody = ({
  bucket,
  motivo,
  direct,
  suggest = false,
}: {
  bucket: DiscardBucket;
  motivo: string;
  direct: boolean;
  /** Legacy `aprovar` button flow (AttendanceFlowHost suggest_discard). */
  suggest?: boolean;
}): AttendanceActionBody => {
  let actionType: AttendanceActionBody['action_type'] = direct ? 'discard' : 'request_discard';
  if (suggest) actionType = 'suggest_discard';
  return { action_type: actionType, bucket, motivo };
};

export const buildAdiarBody = (motivo: string): AttendanceActionBody => ({
  action_type: 'vigia_adiar',
  bucket: null,
  motivo,
});

export const buildSwitchToIaBody = (): AttendanceActionBody => ({
  action_type: 'switch_to_ia',
  bucket: null,
  motivo: null,
});

// `frame_confirmed: true` marks a reply that passed through a frame (motivo/bucket
// captured); without it the engine blocks adiar/descartar answers.
export const buildClickBody = ({
  item,
  messageId,
  frameConfirmed = false,
}: {
  item: MessageOptionItem;
  messageId: number;
  frameConfirmed?: boolean;
}): InteractiveClickBody => {
  const body: InteractiveClickBody = {
    selected_option_label: item.title,
    selected_option_value: item.value,
    in_reply_to: messageId,
  };
  if (frameConfirmed) body.frame_confirmed = true;
  return body;
};
