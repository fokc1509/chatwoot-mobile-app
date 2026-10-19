import type { AxiosRequestConfig } from 'axios';

import { apiService } from '@/services/APIService';
import I18n from '@/i18n';
import { getHttpStatus } from '@/utils/httpUtils';
import type {
  AttendanceActionBody,
  AttendanceStatus,
  InteractiveClickBody,
} from './attendanceTypes';

// 403/422 carry user-facing rule errors; the global handler must not toast/logout.
const OPT_OUT: AxiosRequestConfig = { skipGlobalErrorHandler: true };

export class AttendanceService {
  static async click(conversationId: number, body: InteractiveClickBody): Promise<void> {
    await apiService.post(`conversations/${conversationId}/interactive_messages`, body, {
      ...OPT_OUT,
    });
  }

  static async action(conversationId: number, body: AttendanceActionBody): Promise<void> {
    await apiService.post(`conversations/${conversationId}/attendance_action`, body, {
      ...OPT_OUT,
    });
  }

  /** Raw snake_case payload — intentionally not camelCased. */
  static async status(conversationId: number): Promise<AttendanceStatus> {
    const response = await apiService.get<AttendanceStatus>(
      `conversations/${conversationId}/attendance_action/status`,
      { ...OPT_OUT },
    );
    return response.data;
  }
}

type ErrorData = { error?: unknown; message?: unknown; code?: unknown };

const getErrorData = (error: unknown): ErrorData | undefined => {
  if (typeof error !== 'object' || error === null) return undefined;
  const data = (error as { response?: { data?: unknown } }).response?.data;
  return typeof data === 'object' && data !== null ? (data as ErrorData) : undefined;
};

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

// MOTIVO_REQUIRED → the adiar modal text; other 403/422 → the server's `error`
// (or `message`); anything else → the generic attendance error.
export const getAttendanceErrorMessage = (error: unknown): string => {
  const status = getHttpStatus(error);
  const data = getErrorData(error);
  if (data?.code === 'MOTIVO_REQUIRED') {
    return I18n.t('ATTENDANCE.ADIAR_MODAL.MOTIVO_REQUIRED');
  }
  if (status === 403 || status === 422) {
    if (nonEmpty(data?.error)) return data.error;
    if (nonEmpty(data?.message)) return data.message;
  }
  return I18n.t('ATTENDANCE.ERROR');
};
