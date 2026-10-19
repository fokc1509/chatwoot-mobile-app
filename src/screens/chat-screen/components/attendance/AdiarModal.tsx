import React, { useEffect, useState } from 'react';
import { Text, TextInput } from 'react-native';

import I18n from '@/i18n';
import { tailwind } from '@/theme';
import { adiarValid } from './attendanceFlowViewModel';
import { AttendanceModalShell } from './ConfirmModal';

interface AdiarModalProps {
  visible: boolean;
  submitting: boolean;
  /** Server error shown inline; the modal stays open so the text is kept. */
  error: string | null;
  onClearError: () => void;
  onSubmit: (motivo: string) => void;
  onCancel: () => void;
}

/** Adiar 15 dias (`vigia_adiar`): motivo of at least 5 characters. */
export const AdiarModal = ({
  visible,
  submitting,
  error,
  onClearError,
  onSubmit,
  onCancel,
}: AdiarModalProps) => {
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (visible) setMotivo('');
  }, [visible]);

  const handleChange = (value: string) => {
    setMotivo(value);
    if (error) onClearError();
  };

  const valid = adiarValid(motivo);

  return (
    <AttendanceModalShell
      visible={visible}
      title={I18n.t('ATTENDANCE.ADIAR_MODAL.TITLE')}
      submitting={submitting}
      cancelLabel={I18n.t('ATTENDANCE.ADIAR_MODAL.CANCEL')}
      confirmLabel={I18n.t('ATTENDANCE.ADIAR_MODAL.CONFIRM')}
      confirmDisabled={!valid}
      onConfirm={() => onSubmit(motivo)}
      onCancel={onCancel}>
      <Text style={tailwind.style('text-sm font-inter-medium-24 text-gray-950')}>
        {I18n.t('ATTENDANCE.ADIAR_MODAL.LABEL')}
      </Text>
      <TextInput
        value={motivo}
        onChangeText={handleChange}
        multiline
        autoFocus
        editable={!submitting}
        textAlignVertical="top"
        placeholder={I18n.t('ATTENDANCE.ADIAR_MODAL.PLACEHOLDER')}
        placeholderTextColor={tailwind.color('text-gray-700')}
        style={tailwind.style(
          'mt-2 min-h-[88px] max-h-[160px] p-3 rounded-[12px] border border-blackA-A4 text-md text-gray-950',
        )}
      />
      <Text style={tailwind.style('mt-1 text-xs text-right text-gray-800')}>
        {I18n.t('ATTENDANCE.ADIAR_MODAL.COUNTER', { count: motivo.trim().length })}
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={tailwind.style('mt-2 text-sm text-ruby-800')}>
          {error}
        </Text>
      ) : null}
    </AttendanceModalShell>
  );
};
