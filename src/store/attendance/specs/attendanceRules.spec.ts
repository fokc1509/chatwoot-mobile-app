import type { User } from '@/types/User';
import type { Inbox } from '@/types/Inbox';
import type { Message } from '@/types/Message';
import {
  ADIAR_MOTIVO_MIN,
  DISCARD_MOTIVOS,
  buildAdiarBody,
  buildClickBody,
  buildDiscardBody,
  buildSwitchToIaBody,
  canDirectDiscard,
  isCommercialInbox,
  resolveOptionFlow,
} from '../attendanceRules';

jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));

const inboxWith = (fields: Record<string, unknown>) => ({ id: 1, ...fields }) as unknown as Inbox;

describe('isCommercialInbox', () => {
  it('is true when automacoesComerciais and botoes are enabled', () => {
    expect(
      isCommercialInbox(
        inboxWith({ automacoesComerciais: { enabled: true, botoes: { enabled: true } } }),
      ),
    ).toBe(true);
  });

  it('is false when automacoesComerciais is enabled but botoes is not', () => {
    expect(
      isCommercialInbox(
        inboxWith({ automacoesComerciais: { enabled: true, botoes: { enabled: false } } }),
      ),
    ).toBe(false);
    expect(isCommercialInbox(inboxWith({ automacoesComerciais: { enabled: true } }))).toBe(false);
  });

  it('the new setting governs when present, ignoring the legacy flag', () => {
    expect(
      isCommercialInbox(
        inboxWith({
          automacoesComerciais: { enabled: false, botoes: { enabled: true } },
          customButtonLabels: { enabled: true },
        }),
      ),
    ).toBe(false);
  });

  it('falls back to customButtonLabels.enabled when the setting is absent', () => {
    expect(isCommercialInbox(inboxWith({ customButtonLabels: { enabled: true } }))).toBe(true);
    expect(
      isCommercialInbox(
        inboxWith({ automacoesComerciais: {}, customButtonLabels: { enabled: true } }),
      ),
    ).toBe(true);
    expect(isCommercialInbox(inboxWith({ customButtonLabels: { enabled: false } }))).toBe(false);
  });

  it('is false without the fields or without an inbox', () => {
    expect(isCommercialInbox(inboxWith({}))).toBe(false);
    expect(isCommercialInbox(undefined)).toBe(false);
    expect(isCommercialInbox(null)).toBe(false);
  });
});

describe('canDirectDiscard', () => {
  const userWith = (account: Record<string, unknown> | null): User =>
    ({
      id: 9,
      account_id: 7,
      role: 'agent',
      accounts: account ? [{ id: 7, permissions: [], role: 'agent', ...account }] : [],
    }) as unknown as User;

  it('administrator discards directly (even with a custom role)', () => {
    expect(canDirectDiscard(userWith({ role: 'administrator', custom_role_id: '3' }), 7)).toBe(
      true,
    );
  });

  it('agent without custom role discards directly', () => {
    expect(canDirectDiscard(userWith({ role: 'agent' }), 7)).toBe(true);
  });

  it('custom role with conversation_direct_discard discards directly', () => {
    expect(
      canDirectDiscard(
        userWith({
          role: 'agent',
          custom_role_id: '3',
          permissions: ['conversation_manage', 'conversation_direct_discard'],
        }),
        7,
      ),
    ).toBe(true);
  });

  it('custom role without conversation_direct_discard must request', () => {
    expect(
      canDirectDiscard(
        userWith({ role: 'agent', custom_role_id: '3', permissions: ['conversation_manage'] }),
        7,
      ),
    ).toBe(false);
  });

  it('is false without the account or user', () => {
    expect(canDirectDiscard(userWith(null), 7)).toBe(false);
    expect(canDirectDiscard(null, 7)).toBe(false);
  });
});

