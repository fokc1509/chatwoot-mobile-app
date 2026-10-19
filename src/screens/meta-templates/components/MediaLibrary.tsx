import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';

import {
  fetchWabaMedia,
  type WabaMediaContent,
  type WabaMediaItem,
} from '@/store/meta-template/metaTemplateMedia';
import I18n from '@/i18n';
import { tailwind } from '@/theme';

interface MediaLibraryProps {
  /** Template type (3rd part of the name) = library folder. */
  templateType: string;
  content: WabaMediaContent;
  selectedUrl: string;
  onSelect: (item: WabaMediaItem) => void;
  disabled: boolean;
}

type Status = 'loading' | 'ready' | 'error';

/** Horizontal strip of the `waba-images/<type>/` media (web WabaImagePicker). */
export const MediaLibrary = ({
  templateType,
  content,
  selectedUrl,
  onSelect,
  disabled,
}: MediaLibraryProps) => {
  const [items, setItems] = useState<WabaMediaItem[]>([]);
  const [status, setStatus] = useState<Status>('loading');

  const load = useCallback(() => {
    let cancelled = false;
    setStatus('loading');
    fetchWabaMedia(templateType, content)
      .then(list => {
        if (cancelled) return;
        setItems(list);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [templateType, content]);

  useEffect(() => load(), [load]);

  if (status === 'loading') {
    return (
      <View style={tailwind.style('h-[104px] items-center justify-center')}>
        <ActivityIndicator />
      </View>
    );
  }

  if (status === 'error' || items.length === 0) {
    return (
      <View style={tailwind.style('py-3 gap-2')}>
        <Text style={tailwind.style('text-sm text-gray-800')}>
          {I18n.t(
            status === 'error'
              ? 'META_TEMPLATES.HEADER.LIBRARY_ERROR'
              : 'META_TEMPLATES.HEADER.LIBRARY_EMPTY',
          )}
        </Text>
        {status === 'error' ? (
          <Pressable accessibilityRole="button" onPress={load} hitSlop={6}>
            <Text style={tailwind.style('text-sm font-inter-medium-24 text-blue-800')}>
              {I18n.t('META_TEMPLATES.HEADER.RETRY')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={tailwind.style('gap-2 py-1')}>
      {items.map(item => {
        const selected = item.url === selectedUrl;
        return (
          <Pressable
            key={item.key}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={item.name}
            accessibilityState={{ selected, disabled }}
            onPress={() => onSelect(item)}
            style={tailwind.style(
              'w-[96px] rounded-lg overflow-hidden border-2',
              selected ? 'border-blue-800' : 'border-transparent',
            )}>
            {item.isImage ? (
              <Image
                source={{ uri: item.thumbnailUrl }}
                style={tailwind.style('w-full h-[72px] bg-gray-100')}
                contentFit="cover"
              />
            ) : (
              <View
                style={tailwind.style('w-full h-[72px] bg-gray-900 items-center justify-center')}>
                <Text style={tailwind.style('text-lg text-white')}>▶</Text>
              </View>
            )}
            <Text
              numberOfLines={1}
              style={tailwind.style(
                'px-1 py-1 text-cxs',
                selected ? 'bg-blue-800 text-white' : 'bg-gray-50 text-gray-900',
              )}>
              {item.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};
