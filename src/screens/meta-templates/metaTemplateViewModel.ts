// Pure helpers behind the template picker and fill/send screens (no RN, no store).
import { ALL_FILTER, parseTemplateName } from '@/store/meta-template/metaTemplateNormalize';
import {
  buildWabaTemplatePayload,
  type WabaTemplatePayload,
} from '@/store/meta-template/metaTemplatePayload';
import type {
  MetaTemplate,
  TemplateButtonParam,
  TemplateHeaderFormat,
  TemplateHeaderParams,
  TemplateParams,
  TemplateVariable,
} from '@/store/meta-template/metaTemplateTypes';
import {
  buildTemplateParams,
  initialVariableValues,
} from '@/store/meta-template/metaTemplateVariables';

type Raw = Record<string, unknown>;

export type VariableInputMode = 'text' | 'name' | 'select';

const PLACEHOLDER = /{{([^}]+)}}/g;

const isFilled = (value: string | undefined, key?: string): boolean => {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return false;
  // initialVariableValues falls back to the literal `{{key}}` (web prefill); sending it
  // would deliver the raw placeholder to the lead.
  return key === undefined || trimmed !== `{{${key}}}`;
};

/** Body preview with the typed values; empty values keep their `{{placeholder}}`. */
export const applyVariables = (body: string, values: Record<string, string>): string =>
  (body || '').replace(PLACEHOLDER, (match, raw: string) => {
    const value = values[raw.trim()];
    return isFilled(value) ? value : match;
  });

/** Web picker `formatTemplateBody`: body with the template's examples. */
export const formatTemplateBody = (template: MetaTemplate): string => {
  const examples = template.body_examples || {};
  return (template.body_text || '').replace(/{{(.*?)}}/g, (match, raw: string) => {
    return examples[raw.trim()] || match;
  });
};

const sentence = (text: string) => {
  const spaced = text.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/** Readable title from `definition_operation_type_content`, plus the first three parts. */
export const describeTemplate = (template: MetaTemplate): { title: string; tags: string[] } => {
  if (template.name.split('_').length < 4) {
    return { title: sentence(template.name), tags: [] };
  }
  const parsed = parseTemplateName(template.name);
  return {
    title: sentence(parsed.content),
    tags: [parsed.definition, parsed.operation, parsed.type],
  };
};

/** Drops a filter selection that is no longer among the options (e.g. type after definition). */
export const reconcileFilter = (selected: string, options: string[]): string =>
  selected === ALL_FILTER || options.includes(selected) ? selected : ALL_FILTER;

export const variableInputMode = (
  variable: TemplateVariable,
  empreendimentos: string[],
): VariableInputMode => {
  if (variable.kind === 'name') return 'name';
  if (variable.kind === 'empreendimento' && empreendimentos.length > 0) return 'select';
  return 'text';
};

/**
 * Web prefill (contact name, examples), except the literal `{{key}}` fallback, which is
 * left empty so the field shows its placeholder, and an empreendimento example that is
 * not in the list (the select would show a value that is not one of its options).
 */
export const initialFormValues = (
  variables: TemplateVariable[],
  contactName: string | null | undefined,
  empreendimentos: string[],
): Record<string, string> => {
  const values = initialVariableValues(variables, contactName);
  variables.forEach(v => {
    if (!isFilled(values[v.key], v.key)) values[v.key] = '';
    if (
      variableInputMode(v, empreendimentos) === 'select' &&
      !empreendimentos.includes(values[v.key])
    ) {
      values[v.key] = '';
    }
  });
  return values;
};

const MEDIA_FORMATS: TemplateHeaderFormat[] = ['IMAGE', 'VIDEO', 'DOCUMENT'];

/**
 * Every body variable, media URL (IMAGE/VIDEO/DOCUMENT), text-header variable and
 * button parameter must be filled. The document name is optional, as on the web.
 */
export const canSend = (
  variables: TemplateVariable[],
  values: Record<string, string>,
  header: { format: TemplateHeaderFormat; params: TemplateHeaderParams | undefined },
  buttons?: (TemplateButtonParam | undefined)[],
): boolean => {
  if (!variables.every(v => isFilled(values[v.key], v.key))) return false;
  if (MEDIA_FORMATS.includes(header.format)) {
    if (!isFilled(header.params?.media_url)) return false;
  } else if (header.format === 'TEXT' && header.params) {
    if (!Object.values(header.params).every(value => isFilled(value))) return false;
  }
  // forEach-style check skips the sparse holes.
  return !(buttons || []).some(button => button !== undefined && !isFilled(button.parameter));
};

/** The webhook only reads id/name/email; never forward tokens of the auth user. */
export const senderFromUser = (user: Raw): Raw => ({
  id: user.id,
  name: user.name,
  email: user.email,
});

/** web: `sendRenderedContent = isAPIInbox` (ReplyBox.vue). */
export const sendTemplateParams = (
  template: MetaTemplate,
  values: Record<string, string>,
  headerParams: TemplateHeaderParams | undefined,
  buttonParams: (TemplateButtonParam | undefined)[] | undefined,
  inbox: Raw,
): TemplateParams =>
  buildTemplateParams(template, values, headerParams, buttonParams, {
    sendRenderedContent: inbox.channel_type === 'Channel::Api',
  });

export interface SendPayloadInput {
  template: MetaTemplate;
  values: Record<string, string>;
  /** `{...parseHeader(t).params, media_url, …}` so media_type survives. */
  headerParams: TemplateHeaderParams | undefined;
  buttonParams: (TemplateButtonParam | undefined)[] | undefined;
  /** Raw GET conversations/:id and GET inboxes/:id (snake_case). */
  conversation: Raw;
  inbox: Raw;
  /** Raw auth user (`state.auth.user`). */
  user: Raw;
  accountId: number;
  inReplyToId: number | undefined;
  now?: Date;
}

export const buildSendPayload = ({
  template,
  values,
  headerParams,
  buttonParams,
  conversation,
  inbox,
  user,
  accountId,
  inReplyToId,
  now,
}: SendPayloadInput): WabaTemplatePayload =>
  buildWabaTemplatePayload({
    conversation,
    inbox,
    sender: senderFromUser(user),
    account: { id: accountId },
    inReplyTo: inReplyToId ? { id: inReplyToId } : undefined,
    templateParams: sendTemplateParams(template, values, headerParams, buttonParams, inbox),
    now,
  });
