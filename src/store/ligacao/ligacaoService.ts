import type { AxiosRequestConfig } from 'axios';

import { apiService } from '@/services/APIService';
import I18n from '@/i18n';
import { getHttpStatus } from '@/utils/httpUtils';
import type {
  LigacaoJanela,
  LigacaoListResponse,
  LigacaoPuxarResponse,
  LigacaoReservarResponse,
} from './ligacaoTypes';

// The server answers permission denials with 401, which the global handler
// would turn into a logout. Every queue request handles its own errors.
const OPT_OUT: AxiosRequestConfig = { skipGlobalErrorHandler: true };

export class LigacaoService {
  static async list(dias?: LigacaoJanela): Promise<LigacaoListResponse> {
    const config: AxiosRequestConfig =
      dias === undefined ? { ...OPT_OUT } : { params: { dias }, ...OPT_OUT };
    const response = await apiService.get<LigacaoListResponse>('ligacoes', config);
    return response.data;
  }

  static async reservar(displayId: number): Promise<LigacaoReservarResponse> {
    const response = await apiService.post<LigacaoReservarResponse>(
      `ligacoes/${displayId}/reservar`,
      undefined,
      { ...OPT_OUT },
    );
    return response.data;
  }

  static async liberar(displayId: number): Promise<void> {
    await apiService.post(`ligacoes/${displayId}/liberar`, undefined, { ...OPT_OUT });
  }

  static async puxar(displayId: number): Promise<LigacaoPuxarResponse> {
    const response = await apiService.post<LigacaoPuxarResponse>(
      `ligacoes/${displayId}/puxar`,
      undefined,
      { ...OPT_OUT },
    );
    return response.data;
  }

  static async resumo(displayId: number, texto: string): Promise<void> {
    await apiService.post(`ligacoes/${displayId}/resumo`, { texto }, { ...OPT_OUT });
  }
}

type ErrorWithResponse = {
  response?: { status?: unknown; data?: { message?: unknown } };
};

const asErrorWithResponse = (error: unknown): ErrorWithResponse | undefined =>
  typeof error === 'object' && error !== null ? (error as ErrorWithResponse) : undefined;

// Moved to a shared util (also used by meta templates); re-exported for callers.
export { getHttpStatus };

export const getLigacaoErrorMessage = (error: unknown): string => {
  if (getHttpStatus(error) === 422) {
    const message = asErrorWithResponse(error)?.response?.data?.message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return I18n.t('LIGACOES.ERRORS.GENERIC');
};