describe('resolveOptionFlow', () => {
  const commercial = inboxWith({
    automacoesComerciais: { enabled: true, botoes: { enabled: true } },
  });
  const followupMessage = {
    id: 55,
    contentAttributes: { followupExecutionId: 12, stepId: 3 },
  } as unknown as Message;
  const ctx = { inbox: commercial, message: followupMessage, conversation: null };

  it.each([
    ['discard', 'discard'],
    ['adiar_modal', 'adiar'],
    ['ia_confirm', 'ia'],
    ['enviar_msg_confirm', 'enviar_msg'],
  ])('frame %s → %s', (frame, flow) => {
    expect(resolveOptionFlow({ title: 'X', value: 'qualquer', frame }, ctx)).toBe(flow);
  });

  it('a declared frame wins over a legacy value', () => {
    expect(resolveOptionFlow({ title: 'X', value: 'descartar', frame: 'ia_confirm' }, ctx)).toBe(
      'ia',
    );
  });

  it('an unknown frame posts directly', () => {
    expect(resolveOptionFlow({ title: 'X', value: 'descartar', frame: 'outro' }, ctx)).toBe(
      'direct',
    );
  });

  it.each([
    ['descartar', 'discard'],
    ['adiar', 'adiar'],
    ['mover_ia', 'ia'],
    ['enviar_msg', 'enviar_msg'],
  ])('legacy value %s → %s', (value, flow) => {
    expect(resolveOptionFlow({ title: 'X', value }, ctx)).toBe(flow);
  });

  it('legacy aprovar without descarteSolicitado → discard_request_legacy', () => {
    expect(resolveOptionFlow({ title: 'Aprovar', value: 'aprovar' }, ctx)).toBe(
      'discard_request_legacy',
    );
    expect(
      resolveOptionFlow(
        { title: 'Aprovar', value: 'aprovar' },
        { ...ctx, conversation: { customAttributes: {} } },
      ),
    ).toBe('discard_request_legacy');
  });

  it('legacy aprovar with descarteSolicitado posts directly', () => {
    expect(
      resolveOptionFlow(
        { title: 'Aprovar', value: 'aprovar' },
        {
          ...ctx,
          conversation: {
            customAttributes: { descarteSolicitado: { bucket: 'descartado', motivo: 'x' } },
          },
        },
      ),
    ).toBe('direct');
  });

  it('a plain value without frame posts directly', () => {
    expect(resolveOptionFlow({ title: 'Sim', value: 'sim' }, ctx)).toBe('direct');
  });

  it('outside a commercial inbox everything posts directly', () => {
    const plain = { ...ctx, inbox: inboxWith({}) };
    expect(resolveOptionFlow({ title: 'X', value: 'x', frame: 'discard' }, plain)).toBe('direct');
    expect(resolveOptionFlow({ title: 'X', value: 'descartar' }, plain)).toBe('direct');
    expect(resolveOptionFlow({ title: 'X', value: 'aprovar' }, plain)).toBe('direct');
  });

  it('without followupExecutionId everything posts directly', () => {
    const noFollowup = {
      ...ctx,
      message: { id: 55, contentAttributes: {} } as unknown as Message,
    };
    expect(resolveOptionFlow({ title: 'X', value: 'x', frame: 'discard' }, noFollowup)).toBe(
      'direct',
    );
    expect(resolveOptionFlow({ title: 'X', value: 'adiar' }, noFollowup)).toBe('direct');
    expect(
      resolveOptionFlow(
        { title: 'X', value: 'adiar' },
        { ...ctx, message: { id: 55, contentAttributes: null } as unknown as Message },
      ),
    ).toBe('direct');
  });
});

describe('DISCARD_MOTIVOS', () => {
  it('lists the four web motivos with identical texts', () => {
    expect(DISCARD_MOTIVOS.map(m => m.value)).toEqual([
      'Não responde',
      'Deseja outras metragens',
      'Não tem perfil financeiro',
      'Não tem interesse na região',
    ]);
  });

  it('ADIAR_MOTIVO_MIN mirrors the server minimum', () => {
    expect(ADIAR_MOTIVO_MIN).toBe(5);
  });
});

describe('body builders', () => {
  it('buildDiscardBody direct → discard', () => {
    expect(
      buildDiscardBody({ bucket: 'reativacao', motivo: 'Não responde', direct: true }),
    ).toEqual({ action_type: 'discard', bucket: 'reativacao', motivo: 'Não responde' });
  });

  it('buildDiscardBody not direct → request_discard', () => {
    expect(
      buildDiscardBody({ bucket: 'descartado', motivo: 'Outro texto', direct: false }),
    ).toEqual({ action_type: 'request_discard', bucket: 'descartado', motivo: 'Outro texto' });
  });

  it('buildDiscardBody suggest → suggest_discard (legacy aprovar)', () => {
    expect(
      buildDiscardBody({ bucket: 'descartado', motivo: 'x', direct: true, suggest: true }),
    ).toEqual({ action_type: 'suggest_discard', bucket: 'descartado', motivo: 'x' });
  });

  it('buildAdiarBody → vigia_adiar with motivo (bucket null like the web)', () => {
    expect(buildAdiarBody('cliente viajando')).toEqual({
      action_type: 'vigia_adiar',
      bucket: null,
      motivo: 'cliente viajando',
    });
  });

  it('buildSwitchToIaBody → switch_to_ia without parameters', () => {
    expect(buildSwitchToIaBody()).toEqual({
      action_type: 'switch_to_ia',
      bucket: null,
      motivo: null,
    });
  });

  it('buildClickBody without frame confirmation', () => {
    expect(
      buildClickBody({
        item: { title: 'Sim', value: 'sim' },
        messageId: 55,
        frameConfirmed: false,
      }),
    ).toEqual({ selected_option_label: 'Sim', selected_option_value: 'sim', in_reply_to: 55 });
    expect(
      buildClickBody({ item: { title: 'Sim', value: 'sim' }, messageId: 55 }),
    ).not.toHaveProperty('frame_confirmed');
  });

  it('buildClickBody with frame confirmation', () => {
    expect(
      buildClickBody({
        item: { title: 'Descartar', value: 'descartar', frame: 'discard' },
        messageId: 55,
        frameConfirmed: true,
      }),
    ).toEqual({
      selected_option_label: 'Descartar',
      selected_option_value: 'descartar',
      in_reply_to: 55,
      frame_confirmed: true,
    });
  });
});
