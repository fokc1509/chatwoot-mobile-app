import React from 'react';
import { Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackActions, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { TabBarExcludedScreenParamList } from '@/navigation/tabs/AppTabs';
import { tailwind } from '@/theme';
import i18n from '@/i18n';

type Props = NativeStackScreenProps<TabBarExcludedScreenParamList, 'MetaTemplatePicker'>;

// Placeholder so the entry points can navigate; the real picker replaces it.
const MetaTemplatePickerScreen = (_props: Props) => {
  const navigation = useNavigation();
  return (
    <SafeAreaView edges={['top']} style={tailwind.style('flex-1 bg-white px-4 py-3')}>
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.dispatch(StackActions.pop())}
        hitSlop={8}>
        <Text style={tailwind.style('text-lg font-inter-medium-24 text-gray-950')}>
          {i18n.t('META_TEMPLATES.PICKER_TITLE')}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
};

export default MetaTemplatePickerScreen;
