import React from 'react';
import { Pressable, Text } from 'react-native';
import Animated from 'react-native-reanimated';

import { tailwind } from '@/theme';
import { INBOX_TYPES } from '@/constants';
import { Inbox } from '@/types/Inbox';
import { Conversation } from '@/types';
import i18n from '@/i18n';
import { REPLY_POLICY } from '@/constants/url';
import { openURL } from '@/utils/urlUtils';

type ReplyWarningProps = {
  inbox: Inbox;
  conversation: Conversation;
  /** Shown as "Enviar template" when the inbox can send Meta templates. */
  onPressTemplate?: () => void;
};

export const ReplyWarning = (props: ReplyWarningProps) => {
  const { inbox, conversation, onPressTemplate } = props;
  const channel = conversation?.meta?.channel;
  const isAPIChannel = channel === INBOX_TYPES.API;
  const isAWhatsappChannel = channel === INBOX_TYPES.WHATSAPP;

  const replyBannerMessage = () => {
    if (isAWhatsappChannel) {
      return i18n.t('BANNER.TWILIO_WHATSAPP_CAN_REPLY');
    }
    if (isAPIChannel) {
      const { additionalAttributes = {} } = inbox;
      if (additionalAttributes) {
        const agentReplyTimeWindowMessage = additionalAttributes?.agentReplyTimeWindowMessage;
        return agentReplyTimeWindowMessage;
      }
      return '';
    }
    return i18n.t('BANNER.CANNOT_REPLY');
  };

  const replyWindowLink = () => {
    if (isAWhatsappChannel) {
      return REPLY_POLICY.TWILIO_WHATSAPP;
    }
    if (!isAPIChannel) {
      return REPLY_POLICY.FACEBOOK;
    }
    return '';
  };

  const replyWindowLinkText = () => {
    if (isAWhatsappChannel) {
      return i18n.t('BANNER.24_HOURS_WINDOW');
    }
    if (!isAPIChannel) {
      return i18n.t('BANNER.TWILIO_WHATSAPP_24_HOURS_WINDOW');
    }
    return '';
  };

  return (
    <Pressable
      style={tailwind.style('flex flex-row items-center px-4 py-3 max-h-[64px] bg-ruby-700 -z-10')}>
      <Animated.View style={tailwind.style('flex-1')}>
        <Animated.Text
          style={tailwind.style(
            'text-sm tracking-[0.32px] leading-[15px] font-inter-420-20 text-white',
          )}>
          {`${replyBannerMessage()} `}
          <Animated.Text
            onPress={() => openURL({ URL: replyWindowLink() })}
            style={tailwind.style(
              'text-sm tracking-[0.32px] leading-[15px] font-inter-420-20 text-white underline',
            )}>
            {replyWindowLinkText()}
          </Animated.Text>
        </Animated.Text>
      </Animated.View>
      {onPressTemplate ? (
        <Pressable
          onPress={onPressTemplate}
          accessibilityRole="button"
          hitSlop={6}
          testID="reply-warning-send-template"
          style={({ pressed }) =>
            tailwind.style('ml-3 px-3 py-2 rounded-[10px] bg-white', pressed ? 'opacity-70' : '')
          }>
          <Text style={tailwind.style('text-sm font-inter-medium-24 text-ruby-800')}>
            {i18n.t('META_TEMPLATES.SEND_TEMPLATE')}
          </Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
};
