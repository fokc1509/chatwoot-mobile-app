import { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

import { apiService } from '@/services/APIService';
import { showToast } from '@/utils/toastUtils';

const mockDispatch = jest.fn();

jest.mock('@/store/storeAccessor', () => ({
  getStore: () => ({
    dispatch: mockDispatch,
    getState: () => ({
      auth: { headers: null, user: { account_id: 1 } },
      settings: { installationUrl: 'https://example.test/' },
    }),
  }),
}));

jest.mock('@/i18n', () => ({
  t: (key: string) => key,
}));

jest.mock('@/utils/toastUtils', () => ({
  showToast: jest.fn(),
}));

const failingAdapter =
  (status: number) =>
  (config: InternalAxiosRequestConfig): Promise<never> =>
    Promise.reject(
      new AxiosError(
        `Request failed with status code ${status}`,
        'ERR_BAD_RESPONSE',
        config,
        null,
        {
          status,
          statusText: '',
          headers: {},
          config,
          data: {},
        },
      ),
    );

const requestWith = (status: number, extra: AxiosRequestConfig = {}) =>
  apiService.get('ligacoes', { adapter: failingAdapter(status), ...extra });

describe('APIService response interceptor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects without logout or toast when skipGlobalErrorHandler is set (401)', async () => {
    await expect(requestWith(401, { skipGlobalErrorHandler: true })).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('rejects without logout or toast when skipGlobalErrorHandler is set (500)', async () => {
    await expect(requestWith(500, { skipGlobalErrorHandler: true })).rejects.toMatchObject({
      response: { status: 500 },
    });
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('still dispatches auth/logout on 401 without the flag', async () => {
    await expect(requestWith(401)).rejects.toMatchObject({ response: { status: 401 } });
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'auth/logout' });
    expect(showToast).not.toHaveBeenCalled();
  });

  it('still shows the generic toast on 500 without the flag', async () => {
    await expect(requestWith(500)).rejects.toMatchObject({ response: { status: 500 } });
    expect(showToast).toHaveBeenCalledWith({ message: 'ERRORS.COMMON_ERROR' });
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
