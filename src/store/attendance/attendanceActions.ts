import { createAsyncThunk } from '@reduxjs/toolkit';

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
