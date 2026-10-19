import type { MessageOptionItem } from '@/store/attendance/attendanceTypes';
import {
  INITIAL_DISCARD_FORM,
  INITIAL_FLOW_SESSION,
  adiarValid,
  discardGoBack,
  discardPickBucket,
  discardStepValid,
  flowActionBody,
  flowInputValid,
  flowOutcome,
  flowSessionReducer,
  isDiscardRequestMode,
  resolveDiscardMotivo,
  submitFlow,
  successMessageKey,
  type AttendanceFlow,
  type AttendanceFlowContext,
  type DiscardFormState,
  type FlowDeps,
  type FlowSession,
} from '../attendanceFlowViewModel';

jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));
jest.mock('@/i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));

const item: MessageOptionItem = { title: 'Adiar', value: 'adiar', frame: 'adiar_modal' };

const makeDeps = (
  overrides: Partial<FlowDeps> = {},
): FlowDeps & {
  runAction: jest.Mock;
  clickOption: jest.Mock;
} =>
  ({
    runAction: jest.fn().mockResolvedValue(undefined),
    clickOption: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as FlowDeps & { runAction: jest.Mock; clickOption: jest.Mock };

const openSession = (
  flow: AttendanceFlow,
  ctx: AttendanceFlowContext = { conversationId: 7 },
  canDirect = true,
): FlowSession => flowSessionReducer(INITIAL_FLOW_SESSION, { type: 'open', flow, ctx, canDirect });

const discardForm = (overrides: Partial<DiscardFormState> = {}): DiscardFormState => ({
  ...INITIAL_DISCARD_FORM,
  step: 2,
  bucket: 'descartado',
  motivoKey: 'NAO_RESPONDE',
  ...overrides,
});

describe('discard form', () => {
  it('step 1 needs a bucket', () => {
    expect(discardStepValid(1, INITIAL_DISCARD_FORM)).toBe(false);
    expect(discardStepValid(1, { ...INITIAL_DISCARD_FORM, bucket: 'reativacao' })).toBe(true);
  });

  it('step 2 needs a motivo', () => {
    expect(discardStepValid(2, discardForm({ motivoKey: null }))).toBe(false);
    expect(discardStepValid(2, discardForm())).toBe(true);
  });

  it('"Outro" requires non-blank text', () => {
    expect(discardStepValid(2, discardForm({ motivoKey: 'OUTRO', outroText: '' }))).toBe(false);
    expect(discardStepValid(2, discardForm({ motivoKey: 'OUTRO', outroText: '   ' }))).toBe(false);
    expect(discardStepValid(2, discardForm({ motivoKey: 'OUTRO', outroText: 'x' }))).toBe(true);
  });

  it('resolves the canonical pt-BR value, or the trimmed "Outro" text', () => {
    expect(resolveDiscardMotivo(discardForm({ motivoKey: 'SEM_INTERESSE_REGIAO' }))).toBe(
      'Não tem interesse na região',
    );
    expect(
      resolveDiscardMotivo(discardForm({ motivoKey: 'OUTRO', outroText: '  mudou de cidade ' })),
    ).toBe('mudou de cidade');
    expect(resolveDiscardMotivo(discardForm({ motivoKey: null }))).toBeNull();
  });

  it('picking a bucket goes to step 2 with a clean motivo', () => {
    const next = discardPickBucket(
      discardForm({ motivoKey: 'OUTRO', outroText: 'antigo', bucket: 'descartado' }),
      'reativacao',
    );
    expect(next).toEqual({ step: 2, bucket: 'reativacao', motivoKey: null, outroText: '' });
  });

  it('going back returns to step 1 keeping the bucket', () => {
    expect(discardGoBack(discardForm())).toEqual({ ...discardForm(), step: 1 });
  });
});

describe('adiarValid', () => {
  it('requires at least 5 characters after trim', () => {
    expect(adiarValid('abcd')).toBe(false);
    expect(adiarValid('  abcd   ')).toBe(false);
    expect(adiarValid('abcde')).toBe(true);
    expect(adiarValid('')).toBe(false);
  });
});

describe('isDiscardRequestMode', () => {
  it('is request mode without direct permission or on the legacy flow', () => {
    expect(isDiscardRequestMode('discard', true)).toBe(false);
    expect(isDiscardRequestMode('discard', false)).toBe(true);
    expect(isDiscardRequestMode('discard_request_legacy', true)).toBe(true);
  });
});

describe('flowActionBody', () => {
  it('discard with direct permission sends discard', () => {
    expect(flowActionBody('discard', { discard: discardForm() }, true)).toEqual({
      action_type: 'discard',
      bucket: 'descartado',
      motivo: 'Não responde',
    });
  });

  it('discard without direct permission sends request_discard', () => {
    expect(flowActionBody('discard', { discard: discardForm() }, false)).toEqual({
      action_type: 'request_discard',
      bucket: 'descartado',
      motivo: 'Não responde',
    });
  });

  it('discard_request_legacy sends suggest_discard regardless of permission', () => {
    for (const canDirect of [true, false]) {
      expect(
        flowActionBody(
          'discard_request_legacy',
          { discard: discardForm({ motivoKey: 'OUTRO', outroText: ' caro ' }) },
          canDirect,
        ),
      ).toEqual({ action_type: 'suggest_discard', bucket: 'descartado', motivo: 'caro' });
    }
  });

  it('adiar sends vigia_adiar with the trimmed motivo', () => {
    expect(flowActionBody('adiar', { adiarMotivo: '  depois do dia 15 ' }, true)).toEqual({
      action_type: 'vigia_adiar',
      bucket: null,
      motivo: 'depois do dia 15',
    });
  });

  it('ia sends switch_to_ia; enviar_msg sends no action', () => {
    expect(flowActionBody('ia', {}, true)).toEqual({
      action_type: 'switch_to_ia',
      bucket: null,
      motivo: null,
    });
    expect(flowActionBody('enviar_msg', {}, true)).toBeNull();
  });
});

describe('flowInputValid', () => {
  it('validates per flow', () => {
    expect(flowInputValid('discard', {})).toBe(false);
    expect(flowInputValid('discard', { discard: discardForm({ step: 1 }) })).toBe(false);
    expect(flowInputValid('discard', { discard: discardForm() })).toBe(true);
    expect(flowInputValid('adiar', { adiarMotivo: 'abcd' })).toBe(false);
    expect(flowInputValid('adiar', { adiarMotivo: 'abcde' })).toBe(true);
    expect(flowInputValid('ia', {})).toBe(true);
    expect(flowInputValid('enviar_msg', {})).toBe(true);
  });
});

describe('successMessageKey', () => {
  it('maps the resolved action to the web success copy', () => {
    const key = (flow: AttendanceFlow, canDirect = true) =>
      successMessageKey(
        flow,
        flowActionBody(flow, { discard: discardForm(), adiarMotivo: 'abcde' }, canDirect),
      );
    expect(key('discard')).toBe('ATTENDANCE.DISCARD_MODAL.SUCCESS');
    expect(key('discard', false)).toBe('ATTENDANCE.DISCARD_MODAL.REQUEST_SUCCESS');
    expect(key('discard_request_legacy')).toBe('ATTENDANCE.DISCARD_MODAL.SUGGEST_SUCCESS');
    expect(key('adiar')).toBe('ATTENDANCE.ADIAR_MODAL.SUCCESS');
    expect(key('ia')).toBe('ATTENDANCE.IA_CONFIRM.SUCCESS');
    expect(key('enviar_msg')).toBe('ATTENDANCE.ENVIAR_MSG_CONFIRM.SUCCESS');
  });
});

describe('flowSessionReducer', () => {
  it('open stores the flow, context and request mode', () => {
    const session = openSession('discard', { conversationId: 3 }, false);
    expect(session).toEqual({
      active: { flow: 'discard', ctx: { conversationId: 3 }, requestMode: true },
      submitting: false,
      error: null,
    });
  });

  it('cancel clears the session', () => {
    expect(flowSessionReducer(openSession('ia'), { type: 'cancel' })).toEqual(INITIAL_FLOW_SESSION);
  });

  it('cancel and open are ignored while submitting', () => {
    const submitting = flowSessionReducer(openSession('adiar'), { type: 'submit' });
    expect(submitting.submitting).toBe(true);
    expect(flowSessionReducer(submitting, { type: 'cancel' })).toBe(submitting);
    expect(
      flowSessionReducer(submitting, {
        type: 'open',
        flow: 'ia',
        ctx: { conversationId: 9 },
        canDirect: true,
      }),
    ).toBe(submitting);
  });

  it('open is ignored while another flow is active', () => {
    const active = openSession('discard', { conversationId: 3 });
    expect(
      flowSessionReducer(active, {
        type: 'open',
        flow: 'ia',
        ctx: { conversationId: 9 },
        canDirect: true,
      }),
    ).toBe(active);
  });

  it('submit is a no-op without an active flow or while one is in flight', () => {
    expect(flowSessionReducer(INITIAL_FLOW_SESSION, { type: 'submit' })).toBe(INITIAL_FLOW_SESSION);
    const submitting = flowSessionReducer(openSession('ia'), { type: 'submit' });
    expect(flowSessionReducer(submitting, { type: 'submit' })).toBe(submitting);
  });

  it('finish closes or keeps the flow with an inline error', () => {
    const submitting = flowSessionReducer(openSession('adiar'), { type: 'submit' });
    expect(
      flowSessionReducer(submitting, {
        type: 'finish',
        outcome: { close: true, toast: 'ok', inlineError: null },
      }),
    ).toEqual(INITIAL_FLOW_SESSION);
    expect(
      flowSessionReducer(submitting, {
        type: 'finish',
        outcome: { close: false, toast: null, inlineError: 'curto' },
      }),
    ).toEqual({ ...submitting, submitting: false, error: 'curto' });
  });

  it('clearError drops the inline error', () => {
    const withError = { ...openSession('adiar'), error: 'x' };
    expect(flowSessionReducer(withError, { type: 'clearError' }).error).toBeNull();
  });
});

describe('submitFlow', () => {
  it('cancel at any step sends nothing', async () => {
    const flows: AttendanceFlow[] = [
      'discard',
      'adiar',
      'ia',
      'enviar_msg',
      'discard_request_legacy',
    ];
    for (const flow of flows) {
      const deps = makeDeps();
      const cancelled = flowSessionReducer(
        openSession(flow, { conversationId: 7, replayClick: { item, messageId: 1 } }),
        { type: 'cancel' },
      );
      const result = await submitFlow(deps, cancelled, {
        discard: discardForm(),
        adiarMotivo: 'abcde',
      });
      expect(result).toBeNull();
      expect(deps.runAction).not.toHaveBeenCalled();
      expect(deps.clickOption).not.toHaveBeenCalled();
    }
  });

  it('does nothing while a submit is already in flight', async () => {
    const deps = makeDeps();
    const submitting = flowSessionReducer(openSession('ia'), { type: 'submit' });
    expect(await submitFlow(deps, submitting, {})).toBeNull();
    expect(deps.runAction).not.toHaveBeenCalled();
  });

  it('invalid input sends nothing', async () => {
    const deps = makeDeps();
    expect(await submitFlow(deps, openSession('adiar'), { adiarMotivo: 'abcd' })).toEqual({
      status: 'invalid',
    });
    expect(
      await submitFlow(deps, openSession('discard'), {
        discard: discardForm({ motivoKey: 'OUTRO', outroText: ' ' }),
      }),
    ).toEqual({ status: 'invalid' });
    expect(deps.runAction).not.toHaveBeenCalled();
    expect(deps.clickOption).not.toHaveBeenCalled();
  });

  it('runs the action then replays the click with frameConfirmed', async () => {
    const calls: string[] = [];
    const deps = makeDeps({
      runAction: jest.fn(async () => {
        calls.push('action');
      }),
      clickOption: jest.fn(async () => {
        calls.push('click');
      }),
    });
    const session = openSession('adiar', {
      conversationId: 7,
      replayClick: { item, messageId: 55 },
    });
    const result = await submitFlow(deps, session, { adiarMotivo: ' retomar dia 15 ' });
    expect(calls).toEqual(['action', 'click']);
    expect(deps.runAction).toHaveBeenCalledWith(7, {
      action_type: 'vigia_adiar',
      bucket: null,
      motivo: 'retomar dia 15',
    });
    expect(deps.clickOption).toHaveBeenCalledWith({
      conversationId: 7,
      item,
      messageId: 55,
      frameConfirmed: true,
    });
    expect(result).toEqual({ status: 'success', messageKey: 'ATTENDANCE.ADIAR_MODAL.SUCCESS' });
  });

  it('without replayClick only the action runs', async () => {
    const deps = makeDeps();
    const result = await submitFlow(deps, openSession('discard', { conversationId: 7 }, false), {
      discard: discardForm(),
    });
    expect(deps.runAction).toHaveBeenCalledWith(7, {
      action_type: 'request_discard',
      bucket: 'descartado',
      motivo: 'Não responde',
    });
    expect(deps.clickOption).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 'success',
      messageKey: 'ATTENDANCE.DISCARD_MODAL.REQUEST_SUCCESS',
    });
  });

  it('enviar_msg only replays the click (no attendance action)', async () => {
    const deps = makeDeps();
    const sendItem = { title: 'Enviar msg', value: 'enviar_msg' };
    const result = await submitFlow(
      deps,
      openSession('enviar_msg', {
        conversationId: 7,
        replayClick: { item: sendItem, messageId: 2 },
      }),
      {},
    );
    expect(deps.runAction).not.toHaveBeenCalled();
    expect(deps.clickOption).toHaveBeenCalledWith({
      conversationId: 7,
      item: sendItem,
      messageId: 2,
      frameConfirmed: true,
    });
    expect(result).toEqual({
      status: 'success',
      messageKey: 'ATTENDANCE.ENVIAR_MSG_CONFIRM.SUCCESS',
    });
  });

  it('a failed action skips the replay and returns the error', async () => {
    const deps = makeDeps({
      runAction: jest.fn().mockRejectedValue({ code: 'MOTIVO_REQUIRED', message: 'curto' }),
    });
    const result = await submitFlow(
      deps,
      openSession('adiar', { conversationId: 7, replayClick: { item, messageId: 1 } }),
      { adiarMotivo: 'abcde' },
    );
    expect(deps.clickOption).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'error', code: 'MOTIVO_REQUIRED', message: 'curto' });
  });

  it('an unexpected rejection falls back to the generic error', async () => {
    const deps = makeDeps({ runAction: jest.fn().mockRejectedValue(new Error('boom')) });
    expect(await submitFlow(deps, openSession('ia'), {})).toEqual({
      status: 'error',
      message: 'ATTENDANCE.ERROR',
    });
  });

  it('a serialized thunk crash also falls back to the generic error', async () => {
    const deps = makeDeps({
      runAction: jest.fn().mockRejectedValue({ name: 'TypeError', message: 'x is undefined' }),
    });
    expect(await submitFlow(deps, openSession('ia'), {})).toEqual({
      status: 'error',
      message: 'ATTENDANCE.ERROR',
    });
  });
});

