import { createAsyncThunk } from '@reduxjs/toolkit';

import I18n from '@/i18n';

import { conversationActions } from '@/store/conversation/conversationActions';
import { buildClickBody } from './attendanceRules';
import { AttendanceService, getAttendanceErrorMessage } from './attendanceService';
import type { AttendanceActionBody, AttendanceStatus, MessageOptionItem } from './attendanceTypes';

/** Rejection payload; `code: 'MOTIVO_REQUIRED'` lets the adiar modal show it inline. */
export interface AttendanceError {
  code?: string;
  message: string;
}

export interface ClickOptionPayload {
  conversationId: number;
  item: MessageOptionItem;
  messageId: number;
  /** True when the click passed through a frame (motivo/bucket captured). */
  frameConfirmed?: boolean;
}

export interface RunAttendanceActionPayload {
  conversationId: number;
  body: AttendanceActionBody;
}

const toAttendanceError = (error: unknown): AttendanceError => {
  const message = getAttendanceErrorMessage(error);
  const code = (error as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code;
  return typeof code === 'string' && code.length > 0 ? { code, message } : { message };
};

/**
 * Narrows a rejection caught from `.unwrap()` of the attendance thunks. Their rejection
 * payload is an AttendanceError ({ code?, message }) with a user-facing message; anything
 * else (Error, RTK SerializedError with `name`, non-objects) gets the generic error.
 */
export const narrowAttendanceError = (error: unknown): AttendanceError => {
  const e = error as { code?: unknown; message?: unknown; name?: unknown } | null;
  const isAttendanceError =
    !!e &&
    typeof e === 'object' &&
    !(error instanceof Error) &&
    e.name === undefined &&
    typeof e.message === 'string' &&
    e.message.length > 0;
  if (!isAttendanceError) return { message: I18n.t('ATTENDANCE.ERROR') };
  const message = e.message as string;
  return typeof e.code === 'string' && e.code ? { code: e.code, message } : { message };
};

type ThunkConfig = { rejectValue: AttendanceError };

export const attendanceActions = {
  clickOption: createAsyncThunk<void, ClickOptionPayload, ThunkConfig>(
    'attendance/clickOption',
    async ({ conversationId, item, messageId, frameConfirmed }, { dispatch, rejectWithValue }) => {
      try {
        await AttendanceService.click(
          conversationId,
          buildClickBody({ item, messageId, frameConfirmed }),
        );
      } catch (error) {
        return rejectWithValue(toAttendanceError(error));
      }
      // Best-effort refresh: the click already succeeded.
      dispatch(conversationActions.fetchConversation(conversationId));
    },
  ),

  runAttendanceAction: createAsyncThunk<void, RunAttendanceActionPayload, ThunkConfig>(
    'attendance/runAttendanceAction',
    async ({ conversationId, body }, { dispatch, rejectWithValue }) => {
      try {
        await AttendanceService.action(conversationId, body);
      } catch (error) {
        return rejectWithValue(toAttendanceError(error));
      }
      dispatch(conversationActions.fetchConversation(conversationId));
    },
  ),

  /** Resolves with the raw (snake_case) status; not stored in Redux. */
  fetchAttendanceStatus: createAsyncThunk<AttendanceStatus, number, ThunkConfig>(
    'attendance/fetchAttendanceStatus',
    async (conversationId, { rejectWithValue }) => {
      try {
        return await AttendanceService.status(conversationId);
      } catch (error) {
        return rejectWithValue(toAttendanceError(error));
      }
    },
  ),
};
