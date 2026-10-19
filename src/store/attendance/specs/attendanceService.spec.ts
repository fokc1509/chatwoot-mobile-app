import { apiService } from '@/services/APIService';
import { AttendanceService, getAttendanceErrorMessage } from '../attendanceService';

jest.mock('@/i18n', () => ({
  t: (key: string) => key,
}));

jest.mock('@/services/APIService', () => ({
  apiService: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('AttendanceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('click() posts the body to interactive_messages opting out of the global handler', async () => {
    (apiService.post as jest.Mock).mockResolvedValueOnce({ data: { id: 1 } });
    const body = { selected_option_label: 'Sim', selected_option_value: 'sim', in_reply_to: 55 };

    await expect(AttendanceService.click(42, body)).resolves.toBeUndefined();

    expect(apiService.post).toHaveBeenCalledWith('conversations/42/interactive_messages', body, {
      skipGlobalErrorHandler: true,
    });
  });

  it('action() posts the body to attendance_action', async () => {
    (apiService.post as jest.Mock).mockResolvedValueOnce({ data: '' });
    const body = { action_type: 'switch_to_ia' as const, bucket: null, motivo: null };

    await expect(AttendanceService.action(42, body)).resolves.toBeUndefined();

    expect(apiService.post).toHaveBeenCalledWith('conversations/42/attendance_action', body, {
      skipGlobalErrorHandler: true,
    });
  });

  it('status() gets attendance_action/status and returns the raw snake_case payload', async () => {
    const data = {
      estado: 'aprovacao_pendente',
      tipo: 'descarte',
      pode_aprovar: true,
      message_id: 99,
      opcoes: [{ label: 'Aprovar', value: 'aprovar' }],
      contexto: { motivo: 'Não responde', bucket: 'descartado' },
    };
    (apiService.get as jest.Mock).mockResolvedValueOnce({ data });

    const response = await AttendanceService.status(42);

    expect(apiService.get).toHaveBeenCalledWith('conversations/42/attendance_action/status', {
      skipGlobalErrorHandler: true,
    });
    expect(response).toEqual(data);
  });
});

describe('getAttendanceErrorMessage', () => {
  it('maps MOTIVO_REQUIRED to the adiar modal text', () => {
    const error = {
      response: {
        status: 422,
        data: { error: 'motivo obrigatorio (minimo 5 caracteres)', code: 'MOTIVO_REQUIRED' },
      },
    };
    expect(getAttendanceErrorMessage(error)).toBe('ATTENDANCE.ADIAR_MODAL.MOTIVO_REQUIRED');
  });

  it('returns the server error for a 403', () => {
    const error = {
      response: {
        status: 403,
        data: { error: 'Você não tem permissão para responder este botão.' },
      },
    };
    expect(getAttendanceErrorMessage(error)).toBe(
      'Você não tem permissão para responder este botão.',
    );
  });

  it('returns the server error for a 422', () => {
    const error = {
      response: { status: 422, data: { error: 'bucket e motivo sao obrigatorios' } },
    };
    expect(getAttendanceErrorMessage(error)).toBe('bucket e motivo sao obrigatorios');
  });

  it('falls back to the server message field', () => {
    const error = { response: { status: 422, data: { message: 'Algo deu errado' } } };
    expect(getAttendanceErrorMessage(error)).toBe('Algo deu errado');
  });

  it('returns the generic key for 5xx, network and malformed errors', () => {
    expect(getAttendanceErrorMessage({ response: { status: 500, data: { error: 'boom' } } })).toBe(
      'ATTENDANCE.ERROR',
    );
    expect(getAttendanceErrorMessage(new Error('Network Error'))).toBe('ATTENDANCE.ERROR');
    expect(getAttendanceErrorMessage({ response: { status: 403, data: {} } })).toBe(
      'ATTENDANCE.ERROR',
    );
    expect(getAttendanceErrorMessage(undefined)).toBe('ATTENDANCE.ERROR');
  });
});
