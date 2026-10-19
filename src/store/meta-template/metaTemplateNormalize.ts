// Port of the web template normalization, visibility and picker filters:
//  - normalizeRow / buildBodyExamples / pickHeaderUrl:
//    cw-arqos app/javascript/dashboard/store/modules/metaTemplates.js:20-68
//  - parseTemplateName, availableTemplates, dropdown options, filteredTemplateMessages:
//    cw-arqos app/javascript/dashboard/components/widgets/conversation/WhatsappTemplates/TemplatesPicker.vue:29-107
// Rows keep their snake_case keys (never camelCased).
import type {
  MetaInboxConfig,
  MetaTemplate,
  MetaTemplateComponent,
  MetaTemplateRow,
  ParsedTemplateName,
  TemplateFilterOptions,
  TemplateFilters,
} from './metaTemplateTypes';

// Sentinel the web dropdowns use for "no filter".
export const ALL_FILTER = 'All';

const buildBodyExamples = (bodyComp?: MetaTemplateComponent): Record<string, string> => {
  const ex = bodyComp?.example;
  if (!ex) return {};
  if (Array.isArray(ex.body_text_named_params)) {
    return Object.fromEntries(ex.body_text_named_params.map(p => [p.param_name, p.example]));
  }
  if (Array.isArray(ex.body_text) && Array.isArray(ex.body_text[0])) {
    return Object.fromEntries(ex.body_text[0].map((v, i) => [String(i + 1), v]));
  }
  return {};
};

const pickHeaderUrl = (row: MetaTemplateRow, headerComp?: MetaTemplateComponent): string | null => {
  if (row.header_url) return row.header_url;
  const candidate = headerComp?.example?.header_handle?.[0];
  return typeof candidate === 'string' && /^https?:\/\//i.test(candidate) ? candidate : null;
};

export const normalizeTemplateRow = (row: MetaTemplateRow): MetaTemplate => {
  const components = Array.isArray(row.components) ? row.components : [];
  const findByType = (type: string) => components.find(c => c.type === type);
  const header = findByType('HEADER');
  const body = findByType('BODY');
  const footer = findByType('FOOTER');
  const buttons = findByType('BUTTONS');

  return {
    ...row,
    waba_template_id: row.meta_template_id,
    body_text: body?.text || '',
    body_examples: buildBodyExamples(body),
    header_format: header?.format || null,
    header_text: header?.format === 'TEXT' ? (header.text ?? null) : null,
    header_url: pickHeaderUrl(row, header),
    footer_text: footer?.text || null,
    buttons_json: buttons ? { buttons: buttons.buttons || [] } : null,
  };
};

export const parseTemplateName = (name: string | null | undefined): ParsedTemplateName => {
  const parts = (name || '').split('_');
  // Web fallback, including its leading space in content.
  if (parts.length < 4) {
    return { definition: 'Other', operation: 'Other', type: 'Other', content: ' Other' };
  }
  return {
    definition: parts[0],
    operation: parts[1],
    type: parts[2],
    content: parts.slice(3).join('_'),
  };
};

const listFrom = (config: Record<string, unknown>, camel: string, snake: string): string[] => {
  const value = config[camel] ?? config[snake];
  return Array.isArray(value) ? (value as string[]) : [];
};

export const filterVisibleTemplates = (
  templates: MetaTemplate[],
  metaInboxConfig: MetaInboxConfig | null | undefined,
): MetaTemplate[] => {
  const config = (metaInboxConfig || {}) as Record<string, unknown>;
  const definitions = listFrom(config, 'visibleDefinitions', 'visible_definitions');
  const operations = listFrom(config, 'visibleOperations', 'visible_operations');
  const types = listFrom(config, 'visibleTypes', 'visible_types');

  return templates.filter(t => {
    const parsed = parseTemplateName(t.name);
    if (definitions.length > 0 && !definitions.includes(parsed.definition)) return false;
    if (operations.length > 0 && !operations.includes(parsed.operation)) return false;
    if (types.length > 0 && !types.includes(parsed.type)) return false;
    return true;
  });
};

const matches = (selected: string | undefined, value: string) =>
  !selected || selected === ALL_FILTER || value === selected;

export const filterTemplates = (
  templates: MetaTemplate[],
  { category, definition, operation, type, search }: TemplateFilters,
): MetaTemplate[] => {
  const query = (search || '').toLowerCase();
  return templates.filter(t => {
    const parsed = parseTemplateName(t.name);
    return (
      t.name.toLowerCase().includes(query) &&
      matches(category, t.category) &&
      matches(definition, parsed.definition) &&
      matches(operation, parsed.operation) &&
      matches(type, parsed.type)
    );
  });
};

const distinct = (values: string[]) => [...new Set(values)];

// Distinct values for the dropdowns (callers add their own "all" option).
// `types` narrows by the selected definition/operation, like the web.
export const getFilterOptions = (
  templates: MetaTemplate[],
  selection: Pick<TemplateFilters, 'definition' | 'operation'> = {},
): TemplateFilterOptions => {
  const parsed = templates.map(t => ({ template: t, ...parseTemplateName(t.name) }));
  return {
    categories: distinct(parsed.map(p => p.template.category)),
    definitions: distinct(parsed.map(p => p.definition)),
    operations: distinct(parsed.map(p => p.operation)),
    types: distinct(
      parsed
        .filter(
          p =>
            matches(selection.definition, p.definition) &&
            matches(selection.operation, p.operation),
        )
        .map(p => p.type),
    ),
  };
};
