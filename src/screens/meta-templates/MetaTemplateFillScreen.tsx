import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAppDispatch, useAppSelector } from '@/hooks';
import I18n from '@/i18n';
import type { TabBarExcludedScreenParamList } from '@/navigation/tabs/AppTabs';
import { selectCurrentUserAccountId, selectUser } from '@/store/auth/authSelectors';
import { selectConversationById } from '@/store/conversation/conversationSelectors';
import { selectQuoteMessage, setQuoteMessage } from '@/store/conversation/sendMessageSlice';
import { parseTemplateName } from '@/store/meta-template/metaTemplateNormalize';
import {
  selectEmpreendimentos,
  selectTemplates,
} from '@/store/meta-template/metaTemplateSelectors';
import {
  getTemplateErrorMessage,
  MetaTemplateService,
} from '@/store/meta-template/metaTemplateService';
import type {
  MetaTemplate,
  TemplateButtonParam,
  TemplateHeaderParams,
} from '@/store/meta-template/metaTemplateTypes';
import {
  parseButtonParams,
  parseHeader,
  parseTemplateVariables,
} from '@/store/meta-template/metaTemplateVariables';
import { tailwind } from '@/theme';
import { showToast } from '@/utils/toastUtils';
import { FieldInput } from './components/FieldInput';
import { MediaLibrary } from './components/MediaLibrary';
import { ScreenHeader } from './components/ScreenHeader';
import { VariableField } from './components/VariableField';
import {
  applyVariables,
  buildSendPayload,
  canSend,
  describeTemplate,
  initialFormValues,
  variableInputMode,
} from './metaTemplateViewModel';

type Props = NativeStackScreenProps<TabBarExcludedScreenParamList, 'MetaTemplateFill'>;

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={tailwind.style('px-4 pt-4 gap-3')}>
    <Text style={tailwind.style('text-sm font-inter-medium-24 text-gray-950')}>{title}</Text>
    {children}
  </View>
);

const buttonLabel = (template: MetaTemplate, index: number) => {
  const component = (template.components || []).find(c => c.type === 'BUTTONS');
  const text = component?.buttons?.[index]?.text;
  const base = I18n.t('META_TEMPLATES.BUTTON_PARAM', { n: index + 1 });
  return text ? `${base} (${text})` : base;
};

interface FillFormProps extends Props {
  template: MetaTemplate;
}

