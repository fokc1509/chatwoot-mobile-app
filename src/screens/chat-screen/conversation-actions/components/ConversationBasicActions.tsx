import React, { useEffect } from 'react';
import { Dimensions, Pressable } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Icon } from '@/components-next';
import {
  OpenIcon,
  ResolvedFilledIcon,
  PendingFilledIcon,
  SnoozedFilledIcon,
  Trash,
} from '@/svg-icons';
import { tailwind } from '@/theme';
import { useHaptic, useScaleAnimation } from '@/utils';
import { ConversationStatus } from '@/types';
import i18n from '@/i18n';
import type { AttendanceMenuItem } from '@/store/attendance/attendanceMenu';

import { ConversationActionType } from '../ConversationActions';

type ConversationStateType = 'open' | 'pending' | 'snooze' | 'resolve';

type ConversationActionOptionsType = {
  backgroundActionColor: string;
  backgroundActionPressedColor: string;
  borderActionColor: string;
  actionIcon: React.JSX.Element;
  actionText: ConversationStateType;
  actionStatus: ConversationStatus | 'open';
  /** Commercial inbox item: opens the attendance flow instead of changing the status. */
  attendanceItem?: AttendanceMenuItem;
  label?: string;
};

const SCREEN_WIDTH = Dimensions.get('screen').width;
const ACTION_WIDTH = (SCREEN_WIDTH - 32 - 12 * 3) / 4;

const conversationActionOptions: ConversationActionOptionsType[] = [
  {
    backgroundActionColor: 'bg-gray-100',
    backgroundActionPressedColor: 'bg-gray-200',
    borderActionColor: 'bg-gray-700',
    actionIcon: <OpenIcon stroke={tailwind.color('text-gray-700') as string} />,
    actionText: 'open',
    actionStatus: 'open',
  },
  {
    backgroundActionColor: 'bg-amber-100',
    backgroundActionPressedColor: 'bg-amber-200',
    borderActionColor: 'bg-amber-700',
    actionIcon: <PendingFilledIcon />,
    actionText: 'pending',
    actionStatus: 'pending',
  },
  {
    backgroundActionColor: 'bg-indigo-100',
    backgroundActionPressedColor: 'bg-indigo-200',
    borderActionColor: 'bg-indigo-700',
    actionIcon: <SnoozedFilledIcon />,
    actionText: 'snooze',
    actionStatus: 'snoozed',
  },
  {
    backgroundActionColor: 'bg-green-100',
    backgroundActionPressedColor: 'bg-green-200',
    borderActionColor: 'bg-green-700',
    actionIcon: <ResolvedFilledIcon />,
    actionText: 'resolve',
    actionStatus: 'resolved',
  },
];

const attendanceActionOptions: Record<AttendanceMenuItem, ConversationActionOptionsType> = {
  descartar: {
    backgroundActionColor: 'bg-ruby-100',
    backgroundActionPressedColor: 'bg-ruby-200',
    borderActionColor: 'bg-ruby-700',
    actionIcon: <Trash />,
    actionText: 'resolve',
    actionStatus: 'resolved',
    attendanceItem: 'descartar',
  },
  adiar: {
    backgroundActionColor: 'bg-indigo-100',
    backgroundActionPressedColor: 'bg-indigo-200',
    borderActionColor: 'bg-indigo-700',
    actionIcon: <SnoozedFilledIcon />,
    actionText: 'snooze',
    actionStatus: 'snoozed',
    attendanceItem: 'adiar',
  },
  ia: {
    backgroundActionColor: 'bg-amber-100',
    backgroundActionPressedColor: 'bg-amber-200',
    borderActionColor: 'bg-amber-700',
    actionIcon: <PendingFilledIcon />,
    actionText: 'pending',
    actionStatus: 'pending',
    attendanceItem: 'ia',
  },
};

const ATTENDANCE_LABEL_KEYS: Record<AttendanceMenuItem, string> = {
  descartar: 'ATTENDANCE.MENU.DESCARTAR',
  adiar: 'ATTENDANCE.MENU.ADIAR',
  ia: 'ATTENDANCE.MENU.IA',
};

