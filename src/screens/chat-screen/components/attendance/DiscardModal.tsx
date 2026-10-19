import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import I18n from '@/i18n';
import { tailwind } from '@/theme';
import type { DiscardBucket } from '@/store/attendance/attendanceTypes';
import {
  DISCARD_MOTIVO_KEYS,
  INITIAL_DISCARD_FORM,
  discardGoBack,
  discardPickBucket,
  discardStepValid,
  type DiscardFormState,
} from './attendanceFlowViewModel';
import { AttendanceModalShell } from './ConfirmModal';

interface DiscardModalProps {
  visible: boolean;
  /** Request copy (no direct-discard permission, or the legacy `aprovar` path). */
  requestMode: boolean;
  submitting: boolean;
  onSubmit: (form: DiscardFormState) => void;
  onCancel: () => void;
}

const BUCKETS: { value: DiscardBucket; title: string; desc: string }[] = [
  {
    value: 'reativacao',
    title: 'ATTENDANCE.DISCARD_MODAL.BUCKET_REATIVACAO_TITLE',
    desc: 'ATTENDANCE.DISCARD_MODAL.BUCKET_REATIVACAO_DESC',
  },
  {
    value: 'descartado',
    title: 'ATTENDANCE.DISCARD_MODAL.BUCKET_DESCARTE_TITLE',
    desc: 'ATTENDANCE.DISCARD_MODAL.BUCKET_DESCARTE_DESC',
  },
];

/** Descartar: step 1 picks the bucket, step 2 the motivo (4 fixed + "Outro" with text). */
export const DiscardModal = ({
  visible,
  requestMode,
  submitting,
  onSubmit,
  onCancel,
}: DiscardModalProps) => {
  const [form, setForm] = useState<DiscardFormState>(INITIAL_DISCARD_FORM);
  const [outroError, setOutroError] = useState(false);

  useEffect(() => {
    if (visible) {
      setForm(INITIAL_DISCARD_FORM);
      setOutroError(false);
    }
  }, [visible]);

  // Like the web, the CTA only needs a motivo; an empty "Outro" surfaces OUTRO_REQUIRED.
  const handleConfirm = () => {
    if (form.step !== 2 || !form.motivoKey) return;
    if (!discardStepValid(2, form)) {
      setOutroError(true);
      return;
    }
    onSubmit(form);
  };

  return (
    <AttendanceModalShell
      visible={visible}
      title={I18n.t(
        requestMode ? 'ATTENDANCE.DISCARD_MODAL.REQUEST_TITLE' : 'ATTENDANCE.DISCARD_MODAL.TITLE',
      )}
      submitting={submitting}
      confirmLabel={
        form.step === 2
          ? I18n.t(
              requestMode
                ? 'ATTENDANCE.DISCARD_MODAL.REQUEST_CONFIRM'
                : 'ATTENDANCE.DISCARD_MODAL.CONFIRM',
            )
          : undefined
      }
      confirmDisabled={!form.motivoKey}
      onConfirm={handleConfirm}
      onCancel={onCancel}>
      {form.step === 1 ? (
        <View style={tailwind.style('gap-3')}>
          <Text style={tailwind.style('text-sm font-inter-medium-24 text-gray-950')}>
            {I18n.t('ATTENDANCE.DISCARD_MODAL.STEP_BUCKET')}
          </Text>
          {BUCKETS.map(bucket => (
            <Pressable
              key={bucket.value}
              accessibilityRole="button"
              onPress={() => setForm(discardPickBucket(form, bucket.value))}
              style={({ pressed }) =>
                tailwind.style(
                  'p-4 rounded-[12px] border border-blackA-A4',
                  pressed ? 'bg-gray-50' : '',
                )
              }>
              <Text style={tailwind.style('text-sm font-inter-medium-24 text-gray-950')}>
                {I18n.t(bucket.title)}
              </Text>
              <Text style={tailwind.style('mt-1 text-sm text-gray-800')}>
                {I18n.t(bucket.desc)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View>
          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={() => {
              setForm(discardGoBack(form));
              setOutroError(false);
            }}
            hitSlop={8}
            style={tailwind.style('self-start')}>
            <Text style={tailwind.style('text-sm font-inter-medium-24 text-blue-800')}>
              {I18n.t('ATTENDANCE.DISCARD_MODAL.BACK')}
            </Text>
          </Pressable>
          <Text style={tailwind.style('mt-3 text-sm font-inter-medium-24 text-gray-950')}>
            {I18n.t('ATTENDANCE.DISCARD_MODAL.STEP_MOTIVO')}
          </Text>
          <View style={tailwind.style('mt-2 rounded-[12px] border border-blackA-A4')}>
            {DISCARD_MOTIVO_KEYS.map((key, index) => {
              const selected = form.motivoKey === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  disabled={submitting}
                  onPress={() => {
                    setForm({ ...form, motivoKey: key });
                    setOutroError(false);
                  }}
                  style={({ pressed }) =>
                    tailwind.style(
                      'px-3 py-3 flex-row items-center',
                      index > 0 ? 'border-t border-blackA-A3' : '',
                      pressed ? 'bg-gray-50' : '',
                    )
                  }>
                  <Text
                    style={tailwind.style(
                      'flex-1 text-sm text-gray-950',
                      selected ? 'font-inter-medium-24' : '',
                    )}>
                    {I18n.t(`ATTENDANCE.MOTIVOS.${key}`)}
                  </Text>
                  {selected ? <Text style={tailwind.style('text-sm text-blue-800')}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
          {form.motivoKey === 'OUTRO' ? (
            <TextInput
              value={form.outroText}
              onChangeText={text => {
                setForm({ ...form, outroText: text });
                setOutroError(false);
              }}
              autoFocus
              editable={!submitting}
              placeholder={I18n.t('ATTENDANCE.DISCARD_MODAL.OUTRO_PLACEHOLDER')}
              placeholderTextColor={tailwind.color('text-gray-700')}
              style={tailwind.style(
                'mt-2 px-3 py-2 rounded-[12px] border border-blackA-A4 text-md text-gray-950',
              )}
            />
          ) : null}
          {outroError ? (
            <Text accessibilityRole="alert" style={tailwind.style('mt-1 text-sm text-ruby-800')}>
              {I18n.t('ATTENDANCE.DISCARD_MODAL.OUTRO_REQUIRED')}
            </Text>
          ) : null}
          {requestMode ? (
            <Text style={tailwind.style('mt-3 text-sm text-gray-800')}>
              {I18n.t('ATTENDANCE.DISCARD_MODAL.REQUEST_HINT')}
            </Text>
          ) : null}
        </View>
      )}
    </AttendanceModalShell>
  );
};
