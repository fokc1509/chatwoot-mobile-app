import {
  applyVariables,
  buildSendPayload,
  canSend,
  describeTemplate,
  formatTemplateBody,
  initialFormValues,
  reconcileFilter,
  sendTemplateParams,
  senderFromUser,
  variableInputMode,
} from '../metaTemplateViewModel';
import { normalizeTemplateRow } from '@/store/meta-template/metaTemplateNormalize';
import {
  buildTemplateParams,
  parseButtonParams,
  parseHeader,
  parseTemplateVariables,
} from '@/store/meta-template/metaTemplateVariables';
import { buildWabaTemplatePayload } from '@/store/meta-template/metaTemplatePayload';
import type { MetaTemplate, TemplateVariable } from '@/store/meta-template/metaTemplateTypes';
import { mockMetaTemplateRow } from '@/store/meta-template/specs/metaTemplateMockData';

const template = (overrides: Partial<MetaTemplate> = {}): MetaTemplate => ({
  ...normalizeTemplateRow(mockMetaTemplateRow),
  ...overrides,
});

const v = (key: string, kind: TemplateVariable['kind'] = 'text'): TemplateVariable => ({
  key,
  example: '',
  kind,
});

describe('applyVariables', () => {
  it('replaces named placeholders with the typed values', () => {
    expect(applyVariables('Olá {{name}}', { name: 'Ana' })).toBe('Olá Ana');
  });

  it('tolerates spaces inside the braces and repeated placeholders', () => {
    expect(applyVariables('{{ name }} e {{name}}', { name: 'Ana' })).toBe('Ana e Ana');
  });

  it('keeps the placeholder while the value is empty or blank', () => {
    expect(applyVariables('Olá {{name}}, {{msg_body}}', { name: '  ' })).toBe(
      'Olá {{name}}, {{msg_body}}',
    );
  });
});

describe('canSend', () => {
  const none = { format: 'NONE' as const, params: undefined };

  it('is true when every variable has a value', () => {
    expect(canSend([v('name', 'name'), v('msg_body')], { name: 'Ana', msg_body: 'oi' }, none)).toBe(
      true,
    );
  });

  it('is false when a value is only spaces', () => {
    expect(canSend([v('msg_body')], { msg_body: '   ' }, none)).toBe(false);
  });

  it('is false when a value is missing', () => {
    expect(canSend([v('msg_body')], {}, none)).toBe(false);
  });

  it('is false while a value is still the {{key}} placeholder default', () => {
    expect(canSend([v('msg_body')], { msg_body: '{{msg_body}}' }, none)).toBe(false);
  });

  it('is false for an IMAGE header without media and true once it has one', () => {
    const header = { format: 'IMAGE' as const, params: { media_url: '', media_type: 'image' } };
    expect(canSend([], {}, header)).toBe(false);
    expect(
      canSend([], {}, { ...header, params: { media_url: 'https://x/a.jpg', media_type: 'image' } }),
    ).toBe(true);
  });

  it('requires text header variables', () => {
    const header = { format: 'TEXT' as const, params: { titulo: '' } };
    expect(canSend([], {}, header)).toBe(false);
    expect(canSend([], {}, { ...header, params: { titulo: 'X' } })).toBe(true);
  });

  it('requires button parameters and ignores the sparse holes', () => {
    // eslint-disable-next-line no-sparse-arrays
    const buttons = [, { type: 'copy_code' as const, parameter: '' }];
    expect(canSend([], {}, none, buttons)).toBe(false);
    // eslint-disable-next-line no-sparse-arrays
    expect(canSend([], {}, none, [, { type: 'copy_code' as const, parameter: 'ABC' }])).toBe(true);
  });
});

