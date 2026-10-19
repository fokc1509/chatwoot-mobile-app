import React from 'react';
import { Pressable, Text } from 'react-native';

import { tailwind } from '@/theme';

interface OptionChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export const OptionChip = ({ label, selected, onPress }: OptionChipProps) => (
  <Pressable
    onPress={onPress}
    hitSlop={4}
    accessibilityRole="radio"
    accessibilityState={{ selected }}
    style={tailwind.style(
      'px-3 py-2 rounded-full border-[1px]',
      selected ? 'bg-blue-800 border-blue-800' : 'bg-white border-blackA-A6',
    )}>
    <Text
      numberOfLines={1}
      style={tailwind.style(
        'text-sm font-inter-medium-24',
        selected ? 'text-white' : 'text-gray-900',
      )}>
      {label}
    </Text>
  </Pressable>
);
