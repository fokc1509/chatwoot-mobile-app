import React from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { tailwind } from '@/theme';

/** Plain bordered input used by every field of the fill screen. */
export const FieldInput = ({ multiline, style, ...props }: TextInputProps) => (
  <TextInput
    {...props}
    multiline={multiline}
    placeholderTextColor={tailwind.color('text-gray-600')}
    textAlignVertical={multiline ? 'top' : 'center'}
    style={[
      tailwind.style(
        'px-3 py-2.5 rounded-[10px] border-[1px] border-blackA-A6 bg-white text-base text-gray-950',
        multiline ? 'min-h-[88px]' : '',
      ),
      style,
    ]}
  />
);
