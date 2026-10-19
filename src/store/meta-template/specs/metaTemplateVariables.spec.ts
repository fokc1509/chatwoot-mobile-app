import { normalizeTemplateRow } from '../metaTemplateNormalize';
import type { MetaTemplate, MetaTemplateRow } from '../metaTemplateTypes';
import {
  buildTemplateParams,
  initialVariableValues,
  parseButtonParams,
  parseHeader,
  parseTemplateVariables,
} from '../metaTemplateVariables';
import { mockMetaTemplateRow } from './metaTemplateMockData';

const make = (overrides: Partial<MetaTemplateRow> & Record<string, unknown>): MetaTemplate =>
  normalizeTemplateRow({ ...mockMetaTemplateRow, ...overrides } as MetaTemplateRow);

const named = normalizeTemplateRow(mockMetaTemplateRow);

// ---------------------------------------------------------------------------
// Reference: the web flow transcribed (JS semantics) from
// @chatwoot/utils@0.0.57 buildWhatsAppProcessedParams + WhatsAppTemplateParser.vue
// templateVariables / initializeTemplateParameters / sendMessage, used as the
// oracle for buildTemplateParams.
// ---------------------------------------------------------------------------
/* eslint-disable @typescript-eslint/no-explicit-any */
const VAR = /{{([^}]+)}}/g;
const webExtract = (body: string) => {
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(VAR.source, 'g');
  while ((m = re.exec(body)) !== null) {
    const k = m[1].trim();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
};
const webScaffold = (template: any) => {
  const params: any = {};
  const find = (t: string) => (template.components || []).find((c: any) => c.type === t);
  const body = find('BODY');
  const bodyVars = body ? webExtract(body.text) : [];
  if (bodyVars.length) {
    params.body = {};
    bodyVars.forEach(v => (params.body[v] = ''));
  }
  const header = find('HEADER');
  if (header?.format && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(header.format)) {
    const format = header.format.toLowerCase();
    params.header = { media_url: '', media_type: format };
    if (format === 'document') params.header.media_name = '';
  } else if (header?.format === 'TEXT' && header.text) {
    const hv = webExtract(header.text);
    if (hv.length) {
      params.header = {};
      hv.forEach(v => (params.header[v] = ''));
    }
  }
  const buttons: any[] = [];
  let found = false;
  (template.components || [])
    .filter((c: any) => c.type === 'BUTTONS')
    .forEach((c: any) =>
      (c.buttons || []).forEach((b: any, i: number) => {
        if (b.type === 'URL' && b.url && b.url.includes('{{')) {
          const vs = b.url.match(VAR) || [];
          if (vs.length) {
            found = true;
            buttons[i] = {
              type: 'url',
              parameter: '',
              url: b.url,
              variables: vs.map((s: string) => s.replace(/{{|}}/g, '')),
            };
          }
        }
        if (b.type === 'COPY_CODE') {
          found = true;
          buttons[i] = { type: 'copy_code', parameter: '' };
        }
      }),
    );
  if (found) params.buttons = buttons;
  return params;
};
const webVariables = (template: any) => {
  const bodyComp = (template.components || []).find((c: any) => c.type === 'BODY');
  const bodyText = bodyComp?.text || '';
  const matches = bodyText.match(VAR);
  if (!matches) return [];
  const bodyExamples = bodyComp?.example?.body_text || [];
  return matches.map((match: string, index: number) => {
    const name = match.replace(/{{|}}/g, '').trim();
    let example = '';
    if (template.body_examples && template.body_examples[name]) {
      example = template.body_examples[name];
    } else if (bodyExamples[index] && bodyExamples[index][0]) {
      example = bodyExamples[index][0];
    }
    return { name, example };
  });
};
const webSendMessage = (
  template: any,
  contactName: string,
  edit: (p: any) => void,
  sendRenderedContent = false,
) => {
  const processedParams = webScaffold(template);
  const vars = webVariables(template);
  if (vars.length > 0) {
    const body = { ...processedParams.body };
    vars.forEach((v: any) => {
      const cleanName = v.name.trim();
      if (cleanName.toLowerCase() === 'name') {
        if (contactName) body[cleanName] = contactName;
        return;
      }
      if (!body[cleanName]) body[cleanName] = v.example || `{{${cleanName}}}`;
    });
    processedParams.body = body;
  }
  edit(processedParams);
  const { name, category, language, namespace, id, waba_template_id } = template;
  return {
    name,
    category,
    language,
    namespace,
    id,
    waba_template_id,
    content_mode: sendRenderedContent ? 'rendered' : 'raw_template',
    processed_params: processedParams,
  };
};
/* eslint-enable @typescript-eslint/no-explicit-any */

describe('parseTemplateVariables (WhatsAppTemplateParser.vue templateVariables)', () => {
  it('returns [] for a template without variables', () => {
    const t = make({ components: [{ type: 'BODY', text: 'Olá, tudo bem?' }] });
    expect(parseTemplateVariables(t)).toEqual([]);
  });

  it('classifies name / empreendimento / text and takes examples from body_examples', () => {
    expect(parseTemplateVariables(named)).toEqual([
      { key: 'name', example: 'Maria', kind: 'name' },
      { key: 'empreendimento', example: 'Alameda', kind: 'empreendimento' },
      { key: 'msg_body', example: 'novidades', kind: 'text' },
    ]);
  });

  it('handles positional {{1}}, case-insensitive kinds and trims keys', () => {
    const t = make({
      components: [
        {
          type: 'BODY',
          text: '{{1}} {{ Name }} {{EMPREENDIMENTO}} {{2}}',
          example: { body_text: [['um', 'dois']] },
        },
      ],
    });
    expect(parseTemplateVariables(t)).toEqual([
      { key: '1', example: 'um', kind: 'text' },
      { key: 'Name', example: '', kind: 'name' },
      { key: 'EMPREENDIMENTO', example: '', kind: 'empreendimento' },
      { key: '2', example: 'dois', kind: 'text' },
    ]);
  });

  it('falls back to component example body_text[index][0] when body_examples misses', () => {
    const t = {
      ...make({
        components: [{ type: 'BODY', text: '{{a}} {{b}}', example: { body_text: [['x'], ['y']] } }],
      }),
      body_examples: {},
    };
    expect(parseTemplateVariables(t).map(v => v.example)).toEqual(['x', 'y']);
  });

  it('de-duplicates repeated placeholders (single input per key)', () => {
    const t = make({ components: [{ type: 'BODY', text: '{{name}} e {{name}} {{x}}' }] });
    expect(parseTemplateVariables(t).map(v => v.key)).toEqual(['name', 'x']);
  });

  it('prefers structured body_variables.vars (string or object) with example priority', () => {
    const t = make({
      body_variables: {
        vars: [' name ', { name: 'msg_body', example: 'obj' }, 'empreendimento', 'extra'],
        examples: ['e0', 'e1', 'e2', 'e3'],
      },
    });
    expect(parseTemplateVariables(t)).toEqual([
      { key: 'name', example: 'Maria', kind: 'name' },
      { key: 'msg_body', example: 'novidades', kind: 'text' },
      { key: 'empreendimento', example: 'Alameda', kind: 'empreendimento' },
      { key: 'extra', example: 'e3', kind: 'text' },
    ]);
  });
});

describe('initialVariableValues (WhatsAppTemplateParser.vue initializeTemplateParameters)', () => {
  it('uses the contact name for `name` and examples for the rest', () => {
    expect(initialVariableValues(parseTemplateVariables(named), 'João')).toEqual({
      name: 'João',
      empreendimento: 'Alameda',
      msg_body: 'novidades',
    });
  });

  it('leaves `name` empty without a contact name and falls back to {{key}} without example', () => {
    const t = make({ components: [{ type: 'BODY', text: '{{name}} {{codigo}}' }] });
    expect(initialVariableValues(parseTemplateVariables(t), '')).toEqual({
      name: '',
      codigo: '{{codigo}}',
    });
  });

  it('returns {} for no variables', () => {
    expect(initialVariableValues([], 'João')).toEqual({});
  });
});

describe('parseHeader', () => {
  it('IMAGE header → media params with empty media_url and the example url', () => {
    expect(parseHeader(named)).toEqual({
      format: 'IMAGE',
      text: null,
      variables: [],
      exampleUrl: 'https://cdn.example/img.jpg',
      params: { media_url: '', media_type: 'image' },
    });
  });

  it('DOCUMENT header adds media_name', () => {
    const t = make({ components: [{ type: 'HEADER', format: 'DOCUMENT' }] });
    expect(parseHeader(t).params).toEqual({
      media_url: '',
      media_type: 'document',
      media_name: '',
    });
  });

  it('TEXT header with variables → one param per variable; without → undefined', () => {
    const withVars = make({
      components: [{ type: 'HEADER', format: 'TEXT', text: 'Oi {{nome}} {{nome}}' }],
    });
    expect(parseHeader(withVars)).toEqual({
      format: 'TEXT',
      text: 'Oi {{nome}} {{nome}}',
      variables: ['nome'],
      exampleUrl: null,
      params: { nome: '' },
    });
    const plain = make({ components: [{ type: 'HEADER', format: 'TEXT', text: 'Oi' }] });
    expect(parseHeader(plain).params).toBeUndefined();
  });

  it('no header (or LOCATION) → NONE', () => {
    expect(parseHeader(make({ components: [] })).format).toBe('NONE');
    expect(
      parseHeader(make({ components: [{ type: 'HEADER', format: 'LOCATION' }] })),
    ).toMatchObject({ format: 'NONE', params: undefined });
  });
});

describe('parseButtonParams', () => {
  it('URL buttons with variables need a parameter', () => {
    expect(parseButtonParams(named)).toEqual([
      { type: 'url', parameter: '', url: 'https://arqos.com.br/{{1}}', variables: ['1'] },
    ]);
  });

  it('keeps positional indexes (sparse) and supports COPY_CODE', () => {
    const t = make({
      components: [
        {
          type: 'BUTTONS',
          buttons: [
            { type: 'QUICK_REPLY', text: 'Sim' },
            { type: 'COPY_CODE', example: 'ABC' },
          ],
        },
      ],
    });
    const result = parseButtonParams(t);
    expect(result).toHaveLength(2);
    expect(result && 0 in result).toBe(false);
    expect(result?.[1]).toEqual({ type: 'copy_code', parameter: '' });
  });

  it('returns undefined when no button needs input', () => {
    const t = make({
      components: [
        { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Site', url: 'https://a.b' }] },
      ],
    });
    expect(parseButtonParams(t)).toBeUndefined();
  });
});

describe('buildTemplateParams (WhatsAppTemplateParser.vue sendMessage templateParams)', () => {
  it('matches the web templateParams for the NAMED mock, keeping msg_body intact', () => {
    const vars = parseTemplateVariables(named);
    const values = { ...initialVariableValues(vars, 'João'), msg_body: 'Promoção de outubro' };
    const header = { ...parseHeader(named).params, media_url: 'https://s3/x.jpg' };
    const buttons = parseButtonParams(named)?.map(b => b && { ...b, parameter: 'abc' });

    const result = buildTemplateParams(named, values, header, buttons);

    const web = webSendMessage(named, 'João', p => {
      p.body.msg_body = 'Promoção de outubro';
      p.header.media_url = 'https://s3/x.jpg';
      p.buttons[0].parameter = 'abc';
    });
    expect(result).toEqual(web);
    expect(JSON.stringify(result)).toBe(JSON.stringify(web));
    expect(result).toEqual({
      name: 'lancamento_venda_imagem_convite',
      category: 'MARKETING',
      language: 'pt_BR',
      namespace: undefined,
      id: 7,
      waba_template_id: '1234567890',
      content_mode: 'raw_template',
      processed_params: {
        body: { name: 'João', empreendimento: 'Alameda', msg_body: 'Promoção de outubro' },
        header: { media_url: 'https://s3/x.jpg', media_type: 'image' },
        buttons: [
          { type: 'url', parameter: 'abc', url: 'https://arqos.com.br/{{1}}', variables: ['1'] },
        ],
      },
    });
    expect(Object.keys(result.processed_params.body ?? {})).toContain('msg_body');
  });

  it('content_mode rendered when sendRenderedContent', () => {
    const result = buildTemplateParams(named, {}, undefined, undefined, {
      sendRenderedContent: true,
    });
    expect(result.content_mode).toBe('rendered');
  });

  it('template without variables, header or buttons → empty processed_params like the web', () => {
    const t = make({ components: [{ type: 'BODY', text: 'Olá!' }] });
    const result = buildTemplateParams(
      t,
      initialVariableValues(parseTemplateVariables(t), 'Ana'),
      parseHeader(t).params,
      parseButtonParams(t),
    );
    expect(result).toEqual(webSendMessage(t, 'Ana', () => undefined));
    expect(result.processed_params).toEqual({});
  });

  it('defaults header/buttons to the scaffold and keeps POSITIONAL keys', () => {
    const t = make({
      parameter_format: 'POSITIONAL',
      components: [
        { type: 'HEADER', format: 'TEXT', text: 'Oi {{1}}' },
        { type: 'BODY', text: '{{1}} e {{2}}', example: { body_text: [['a', 'b']] } },
      ],
    });
    const values = initialVariableValues(parseTemplateVariables(t), '');
    expect(buildTemplateParams(t, values)).toEqual(webSendMessage(t, '', () => undefined));
  });
});
