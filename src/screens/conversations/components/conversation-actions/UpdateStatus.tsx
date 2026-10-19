import React from 'react';
import { Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { BottomSheetView } from '@gorhom/bottom-sheet';

import { useRefsContext } from '@/context';
import { tailwind } from '@/theme';
import { ConversationStatus, StatusCollection } from '@/types';
import { getStatusTypeIcon, useHaptic } from '@/utils';
import { BottomSheetHeader, Icon } from '@/components-next';
import { useAppDispatch, useAppSelector } from '@/hooks';
import {
  selectSelectedConversation,
  selectSelectedIds,
} from '@/store/conversation/conversationSelectedSlice';
import { conversationActions } from '@/store/conversation/conversationActions';
import { setCurrentState } from '@/store/conversation/conversationHeaderSlice';
import i18n from '@/i18n';
import { StatusOptions } from '@/types';
import { Trash } from '@/svg-icons';
import { selectInboxById } from '@/store/inbox/inboxSelectors';
import {
  ATTENDANCE_MENU_FLOWS,
  AttendanceMenuItem,
  attendanceMenuItems,
} from '@/store/attendance/attendanceMenu';
import { useAttendanceFlow } from '@/screens/chat-screen/components/attendance/AttendanceFlowHost';
type StatusCellProps = {
  value: StatusCollection;
  isLastItem: boolean;
  onPress: (status: ConversationStatus) => void;
  /** Attendance items show their own label instead of the status name. */
  label?: string;
};

const StatusList: StatusCollection[] = [
  { id: 'open', icon: getStatusTypeIcon('open') },
  { id: 'pending', icon: getStatusTypeIcon('pending') },
  { id: 'snoozed', icon: getStatusTypeIcon('snoozed') },
  { id: 'resolved', icon: getStatusTypeIcon('resolved') },
];

const StatusCell = (props: StatusCellProps) => {
  const { value, isLastItem, onPress, label } = props;
  return (
    <Pressable
      onPress={() => onPress(value.id)}
      style={tailwind.style('flex flex-row items-center')}>
      <Animated.View>
        <Icon icon={value.icon} size={24} />
      </Animated.View>
      <Animated.View
        style={tailwind.style(
          'flex-1 ml-3 flex-row justify-between py-[11px] pr-3',
          !isLastItem ? 'border-b-[1px] border-blackA-A3' : '',
        )}>
        <Animated.Text
          style={tailwind.style(
            'text-base text-gray-950 font-inter-420-20 leading-[21px] tracking-[0.16px]',
            label ? '' : 'capitalize',
          )}>
          {label ??
            i18n.t(`CONVERSATION.ASSIGNEE.STATUS.OPTIONS.${StatusOptions[value.id].toUpperCase()}`)}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
};

// Commercial inbox (single conversation): status items replaced by the attendance items.
const ATTENDANCE_CELLS: Record<AttendanceMenuItem, { value: StatusCollection; labelKey: string }> =
  {
    descartar: {
      value: { id: 'resolved', icon: <Trash /> },
      labelKey: 'ATTENDANCE.MENU.DESCARTAR',
    },
    adiar: {
      value: { id: 'snoozed', icon: getStatusTypeIcon('snoozed') },
      labelKey: 'ATTENDANCE.MENU.ADIAR',
    },
    ia: {
      value: { id: 'pending', icon: getStatusTypeIcon('pending') },
      labelKey: 'ATTENDANCE.MENU.IA',
    },
  };

const filterStatusList = (status: ConversationStatus) => {
  return StatusList.filter(item => item.id !== status);
};

export const UpdateStatus = () => {
  const { actionsModalSheetRef } = useRefsContext();

  const dispatch = useAppDispatch();
  const selectedIds = useAppSelector(selectSelectedIds);
  const selectedConversation = useAppSelector(selectSelectedConversation);
  const isMultipleConversationsSelected = selectedIds.length !== 0;
  const inbox = useAppSelector(state =>
    selectedConversation ? selectInboxById(state, selectedConversation.inboxId) : undefined,
  );
  const attendanceFlow = useAttendanceFlow();
  // Bulk selection keeps the default status list.
  const attendanceItems = isMultipleConversationsSelected
    ? null
    : attendanceMenuItems({ inbox, status: selectedConversation?.status });
  const defaultStatusList = isMultipleConversationsSelected
    ? StatusList
    : filterStatusList(selectedConversation?.status || 'open');
  const statusList = attendanceItems
    ? defaultStatusList.filter(item => item.id === 'open')
    : defaultStatusList;

  const hapticSelection = useHaptic();

  const handleStatusPress = (status: ConversationStatus) => {
    hapticSelection?.();
    if (isMultipleConversationsSelected) {
      const payload = { type: 'Conversation', ids: selectedIds, fields: { status } };
      dispatch(conversationActions.bulkAction(payload));
      actionsModalSheetRef.current?.dismiss({ overshootClamping: true });
      dispatch(setCurrentState('none'));
    } else {
      if (!selectedConversation?.id) return;
      dispatch(
        conversationActions.toggleConversationStatus({
          conversationId: selectedConversation?.id,
          payload: {
            status,
            snoozed_until: null,
          },
        }),
      );
      actionsModalSheetRef.current?.dismiss({ overshootClamping: true });
    }
  };

  const handleAttendancePress = (item: AttendanceMenuItem) => {
    hapticSelection?.();
    if (!selectedConversation?.id) return;
    // Close the sheet first; the flow host shows its own modal (no completion callback).
    actionsModalSheetRef.current?.dismiss({ overshootClamping: true });
    attendanceFlow.open(ATTENDANCE_MENU_FLOWS[item], { conversationId: selectedConversation.id });
  };

  return (
    <BottomSheetView>
      <BottomSheetHeader headerText={i18n.t('CONVERSATION.CHANGE_STATUS')} />
      <Animated.View style={tailwind.style('py-1 pl-3')}>
        {statusList.map((value, index) => (
          <StatusCell
            key={index}
            {...{
              value,
              isLastItem: index === statusList.length - 1 && !attendanceItems?.length,
            }}
            onPress={() => handleStatusPress(value.id)}
          />
        ))}
        {attendanceItems?.map((item, index) => (
          <StatusCell
            key={item}
            value={ATTENDANCE_CELLS[item].value}
            label={i18n.t(ATTENDANCE_CELLS[item].labelKey)}
            isLastItem={index === attendanceItems.length - 1}
            onPress={() => handleAttendancePress(item)}
          />
        ))}
      </Animated.View>
    </BottomSheetView>
  );
};
