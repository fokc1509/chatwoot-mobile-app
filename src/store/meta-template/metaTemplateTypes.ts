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
}

export interface EmpreendimentosResponse {
  nomes: string[];
}
