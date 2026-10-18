import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import I18n from '@/i18n';
import { tailwind } from '@/theme';
import { RESUMO_MAX, canSaveResumo } from '../ligacaoViewModel';
import { LigacaoButton } from './LigacaoButton';

interface LigacaoResumoModalProps {
  visible: boolean;
  leadNome: string | null;
  saving: boolean;
  onSave: (texto: string) => void;
  onSkip: () => void;
}

/**
 * "Resumo da ligação": shown right after pulling a lead, while the call is
 * still fresh. Skipping is legitimate — the lead is already the broker's.
 */
export const LigacaoResumoModal = ({
  visible,
  leadNome,
  saving,
  onSave,
  onSkip,
}: LigacaoResumoModalProps) => {
  const [texto, setTexto] = useState('');

  useEffect(() => {
    if (visible) setTexto('');
  }, [visible]);

  const podeSalvar = canSaveResumo(texto);

  // Android back acts as "Pular", except while saving or with text typed
  // (it would silently throw the summary away).
  const handleRequestClose = () => {
    if (!saving && !podeSalvar) onSkip();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleRequestClose}>
      <SafeAreaView edges={['top', 'bottom']} style={tailwind.style('flex-1 bg-white')}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={tailwind.style('flex-1 px-4 pt-4')}>
          <Text style={tailwind.style('text-[17px] font-inter-580-24 text-gray-950')}>
            {I18n.t('LIGACOES.RESUMO.TITULO')}
          </Text>
          <Text style={tailwind.style('mt-1 text-sm text-gray-800')}>
            {I18n.t('LIGACOES.RESUMO.DICA')}
          </Text>
          {leadNome ? (
            <Text style={tailwind.style('mt-3 text-sm font-inter-medium-24 text-gray-950')}>
              {leadNome}
            </Text>
          ) : null}
          <TextInput
            value={texto}
            onChangeText={setTexto}
            multiline
            autoFocus
            maxLength={RESUMO_MAX}
            editable={!saving}
            textAlignVertical="top"
            placeholder={I18n.t('LIGACOES.RESUMO.PLACEHOLDER')}
            placeholderTextColor={tailwind.color('text-gray-700')}
            style={tailwind.style(
              'mt-3 flex-1 max-h-[260px] min-h-[140px] p-3 rounded-[12px] border border-blackA-A4 text-md text-gray-950',
            )}
          />
          <Text style={tailwind.style('mt-1 text-xs text-right text-gray-800')}>
            {I18n.t('LIGACOES.RESUMO.CONTADOR', { count: texto.length, max: RESUMO_MAX })}
          </Text>
          <View style={tailwind.style('mt-4 mb-4 flex-row gap-2')}>
            <LigacaoButton
              grow
              text={I18n.t('LIGACOES.RESUMO.PULAR')}
              disabled={saving}
              onPress={onSkip}
            />
            <LigacaoButton
              grow
              variant="primary"
              text={I18n.t('LIGACOES.RESUMO.SALVAR')}
              disabled={!podeSalvar || saving}
              onPress={() => onSave(texto)}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};