describe('variableInputMode', () => {
  it('uses the name mode for the contact name variable', () => {
    expect(variableInputMode(v('name', 'name'), ['A'])).toBe('name');
  });

  it('falls back to free text for empreendimento when the list is empty', () => {
    expect(variableInputMode(v('empreendimento', 'empreendimento'), [])).toBe('text');
  });

  it('uses a select for empreendimento when the list has names', () => {
    expect(variableInputMode(v('empreendimento', 'empreendimento'), ['Alameda'])).toBe('select');
  });

  it('uses text for other variables', () => {
    expect(variableInputMode(v('msg_body'), ['Alameda'])).toBe('text');
  });
});

describe('initialFormValues', () => {
  const vars = [
    { key: 'name', example: 'Maria', kind: 'name' as const },
    { key: 'empreendimento', example: 'Alameda', kind: 'empreendimento' as const },
    { key: 'msg_body', example: 'novidades', kind: 'text' as const },
    { key: 'extra', example: '', kind: 'text' as const },
  ];

  it('prefills the contact name and the examples, leaving {{key}} defaults empty', () => {
    expect(initialFormValues(vars, 'Ana', [])).toEqual({
      name: 'Ana',
      empreendimento: 'Alameda',
      msg_body: 'novidades',
      extra: '',
    });
  });

  it('keeps the empreendimento example only when it is in the list', () => {
    expect(initialFormValues(vars, null, ['Alameda', 'Bosque']).empreendimento).toBe('Alameda');
    expect(initialFormValues(vars, null, ['Bosque']).empreendimento).toBe('');
    expect(initialFormValues(vars, null, ['Bosque']).name).toBe('');
  });
});

describe('describeTemplate', () => {
  it('turns the content part of the name into a readable title, with tags', () => {
    expect(describeTemplate(template({ name: 'lancamento_venda_imagem_convite_visita' }))).toEqual({
      title: 'Convite visita',
      tags: ['lancamento', 'venda', 'imagem'],
    });
  });

  it('uses the whole name for names outside the definition_operation_type_content format', () => {
    expect(describeTemplate(template({ name: 'boas_vindas' }))).toEqual({
      title: 'Boas vindas',
      tags: [],
    });
  });
});

describe('formatTemplateBody', () => {
  it('fills the body with the template examples like the web picker', () => {
    expect(formatTemplateBody(template())).toBe('Olá Maria, conheça o Alameda: novidades');
  });

  it('keeps placeholders without an example', () => {
    expect(formatTemplateBody(template({ body_text: 'Oi {{x}}', body_examples: {} }))).toBe(
      'Oi {{x}}',
    );
  });
});

describe('reconcileFilter', () => {
  it('keeps a selection that is still offered and resets one that is not', () => {
    expect(reconcileFilter('imagem', ['imagem', 'texto'])).toBe('imagem');
    expect(reconcileFilter('video', ['imagem'])).toBe('All');
    expect(reconcileFilter('All', [])).toBe('All');
  });
});

describe('senderFromUser', () => {
  it('keeps only the raw id, name and email of the auth user', () => {
    expect(
      senderFromUser({ id: 9, name: 'Ana', email: 'a@x.com', pubsub_token: 't', account_id: 3 }),
    ).toEqual({ id: 9, name: 'Ana', email: 'a@x.com' });
  });
});

