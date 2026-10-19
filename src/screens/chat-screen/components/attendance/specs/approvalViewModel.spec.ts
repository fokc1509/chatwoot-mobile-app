import type { AttendanceStatus } from '@/store/attendance/attendanceTypes';
import {
  approvalBannerModel,
  approvalContextLines,
  approvalRefreshKey,
  approvalTitleKey,
  createLatestRequestGuard,
} from '../approvalViewModel';

const pendente = (
  overrides: Partial<Extract<AttendanceStatus, { estado: 'aprovacao_pendente' }>> = {},
) =>
  ({
    estado: 'aprovacao_pendente',
    tipo: 'descarte',
    pode_aprovar: true,
    message_id: 42,
    opcoes: [
      { label: 'Aprovar', value: 'aprovar' },
      { label: 'Negar', value: 'negar' },
    ],
    contexto: { motivo: 'Não responde', bucket: 'reativacao', solicitante: 'Ana' },
    ...overrides,
  }) as AttendanceStatus;

describe('approvalBannerModel', () => {
  it.each<AttendanceStatus | null | undefined>([
    { estado: 'aguardando_acao' },
    { estado: 'countdown', deadline_at: '2026-10-19T10:00:00Z' },
    { estado: 'sem_cobranca', motivo: 'resolvida' },
    null,
    undefined,
  ])('returns null for non-pending status %p', status => {
    expect(approvalBannerModel(status)).toBeNull();
  });

  it('returns null when the user cannot approve', () => {
    expect(approvalBannerModel(pendente({ pode_aprovar: false }))).toBeNull();
  });

  it('returns null without options or message id', () => {
    expect(approvalBannerModel(pendente({ opcoes: [] }))).toBeNull();
    expect(
      approvalBannerModel(pendente({ message_id: undefined as unknown as number })),
    ).toBeNull();
  });

  it('maps a pending approval the user can decide', () => {
    expect(approvalBannerModel(pendente())).toEqual({
      tipo: 'descarte',
      contexto: { motivo: 'Não responde', bucket: 'reativacao', solicitante: 'Ana' },
      opcoes: [
        { label: 'Aprovar', value: 'aprovar' },
        { label: 'Negar', value: 'negar' },
      ],
      messageId: 42,
    });
  });

  it('drops malformed options and tolerates a missing contexto', () => {
    const model = approvalBannerModel(
      pendente({
        opcoes: [
          { label: 'Aprovar', value: 'aprovar' },
          { label: '', value: 'x' },
          null as unknown as { label: string; value: string },
        ],
        contexto: undefined as unknown as Record<string, never>,
      }),
    );
    expect(model?.opcoes).toEqual([{ label: 'Aprovar', value: 'aprovar' }]);
    expect(model?.contexto).toEqual({});
  });
});

describe('approvalTitleKey', () => {
  it('uses the discard title only for descarte (same as the web)', () => {
    expect(approvalTitleKey('descarte')).toBe('ATTENDANCE.APPROVAL.DESCARTE_TITLE');
    expect(approvalTitleKey('adiamento')).toBe('ATTENDANCE.APPROVAL.ADIAMENTO_TITLE');
    expect(approvalTitleKey('devolucao_ia')).toBe('ATTENDANCE.APPROVAL.ADIAMENTO_TITLE');
  });
});

describe('approvalContextLines', () => {
  it('lists solicitante, motivo and bucket in web order, skipping absent ones', () => {
    expect(approvalContextLines({ bucket: 'descartado', solicitante: 'Ana', motivo: 'x' })).toEqual(
      [
        { key: 'ATTENDANCE.APPROVAL.SOLICITANTE', params: { nome: 'Ana' } },
        { key: 'ATTENDANCE.APPROVAL.MOTIVO', params: { motivo: 'x' } },
        { key: 'ATTENDANCE.APPROVAL.BUCKET', params: { bucket: 'descartado' } },
      ],
    );
    expect(approvalContextLines({ streak: 2 })).toEqual([]);
  });
});

describe('approvalRefreshKey', () => {
  it('changes when status or lastActivityAt change', () => {
    const base = { id: 1, status: 'open', lastActivityAt: 20 };
    const key = approvalRefreshKey(base);
    expect(approvalRefreshKey({ ...base })).toBe(key);
    expect(approvalRefreshKey({ ...base, status: 'resolved' })).not.toBe(key);
    expect(approvalRefreshKey({ ...base, id: 2 })).not.toBe(key);
    expect(approvalRefreshKey({ ...base, lastActivityAt: 21 })).not.toBe(key);
    expect(approvalRefreshKey(undefined)).toBe('');
  });
});

describe('createLatestRequestGuard', () => {
  it('only accepts the latest request for the current conversation', () => {
    const guard = createLatestRequestGuard();
    const first = guard.begin(1);
    const second = guard.begin(1);
    expect(guard.isCurrent(first, 1)).toBe(false);
    expect(guard.isCurrent(second, 1)).toBe(true);
    expect(guard.isCurrent(second, 2)).toBe(false);
    const other = guard.begin(2);
    expect(guard.isCurrent(second, 1)).toBe(false);
    expect(guard.isCurrent(other, 2)).toBe(true);
  });
});
