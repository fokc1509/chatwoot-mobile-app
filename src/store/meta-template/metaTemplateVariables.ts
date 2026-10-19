// Port of the web template variable parsing and `templateParams` emission:
//  - templateVariables / initializeTemplateParameters / sendMessage:
//    cw-arqos app/javascript/dashboard/components-next/whatsapp/WhatsAppTemplateParser.vue:145-202,292-319,331-352
//  - processed_params scaffold (buildTemplateParameters → buildWhatsAppProcessedParams,
//    @chatwoot/utils@0.0.57 src/template.ts; the app pins 0.0.33, which lacks it).
// Variable keys and processed_params keys are kept verbatim (e.g. `msg_body`).
import type {
  MetaTemplate,
  MetaTemplateComponent,
  TemplateButtonParam,
  TemplateContentMode,
  TemplateHeader,
  TemplateHeaderFormat,
  TemplateHeaderParams,
  TemplateParams,
  TemplateProcessedParams,
  TemplateVariable,
  TemplateVariableKind,
} from './metaTemplateTypes';

const VARIABLE_SOURCE = '{{([^}]+)}}';
const MEDIA_FORMATS = ['IMAGE', 'VIDEO', 'DOCUMENT'];

const variableRegex = () => new RegExp(VARIABLE_SOURCE, 'g');

const findComponent = (template: MetaTemplate, type: string): MetaTemplateComponent | undefined =>
  (Array.isArray(template.components) ? template.components : []).find(c => c.type === type);

// Strips the surrounding braces from a `{{token}}` match (no trim, like the web).
const processVariable = (str: string) => str.replace(/{{|}}/g, '');

// Ordered, de-duplicated, trimmed variable names (@chatwoot/utils extractVariables).
const extractVariables = (text: string | undefined): string[] => {
  if (!text) return [];
  const seen = new Set<string>();
  const ordered: string[] = [];
  const regex = variableRegex();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const key = match[1].trim();
    if (!seen.has(key)) {
      seen.add(key);
      ordered.push(key);
    }
  }
  return ordered;
};

// WhatsAppTemplateParser.vue:208-212 (dropdown) and :521 (smart name).
const variableKind = (key: string): TemplateVariableKind => {
  const normalized = key.toLowerCase().trim();
  if (normalized === 'name') return 'name';
  if (normalized === 'empreendimento') return 'empreendimento';
  return 'text';
};

const toVariable = (key: string, example: string): TemplateVariable => ({
  key,
  example,
  kind: variableKind(key),
});

export const parseTemplateVariables = (template: MetaTemplate): TemplateVariable[] => {
  const bodyExamplesByKey = template.body_examples || {};
  const structured = template.body_variables;

  if (structured?.vars && structured.vars.length > 0) {
    return structured.vars.map((v, i) => {
      const key = (typeof v === 'object' ? v.name : v).trim();
      let example = '';
      if (bodyExamplesByKey[key]) {
        example = bodyExamplesByKey[key];
      } else if (typeof v === 'object' && v.example) {
        example = v.example;
      } else if (structured.examples?.[i]) {
        example = structured.examples[i];
      }
      return toVariable(key, example);
    });
  }

  const body = findComponent(template, 'BODY');
  const matches = (body?.text || '').match(variableRegex());
  if (!matches) return [];
  const componentExamples = body?.example?.body_text || [];

  // The web lists repeated placeholders twice; they share one processed_params
  // key, so keep the first occurrence only (same payload, one input per key).
  const seen = new Set<string>();
  const variables: TemplateVariable[] = [];
  matches.forEach((match, index) => {
    const key = processVariable(match).trim();
    if (seen.has(key)) return;
    seen.add(key);
    let example = '';
    if (bodyExamplesByKey[key]) {
      example = bodyExamplesByKey[key];
    } else if (componentExamples[index]?.[0]) {
      example = componentExamples[index][0];
    }
    variables.push(toVariable(key, example));
  });
  return variables;
};

