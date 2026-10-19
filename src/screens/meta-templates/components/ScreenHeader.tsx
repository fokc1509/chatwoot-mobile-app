import React from 'react';
import { Pressable, StatusBar, Text, View } from 'react-native';

import { Icon } from '@/components-next';
import { ChevronLeft } from '@/svg-icons';
import I18n from '@/i18n';
import { tailwind } from '@/theme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: React.ReactNode;
}

export const ScreenHeader = ({ title, subtitle, onBack, right }: ScreenHeaderProps) => (
  <>
    <StatusBar backgroundColor={tailwind.color('bg-white')} barStyle="dark-content" />
    <View
      style={tailwind.style(
        'flex-row items-center gap-2 pl-4 pr-3 py-2 border-b-[1px] border-b-blackA-A3',
      )}>
      <Pressable
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={I18n.t('META_TEMPLATES.BACK')}
        onPress={onBack}
        style={tailwind.style('h-8 w-8 justify-center')}>
        <Icon icon={<ChevronLeft />} size={24} />
      </Pressable>
      <View style={tailwind.style('flex-1')}>
        <Text
          numberOfLines={1}
          style={tailwind.style('text-base font-inter-medium-24 text-gray-950')}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={tailwind.style('text-cxs text-gray-700')}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  </>
);
