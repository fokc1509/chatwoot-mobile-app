import type { Inbox } from '@/types/Inbox';
import { ATTENDANCE_MENU_FLOWS, attendanceMenuItems } from '../attendanceMenu';

jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));

const commercial = {
  id: 1,
  automacoesComerciais: { enabled: true, botoes: { enabled: true } },
} as unknown as Inbox;
const regular = { id: 2 } as unknown as Inbox;

describe('attendanceMenuItems', () => {
  it('returns null for a non-commercial inbox (default menu)', () => {
    expect(attendanceMenuItems({ inbox: regular, status: 'open' })).toBeNull();
    expect(attendanceMenuItems({ inbox: regular, status: 'pending' })).toBeNull();
  });

  it('returns null when the inbox is unknown', () => {
    expect(attendanceMenuItems({ inbox: undefined, status: 'open' })).toBeNull();
    expect(attendanceMenuItems({ inbox: null, status: 'open' })).toBeNull();
  });

  it('offers only Descartar for a pending conversation', () => {
    expect(attendanceMenuItems({ inbox: commercial, status: 'pending' })).toEqual(['descartar']);
  });

  it('offers Descartar, Adiar and IA for an open conversation', () => {
    expect(attendanceMenuItems({ inbox: commercial, status: 'open' })).toEqual([
      'descartar',
      'adiar',
      'ia',
    ]);
  });

  it('offers all three items for other non-pending statuses', () => {
    expect(attendanceMenuItems({ inbox: commercial, status: 'snoozed' })).toEqual([
      'descartar',
      'adiar',
      'ia',
    ]);
    expect(attendanceMenuItems({ inbox: commercial, status: undefined })).toEqual([
      'descartar',
      'adiar',
      'ia',
    ]);
  });
});

describe('ATTENDANCE_MENU_FLOWS', () => {
  it('maps each menu item to its attendance flow', () => {
    expect(ATTENDANCE_MENU_FLOWS).toEqual({ descartar: 'discard', adiar: 'adiar', ia: 'ia' });
  });
});
