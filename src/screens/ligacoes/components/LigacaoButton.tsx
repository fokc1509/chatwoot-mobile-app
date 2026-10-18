import React from 'react';
import { Pressable, Text } from 'react-native';

import { tailwind } from '@/theme';

type LigacaoButtonVariant = 'primary' | 'secondary' | 'success' | 'destructive';

interface LigacaoButtonProps {
  text: string;
  onPress?: () => void;
  variant?: LigacaoButtonVariant;
  disabled?: boolean;
  /** Stretches to fill the row it sits in. */
  grow?: boolean;
  testID?: string;
}

const CONTAINER: Record<LigacaoButtonVariant, string> = {
  primary: 'bg-blue-800',
  secondary: 'bg-gray-100',
  success: 'bg-teal-800',
  destructive: 'bg-gray-100',
};

const TEXT: Record<LigacaoButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-gray-950',
  success: 'text-white',
  destructive: 'text-ruby-800',
};

/** Compact action button used by the queue cards, banner and summary modal. */
export const LigacaoButton = ({
  text,
  onPress,
  variant = 'secondary',
  disabled = false,
  grow = false,
  testID,
}: LigacaoButtonProps) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    testID={testID}
    accessibilityRole="button"
    accessibilityState={{ disabled }}
    hitSlop={4}
    style={({ pressed }) =>
      tailwind.style(
        'min-h-[40px] px-3 py-2 rounded-[10px] items-center justify-center',
        CONTAINER[variant],
        grow ? 'flex-1' : '',
        disabled ? 'opacity-50' : pressed ? 'opacity-80' : '',
      )
    }>
    <Text
      style={tailwind.style(
        'text-sm text-center font-inter-medium-24 tracking-[0.16px]',
        TEXT[variant],
      )}>
      {text}
    </Text>
  </Pressable>
);
