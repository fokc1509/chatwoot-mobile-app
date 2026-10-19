import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text } from 'react-native';
import Animated from 'react-native-reanimated';

import { useAppDispatch, useAppSelector } from '@/hooks';
import i18n from '@/i18n';
import { attendanceActions, narrowAttendanceError } from '@/store/attendance/attendanceActions';
import type {
  AttendanceApprovalOption,
  AttendanceStatus,
} from '@/store/attendance/attendanceTypes';
import { selectConversationById } from '@/store/conversation/conversationSelectors';
import { tailwind } from '@/theme';
import { showToast } from '@/utils/toastUtils';
import {
  approvalBannerModel,
  approvalContextLines,
  approvalRefreshKey,
  approvalTitleKey,
  createLatestRequestGuard,
} from './approvalViewModel';

/**
 * Supervisor Aprovar/Negar banner (port of the web sheet's `aprovacao` view). Mount only
 * for commercial inboxes. Status is re-read on open and whenever the conversation's
 * status/lastActivityAt change; fetch errors simply hide the banner.
 */
export const ApprovalBanner = ({ conversationId }: { conversationId: number }) => {
  const dispatch = useAppDispatch();
  const conversation = useAppSelector(state => selectConversationById(state, conversationId));
  const refreshKey = approvalRefreshKey(conversation);
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [sending, setSending] = useState(false);
  // Synchronous guard so a double tap in the same frame cannot post twice.
  const sendingRef = useRef(false);
  const guardRef = useRef(createLatestRequestGuard());
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  const refresh = useCallback(async () => {
    const token = guardRef.current.begin(conversationId);
    try {
      const next = await dispatch(attendanceActions.fetchAttendanceStatus(conversationId)).unwrap();
      if (guardRef.current.isCurrent(token, conversationIdRef.current)) setStatus(next);
    } catch {
      if (guardRef.current.isCurrent(token, conversationIdRef.current)) setStatus(null);
    }
  }, [dispatch, conversationId]);

  useEffect(() => {
    setStatus(null);
  }, [conversationId]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  const model = approvalBannerModel(status);
  if (!model) return null;

  const handlePress = async ({ label, value }: AttendanceApprovalOption) => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      await dispatch(
        attendanceActions.clickOption({
          conversationId,
          item: { title: label, value },
          messageId: model.messageId,
        }),
      ).unwrap();
      // No explicit refetch: clickOption refreshes the conversation, and the status is
      // re-read when its status/lastActivityAt change (refreshKey effect).
    } catch (error) {
      showToast({ message: narrowAttendanceError(error).message });
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <Animated.View style={tailwind.style('px-4 py-3 gap-2 bg-amber-50 border-b border-amber-200')}>
      <Text style={tailwind.style('text-sm font-inter-semibold-20 text-gray-950')}>
        {i18n.t(approvalTitleKey(model.tipo))}
      </Text>
      {approvalContextLines(model.contexto).map(line => (
        <Text key={line.key} style={tailwind.style('text-sm font-inter-normal-20 text-gray-700')}>
          {i18n.t(line.key, line.params)}
        </Text>
      ))}
      <Animated.View style={tailwind.style('flex flex-row flex-wrap gap-2 pt-1')}>
        {model.opcoes.map((opcao, index) => (
          <Pressable
            key={`${opcao.value}-${index}`}
            disabled={sending}
            onPress={() => handlePress(opcao)}
            style={({ pressed }) =>
              tailwind.style(
                'px-4 py-2 rounded-lg',
                index === 0 ? 'bg-blue-800' : 'border border-gray-300 bg-white',
                pressed && 'opacity-80',
                sending && 'opacity-50',
              )
            }>
            <Text
              style={tailwind.style(
                'text-sm font-inter-medium-24',
                index === 0 ? 'text-white' : 'text-gray-950',
              )}>
              {opcao.label}
            </Text>
          </Pressable>
        ))}
      </Animated.View>
    </Animated.View>
  );
};
