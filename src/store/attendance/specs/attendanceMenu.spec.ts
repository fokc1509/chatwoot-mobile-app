import type { Inbox } from '@/types/Inbox';
import {
  ATTENDANCE_MENU_FLOWS,
  attendanceMenuItems,
  headerStatusAction,
  isAttendanceInboxLoading,
} from '../attendanceMenu';

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
    expect(attendanceMenuItems({ inbox: regular, status: 'snoozed' })).toBeNull();
    expect(attendanceMenuItems({ inbox: regular, status: 'resolved' })).toBeNull();
  });

  it('treats an unknown inbox as loading: no status items, never the default menu', () => {
    expect(attendanceMenuItems({ inbox: undefined, status: 'open' })).toEqual([]);
    expect(attendanceMenuItems({ inbox: null, status: 'open' })).toEqual([]);
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
    expect(attendanceMenuItems({ inbox: commercial, status: undefined })).toEqual([
      'descartar',
      'adiar',
      'ia',
    ]);
  });

  it('offers no attendance item for a snoozed conversation (only reopen, as on the web)', () => {
    expect(attendanceMenuItems({ inbox: commercial, status: 'snoozed' })).toEqual([]);
  });

  it('offers Adiar and IA for a resolved conversation (as on the web)', () => {
    expect(attendanceMenuItems({ inbox: commercial, status: 'resolved' })).toEqual(['adiar', 'ia']);
  });
});

describe('isAttendanceInboxLoading', () => {
  it('is true only while the inbox is not in the store', () => {
    expect(isAttendanceInboxLoading({ inbox: undefined })).toBe(true);
    expect(isAttendanceInboxLoading({ inbox: null })).toBe(true);
    expect(isAttendanceInboxLoading({ inbox: regular })).toBe(false);
    expect(isAttendanceInboxLoading({ inbox: commercial })).toBe(false);
  });
});

describe('headerStatusAction', () => {
  it('hides the button while the inbox is loading', () => {
    expect(headerStatusAction({ inbox: undefined, status: 'open' })).toBe('hidden');
    expect(headerStatusAction({ inbox: undefined, status: 'resolved' })).toBe('hidden');
  });

  it('keeps the stock toggle for a non-commercial inbox', () => {
    expect(headerStatusAction({ inbox: regular, status: 'open' })).toBe('resolve');
    expect(headerStatusAction({ inbox: regular, status: 'pending' })).toBe('resolve');
    expect(headerStatusAction({ inbox: regular, status: 'snoozed' })).toBe('resolve');
    expect(headerStatusAction({ inbox: regular, status: 'resolved' })).toBe('reopen');
  });

  it('uses Descartar for open/pending commercial conversations and reopen otherwise', () => {
    expect(headerStatusAction({ inbox: commercial, status: 'open' })).toBe('discard');
    expect(headerStatusAction({ inbox: commercial, status: 'pending' })).toBe('discard');
    expect(headerStatusAction({ inbox: commercial, status: 'snoozed' })).toBe('reopen');
    expect(headerStatusAction({ inbox: commercial, status: 'resolved' })).toBe('reopen');
  });
});

describe('ATTENDANCE_MENU_FLOWS', () => {
  it('maps each menu item to its attendance flow', () => {
    expect(ATTENDANCE_MENU_FLOWS).toEqual({ descartar: 'discard', adiar: 'adiar', ia: 'ia' });
  });
});
