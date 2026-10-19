import React, { useRef, useState } from 'react';
import { Pressable, Text } from 'react-native';
import Animated from 'react-native-reanimated';

import { useAppDispatch, useAppSelector } from '@/hooks';
import i18n from '@/i18n';
import { attendanceActions, type AttendanceError } from '@/store/attendance/attendanceActions';
import { selectConversationById } from '@/store/conversation/conversationSelectors';
import { selectInboxById } from '@/store/inbox/inboxSelectors';
import { tailwind } from '@/theme';
import { Message } from '@/types';
import { showToast } from '@/utils/toastUtils';
import { useAttendanceFlow } from '../attendance/AttendanceFlowHost';
import { MarkdownBubble } from './MarkdownBubble';
import { optionButtons, type OptionButton } from './optionsBubbleViewModel';

export type OptionsBubbleProps = {
  item: Message;
  variant: string;
};

/** Port of cw-arqos OptionsBubble.vue: markdown content + one button per `input_select` item. */
export const OptionsBubble = ({ item, variant }: OptionsBubbleProps) => {
  const dispatch = useAppDispatch();
  const { open } = useAttendanceFlow();
  const { conversationId, content, private: isPrivate } = item;
  const conversation = useAppSelector(state => selectConversationById(state, conversationId));
  const inboxId = conversation?.inboxId ?? item.inboxId;
  const inbox = useAppSelector(state => (inboxId ? selectInboxById(state, inboxId) : undefined));
  const [sending, setSending] = useState(false);
  // Synchronous guard so a double tap in the same frame cannot post twice.
  const sendingRef = useRef(false);

  const buttons = optionButtons(item, { inbox, conversation });

  const handlePress = async ({ flow, item: option }: OptionButton) => {
    if (sendingRef.current) return;
    if (flow !== 'direct') {
      open(flow, { conversationId, replayClick: { item: option, messageId: item.id } });
      return;
    }
    sendingRef.current = true;
    setSending(true);
    try {
      await dispatch(
        attendanceActions.clickOption({ conversationId, item: option, messageId: item.id }),
      ).unwrap();
    } catch (error) {
      const message = (error as AttendanceError | undefined)?.message;
      showToast({ message: message || i18n.t('ATTENDANCE.ERROR') });
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const body = (
    <Animated.View>
      {content ? <MarkdownBubble messageContent={content} variant={variant} /> : null}
      <Animated.View style={tailwind.style('flex flex-row flex-wrap pt-2 gap-2')}>
        {buttons.map((button, index) => (
          <Pressable
            key={`${button.item.value}-${index}`}
            disabled={sending}
            onPress={() => handlePress(button)}
            style={({ pressed }) =>
              tailwind.style(
                'px-4 py-1.5 rounded-full border border-gray-300 bg-white',
                pressed && 'bg-gray-100',
                sending && 'opacity-50',
              )
            }>
            <Text style={tailwind.style('text-sm font-inter-medium-24 text-gray-950')}>
              {button.label}
            </Text>
          </Pressable>
        ))}
      </Animated.View>
    </Animated.View>
  );

  if (!isPrivate) return body;

  return (
    <Animated.View style={tailwind.style('flex flex-row')}>
      <Animated.View style={tailwind.style('w-[3px] bg-amber-700 h-auto rounded-[4px]')} />
      <Animated.View style={tailwind.style('pl-2.5 shrink')}>{body}</Animated.View>
    </Animated.View>
  );
};
