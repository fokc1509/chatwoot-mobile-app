import type { MetaTemplateRow } from '../metaTemplateTypes';

export const mockMetaTemplateRow: MetaTemplateRow = {
  id: 7,
  meta_template_id: '1234567890',
  name: 'lancamento_venda_imagem_convite',
  language: 'pt_BR',
  category: 'MARKETING',
  status: 'APPROVED',
  parameter_format: 'NAMED',
  components: [
    {
      type: 'HEADER',
      format: 'IMAGE',
      example: { header_handle: ['https://cdn.example/img.jpg'] },
    },
    {
      type: 'BODY',
      text: 'Olá {{name}}, conheça o {{empreendimento}}: {{msg_body}}',
      example: {
        body_text_named_params: [
          { param_name: 'name', example: 'Maria' },
          { param_name: 'empreendimento', example: 'Alameda' },
          { param_name: 'msg_body', example: 'novidades' },
        ],
      },
    },
    { type: 'FOOTER', text: 'Arqos' },
    { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Ver', url: 'https://arqos.com.br/{{1}}' }] },
  ],
  header_url: null,
  rejected_reason: null,
  last_synced_at: '2026-10-18T12:00:00Z',
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-18T12:00:00Z',
};