describe('flowOutcome', () => {
  it('success closes and toasts the translated message', () => {
    expect(
      flowOutcome('discard', { status: 'success', messageKey: 'ATTENDANCE.DISCARD_MODAL.SUCCESS' }),
    ).toEqual({ close: true, toast: 'ATTENDANCE.DISCARD_MODAL.SUCCESS', inlineError: null });
  });

  it('adiar errors stay in the modal (MOTIVO_REQUIRED inline)', () => {
    expect(
      flowOutcome('adiar', { status: 'error', code: 'MOTIVO_REQUIRED', message: 'server' }),
    ).toEqual({ close: false, toast: null, inlineError: 'ATTENDANCE.ADIAR_MODAL.MOTIVO_REQUIRED' });
    expect(flowOutcome('adiar', { status: 'error', message: 'Sem permissão' })).toEqual({
      close: false,
      toast: null,
      inlineError: 'Sem permissão',
    });
  });

  it('other flows close and toast the error', () => {
    for (const flow of ['discard', 'ia', 'enviar_msg', 'discard_request_legacy'] as const) {
      expect(flowOutcome(flow, { status: 'error', message: 'Sem permissão' })).toEqual({
        close: true,
        toast: 'Sem permissão',
        inlineError: null,
      });
    }
  });

  it('invalid input keeps the modal open silently', () => {
    expect(flowOutcome('adiar', { status: 'invalid' })).toEqual({
      close: false,
      toast: null,
      inlineError: null,
    });
  });
});
