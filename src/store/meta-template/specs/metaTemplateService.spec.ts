import { apiService } from '@/services/APIService';
import { getTemplateErrorMessage, MetaTemplateService } from '../metaTemplateService';
import { mockMetaTemplateRow } from './metaTemplateMockData';

jest.mock('@/i18n', () => ({
  t: (key: string) => key,
}));

jest.mock('@/services/APIService', () => ({
  apiService: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const OPT_OUT = { skipGlobalErrorHandler: true };

describe('MetaTemplateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('list(3) fetches the inbox templates and keeps snake_case keys', async () => {
    const row = { ...mockMetaTemplateRow, msg_body: 'x' };
    (apiService.get as jest.Mock).mockResolvedValueOnce({ data: [row] });

    const rows = await MetaTemplateService.list(3);

    expect(apiService.get).toHaveBeenCalledWith('inboxes/3/meta_templates', OPT_OUT);
    expect(rows).toEqual([row]);
    expect(rows[0]).toHaveProperty('msg_body', 'x');
    expect(rows[0]).toHaveProperty('meta_template_id', '1234567890');
    expect(rows[0]).not.toHaveProperty('msgBody');
    expect(rows[0]).not.toHaveProperty('metaTemplateId');
  });

  it('list() returns [] when the body is not an array', async () => {
    (apiService.get as jest.Mock).mockResolvedValueOnce({ data: null });
    await expect(MetaTemplateService.list(3)).resolves.toEqual([]);
  });

  it('list() propagates errors (e.g. 403)', async () => {
    const error = { response: { status: 403 } };
    (apiService.get as jest.Mock).mockRejectedValueOnce(error);
    await expect(MetaTemplateService.list(3)).rejects.toBe(error);
  });

  it('sync(3) posts to the sync route', async () => {
    (apiService.post as jest.Mock).mockResolvedValueOnce({ data: { synced_at: 'x' } });

    await expect(MetaTemplateService.sync(3)).resolves.toBeUndefined();

    expect(apiService.post).toHaveBeenCalledWith(
      'inboxes/3/meta_templates/sync',
      undefined,
      OPT_OUT,
    );
  });

  it('empreendimentos() returns the nomes list', async () => {
    (apiService.get as jest.Mock).mockResolvedValueOnce({ data: { nomes: ['Alameda'] } });

    await expect(MetaTemplateService.empreendimentos()).resolves.toEqual(['Alameda']);

    expect(apiService.get).toHaveBeenCalledWith('empreendimentos', OPT_OUT);
  });

  it('empreendimentos() returns [] on a 404 rejection', async () => {
    (apiService.get as jest.Mock).mockRejectedValueOnce({ response: { status: 404 } });
    await expect(MetaTemplateService.empreendimentos()).resolves.toEqual([]);
  });

  it('empreendimentos() returns [] for a malformed body and drops non-strings', async () => {
    (apiService.get as jest.Mock).mockResolvedValueOnce({ data: {} });
    await expect(MetaTemplateService.empreendimentos()).resolves.toEqual([]);

    (apiService.get as jest.Mock).mockResolvedValueOnce({ data: { nomes: ['A', 1, null, 'B'] } });
    await expect(MetaTemplateService.empreendimentos()).resolves.toEqual(['A', 'B']);
  });

  it('rawConversation(42) returns the raw conversation body', async () => {
    const data = { id: 9, display_id: 42, meta: { sender: { phone_number: '+55' } } };
    (apiService.get as jest.Mock).mockResolvedValueOnce({ data });

    await expect(MetaTemplateService.rawConversation(42)).resolves.toBe(data);

    expect(apiService.get).toHaveBeenCalledWith('conversations/42', OPT_OUT);
  });

  it('rawInbox(3) returns the raw inbox body', async () => {
    const data = { id: 3, meta_inbox_config: { enabled: true } };
    (apiService.get as jest.Mock).mockResolvedValueOnce({ data });

    await expect(MetaTemplateService.rawInbox(3)).resolves.toBe(data);

    expect(apiService.get).toHaveBeenCalledWith('inboxes/3', OPT_OUT);
  });

  it('sendToWebhook(3, payload) posts { payload } untouched', async () => {
    const payload = { processed_params: { msg_body: 'oi' }, waba_template_id: '1' };
    (apiService.post as jest.Mock).mockResolvedValueOnce({ data: { ok: true } });

    await expect(MetaTemplateService.sendToWebhook(3, payload)).resolves.toBeUndefined();

    expect(apiService.post).toHaveBeenCalledWith(
      'inboxes/3/send_template_to_webhook',
      { payload },
      OPT_OUT,
    );
    const body = (apiService.post as jest.Mock).mock.calls[0][1];
    expect(body.payload).toBe(payload);
  });
});

describe('getTemplateErrorMessage', () => {
  it('returns other server error strings as-is', () => {
    expect(
      getTemplateErrorMessage({
        response: { status: 403, data: { error: 'Você não tem permissão' } },
      }),
    ).toBe('Você não tem permissão');
  });

  it('maps the English webhook errors of send_template_to_webhook to pt-BR keys', () => {
    expect(
      getTemplateErrorMessage({
        response: { status: 422, data: { error: 'Webhook URL not configured for this inbox' } },
      }),
    ).toBe('META_TEMPLATES.ERRORS.WEBHOOK_NOT_CONFIGURED');
    expect(
      getTemplateErrorMessage({
        response: { status: 502, data: { error: 'Webhook returned: 500 Internal Server Error' } },
      }),
    ).toBe('META_TEMPLATES.ERRORS.WEBHOOK_FAILED');
  });

  it('maps the 400 "Webhook execution failed: …" error to WEBHOOK_FAILED', () => {
    expect(
      getTemplateErrorMessage({
        response: { status: 400, data: { error: 'Webhook execution failed: execution expired' } },
      }),
    ).toBe('META_TEMPLATES.ERRORS.WEBHOOK_FAILED');
  });

  it('returns the generic key without a usable error string', () => {
    expect(getTemplateErrorMessage({ response: { status: 422, data: { error: '' } } })).toBe(
      'META_TEMPLATES.ERRORS.GENERIC',
    );
    expect(getTemplateErrorMessage({ response: { status: 500, data: { error: ['x'] } } })).toBe(
      'META_TEMPLATES.ERRORS.GENERIC',
    );
    expect(getTemplateErrorMessage(new Error('Network Error'))).toBe(
      'META_TEMPLATES.ERRORS.GENERIC',
    );
    expect(getTemplateErrorMessage(undefined)).toBe('META_TEMPLATES.ERRORS.GENERIC');
    expect(getTemplateErrorMessage('x')).toBe('META_TEMPLATES.ERRORS.GENERIC');
  });
});
