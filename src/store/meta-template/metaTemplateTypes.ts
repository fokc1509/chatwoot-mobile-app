// Raw shapes returned by `GET inboxes/:id/meta_templates`
// (cw-arqos `Api::V1::Accounts::Inboxes::MetaTemplatesController#serialize`).
// Keys stay snake_case on purpose: rows, variable names and processed_params
// must reach the server intact (e.g. `msg_body`), so never camelCase them.

export type MetaTemplateComponentType = 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';

export type MetaTemplateHeaderFormat = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';

export interface MetaTemplateButton {
  type: string;
  text?: string;
  url?: string;
  phone_number?: string;
  example?: string[] | string;
  [key: string]: unknown;
}

export interface MetaTemplateNamedParamExample {
  param_name: string;
  example: string;
}

export interface MetaTemplateComponentExample {
  header_handle?: string[];
  header_text?: string[];
  header_text_named_params?: MetaTemplateNamedParamExample[];
  body_text?: string[][];
  body_text_named_params?: MetaTemplateNamedParamExample[];
  [key: string]: unknown;
}

export interface MetaTemplateComponent {
  type: MetaTemplateComponentType | string;
  format?: MetaTemplateHeaderFormat | string;
  text?: string;
  buttons?: MetaTemplateButton[];
  example?: MetaTemplateComponentExample;
  [key: string]: unknown;
}

export interface MetaTemplateRow {
  id: number;
  meta_template_id: string | null;
  name: string;
  language: string;
  category: string;
  status: string;
  parameter_format: string | null;
  components: MetaTemplateComponent[] | null;
  header_url: string | null;
  rejected_reason: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

// Row flattened like the web `normalizeRow`
// (cw-arqos `dashboard/store/modules/metaTemplates.js`): raw row spread first,
// then the flat fields the picker and the WABA webhook payload expect.
export interface MetaTemplate extends MetaTemplateRow {
  waba_template_id: string | null;
  body_text: string;
  body_examples: Record<string, string>;
  header_format: string | null;
  header_text: string | null;
  header_url: string | null;
  footer_text: string | null;
  buttons_json: { buttons: MetaTemplateButton[] } | null;
  body_variables?: MetaTemplateBodyVariables | null;
  namespace?: string;
}

export interface EmpreendimentosResponse {
  nomes: string[];
}

// --- Picker / parser shapes (ported from the web TemplatesPicker.vue and
// WhatsAppTemplateParser.vue). Keys that reach the server stay snake_case.

// `inbox.meta_inbox_config` as it arrives on the app's Inbox (transformInbox
// camelCases it). Empty / missing lists mean "show everything", like the web.
export interface MetaInboxConfig {
  enabled?: boolean;
  visibleDefinitions?: string[];
  visibleOperations?: string[];
  visibleTypes?: string[];
  [key: string]: unknown;
}

// Template name format `definition_operation_type_content`.
export interface ParsedTemplateName {
  definition: string;
  operation: string;
  type: string;
  content: string;
}

export interface TemplateFilters {
  category?: string;
  definition?: string;
  operation?: string;
  type?: string;
  search?: string;
}

export interface TemplateFilterOptions {
  categories: string[];
  definitions: string[];
  operations: string[];
  types: string[];
}

// Legacy structured variables (n8n / DB); optional on a template row.
export interface MetaTemplateBodyVariables {
  vars?: (string | { name: string; example?: string })[];
  examples?: string[];
}

export type TemplateVariableKind = 'text' | 'name' | 'empreendimento';

export interface TemplateVariable {
  key: string;
  example: string;
  kind: TemplateVariableKind;
}

export type TemplateHeaderFormat = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';

// processed_params.header: media (`media_url`, `media_type`, `media_name`)
// or one entry per text-header variable.
export type TemplateHeaderParams = Record<string, string>;

export interface TemplateHeader {
  format: TemplateHeaderFormat;
  // TEXT header raw text (with `{{x}}` placeholders); null otherwise.
  text: string | null;
  // TEXT header variable names, in order, de-duplicated.
  variables: string[];
  // Preview/example media URL (normalized `header_url`); not sent by default.
  exampleUrl: string | null;
  // Initial processed_params.header, or undefined when there is none.
  params: TemplateHeaderParams | undefined;
}

export type TemplateButtonParam =
  | { type: 'url'; parameter: string; url: string; variables: string[] }
  | { type: 'copy_code'; parameter: string };

export interface TemplateProcessedParams {
  body?: Record<string, string>;
  header?: TemplateHeaderParams;
  // Sparse like the web: index = position of the button in the template.
  buttons?: (TemplateButtonParam | undefined)[];
}

export type TemplateContentMode = 'rendered' | 'raw_template';

// `templateParams` emitted by the web WhatsAppTemplateParser `sendMessage`.
export interface TemplateParams {
  name: string;
  category: string;
  language: string;
  namespace: string | undefined;
  id: number;
  waba_template_id: string | null;
  content_mode: TemplateContentMode;
  processed_params: TemplateProcessedParams;
}

// --- Redux state (`state.metaTemplates`).

export interface MetaTemplateInboxState {
  templates: MetaTemplate[];
  // null = not checked yet; false = the server denied it (401/403).
  access: boolean | null;
  isLoading: boolean;
}

export interface MetaTemplateState {
  byInbox: Record<number, MetaTemplateInboxState>;
  empreendimentos: string[];
}
