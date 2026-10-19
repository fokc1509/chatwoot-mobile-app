import type { Inbox } from '@/types/Inbox';
import type { Message } from '@/types/Message';
import { isOptionsMessage, optionButtons } from '../optionsBubbleViewModel';

const commercialInbox = {
  id: 1,
  automacoesComerciais: { enabled: true, botoes: { enabled: true } },
} as unknown as Inbox;
const plainInbox = { id: 2 } as unknown as Inbox;

const items = [
  { title: 'Descartar', value: 'x1', frame: 'discard' },
  { title: 'Adiar', value: 'adiar' },
  { title: 'Mover p/ IA', value: 'x3', frame: 'ia_confirm' },
  { title: 'Enviar', value: 'x4', frame: 'enviar_msg_confirm' },
  { title: 'Aprovar', value: 'aprovar' },
  { title: 'Respondeu', value: 'respondeu' },
];

const message = (contentAttributes: object | null, contentType = 'input_select') =>
  ({ id: 9, contentType, contentAttributes }) as unknown as Message;

describe('optionButtons', () => {
  it('maps follow-up note buttons in a commercial inbox to their flows', () => {
    const buttons = optionButtons(message({ items, followupExecutionId: 7 }), {
      inbox: commercialInbox,
      conversation: { customAttributes: {} },
    });
    expect(buttons.map(b => [b.label, b.flow])).toEqual([
      ['Descartar', 'discard'],
      ['Adiar', 'adiar'],
      ['Mover p/ IA', 'ia'],
      ['Enviar', 'enviar_msg'],
      ['Aprovar', 'discard_request_legacy'],
      ['Respondeu', 'direct'],
    ]);
    expect(buttons[0].item).toBe(items[0]);
  });

  it('posts legacy aprovar directly once a discard was suggested', () => {
    const buttons = optionButtons(message({ items, followupExecutionId: 7 }), {
      inbox: commercialInbox,
      conversation: { customAttributes: { descarteSolicitado: true } },
    });
    expect(buttons[4].flow).toBe('direct');
  });

  it('keeps every button direct for a plain input_select (no followupExecutionId)', () => {
    const buttons = optionButtons(message({ items }), {
      inbox: commercialInbox,
      conversation: null,
    });
    expect(buttons.every(b => b.flow === 'direct')).toBe(true);
    expect(buttons).toHaveLength(items.length);
  });

  it('keeps every button direct outside a commercial inbox', () => {
    const buttons = optionButtons(message({ items, followupExecutionId: 7 }), {
      inbox: plainInbox,
      conversation: null,
    });
    expect(buttons.every(b => b.flow === 'direct')).toBe(true);
  });

  it('returns no buttons when the message has no items', () => {
    const ctx = { inbox: commercialInbox, conversation: null };
    expect(optionButtons(message({}), ctx)).toEqual([]);
    expect(optionButtons(message(null), ctx)).toEqual([]);
    expect(optionButtons(message({ items: [] }), ctx)).toEqual([]);
  });
});

describe('isOptionsMessage', () => {
  it('is true only for input_select with items', () => {
    expect(isOptionsMessage(message({ items }))).toBe(true);
    expect(isOptionsMessage(message({ items: [] }))).toBe(false);
    expect(isOptionsMessage(message(null))).toBe(false);
    expect(isOptionsMessage(message({ items }, 'text'))).toBe(false);
  });
});
