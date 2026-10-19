import { resolveOptionFlow, type OptionFlowContext } from '@/store/attendance/attendanceRules';
import type { MessageOptionItem, OptionFlow } from '@/store/attendance/attendanceTypes';
import type { Message } from '@/types/Message';

export type OptionButton = { label: string; flow: OptionFlow; item: MessageOptionItem };

/** Like the web (OptionsBubble.vue): every `input_select` with items is a clickable bubble. */
export const isOptionsMessage = (message: Pick<Message, 'contentType' | 'contentAttributes'>) =>
  message.contentType === 'input_select' && (message.contentAttributes?.items?.length ?? 0) > 0;

/** One button per item; the flow is `direct` unless it is a follow-up note in a commercial inbox. */
export const optionButtons = (
  message: Pick<Message, 'contentAttributes'>,
  ctx: Omit<OptionFlowContext, 'message'>,
): OptionButton[] =>
  (message.contentAttributes?.items ?? []).map(item => ({
    label: item.title,
    flow: resolveOptionFlow(item, { ...ctx, message }),
    item,
  }));
