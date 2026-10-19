import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { TemplateVariable } from '@/store/meta-template/metaTemplateTypes';
import I18n from '@/i18n';
import { tailwind } from '@/theme';
import type { VariableInputMode } from '../metaTemplateViewModel';
import { FieldInput } from './FieldInput';
import { OptionChip } from './OptionChip';
import { OptionSheet } from './OptionSheet';

interface VariableFieldProps {
  variable: TemplateVariable;
  mode: VariableInputMode;
  value: string;
  onChange: (value: string) => void;
  contactName: string;
  empreendimentos: string[];
  editable: boolean;
}

const placeholderFor = (variable: TemplateVariable) =>
  variable.example || I18n.t('META_TEMPLATES.VALUE_PLACEHOLDER', { variable: variable.key });

/** `name`: contact name or another value (web smart name variable). */
const NameField = ({ variable, value, onChange, contactName, editable }: VariableFieldProps) => {
  const [custom, setCustom] = useState(!contactName || (value !== '' && value !== contactName));
  return (
    <View style={tailwind.style('gap-2')}>
      <View style={tailwind.style('flex-row gap-2')}>
        {contactName ? (
          <OptionChip
            label={I18n.t('META_TEMPLATES.CONTACT_NAME')}
            selected={!custom}
            onPress={() => {
              if (!editable) return;
              setCustom(false);
              onChange(contactName);
            }}
          />
        ) : null}
        <OptionChip
          label={I18n.t('META_TEMPLATES.OTHER_VALUE')}
          selected={custom}
          onPress={() => {
            if (!editable) return;
            setCustom(true);
            if (value === contactName) onChange('');
          }}
        />
      </View>
      {custom ? (
        <FieldInput
          value={value}
          onChangeText={onChange}
          editable={editable}
          autoCapitalize="words"
          placeholder={placeholderFor(variable)}
        />
      ) : (
        <Text
          style={tailwind.style(
            'px-3 py-2.5 rounded-[10px] bg-gray-100 text-base font-inter-medium-24 text-gray-950',
          )}>
          {contactName}
        </Text>
      )}
    </View>
  );
};

const OTHER = '__other__';

/** `empreendimento`: one of the CV names, or another value typed by the broker. */
const SelectField = ({
  variable,
  value,
  onChange,
  empreendimentos,
  editable,
}: VariableFieldProps) => {
  const [open, setOpen] = useState(false);
  const [other, setOther] = useState(value !== '' && !empreendimentos.includes(value));
  const selected = other ? OTHER : value || null;
  const label = other
    ? I18n.t('META_TEMPLATES.OTHER_VALUE')
    : value || I18n.t('META_TEMPLATES.SELECT_PLACEHOLDER');

  return (
    <View style={tailwind.style('gap-2')}>
      <Pressable
        accessibilityRole="button"
        disabled={!editable}
        onPress={() => setOpen(true)}
        style={tailwind.style(
          'flex-row items-center px-3 py-2.5 rounded-[10px] border-[1px] border-blackA-A6 bg-white',
        )}>
        <Text
          numberOfLines={1}
          style={tailwind.style(
            'flex-1 text-base',
            value || other ? 'text-gray-950' : 'text-gray-600',
          )}>
          {label}
        </Text>
        <Text style={tailwind.style('text-base text-gray-700')}>▾</Text>
      </Pressable>
      {other ? (
        <FieldInput
          value={value}
          onChangeText={onChange}
          editable={editable}
          placeholder={placeholderFor(variable)}
        />
      ) : null}
      <OptionSheet
        visible={open}
        title={variable.key}
        options={[
          ...empreendimentos.map(nome => ({ value: nome, label: nome })),
          { value: OTHER, label: I18n.t('META_TEMPLATES.OTHER_VALUE') },
        ]}
        selected={selected}
        onSelect={choice => {
          if (choice === OTHER) {
            setOther(true);
            if (empreendimentos.includes(value)) onChange('');
          } else {
            setOther(false);
            onChange(choice);
          }
        }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
};

export const VariableField = (props: VariableFieldProps) => {
  const { variable, mode, value, onChange, editable } = props;
  let field: React.ReactNode;
  if (mode === 'name') field = <NameField {...props} />;
  else if (mode === 'select') field = <SelectField {...props} />;
  else
    field = (
      <FieldInput
        value={value}
        onChangeText={onChange}
        editable={editable}
        multiline
        placeholder={placeholderFor(variable)}
      />
    );

  return (
    <View style={tailwind.style('gap-1.5')}>
      <Text style={tailwind.style('text-cxs font-inter-medium-24 text-gray-800')}>
        {variable.key}
      </Text>
      {field}
    </View>
  );
};