export const initialVariableValues = (
  variables: TemplateVariable[],
  contactName: string | null | undefined,
): Record<string, string> => {
  const values: Record<string, string> = {};
  variables.forEach(v => {
    values[v.key] = '';
  });
  variables.forEach(v => {
    if (v.kind === 'name') {
      if (contactName) values[v.key] = contactName;
      return;
    }
    if (!values[v.key]) values[v.key] = v.example || `{{${v.key}}}`;
  });
  return values;
};

export const parseHeader = (template: MetaTemplate): TemplateHeader => {
  const header = findComponent(template, 'HEADER');
  const rawFormat = header?.format;

  if (rawFormat && MEDIA_FORMATS.includes(rawFormat)) {
    const mediaType = rawFormat.toLowerCase();
    const params: TemplateHeaderParams = { media_url: '', media_type: mediaType };
    if (mediaType === 'document') params.media_name = '';
    return {
      format: rawFormat as TemplateHeaderFormat,
      text: null,
      variables: [],
      exampleUrl: template.header_url ?? null,
      params,
    };
  }

  if (rawFormat === 'TEXT') {
    const text = header?.text || '';
    const variables = extractVariables(text);
    let params: TemplateHeaderParams | undefined;
    if (variables.length > 0) {
      params = {};
      variables.forEach(v => {
        (params as TemplateHeaderParams)[v] = '';
      });
    }
    return { format: 'TEXT', text, variables, exampleUrl: null, params };
  }

  // No header, or LOCATION (no input in the web composer).
  return { format: 'NONE', text: null, variables: [], exampleUrl: null, params: undefined };
};

export const parseButtonParams = (
  template: MetaTemplate,
): (TemplateButtonParam | undefined)[] | undefined => {
  const components = Array.isArray(template.components) ? template.components : [];
  const buttons: (TemplateButtonParam | undefined)[] = [];
  let found = false;
  components
    .filter(c => c.type === 'BUTTONS')
    .forEach(component => {
      (component.buttons || []).forEach((button, index) => {
        if (button.type === 'URL' && button.url && button.url.includes('{{')) {
          const buttonVars = button.url.match(variableRegex()) || [];
          if (buttonVars.length > 0) {
            found = true;
            buttons[index] = {
              type: 'url',
              parameter: '',
              url: button.url,
              variables: buttonVars.map(processVariable),
            };
          }
        }
        if (button.type === 'COPY_CODE') {
          found = true;
          buttons[index] = { type: 'copy_code', parameter: '' };
        }
      });
    });
  return found ? buttons : undefined;
};

// Empty processed_params, same keys and order as buildWhatsAppProcessedParams.
const buildScaffold = (template: MetaTemplate): TemplateProcessedParams => {
  const params: TemplateProcessedParams = {};
  const bodyVariables = extractVariables(findComponent(template, 'BODY')?.text);
  if (bodyVariables.length > 0) {
    params.body = Object.fromEntries(bodyVariables.map(v => [v, '']));
  }
  const header = parseHeader(template).params;
  if (header) params.header = header;
  const buttons = parseButtonParams(template);
  if (buttons) params.buttons = buttons;
  return params;
};

export const buildTemplateParams = (
  template: MetaTemplate,
  values: Record<string, string>,
  header?: TemplateHeaderParams,
  buttons?: (TemplateButtonParam | undefined)[],
  options: { sendRenderedContent?: boolean } = {},
): TemplateParams => {
  const processed = buildScaffold(template);
  if (processed.body || Object.keys(values).length > 0) {
    processed.body = { ...processed.body, ...values };
  }
  if (header) processed.header = header;
  if (buttons) processed.buttons = buttons;

  const contentMode: TemplateContentMode = options.sendRenderedContent
    ? 'rendered'
    : 'raw_template';
  const { name, category, language, namespace, id, waba_template_id } = template;
  return {
    name,
    category,
    language,
    namespace,
    id,
    waba_template_id,
    content_mode: contentMode,
    processed_params: processed,
  };
};
