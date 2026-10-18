import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import I18n from '@/i18n';
import { tailwind } from '@/theme';
import type { LigacaoJanela, LigacaoTab } from '@/store/ligacao/ligacaoTypes';

interface LigacaoFiltersProps {
  janelas: LigacaoJanela[];
  janela: LigacaoJanela | null;
  tab: LigacaoTab;
  total: number;
  onJanela: (janela: LigacaoJanela) => void;
  onTab: (tab: LigacaoTab) => void;
}

const Chip = ({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    hitSlop={4}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    style={tailwind.style('px-3 py-1.5 rounded-full', selected ? 'bg-gray-950' : 'bg-gray-100')}>
    <Text
      style={tailwind.style(
        'text-cxs font-inter-medium-24',
        selected ? 'text-white' : 'text-gray-900',
      )}>
      {label}
    </Text>
  </Pressable>
);

const TABS: { value: LigacaoTab; label: string }[] = [
  { value: 'todos', label: 'LIGACOES.TABS.TODOS' },
  { value: 'meus_cv', label: 'LIGACOES.TABS.MEUS' },
];

export const LigacaoFilters = ({
  janelas,
  janela,
  tab,
  total,
  onJanela,
  onTab,
}: LigacaoFiltersProps) => (
  <View style={tailwind.style('pt-1 pb-3 gap-2 border-b-[1px] border-b-blackA-A3')}>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={tailwind.style('px-4 gap-2 items-center')}>
      <Text style={tailwind.style('text-cxs text-gray-800')}>
        {I18n.t('LIGACOES.JANELA.LABEL')}
      </Text>
      {janelas.map(dias => (
        <Chip
          key={dias}
          label={I18n.t('LIGACOES.JANELA.DIAS', { n: dias })}
          selected={dias === janela}
          onPress={() => onJanela(dias)}
        />
      ))}
    </ScrollView>
    <View style={tailwind.style('px-4 flex-row items-center gap-2')}>
      {TABS.map(item => (
        <Chip
          key={item.value}
          label={I18n.t(item.label)}
          selected={item.value === tab}
          onPress={() => onTab(item.value)}
        />
      ))}
      <Text style={tailwind.style('ml-auto text-cxs text-gray-800')}>
        {I18n.t('LIGACOES.TOTAL', { count: total })}
      </Text>
    </View>
  </View>
);
