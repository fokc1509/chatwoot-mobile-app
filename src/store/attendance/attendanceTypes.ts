// Types for the Arqos attendance flow (follow-up buttons, Descartar/Adiar/Mover p/ IA,
// approvals). Request bodies and the status response are snake_case on the wire and are
// used raw — never camelCased (only messages/inboxes/conversations are).

/** One button of a follow-up `input_select` note (camelCased message content). */
export type MessageOptionItem = {
  title: string;
  value: string;
  /** Declared behavior: discard | adiar_modal | ia_confirm | enviar_msg_confirm. */
  frame?: string;
};

/** Which flow a tapped option opens (`direct` = post the click as-is). */
export type OptionFlow =
  | 'direct'
  | 'discard'
  | 'adiar'
  | 'ia'
  | 'enviar_msg'
  | 'discard_request_legacy';

export type DiscardBucket = 'reativacao' | 'descartado';

export type AttendanceActionType =
  | 'discard'
  | 'request_discard'
  | 'suggest_discard'
  | 'switch_to_ia'
  | 'vigia_adiar';

/** Body of POST conversations/:id/attendance_action (same keys the web sends). */
export type AttendanceActionBody = {
  action_type: AttendanceActionType;
  bucket: DiscardBucket | null;
  motivo: string | null;
};

/** Body of POST conversations/:id/interactive_messages. */
export type InteractiveClickBody = {
  selected_option_label: string;
  selected_option_value: string;
  in_reply_to: number;
  frame_confirmed?: true;
};

export type AttendanceApprovalOption = { label: string; value: string };

export type AttendanceApprovalContext = {
  motivo?: string;
  bucket?: string;
  solicitante?: string;
  streak?: number;
  origem?: string;
  solicitado_em?: string;
};

/** Raw response of GET conversations/:id/attendance_action/status (snake_case). */
export type AttendanceStatus =
  | { estado: 'aguardando_acao' }
  | { estado: 'countdown'; deadline_at: string }
  | { estado: 'sem_cobranca'; motivo: string }
  | {
      estado: 'aprovacao_pendente';
      tipo: 'adiamento' | 'devolucao_ia' | 'descarte';
      pode_aprovar: boolean;
      message_id: number;
      opcoes: AttendanceApprovalOption[];
      contexto: AttendanceApprovalContext;
    };
