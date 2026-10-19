import { configureStore, type AnyAction, type Middleware } from '@reduxjs/toolkit';

import { ConversationService } from '@/store/conversation/conversationService';
import { attendanceActions, narrowAttendanceError } from '../attendanceActions';
import { AttendanceService } from '../attendanceService';
import type { AttendanceStatus } from '../attendanceTypes';

jest.mock('@/i18n', () => ({
  t: (key: string) => key,
}));

jest.mock('../attendanceService', () => {
  const actual = jest.requireActual('../attendanceService');
  return {
    ...actual,
    AttendanceService: {
      click: jest.fn(),
      action: jest.fn(),
      status: jest.fn(),
    },
  };
});

jest.mock('@/store/conversation/conversationService', () => ({
  ConversationService: { fetchConversation: jest.fn() },
}));

const mockedService = AttendanceService as jest.Mocked<typeof AttendanceService>;
const mockedFetchConversation = ConversationService.fetchConversation as jest.Mock;

const httpError = (status: number, data?: unknown) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });

const setupStore = () => {
  const dispatched: AnyAction[] = [];
  const recorder: Middleware = () => next => action => {
    dispatched.push(action as AnyAction);
    return next(action);
  };
  const store = configureStore({
    reducer: { noop: (state: null = null) => state },
    middleware: getDefault => getDefault({ serializableCheck: false }).concat(recorder),
  });
  return { store, dispatched };
};

const types = (actions: AnyAction[]) => actions.map(action => action.type);
const REFRESH = 'conversations/fetchConversation/pending';

const item = { title: 'Descartar', value: 'descartar', frame: 'discard' };

