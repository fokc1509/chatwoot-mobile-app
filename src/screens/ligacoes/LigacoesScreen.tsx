import React from 'react';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import I18n from '@/i18n';
import { tailwind } from '@/theme';

// Placeholder: Task 4 replaces this with the real queue screen.
const LigacoesScreen = () => {
  return (
    <SafeAreaView style={tailwind.style('flex-1 items-center justify-center bg-white')}>
      <Text style={tailwind.style('text-base text-gray-950')}>{I18n.t('LIGACOES.TAB')}</Text>
    </SafeAreaView>
  );
};

export default LigacoesScreen;
