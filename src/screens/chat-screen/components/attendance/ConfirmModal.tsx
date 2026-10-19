import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import I18n from '@/i18n';
import { tailwind } from '@/theme';
import { LigacaoButton } from '@/screens/ligacoes/components/LigacaoButton';

interface AttendanceModalShellProps {
  visible: boolean;
  title: string;
  /** Close request (backdrop / Android back); ignored while submitting. */
  onCancel: () => void;
  submitting: boolean;
  /** Hidden when absent (discard step 1 has no confirm, like the web). */
  confirmLabel?: string;
  confirmDisabled?: boolean;
  onConfirm?: () => void;
  cancelLabel?: string;
  children?: React.ReactNode;
}

/** Bottom sheet shared by the attendance modals (same look as the app's option sheets). */
export const AttendanceModalShell = ({
  visible,
  title,
  onCancel,
  submitting,
  confirmLabel,
  confirmDisabled = false,
  onConfirm,
  cancelLabel = I18n.t('ATTENDANCE.DISCARD_MODAL.CANCEL'),
  children,
}: AttendanceModalShellProps) => {
  const requestClose = () => {
    if (!submitting) onCancel();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={requestClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={tailwind.style('flex-1 bg-blackA-A9 justify-end')}>
        <Pressable
          style={tailwind.style('flex-1')}
          onPress={requestClose}
          accessibilityRole="none"
        />
        <SafeAreaView edges={['bottom']} style={tailwind.style('bg-white rounded-t-2xl px-4 pt-4')}>
          <Text style={tailwind.style('text-[17px] font-inter-580-24 text-gray-950')}>{title}</Text>
          <View style={tailwind.style('mt-3')}>{children}</View>
          <View style={tailwind.style('mt-4 mb-4 flex-row gap-2')}>
            <LigacaoButton grow text={cancelLabel} disabled={submitting} onPress={requestClose} />
            {confirmLabel ? (
              <LigacaoButton
                grow
                variant="primary"
                text={confirmLabel}
                disabled={confirmDisabled || submitting}
                onPress={onConfirm}
              />
            ) : null}
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

type ConfirmScope = 'IA_CONFIRM' | 'ENVIAR_MSG_CONFIRM';

interface ConfirmModalProps {
  visible: boolean;
  scope: ConfirmScope;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirm-only flows: Mover p/ IA (`switch_to_ia`) and Enviar mensagem. */
export const ConfirmModal = ({
  visible,
  scope,
  submitting,
  onConfirm,
  onCancel,
}: ConfirmModalProps) => (
  <AttendanceModalShell
    visible={visible}
    title={I18n.t(`ATTENDANCE.${scope}.TITLE`)}
    submitting={submitting}
    confirmLabel={I18n.t(`ATTENDANCE.${scope}.CONFIRM`)}
    onConfirm={onConfirm}
    onCancel={onCancel}>
    <Text style={tailwind.style('text-sm text-gray-800')}>
      {I18n.t(`ATTENDANCE.${scope}.DESC`)}
    </Text>
  </AttendanceModalShell>
);
