import { apiService } from '@/services/APIService';
import { getHttpStatus, getLigacaoErrorMessage, LigacaoService } from '../ligacaoService';
import { mockLigacaoListResponse } from './ligacaoMockData';

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
}));

jest.mock('@/i18n', () => ({
  t: (key: string) => key,
}));

jest.mock('@/utils/toastUtils', () => ({
  showToast: jest.fn(),
}));

jest.mock('@/services/APIService', () => ({
  apiService: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('LigacaoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('list() fetches without dias and opts out of global error handling', async () => {
    (apiService.get as jest.Mock).mockResolvedValueOnce({ data: mockLigacaoListResponse });

    const response = await LigacaoService.list();

    expect(apiService.get).toHaveBeenCalledWith('ligacoes', { skipGlobalErrorHandler: true });
    const config = (apiService.get as jest.Mock).mock.calls[0][1];
    expect(config.params?.dias).toBeUndefined();
    expect(response).toEqual(mockLigacaoListResponse);
  });

  it('list(60) sends dias=60', async () => {
    (apiService.get as jest.Mock).mockResolvedValueOnce({ data: mockLigacaoListResponse });

    await LigacaoService.list(60);

    expect(apiService.get).toHaveBeenCalledWith('ligacoes', {
      params: { dias: 60 },
      skipGlobalErrorHandler: true,
    });
  });

  it('reservar(42) posts to the reservar route and returns telefone/until', async () => {
    const data = { telefone: '+5511999990000', until: '2026-10-18T15:00:00Z' };
    (apiService.post as jest.Mock).mockResolvedValueOnce({ data });

    const response = await LigacaoService.reservar(42);

    expect(apiService.post).toHaveBeenCalledWith('ligacoes/42/reservar', undefined, {
      skipGlobalErrorHandler: true,
    });
    expect(response).toEqual(data);
  });

  it('liberar(42) posts to the liberar route', async () => {
    (apiService.post as jest.Mock).mockResolvedValueOnce({ data: '' });

    await expect(LigacaoService.liberar(42)).resolves.toBeUndefined();

    expect(apiService.post).toHaveBeenCalledWith('ligacoes/42/liberar', undefined, {
      skipGlobalErrorHandler: true,
    });
  });

  it('puxar(42) posts to the puxar route and returns id/display_id', async () => {
    const data = { id: 101, display_id: 42 };
    (apiService.post as jest.Mock).mockResolvedValueOnce({ data });

    const response = await LigacaoService.puxar(42);

    expect(apiService.post).toHaveBeenCalledWith('ligacoes/42/puxar', undefined, {
      skipGlobalErrorHandler: true,
    });
    expect(response).toEqual(data);
  });

  it('resumo(42, "ok") posts the texto body', async () => {
    (apiService.post as jest.Mock).mockResolvedValueOnce({ data: { ok: true } });

    await expect(LigacaoService.resumo(42, 'ok')).resolves.toBeUndefined();

    expect(apiService.post).toHaveBeenCalledWith(
      'ligacoes/42/resumo',
      { texto: 'ok' },
      { skipGlobalErrorHandler: true },
    );
  });
});

describe('getLigacaoErrorMessage', () => {
  it('returns the server message for a 422 rule error', () => {
    const error = {
      response: {
        status: 422,
        data: { error: 'ligacoes.reservada', message: 'Lead já reservado' },
      },
    };
    expect(getLigacaoErrorMessage(error)).toBe('Lead já reservado');
  });

  it('returns the generic key for a network error', () => {
    expect(getLigacaoErrorMessage(new Error('Network Error'))).toBe('LIGACOES.ERRORS.GENERIC');
  });

  it('returns the generic key for a 422 without message', () => {
    expect(getLigacaoErrorMessage({ response: { status: 422, data: {} } })).toBe(
      'LIGACOES.ERRORS.GENERIC',
    );
  });

  it('returns the generic key for non-422 statuses even with a message', () => {
    expect(getLigacaoErrorMessage({ response: { status: 500, data: { message: 'boom' } } })).toBe(
      'LIGACOES.ERRORS.GENERIC',
    );
  });

  it('returns the generic key for non-object errors', () => {
    expect(getLigacaoErrorMessage(undefined)).toBe('LIGACOES.ERRORS.GENERIC');
    expect(getLigacaoErrorMessage('x')).toBe('LIGACOES.ERRORS.GENERIC');
  });
});

describe('getHttpStatus', () => {
  it('returns the response status when present', () => {
    expect(getHttpStatus({ response: { status: 403 } })).toBe(403);
  });

  it('returns undefined for errors without a response', () => {
    expect(getHttpStatus(new Error('Network Error'))).toBeUndefined();
    expect(getHttpStatus(null)).toBeUndefined();
  });
});