describe('attendanceActions', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedFetchConversation.mockResolvedValue({ data: {} });
  });

  describe('clickOption', () => {
    it('posts the click body built from the item and refreshes the conversation', async () => {
      mockedService.click.mockResolvedValue(undefined);
      const { store, dispatched } = setupStore();

      const result = await store.dispatch(
        attendanceActions.clickOption({
          conversationId: 42,
          item,
          messageId: 7,
          frameConfirmed: true,
        }),
      );

      expect(result.type).toBe('attendance/clickOption/fulfilled');
      expect(mockedService.click).toHaveBeenCalledWith(42, {
        selected_option_label: 'Descartar',
        selected_option_value: 'descartar',
        in_reply_to: 7,
        frame_confirmed: true,
      });
      expect(types(dispatched)).toContain(REFRESH);
      expect(mockedFetchConversation).toHaveBeenCalledWith(42);
    });

    it('omits frame_confirmed when not confirmed', async () => {
      mockedService.click.mockResolvedValue(undefined);
      const { store } = setupStore();

      await store.dispatch(
        attendanceActions.clickOption({ conversationId: 42, item, messageId: 7 }),
      );

      expect(mockedService.click).toHaveBeenCalledWith(42, {
        selected_option_label: 'Descartar',
        selected_option_value: 'descartar',
        in_reply_to: 7,
      });
    });

    it('rejects a 403 with the server message, without refreshing or logging out', async () => {
      mockedService.click.mockRejectedValue(httpError(403, { error: 'Sem permissão' }));
      const { store, dispatched } = setupStore();

      const result = await store.dispatch(
        attendanceActions.clickOption({ conversationId: 42, item, messageId: 7 }),
      );

      expect(result.type).toBe('attendance/clickOption/rejected');
      expect(result.payload).toEqual({ message: 'Sem permissão' });
      expect(types(dispatched)).not.toContain('auth/logout');
      expect(types(dispatched)).not.toContain(REFRESH);
    });
  });

  describe('runAttendanceAction', () => {
    const body = { action_type: 'vigia_adiar' as const, bucket: null, motivo: 'cliente viajando' };

    it('posts the body and refreshes the conversation', async () => {
      mockedService.action.mockResolvedValue(undefined);
      const { store, dispatched } = setupStore();

      const result = await store.dispatch(
        attendanceActions.runAttendanceAction({ conversationId: 42, body }),
      );

      expect(result.type).toBe('attendance/runAttendanceAction/fulfilled');
      expect(mockedService.action).toHaveBeenCalledWith(42, body);
      expect(types(dispatched)).toContain(REFRESH);
    });

    it('rejects a 422 MOTIVO_REQUIRED with the code the modal recognizes', async () => {
      mockedService.action.mockRejectedValue(
        httpError(422, { code: 'MOTIVO_REQUIRED', error: 'motivo obrigatório' }),
      );
      const { store, dispatched } = setupStore();

      const result = await store.dispatch(
        attendanceActions.runAttendanceAction({ conversationId: 42, body }),
      );

      expect(result.type).toBe('attendance/runAttendanceAction/rejected');
      expect(result.payload).toEqual({
        code: 'MOTIVO_REQUIRED',
        message: 'ATTENDANCE.ADIAR_MODAL.MOTIVO_REQUIRED',
      });
      expect(types(dispatched)).not.toContain(REFRESH);
    });

    it('rejects a 403 with the server message and does not log out', async () => {
      mockedService.action.mockRejectedValue(httpError(403, { error: 'Papel sem permissão' }));
      const { store, dispatched } = setupStore();

      const result = await store.dispatch(
        attendanceActions.runAttendanceAction({ conversationId: 42, body }),
      );

      expect(result.payload).toEqual({ message: 'Papel sem permissão' });
      expect(types(dispatched)).not.toContain('auth/logout');
    });

    it('rejects a network error with the generic message', async () => {
      mockedService.action.mockRejectedValue(new Error('Network Error'));
      const { store } = setupStore();

      const result = await store.dispatch(
        attendanceActions.runAttendanceAction({ conversationId: 42, body }),
      );

      expect(result.payload).toEqual({ message: 'ATTENDANCE.ERROR' });
    });
  });

  describe('fetchAttendanceStatus', () => {
    it('resolves with the raw status', async () => {
      const status: AttendanceStatus = { estado: 'countdown', deadline_at: '2026-10-19T12:00:00Z' };
      mockedService.status.mockResolvedValue(status);
      const { store } = setupStore();

      const result = await store.dispatch(attendanceActions.fetchAttendanceStatus(42));

      expect(mockedService.status).toHaveBeenCalledWith(42);
      expect(result.payload).toEqual(status);
    });

    it('rejects with the attendance error message', async () => {
      mockedService.status.mockRejectedValue(httpError(403, { error: 'Sem acesso' }));
      const { store, dispatched } = setupStore();

      const result = await store.dispatch(attendanceActions.fetchAttendanceStatus(42));

      expect(result.type).toBe('attendance/fetchAttendanceStatus/rejected');
      expect(result.payload).toEqual({ message: 'Sem acesso' });
      expect(types(dispatched)).not.toContain('auth/logout');
    });
  });
});

describe('narrowAttendanceError', () => {
  it('keeps an AttendanceError rejection payload (message and code)', () => {
    expect(narrowAttendanceError({ message: 'sem permissao' })).toEqual({
      message: 'sem permissao',
    });
    expect(narrowAttendanceError({ code: 'MOTIVO_REQUIRED', message: 'curto' })).toEqual({
      code: 'MOTIVO_REQUIRED',
      message: 'curto',
    });
  });

  it('falls back to the generic error for anything else', () => {
    expect(narrowAttendanceError(new Error('boom'))).toEqual({ message: 'ATTENDANCE.ERROR' });
    expect(narrowAttendanceError({ name: 'TypeError', message: 'x is undefined' })).toEqual({
      message: 'ATTENDANCE.ERROR',
    });
    expect(narrowAttendanceError(undefined)).toEqual({ message: 'ATTENDANCE.ERROR' });
    expect(narrowAttendanceError('oops')).toEqual({ message: 'ATTENDANCE.ERROR' });
    expect(narrowAttendanceError({ message: '' })).toEqual({ message: 'ATTENDANCE.ERROR' });
  });
});
