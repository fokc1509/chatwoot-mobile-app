import { buildWabaTemplatePayload } from '../metaTemplatePayload';
import type { TemplateParams } from '../metaTemplateTypes';
import fixture from './fixtures/webTemplatePayload.json';

// The fixture was produced by running the web's ReplyBox.vue buildWabaTemplatePayload body
// verbatim in node (see the Task 4 report for the generation script). The app must match it
// byte for byte, given the same raw inputs.
type FixtureCase = (typeof fixture.cases)[number];

const run = (c: FixtureCase) =>
  buildWabaTemplatePayload({
    conversation: c.input.conversation as unknown as Record<string, unknown>,
    inbox: c.input.inbox as unknown as Record<string, unknown>,
    sender: c.input.sender as unknown as Record<string, unknown>,
    account: { id: c.input.accountId },
    globalConfigAccountName: c.input.globalConfigAccountName ?? undefined,
    inReplyTo: c.input.inReplyTo as unknown as { id?: number },
    templateParams: c.input.templateParams as unknown as TemplateParams,
    now: new Date(c.input.now),
  });

const byName = (name: string) => {
  const found = fixture.cases.find(c => c.name === name);
  if (!found) throw new Error(`fixture case missing: ${name}`);
  return found;
};

describe('buildWabaTemplatePayload', () => {
  it.each(fixture.cases.map(c => [c.name, c] as const))(
    'matches the web payload: %s',
    (_name, c) => {
      // JSON round-trip: the payload is sent as JSON, so undefined keys are dropped exactly
      // as they are on the wire.
      expect(JSON.parse(JSON.stringify(run(c)))).toEqual(c.expected);
    },
  );

  it('sends empty processed_params as an empty variables object', () => {
    const payload = run(byName('empty processed_params'));
    expect(payload.body.waba_template.waba_template_variables).toEqual({});
  });

  it('keeps underscore variable names intact (no camelCase)', () => {
    const payload = run(byName('full processed_params with underscore keys, no reply-to'));
    const vars = payload.body.waba_template.waba_template_variables as {
      body: Record<string, string>;
    };
    expect(Object.keys(vars.body)).toEqual(['name', 'empreendimento', 'msg_body']);
    expect(vars.body.msg_body).toBe('temos novidades para você');
    expect(JSON.stringify(payload)).not.toContain('msgBody');
  });

  it('falls back to the template id and sets in_reply_to when replying', () => {
    const payload = run(byName('reply-to set, contact without source_id, null waba_template_id'));
    expect(payload.body.waba_template.waba_template_id).toBe(33);
    expect(payload.body.content_attributes).toEqual({ in_reply_to: 5521 });
    expect(payload.body.conversation.contact_inbox.source_id).toBe('');
  });
});
