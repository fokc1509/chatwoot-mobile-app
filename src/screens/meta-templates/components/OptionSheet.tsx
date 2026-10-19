import React from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { tailwind } from '@/theme';

export interface SheetOption {
  value: string;
  label: string;
}

interface OptionSheetProps {
  visible: boolean;
  title: string;
  options: SheetOption[];
  selected: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
}

/** Bottom list used as a native-free dropdown (filters, empreendimento). */
export const OptionSheet = ({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: OptionSheetProps) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={tailwind.style('flex-1 bg-blackA-A9 justify-end')}>
      <Pressable style={tailwind.style('flex-1')} onPress={onClose} accessibilityRole="none" />
      <SafeAreaView edges={['bottom']} style={tailwind.style('bg-white rounded-t-2xl')}>
        <Text style={tailwind.style('px-4 pt-4 pb-2 text-sm font-inter-medium-24 text-gray-950')}>
          {title}
        </Text>
        <FlatList
          data={options}
          keyExtractor={item => item.value}
          style={tailwind.style('max-h-[420px]')}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const isSelected = item.value === selected;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => {
                  onSelect(item.value);
                  onClose();
                }}
                style={({ pressed }) =>
                  tailwind.style('px-4 py-3 flex-row items-center', pressed ? 'bg-gray-50' : '')
                }>
                <Text
                  style={tailwind.style(
                    'flex-1 text-base text-gray-950',
                    isSelected ? 'font-inter-medium-24' : '',
                  )}>
                  {item.label}
                </Text>
                {isSelected ? (
                  <Text style={tailwind.style('text-base text-blue-800')}>✓</Text>
                ) : null}
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => (
            <View style={tailwind.style('h-[1px] bg-blackA-A3 ml-4')} />
          )}
        />
      </SafeAreaView>
    </View>
  </Modal>
);
