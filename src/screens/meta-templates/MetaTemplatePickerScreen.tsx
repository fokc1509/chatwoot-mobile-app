import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { SearchBar } from '@/components-next/common/search';
import { useAppDispatch, useAppSelector } from '@/hooks';
import I18n from '@/i18n';
import type { TabBarExcludedScreenParamList } from '@/navigation/tabs/AppTabs';
import { metaTemplateActions } from '@/store/meta-template/metaTemplateActions';
import {
  ALL_FILTER,
  filterTemplates,
  getFilterOptions,
} from '@/store/meta-template/metaTemplateNormalize';
import {
  selectTemplateAccess,
  selectTemplates,
  selectTemplatesLoading,
} from '@/store/meta-template/metaTemplateSelectors';
import type { MetaTemplate } from '@/store/meta-template/metaTemplateTypes';
import { tailwind } from '@/theme';
import { showToast } from '@/utils/toastUtils';
import { FilterSelect } from './components/FilterSelect';
import { ScreenHeader } from './components/ScreenHeader';
import { TemplateCard } from './components/TemplateCard';
import { reconcileFilter } from './metaTemplateViewModel';

type Props = NativeStackScreenProps<TabBarExcludedScreenParamList, 'MetaTemplatePicker'>;

const EmptyState = ({ text }: { text: string }) => (
  <View style={tailwind.style('flex-1 items-center justify-center px-8 py-16')}>
    <Text style={tailwind.style('text-sm text-center text-gray-800')}>{text}</Text>
  </View>
);

const MetaTemplatePickerScreen = ({ navigation, route }: Props) => {
  const { conversationId, inboxId } = route.params;
  const dispatch = useAppDispatch();

  // The store already holds the visibility-filtered list (fetchTemplates).
  const templates = useAppSelector(selectTemplates(inboxId));
  const access = useAppSelector(selectTemplateAccess(inboxId));
  const isSyncing = useAppSelector(selectTemplatesLoading(inboxId));

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL_FILTER);
  const [definition, setDefinition] = useState(ALL_FILTER);
  const [operation, setOperation] = useState(ALL_FILTER);
  const [type, setType] = useState(ALL_FILTER);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    // Web: fetch only when nothing is cached; the refresh button does the Meta sync.
    if (templates.length === 0) {
      setIsFetching(true);
      dispatch(metaTemplateActions.fetchTemplates(inboxId)).finally(() => setIsFetching(false));
    }
    dispatch(metaTemplateActions.fetchEmpreendimentos());
    // Mount only: re-running on every list change would refetch an empty inbox in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, inboxId]);

  const options = useMemo(
    () => getFilterOptions(templates, { definition, operation }),
    [templates, definition, operation],
  );

  // Narrowing definition/operation can drop the selected type (and a sync can drop anything).
  const filters = {
    category: reconcileFilter(category, options.categories),
    definition: reconcileFilter(definition, options.definitions),
    operation: reconcileFilter(operation, options.operations),
    type: reconcileFilter(type, options.types),
  };

  const visible = useMemo(
    () => filterTemplates(templates, { ...filters, search }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [templates, search, filters.category, filters.definition, filters.operation, filters.type],
  );

  const handleRefresh = async () => {
    const result = await dispatch(metaTemplateActions.syncTemplates(inboxId));
    if (metaTemplateActions.syncTemplates.rejected.match(result)) {
      const message = result.payload;
      showToast({
        message:
          message && message !== I18n.t('META_TEMPLATES.ERRORS.GENERIC')
            ? message
            : I18n.t('META_TEMPLATES.ERRORS.SYNC'),
      });
    }
  };

  const openTemplate = (template: MetaTemplate) => {
    navigation.navigate('MetaTemplateFill', {
      conversationId,
      inboxId,
      templateId: template.id,
    });
  };

  const refreshButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={I18n.t('META_TEMPLATES.REFRESH')}
      disabled={isSyncing || access === false}
      onPress={handleRefresh}
      hitSlop={8}
      style={tailwind.style(
        'min-w-[88px] h-8 px-3 rounded-full bg-gray-100 items-center justify-center',
        access === false ? 'opacity-50' : '',
      )}>
      {isSyncing ? (
        <ActivityIndicator size="small" />
      ) : (
        <Text style={tailwind.style('text-cxs font-inter-medium-24 text-gray-950')}>
          {I18n.t('META_TEMPLATES.REFRESH_SHORT')}
        </Text>
      )}
    </Pressable>
  );

  let empty: React.ReactNode = null;
  if (access === false) {
    empty = <EmptyState text={I18n.t('META_TEMPLATES.EMPTY.NO_ACCESS')} />;
  } else if (templates.length === 0) {
    empty =
      isFetching || isSyncing ? (
        <View style={tailwind.style('flex-1 items-center justify-center py-16')}>
          <ActivityIndicator />
        </View>
      ) : (
        <EmptyState text={I18n.t('META_TEMPLATES.EMPTY.NO_TEMPLATES')} />
      );
  } else if (visible.length === 0) {
    empty = <EmptyState text={I18n.t('META_TEMPLATES.EMPTY.NO_MATCH')} />;
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={tailwind.style('flex-1 bg-white')}>
      <ScreenHeader
        title={I18n.t('META_TEMPLATES.PICKER_TITLE')}
        onBack={() => navigation.goBack()}
        right={refreshButton}
      />
      {access !== false && templates.length > 0 ? (
        <View style={tailwind.style('pt-3 pb-2 gap-2 border-b-[1px] border-b-blackA-A3')}>
          <View style={tailwind.style('px-4')}>
            <SearchBar
              placeholder={I18n.t('META_TEMPLATES.SEARCH_PLACEHOLDER')}
              value={search}
              onChangeText={setSearch}
              onClear={() => setSearch('')}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={tailwind.style('px-4 gap-2 items-center')}>
            <FilterSelect
              label={I18n.t('META_TEMPLATES.FILTERS.CATEGORY')}
              value={filters.category}
              options={options.categories}
              onChange={setCategory}
            />
            {/* Web shows definition/operation only when there is a real choice. */}
            {options.definitions.length > 1 ? (
              <FilterSelect
                label={I18n.t('META_TEMPLATES.FILTERS.DEFINITION')}
                value={filters.definition}
                options={options.definitions}
                onChange={setDefinition}
              />
            ) : null}
            {options.operations.length > 1 ? (
              <FilterSelect
                label={I18n.t('META_TEMPLATES.FILTERS.OPERATION')}
                value={filters.operation}
                options={options.operations}
                onChange={setOperation}
              />
            ) : null}
            <FilterSelect
              label={I18n.t('META_TEMPLATES.FILTERS.TYPE')}
              value={filters.type}
              options={options.types}
              onChange={setType}
            />
          </ScrollView>
        </View>
      ) : null}
      {empty ?? (
        <FlatList
          data={visible}
          keyExtractor={item => String(item.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={tailwind.style('py-2')}
          renderItem={({ item }) => <TemplateCard template={item} onPress={openTemplate} />}
        />
      )}
    </SafeAreaView>
  );
};

export default MetaTemplatePickerScreen;
