import I18n from '@/i18n';
import { narrowAttendanceError } from '@/store/attendance/attendanceActions';
import {
  ADIAR_MOTIVO_MIN,
  DISCARD_MOTIVOS,
  buildAdiarBody,
  buildDiscardBody,
  buildSwitchToIaBody,
} from '@/store/attendance/attendanceRules';
import type {
  AttendanceActionBody,
  DiscardBucket,
  MessageOptionItem,
  OptionFlow,
} from '@/store/attendance/attendanceTypes';

// Pure logic of the attendance flow host (port of cw-arqos AttendanceFlowHost.vue,
// AttendanceDiscardModal.vue and AttendanceAdiarModal.vue). The components only render
// this state and wire it to Redux.

/** A flow the host can open (`direct` clicks never reach it). */
export type AttendanceFlow = Exclude<OptionFlow, 'direct'>;

export interface AttendanceFlowContext {
  conversationId: number;
  /** Set when the flow came from a follow-up button: replayed after the action. */
  replayClick?: { item: MessageOptionItem; messageId: number };
}

// ---- Discard form (two steps: bucket, then motivo) ----

export type DiscardMotivoKey = (typeof DISCARD_MOTIVOS)[number]['key'] | 'OUTRO';

export interface DiscardFormState {
  step: 1 | 2;
  bucket: DiscardBucket | null;
  motivoKey: DiscardMotivoKey | null;
  outroText: string;
}

export const INITIAL_DISCARD_FORM: DiscardFormState = {
  step: 1,
  bucket: null,
  motivoKey: null,
  outroText: '',
};

export const DISCARD_MOTIVO_KEYS: DiscardMotivoKey[] = [
  ...DISCARD_MOTIVOS.map(m => m.key),
  'OUTRO',
];

// Re-picking a bucket restarts step 2 clean (web: a leftover motivo must not leak).
export const discardPickBucket = (
  state: DiscardFormState,
  bucket: DiscardBucket,
): DiscardFormState => ({ ...state, step: 2, bucket, motivoKey: null, outroText: '' });

export const discardGoBack = (state: DiscardFormState): DiscardFormState => ({
  ...state,
  step: 1,
});

/** Canonical pt-BR value, or the trimmed free text for "Outro" (never a sentinel). */
export const resolveDiscardMotivo = (state: DiscardFormState): string | null => {
  if (!state.motivoKey) return null;
  if (state.motivoKey === 'OUTRO') return state.outroText.trim() || null;
  return DISCARD_MOTIVOS.find(m => m.key === state.motivoKey)?.value ?? null;
};

export const discardStepValid = (step: 1 | 2, state: DiscardFormState): boolean => {
  if (step === 1) return state.bucket !== null;
  return state.bucket !== null && resolveDiscardMotivo(state) !== null;
};

/** Request copy when the user cannot discard directly, and on the legacy `aprovar` path. */
export const isDiscardRequestMode = (flow: AttendanceFlow, canDirect: boolean): boolean =>
  flow === 'discard_request_legacy' || !canDirect;

// ---- Adiar ----

export const adiarValid = (motivo: string): boolean => motivo.trim().length >= ADIAR_MOTIVO_MIN;

// ---- Submit ----

export interface FlowInput {
  discard?: DiscardFormState;
  adiarMotivo?: string;
}

const isDiscardFlow = (flow: AttendanceFlow) =>
  flow === 'discard' || flow === 'discard_request_legacy';

export const flowInputValid = (flow: AttendanceFlow, input: FlowInput): boolean => {
  if (isDiscardFlow(flow)) {
    return !!input.discard && input.discard.step === 2 && discardStepValid(2, input.discard);
  }
  if (flow === 'adiar') return adiarValid(input.adiarMotivo ?? '');
  return true;
};

/** Body for attendance_action; null for `enviar_msg`, which only replays the click. */
export const flowActionBody = (
  flow: AttendanceFlow,
  input: FlowInput,
  canDirect: boolean,
): AttendanceActionBody | null => {
  switch (flow) {
    case 'discard':
    case 'discard_request_legacy': {
      const form = input.discard ?? INITIAL_DISCARD_FORM;
      return buildDiscardBody({
        bucket: form.bucket as DiscardBucket,
        motivo: resolveDiscardMotivo(form) ?? '',
        direct: canDirect,
        suggest: flow === 'discard_request_legacy',
      });
    }
    case 'adiar':
      return buildAdiarBody((input.adiarMotivo ?? '').trim());
    case 'ia':
      return buildSwitchToIaBody();
    case 'enviar_msg':
      return null;
  }
};

const SUCCESS_KEYS: Record<string, string> = {
  discard: 'ATTENDANCE.DISCARD_MODAL.SUCCESS',
  request_discard: 'ATTENDANCE.DISCARD_MODAL.REQUEST_SUCCESS',
  suggest_discard: 'ATTENDANCE.DISCARD_MODAL.SUGGEST_SUCCESS',
  switch_to_ia: 'ATTENDANCE.IA_CONFIRM.SUCCESS',
  vigia_adiar: 'ATTENDANCE.ADIAR_MODAL.SUCCESS',
  enviar_msg: 'ATTENDANCE.ENVIAR_MSG_CONFIRM.SUCCESS',
};