// Commercial inbox: "open" stays, the other status items become the attendance items.
const buildAttendanceOptions = (items: AttendanceMenuItem[]): ConversationActionOptionsType[] => [
  conversationActionOptions[0],
  ...items.map(item => ({
    ...attendanceActionOptions[item],
    label: i18n.t(ATTENDANCE_LABEL_KEYS[item]),
  })),
];

type ConversationActionOptionProps = {
  index: number;
  optionsCount: number;
  conversationAction: ConversationActionOptionsType;
  status: ConversationStatus | undefined;
  isMuted: boolean | false;
  updateConversationStatus: (type: ConversationActionType, status?: ConversationStatus) => void;
  onAttendanceAction?: (item: AttendanceMenuItem) => void;
};

const ConversationActionOption = (props: ConversationActionOptionProps) => {
  const {
    index,
    optionsCount,
    conversationAction,
    status,
    updateConversationStatus,
    isMuted,
    onAttendanceAction,
  } = props;

  const hapticSelection = useHaptic();

  const handleActionOptionPress = () => {
    hapticSelection?.();
    if (conversationAction.attendanceItem) {
      onAttendanceAction?.(conversationAction.attendanceItem);
      return;
    }
    updateConversationStatus('status', conversationAction.actionStatus as ConversationStatus);
  };
  const actionActive = useSharedValue(0);

  const { handlers, animatedStyle } = useScaleAnimation();

  useEffect(() => {
    // Attendance items are actions, not statuses: never shown as the current one.
    if (!conversationAction.attendanceItem && conversationAction.actionStatus === status) {
      actionActive.value = withSpring(1);
    } else {
      actionActive.value = withSpring(0);
    }
  }, [
    actionActive,
    conversationAction.actionStatus,
    conversationAction.actionText,
    conversationAction.attendanceItem,
    status,
    isMuted,
  ]);

  const actionBorderColor = tailwind.color(conversationAction.borderActionColor) as string;

  const activeActionContainerStyle = useAnimatedStyle(() => {
    return {
      borderColor: interpolateColor(actionActive.value, [0, 1], ['transparent', actionBorderColor]),
    };
  });

  return (
    <Animated.View
      style={[tailwind.style('flex-1', index !== optionsCount - 1 ? 'mr-3' : ''), animatedStyle]}>
      <Pressable
        key={index}
        style={({ pressed }) => [
          tailwind.style(
            'flex items-center justify-between rounded-xl pt-7 pb-3',
            `w-[${ACTION_WIDTH}px]`,
            conversationAction.backgroundActionColor,
            pressed ? conversationAction.backgroundActionPressedColor : '',
          ),
        ]}
        onPress={handleActionOptionPress}
        {...handlers}>
        <Animated.View
          style={[
            tailwind.style('absolute inset-0 border-2 rounded-xl'),
            activeActionContainerStyle,
          ]}
        />
        <Icon icon={conversationAction.actionIcon} size={32} />
        <Animated.Text
          style={tailwind.style(
            'text-md font-inter-normal-20 leading-[17px] tracking-[0.32px] text-center pt-5 text-gray-950 ',
            conversationAction.label ? '' : 'capitalize',
          )}>
          {conversationAction.label ?? conversationAction.actionText}
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
};

type ConversationBasicActionsProps = {
  status: ConversationStatus | undefined;
  updateConversationStatus: (type: ConversationActionType, status?: ConversationStatus) => void;
  isMuted: boolean | false;
  /** From attendanceMenuItems: null/undefined keeps the default status items. */
  attendanceItems?: AttendanceMenuItem[] | null;
  onAttendanceAction?: (item: AttendanceMenuItem) => void;
};

export const ConversationBasicActions = (props: ConversationBasicActionsProps) => {
  const { status, updateConversationStatus, isMuted, attendanceItems, onAttendanceAction } = props;
  const options = attendanceItems
    ? buildAttendanceOptions(attendanceItems)
    : conversationActionOptions;

  return (
    <Animated.View style={tailwind.style('flex flex-row justify-around px-4 pt-5')}>
      {options.map((conversationAction, index) => (
        <ConversationActionOption
          key={index}
          optionsCount={options.length}
          onAttendanceAction={onAttendanceAction}
          conversationAction={conversationAction}
          status={status}
          isMuted={isMuted}
          updateConversationStatus={updateConversationStatus}
          index={index}
        />
      ))}
    </Animated.View>
  );
};
