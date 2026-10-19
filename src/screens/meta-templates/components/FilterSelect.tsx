import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { ALL_FILTER } from '@/store/meta-template/metaTemplateNormalize';
import I18n from '@/i18n';
import { tailwind } from '@/theme';
import { OptionSheet } from './OptionSheet';

interface FilterSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

const display = (value: string) =>
  value === ALL_FILTER ? I18n.t('META_TEMPLATES.FILTERS.ALL') : value;

/** Dropdown-like pill: tapping opens a bottom list with "Todos" + the options. */
export const FilterSelect = ({ label, value, options, onChange }: FilterSelectProps) => {
  const [open, setOpen] = useState(false);
  const active = value !== ALL_FILTER;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${display(value)}`}
        hitSlop={4}
        onPress={() => setOpen(true)}
        style={tailwind.style('px-3 py-1.5 rounded-full', active ? 'bg-gray-950' : 'bg-gray-100')}>
        <Text
          numberOfLines={1}
          style={tailwind.style(
            'text-cxs font-inter-medium-24',
            active ? 'text-white' : 'text-gray-900',
          )}>
          {`${label}: ${display(value)} ▾`}
        </Text>
      </Pressable>
      <OptionSheet
        visible={open}
        title={label}
        options={[ALL_FILTER, ...options].map(o => ({ value: o, label: display(o) }))}
        selected={value}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
};
