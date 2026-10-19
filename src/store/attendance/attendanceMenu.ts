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

/**
 * Status actions for the chat header, the conversation actions screen and the
 * single-conversation menu in the list (port of cw-arqos ResolveAction.vue and the
 * card context menu). `null` means the inbox is not commercial: keep the default menu.
 * A pending conversation (IA attendance) only offers Descartar, as on the web.
 */
export const attendanceMenuItems = ({
  inbox,
  status,
}: {
  inbox: Inbox | null | undefined;
  status: ConversationStatus | undefined;
}): AttendanceMenuItem[] | null => {
  if (!isCommercialInbox(inbox)) return null;
  if (status === 'pending') return ['descartar'];
  return ['descartar', 'adiar', 'ia'];
};
