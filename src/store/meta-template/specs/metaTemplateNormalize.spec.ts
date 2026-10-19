import {
  filterTemplates,
  filterVisibleTemplates,
  getFilterOptions,
  normalizeTemplateRow,
  parseTemplateName,
} from '../metaTemplateNormalize';
import type { MetaTemplate, MetaTemplateRow } from '../metaTemplateTypes';
import { mockMetaTemplateRow } from './metaTemplateMockData';

const row = (overrides: Partial<MetaTemplateRow>): MetaTemplateRow => ({
  ...mockMetaTemplateRow,
  ...overrides,
});

describe('normalizeTemplateRow (web metaTemplates.js normalizeRow)', () => {
  it('flattens a NAMED row into the picker/webhook shape, keeping the raw row', () => {
    const t = normalizeTemplateRow(mockMetaTemplateRow);
    expect(t).toEqual({
      ...mockMetaTemplateRow,
      waba_template_id: '1234567890',
      body_text: 'Olá {{name}}, conheça o {{empreendimento}}: {{msg_body}}',
      body_examples: { name: 'Maria', empreendimento: 'Alameda', msg_body: 'novidades' },
      header_format: 'IMAGE',
      header_text: null,
      header_url: 'https://cdn.example/img.jpg',
      footer_text: 'Arqos',
      buttons_json: {
        buttons: [{ type: 'URL', text: 'Ver', url: 'https://arqos.com.br/{{1}}' }],
      },
    });
    expect(Object.keys(t.body_examples)).toContain('msg_body');
  });

  it('maps POSITIONAL examples from body_text[0] to "1", "2", ...', () => {
    const t = normalizeTemplateRow(
      row({
        parameter_format: 'POSITIONAL',
        components: [
          { type: 'BODY', text: 'Oi {{1}}, {{2}}', example: { body_text: [['Ana', 'tudo bem']] } },
        ],
      }),
    );
    expect(t.body_examples).toEqual({ '1': 'Ana', '2': 'tudo bem' });
    expect(t.header_format).toBeNull();
    expect(t.header_url).toBeNull();
    expect(t.footer_text).toBeNull();
    expect(t.buttons_json).toBeNull();
  });

  it('prefers row.header_url and ignores opaque h: handles', () => {
    const header = { type: 'HEADER', format: 'IMAGE', example: { header_handle: ['h:abc'] } };
    expect(normalizeTemplateRow(row({ components: [header] })).header_url).toBeNull();
    expect(
      normalizeTemplateRow(row({ components: [header], header_url: 'https://cw/x.png' }))
        .header_url,
    ).toBe('https://cw/x.png');
  });

  it('keeps TEXT header text and tolerates null components', () => {
    const t = normalizeTemplateRow(
      row({ components: [{ type: 'HEADER', format: 'TEXT', text: 'Oi {{nome}}' }] }),
    );
    expect(t.header_format).toBe('TEXT');
    expect(t.header_text).toBe('Oi {{nome}}');
    const empty = normalizeTemplateRow(row({ components: null }));
    expect(empty.body_text).toBe('');
    expect(empty.body_examples).toEqual({});
    expect(empty.buttons_json).toBeNull();
  });

  it('BUTTONS without buttons yields an empty list', () => {
    const t = normalizeTemplateRow(row({ components: [{ type: 'BUTTONS' }] }));
    expect(t.buttons_json).toEqual({ buttons: [] });
  });
});

describe('parseTemplateName (web TemplatesPicker.vue parseTemplateName)', () => {
  it('splits definition_operation_type_content', () => {
    expect(parseTemplateName('lancamento_venda_imagem_convite')).toEqual({
      definition: 'lancamento',
      operation: 'venda',
      type: 'imagem',
      content: 'convite',
    });
  });

  it('keeps underscores inside content', () => {
    expect(parseTemplateName('rev_conf_txt_boas_vindas').content).toBe('boas_vindas');
  });

  it('falls back to Other for names with fewer than 4 parts (web quirk: " Other")', () => {
    expect(parseTemplateName('hello_world')).toEqual({
      definition: 'Other',
      operation: 'Other',
      type: 'Other',
      content: ' Other',
    });
    expect(parseTemplateName('').definition).toBe('Other');
  });
});