export const successMessageKey = (
  flow: AttendanceFlow,
  body: AttendanceActionBody | null,
): string => SUCCESS_KEYS[body?.action_type ?? flow] ?? SUCCESS_KEYS.enviar_msg;

// ---- Session (which flow is open, in-flight guard, inline error) ----

export interface FlowSession {
  active: { flow: AttendanceFlow; ctx: AttendanceFlowContext; requestMode: boolean } | null;
  submitting: boolean;
  /** Inline error (adiar modal); other flows report through a toast. */
  error: string | null;
}

export const INITIAL_FLOW_SESSION: FlowSession = { active: null, submitting: false, error: null };

export interface FlowOutcome {
  close: boolean;
  toast: string | null;
  inlineError: string | null;
}

export type FlowSessionAction =
  | { type: 'open'; flow: AttendanceFlow; ctx: AttendanceFlowContext; canDirect: boolean }
  | { type: 'cancel' }
  | { type: 'submit' }
  | { type: 'finish'; outcome: FlowOutcome }
  | { type: 'clearError' };

export const flowSessionReducer = (state: FlowSession, action: FlowSessionAction): FlowSession => {
  switch (action.type) {
    case 'open':
      // One flow at a time: a re-open must not swap the ctx under a filled form.
      if (state.active) return state;
      return {
        active: {
          flow: action.flow,
          ctx: action.ctx,
          requestMode: isDiscardRequestMode(action.flow, action.canDirect),
        },
        submitting: false,
        error: null,
      };
    case 'cancel':
      return state.submitting ? state : INITIAL_FLOW_SESSION;
    case 'submit':
      if (!state.active || state.submitting) return state;
      return { ...state, submitting: true, error: null };
    case 'finish':
      if (action.outcome.close) return INITIAL_FLOW_SESSION;
      return { ...state, submitting: false, error: action.outcome.inlineError };
    case 'clearError':
      return state.error ? { ...state, error: null } : state;
  }
};

export interface FlowDeps {
  runAction: (conversationId: number, body: AttendanceActionBody) => Promise<unknown>;
  clickOption: (payload: {
    conversationId: number;
    item: MessageOptionItem;
    messageId: number;
    frameConfirmed: true;
  }) => Promise<unknown>;
}

export type FlowResult =
  | { status: 'success'; messageKey: string }
  | { status: 'error'; code?: string; message: string }
  | { status: 'invalid' };

// Thunk rejections carry an AttendanceError; anything else is the generic error.
const toFlowError = (error: unknown): FlowResult => ({
  status: 'error',
  ...narrowAttendanceError(error),
});

/**
 * Runs a confirmed flow (AttendanceFlowHost runAction / runInteractiveReplyOnly):
 * attendance_action (except enviar_msg) → replay of the follow-up click with
 * frame_confirmed. Returns null — sending nothing — when no flow is open (cancelled)
 * or one is already in flight. Call it with the session from before `submit`.
 */
export const submitFlow = async (
  deps: FlowDeps,
  session: FlowSession,
  input: FlowInput,
): Promise<FlowResult | null> => {
  if (!session.active || session.submitting) return null;
  const { flow, ctx, requestMode } = session.active;
  if (!flowInputValid(flow, input)) return { status: 'invalid' };
  // requestMode already folds in canDirect for discard (legacy is always suggest).
  const body = flowActionBody(flow, input, !requestMode);
  try {
    if (body) await deps.runAction(ctx.conversationId, body);
    if (ctx.replayClick) {
      await deps.clickOption({
        conversationId: ctx.conversationId,
        item: ctx.replayClick.item,
        messageId: ctx.replayClick.messageId,
        frameConfirmed: true,
      });
    }
  } catch (error) {
    return toFlowError(error);
  }
  return { status: 'success', messageKey: successMessageKey(flow, body) };
};

/**
 * What the host does with a result. Adiar keeps the modal open on any error so the
 * agent keeps the text (web onAdiarSubmit); MOTIVO_REQUIRED shows the fixed copy. The
 * other flows close and toast, as the web closes those dialogs before the request.
 */
export const flowOutcome = (flow: AttendanceFlow, result: FlowResult): FlowOutcome => {
  if (result.status === 'success') {
    return { close: true, toast: I18n.t(result.messageKey), inlineError: null };
  }
  if (result.status === 'invalid') return { close: false, toast: null, inlineError: null };
  if (flow === 'adiar') {
    const inlineError =
      result.code === 'MOTIVO_REQUIRED'
        ? I18n.t('ATTENDANCE.ADIAR_MODAL.MOTIVO_REQUIRED')
        : result.message;
    return { close: false, toast: null, inlineError };
  }
  return { close: true, toast: result.message, inlineError: null };
};