// Integration: what the fill screen sends = buildTemplateParams → buildWabaTemplatePayload.
describe('buildSendPayload (integration)', () => {
  const NOW = new Date('2026-10-18T13:45:30.123Z');
  const conversation = {
    id: 42,
    inbox_id: 5,
    can_reply: true,
    status: 'open',
    additional_attributes: {},
    meta: { sender: { name: 'Maria', additional_attributes: { source_id: 'wa-1' } } },
  };
  const user = { id: 9, name: 'Ana', email: 'a@x.com', pubsub_token: 'secret' };

  // A plain QUICK_REPLY before the URL button leaves a hole at index 0.
  const withQuickReply = template({
    components: [
      ...(normalizeTemplateRow(mockMetaTemplateRow).components || []).filter(
        c => c.type !== 'BUTTONS',
      ),
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Sim' },
          { type: 'URL', text: 'Ver', url: 'https://arqos.com.br/{{1}}' },
        ],
      },
    ],
  });

  const fill = (inbox: Record<string, unknown>) => {
    const t = withQuickReply;
    const buttons = parseButtonParams(t)?.slice();
    if (buttons?.[1]) buttons[1] = { ...buttons[1], parameter: 'abc' };
    const values = { name: 'Maria', empreendimento: 'Alameda', msg_body: 'novidades' };
    const headerParams = { ...parseHeader(t).params, media_url: 'https://s3/x.jpg' };
    return {
      t,
      values,
      headerParams,
      buttons,
      payload: buildSendPayload({
        template: t,
        values,
        headerParams,
        buttonParams: buttons,
        conversation,
        inbox,
        user,
        accountId: 3,
        inReplyToId: undefined,
        now: NOW,
      }),
    };
  };

  it('equals buildTemplateParams fed into buildWabaTemplatePayload', () => {
    const inbox = { id: 5, name: 'WhatsApp', channel_type: 'Channel::Whatsapp' };
    const { t, values, headerParams, buttons, payload } = fill(inbox);
    const expected = buildWabaTemplatePayload({
      conversation,
      inbox,
      sender: { id: 9, name: 'Ana', email: 'a@x.com' },
      account: { id: 3 },
      templateParams: buildTemplateParams(t, values, headerParams, buttons, {
        sendRenderedContent: false,
      }),
      now: NOW,
    });
    expect(JSON.stringify(payload)).toBe(JSON.stringify(expected));
  });

  it('round-trips through JSON like the web: holes become null, media_type survives', () => {
    const { payload } = fill({ id: 5, name: 'WhatsApp', channel_type: 'Channel::Whatsapp' });
    const wire = JSON.parse(JSON.stringify(payload));
    const vars = wire.body.waba_template.waba_template_variables;
    expect(vars.body).toEqual({ name: 'Maria', empreendimento: 'Alameda', msg_body: 'novidades' });
    expect(vars.header).toEqual({ media_url: 'https://s3/x.jpg', media_type: 'image' });
    expect(vars.buttons).toEqual([
      null,
      { type: 'url', parameter: 'abc', url: 'https://arqos.com.br/{{1}}', variables: ['1'] },
    ]);
    expect(wire.body.sender).toEqual({ id: 9, name: 'Ana', email: 'a@x.com', type: 'user' });
    expect(JSON.stringify(wire)).not.toContain('secret');
    expect(wire.body.account).toEqual({ id: 3, name: 'Account' });
  });

  it('uses rendered content mode only for API inboxes (web isAPIInbox)', () => {
    const t = template();
    const values = { name: 'Maria', empreendimento: 'Alameda', msg_body: 'x' };
    const mode = (inbox: Record<string, unknown>) =>
      sendTemplateParams(t, values, undefined, undefined, inbox).content_mode;
    expect(mode({ channel_type: 'Channel::Api' })).toBe('rendered');
    expect(mode({ channel_type: 'Channel::Whatsapp' })).toBe('raw_template');
    expect(mode({})).toBe('raw_template');
  });

  it('passes the quoted message as in_reply_to', () => {
    const t = template();
    const payload = buildSendPayload({
      template: t,
      values: { name: 'Maria', empreendimento: 'Alameda', msg_body: 'x' },
      headerParams: undefined,
      buttonParams: undefined,
      conversation,
      inbox: { name: 'WA' },
      user,
      accountId: 3,
      inReplyToId: 77,
      now: NOW,
    });
    expect(payload.body.content_attributes).toEqual({ in_reply_to: 77 });
  });
});

describe('parseTemplateVariables sanity for the fill screen', () => {
  it('lists name, empreendimento and msg_body', () => {
    expect(parseTemplateVariables(template()).map(x => x.kind)).toEqual([
      'name',
      'empreendimento',
      'text',
    ]);
  });
});