const tpl = (name: string, category = 'MARKETING'): MetaTemplate =>
  normalizeTemplateRow(row({ name, category }));

const list = [
  tpl('lancamento_venda_imagem_convite'),
  tpl('lancamento_aluguel_txt_aviso', 'UTILITY'),
  tpl('pos_venda_txt_boas_vindas', 'UTILITY'),
  tpl('hello_world'),
];
const names = (ts: MetaTemplate[]) => ts.map(t => t.name);

describe('filterVisibleTemplates (web TemplatesPicker.vue availableTemplates)', () => {
  it('shows everything when config is missing or lists are empty', () => {
    expect(filterVisibleTemplates(list, undefined)).toHaveLength(4);
    expect(filterVisibleTemplates(list, null)).toHaveLength(4);
    expect(
      filterVisibleTemplates(list, {
        enabled: true,
        visibleDefinitions: [],
        visibleOperations: [],
        visibleTypes: [],
      }),
    ).toHaveLength(4);
  });

  it('hides definitions outside visibleDefinitions', () => {
    expect(names(filterVisibleTemplates(list, { visibleDefinitions: ['lancamento'] }))).toEqual([
      'lancamento_venda_imagem_convite',
      'lancamento_aluguel_txt_aviso',
    ]);
  });

  it('ANDs definitions, operations and types', () => {
    expect(
      names(
        filterVisibleTemplates(list, {
          visibleDefinitions: ['lancamento', 'pos'],
          visibleOperations: ['venda'],
          visibleTypes: ['txt'],
        }),
      ),
    ).toEqual(['pos_venda_txt_boas_vindas']);
  });

  it('also accepts the raw snake_case config', () => {
    expect(names(filterVisibleTemplates(list, { visible_types: ['imagem'] } as never))).toEqual([
      'lancamento_venda_imagem_convite',
    ]);
  });
});

describe('filterTemplates (web TemplatesPicker.vue filteredTemplateMessages)', () => {
  it('returns all with no filters or "All"', () => {
    expect(filterTemplates(list, {})).toHaveLength(4);
    expect(filterTemplates(list, { category: 'All', definition: 'All' })).toHaveLength(4);
  });

  it('filters by category, definition, operation, type and case-insensitive name search', () => {
    expect(names(filterTemplates(list, { category: 'UTILITY' }))).toEqual([
      'lancamento_aluguel_txt_aviso',
      'pos_venda_txt_boas_vindas',
    ]);
    expect(names(filterTemplates(list, { definition: 'lancamento', type: 'txt' }))).toEqual([
      'lancamento_aluguel_txt_aviso',
    ]);
    expect(names(filterTemplates(list, { operation: 'venda' }))).toEqual([
      'lancamento_venda_imagem_convite',
      'pos_venda_txt_boas_vindas',
    ]);
    expect(names(filterTemplates(list, { search: 'BOAS' }))).toEqual(['pos_venda_txt_boas_vindas']);
    expect(names(filterTemplates(list, { definition: 'Other' }))).toEqual(['hello_world']);
  });
});

describe('getFilterOptions (web TemplatesPicker.vue dropdown computeds)', () => {
  it('returns distinct values in first-seen order, without the "All" sentinel', () => {
    expect(getFilterOptions(list)).toEqual({
      categories: ['MARKETING', 'UTILITY'],
      definitions: ['lancamento', 'pos', 'Other'],
      operations: ['venda', 'aluguel', 'Other'],
      types: ['imagem', 'txt', 'Other'],
    });
  });

  it('narrows types by the selected definition/operation', () => {
    expect(getFilterOptions(list, { definition: 'lancamento', operation: 'All' }).types).toEqual([
      'imagem',
      'txt',
    ]);
    expect(getFilterOptions(list, { operation: 'venda', definition: 'pos' }).types).toEqual([
      'txt',
    ]);
  });
});
