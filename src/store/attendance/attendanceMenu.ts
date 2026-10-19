import type { Inbox } from '@/types/Inbox';
import type { ConversationStatus } from '@/types/common/ConversationStatus';
import { isCommercialInbox } from './attendanceRules';
import type { OptionFlow } from './attendanceTypes';

export type AttendanceMenuItem = 'descartar' | 'adiar' | 'ia';

// Flow opened by each menu item (useAttendanceFlow().open).
export const ATTENDANCE_MENU_FLOWS: Record<
  AttendanceMenuItem,
  Extract<OptionFlow, 'discard' | 'adiar' | 'ia'>
> = {
  descartar: 'discard',
  adiar: 'adiar',
  ia: 'ia',
};

type MenuInput = {
  /** Inbox of the conversation as found in the store (undefined while not loaded). */
  inbox: Inbox | null | undefined;
  status: ConversationStatus | undefined;
};

/**
 * Whether the inbox of a conversation still has to be loaded before deciding between the
 * default and the attendance menus (e.g. cold start from a push, before the tabs fetch the
 * inboxes). Unknown inbox is treated as loading, never as non-commercial.
 */
export const isAttendanceInboxLoading = ({ inbox }: Pick<MenuInput, 'inbox'>): boolean => !inbox;

/**
 * Status actions for the chat header, the conversation actions screen and the
 * single-conversation menu in the list (port of cw-arqos ResolveAction.vue).
 * - `null`: the inbox is not commercial, keep the default menu.
 * - `[]`: nothing but "open" (reopen) — snoozed conversation, or inbox still loading.
 * Per status, as on the web dropdown: pending → Descartar; snoozed → none;
 * resolved → Adiar + IA; open (and unknown status) → Descartar + Adiar + IA.
 */
export const attendanceMenuItems = ({ inbox, status }: MenuInput): AttendanceMenuItem[] | null => {
  if (isAttendanceInboxLoading({ inbox })) return [];
  if (!isCommercialInbox(inbox)) return null;
  switch (status) {
    case 'pending':
      return ['descartar'];
    case 'snoozed':
      return [];
    case 'resolved':
      return ['adiar', 'ia'];
    default:
      return ['descartar', 'adiar', 'ia'];
  }
};

/** Chat header status button. */
export type HeaderStatusAction = 'hidden' | 'discard' | 'reopen' | 'resolve';

/**
 * Header status button: stock toggle (resolve / reopen) for non-commercial inboxes;
 * for commercial ones Descartar when the menu offers it, otherwise reopen (resolved and
 * snoozed, like the web main button). Hidden while the inbox is loading.
 */
export const headerStatusAction = ({ inbox, status }: MenuInput): HeaderStatusAction => {
  if (isAttendanceInboxLoading({ inbox })) return 'hidden';
  const items = attendanceMenuItems({ inbox, status });
  if (items === null) return status === 'resolved' ? 'reopen' : 'resolve';
  if (status !== 'resolved' && items.includes('descartar')) return 'discard';
  return 'reopen';
};