const FillForm = ({ navigation, route, template }: FillFormProps) => {
  const { conversationId, inboxId } = route.params;
  const dispatch = useAppDispatch();

  const storeConversation = useAppSelector(state => selectConversationById(state, conversationId));
  const contactName = storeConversation?.meta?.sender?.name || '';
  const empreendimentos = useAppSelector(selectEmpreendimentos);
  const user = useAppSelector(selectUser);
  const accountId = useAppSelector(selectCurrentUserAccountId);
  const quoteMessage = useAppSelector(selectQuoteMessage);

  const variables = useMemo(() => parseTemplateVariables(template), [template]);
  const header = useMemo(() => parseHeader(template), [template]);
  const templateType = parseTemplateName(template.name).type;

  const [values, setValues] = useState(() =>
    initialFormValues(variables, contactName, empreendimentos),
  );
  // Starts from the scaffold so `media_type` survives into processed_params.header.
  const [headerParams, setHeaderParams] = useState<TemplateHeaderParams | undefined>(
    () => header.params,
  );
  const [buttonParams, setButtonParams] = useState<(TemplateButtonParam | undefined)[] | undefined>(
    () => parseButtonParams(template),
  );
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Typing again clears the last send error.
  const edit = (apply: (value: string) => void) => (value: string) => {
    if (error) setError(null);
    apply(value);
  };

  const setValue = (key: string) =>
    edit(value => setValues(current => ({ ...current, [key]: value })));
  const setHeader = (key: string) =>
    edit(value => setHeaderParams(current => ({ ...current, [key]: value })));
  const setButton = (index: number) =>
    edit(value =>
      setButtonParams(current => {
        if (!current?.[index]) return current;
        const next = current.slice(); // slice keeps the sparse holes (JSON null, like the web)
        next[index] = { ...current[index], parameter: value } as TemplateButtonParam;
        return next;
      }),
    );

  const ready = canSend(
    variables,
    values,
    { format: header.format, params: headerParams },
    buttonParams,
  );
  const isMedia = header.format === 'IMAGE' || header.format === 'VIDEO';

  const handleSend = async () => {
    if (!ready || isSending) return;
    setError(null);
    setIsSending(true);
    try {
      if (!user || !accountId) throw new Error('no session');
      const [conversation, inbox] = await Promise.all([
        MetaTemplateService.rawConversation(conversationId),
        MetaTemplateService.rawInbox(inboxId),
      ]);
      const payload = buildSendPayload({
        template,
        values,
        headerParams,
        buttonParams,
        conversation,
        inbox,
        // Raw snake_case (authService keeps response.data.data as-is); only id/name/email are sent.
        user: user as unknown as Record<string, unknown>,
        accountId,
        inReplyToId: quoteMessage?.id,
      });
      await MetaTemplateService.sendToWebhook(inboxId, payload);
      if (quoteMessage) dispatch(setQuoteMessage(null));
      showToast({ message: I18n.t('META_TEMPLATES.SENT') });
      // Fill sits on top of the picker: go straight back to the conversation.
      navigation.pop(2);
    } catch (sendError) {
      // Shown on the screen, form kept as typed.
      setError(getTemplateErrorMessage(sendError));
      setIsSending(false);
    }
  };

  const { title } = describeTemplate(template);
  const previewHeader =
    header.format === 'TEXT' && header.text
      ? applyVariables(header.text, headerParams || {})
      : null;
  const previewMedia = headerParams?.media_url?.trim() || '';

  return (
    <SafeAreaView edges={['top', 'bottom']} style={tailwind.style('flex-1 bg-white')}>
      <ScreenHeader
        title={title}
        subtitle={`${template.category} · ${template.language}`}
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView
        style={tailwind.style('flex-1')}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={tailwind.style('pb-6')}>
          <Section title={I18n.t('META_TEMPLATES.PREVIEW')}>
            <View style={tailwind.style('p-3 rounded-xl bg-gray-50 gap-2')}>
              {header.format === 'IMAGE' && previewMedia ? (
                <Image
                  source={{ uri: previewMedia }}
                  style={tailwind.style('w-full h-[160px] rounded-lg bg-gray-100')}
                  contentFit="cover"
                />
              ) : null}
              {(header.format === 'VIDEO' || header.format === 'DOCUMENT') &&
              headerParams?.media_url ? (
                <Text numberOfLines={1} style={tailwind.style('text-cxs text-gray-700')}>
                  {headerParams.media_name || headerParams.media_url.split('/').pop()}
                </Text>
              ) : null}
              {previewHeader ? (
                <Text style={tailwind.style('text-sm font-inter-medium-24 text-gray-950')}>
                  {previewHeader}
                </Text>
              ) : null}
              <Text style={tailwind.style('text-sm text-gray-950')}>
                {applyVariables(template.body_text, values)}
              </Text>
              {template.footer_text ? (
                <Text style={tailwind.style('text-cxs text-gray-700')}>{template.footer_text}</Text>
              ) : null}
            </View>
          </Section>

          {isMedia ? (
            <Section title={I18n.t(`META_TEMPLATES.HEADER.${header.format}`)}>
              <MediaLibrary
                templateType={templateType}
                content={header.format === 'VIDEO' ? 'video' : 'image'}
                selectedUrl={headerParams?.media_url || ''}
                disabled={isSending}
                onSelect={item => setHeader('media_url')(item.url)}
              />
              <FieldInput
                value={headerParams?.media_url || ''}
                onChangeText={setHeader('media_url')}
                editable={!isSending}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder={I18n.t('META_TEMPLATES.HEADER.MEDIA_URL')}
              />
            </Section>
          ) : null}

          {header.format === 'DOCUMENT' ? (
            <Section title={I18n.t('META_TEMPLATES.HEADER.DOCUMENT')}>
              <FieldInput
                value={headerParams?.media_url || ''}
                onChangeText={setHeader('media_url')}
                editable={!isSending}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder={I18n.t('META_TEMPLATES.HEADER.DOCUMENT_URL')}
              />
              <FieldInput
                value={headerParams?.media_name || ''}
                onChangeText={setHeader('media_name')}
                editable={!isSending}
                placeholder={I18n.t('META_TEMPLATES.HEADER.DOCUMENT_NAME')}
              />
            </Section>
          ) : null}

          {header.format === 'TEXT' && header.variables.length > 0 ? (
            <Section title={I18n.t('META_TEMPLATES.HEADER.TEXT')}>
              {header.variables.map(key => (
                <View key={`header-${key}`} style={tailwind.style('gap-1.5')}>
                  <Text style={tailwind.style('text-cxs font-inter-medium-24 text-gray-800')}>
                    {key}
                  </Text>
                  <FieldInput
                    value={headerParams?.[key] || ''}
                    onChangeText={setHeader(key)}
                    editable={!isSending}
                    placeholder={I18n.t('META_TEMPLATES.VALUE_PLACEHOLDER', { variable: key })}
                  />
                </View>
              ))}
            </Section>
          ) : null}

          {variables.length > 0 ? (
            <Section title={I18n.t('META_TEMPLATES.VARIABLES')}>
              {variables.map(variable => (
                <VariableField
                  key={variable.key}
                  variable={variable}
                  mode={variableInputMode(variable, empreendimentos)}
                  value={values[variable.key] ?? ''}
                  onChange={setValue(variable.key)}
                  contactName={contactName}
                  empreendimentos={empreendimentos}
                  editable={!isSending}
                />
              ))}
            </Section>
          ) : null}

          {buttonParams ? (
            <Section title={I18n.t('META_TEMPLATES.BUTTON_PARAMS')}>
              {buttonParams.map((button, index) =>
                button ? (
                  <View key={`button-${index}`} style={tailwind.style('gap-1.5')}>
                    <Text style={tailwind.style('text-cxs font-inter-medium-24 text-gray-800')}>
                      {buttonLabel(template, index)}
                    </Text>
                    <FieldInput
                      value={button.parameter}
                      onChangeText={setButton(index)}
                      editable={!isSending}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                ) : null,
              )}
            </Section>
          ) : null}
        </ScrollView>

        <View style={tailwind.style('px-4 pt-3 pb-2 gap-2 border-t-[1px] border-t-blackA-A3')}>
          {error ? (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={tailwind.style('px-3 py-2 rounded-lg bg-ruby-100')}>
              <Text style={tailwind.style('text-sm text-ruby-900')}>{error}</Text>
            </View>
          ) : !ready ? (
            <Text style={tailwind.style('text-cxs text-center text-gray-700')}>
              {I18n.t('META_TEMPLATES.REQUIRED_HINT')}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !ready || isSending, busy: isSending }}
            disabled={!ready || isSending}
            onPress={handleSend}
            style={({ pressed }) =>
              tailwind.style(
                'h-12 rounded-xl bg-blue-800 flex-row items-center justify-center gap-2',
                !ready || isSending ? 'opacity-50' : pressed ? 'opacity-80' : '',
              )
            }>
            {isSending ? <ActivityIndicator color="white" size="small" /> : null}
            <Text style={tailwind.style('text-base font-inter-medium-24 text-white')}>
              {I18n.t(isSending ? 'META_TEMPLATES.SENDING' : 'META_TEMPLATES.SEND')}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const MetaTemplateFillScreen = (props: Props) => {
  const { inboxId, templateId } = props.route.params;
  const templates = useAppSelector(selectTemplates(inboxId));
  const template = templates.find(t => String(t.id) === String(templateId));

  if (!template) {
    return (
      <SafeAreaView edges={['top']} style={tailwind.style('flex-1 bg-white')}>
        <ScreenHeader
          title={I18n.t('META_TEMPLATES.FILL_TITLE')}
          onBack={() => props.navigation.goBack()}
        />
        <View style={tailwind.style('flex-1 items-center justify-center px-8')}>
          <Text style={tailwind.style('text-sm text-center text-gray-800')}>
            {I18n.t('META_TEMPLATES.EMPTY.TEMPLATE_GONE')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  // Keyed so a different template (or a re-synced copy) starts a fresh form.
  return <FillForm key={String(template.id)} {...props} template={template} />;
};

export default MetaTemplateFillScreen;
