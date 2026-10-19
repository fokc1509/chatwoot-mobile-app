import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { MetaTemplate } from '@/store/meta-template/metaTemplateTypes';
import I18n from '@/i18n';
import { tailwind } from '@/theme';
import { describeTemplate, formatTemplateBody } from '../metaTemplateViewModel';

const MEDIA_HEADERS = ['IMAGE', 'VIDEO', 'DOCUMENT'];

interface TemplateCardProps {
  template: MetaTemplate;
  onPress: (template: MetaTemplate) => void;
}

export const TemplateCard = ({ template, onPress }: TemplateCardProps) => {
  const { title, tags } = describeTemplate(template);
  const badge =
    template.header_format && MEDIA_HEADERS.includes(template.header_format)
      ? I18n.t(`META_TEMPLATES.BADGE.${template.header_format}`)
      : undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => onPress(template)}
      style={({ pressed }) =>
        tailwind.style('mx-4 my-1.5 p-3 rounded-xl bg-gray-50', pressed ? 'opacity-80' : '')
      }>
      <View style={tailwind.style('flex-row items-center gap-2')}>
        {badge ? (
          <Text
            style={tailwind.style(
              'px-1.5 py-0.5 rounded bg-blue-100 text-cxs font-inter-medium-24 text-blue-800',
            )}>
            {badge}
          </Text>
        ) : null}
        <Text
          numberOfLines={1}
          style={tailwind.style('flex-1 text-base font-inter-medium-24 text-gray-950')}>
          {title}
        </Text>
        <Text style={tailwind.style('text-cxs text-gray-700')}>{template.category}</Text>
      </View>
      {tags.length > 0 ? (
        <Text numberOfLines={1} style={tailwind.style('mt-0.5 text-cxs text-gray-700')}>
          {tags.join(' · ')}
        </Text>
      ) : null}
      <Text numberOfLines={3} style={tailwind.style('mt-2 text-sm text-gray-900')}>
        {formatTemplateBody(template)}
      </Text>
    </Pressable>
  );
};
