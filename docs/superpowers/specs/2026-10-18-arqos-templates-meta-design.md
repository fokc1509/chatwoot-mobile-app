# Templates Meta no app Arqos Atendimento — design

Data: 2026-10-18 · Fase 3 do roteiro (Base → Fila de Ligações → **Templates Meta** → Botões/ações → Ligações Meta+wzz → Publicação)

## Intenção

Quando a janela de 24 h do WhatsApp fecha, o corretor precisa mandar um template da Meta para retomar a conversa. Fora
do escritório ele faz isso pelo celular. O fluxo é **igual ao da web** (decisão do usuário): escolhe o template,
preenche as variáveis e envia; o envio passa pelo n8n.

## Objetivos

- Botão **Templates** na conversa do app, nas mesmas inboxes em que a web mostra.
- Escolher o template com os mesmos filtros da web; preencher variáveis, mídia de cabeçalho e parâmetros de botão;
  enviar pelo mesmo endpoint da web.
- A variável **empreendimento** vira uma lista com os empreendimentos cadastrados no mapa do CV (decisão do usuário),
  não a lista fixa de teste que a web tem hoje.

## Não-objetivos

- Criar, editar ou sincronizar templates na Meta (admin, web).
- Inboxes WhatsApp Cloud nativas (na web elas caem no fallback `@meta …`; o fluxo real é o das inboxes API com
  `meta_inbox_config`).
- Mudar a web. (A lista fixa de empreendimento na web continua; trocá-la pela lista real é um follow-up sugerido.)
- Mensagem "pendente" local antes do n8n confirmar (a web também não cria).

## Anti-objetivos

- Payload diferente do que a web manda — o n8n depende do formato exato.
- Converter para camelCase as chaves dos templates ou dos parâmetros (`processed_params`, nomes de variáveis como
  `msg_body`): o app tem `camelcaseKeys` profundo em `src/utils/camelCaseKeys.ts`; não pode passar por ali.
- Quebrar o app oficial / a web (mudança de servidor é só um endpoint novo de leitura).

## Como a web faz hoje (fonte da verdade — cw-arqos, branch develop)

- **Quando aparece:** botão "Templates" (`WootWriter/ReplyTopPanel.vue:169`, `ReplyBottomPanel.vue:353`) quando
  `inbox.meta_inbox_config.enabled` e não é nota privada (`ReplyBox.vue:187`); não depende de `can_reply`. Janela
  fechada: `can_reply` vem do servidor (`services/conversations/message_window_service.rb`).
- **Listar:** `GET /api/v1/accounts/:acc/inboxes/:inbox_id/meta_templates` (`inboxes/meta_templates_controller.rb:6`);
  atualizar: `POST …/meta_templates/sync`. Política `MetaTemplatePolicy`: admin ou papel customizado com
  `meta_template_view` (corretor sem essa permissão recebe 403).
- **Normalização e filtros:** `store/modules/metaTemplates.js:46` (`normalizeRow` → `body_text`, `body_examples`,
  `header_format`, `header_url`, `buttons_json`, `waba_template_id`); nome no formato
  `definition_operation_type_content` (`:34`); só mostra `visible_definitions/operations/types` do
  `meta_inbox_config` (`:62`); filtros categoria/definição/operação/tipo + busca por nome. Sem filtro de status/idioma.
- **Preencher:** `components-next/whatsapp/WhatsAppTemplateParser.vue` — variáveis de `body_variables.vars` ou regex
  `{{x}}`, exemplos pré-preenchidos (`:128-205`, `:299`); variável `name` = nome do contato com opção de digitar outro
  (`:521`); `empreendimento` = dropdown fixo (`:211`, será trocado no app); cabeçalho imagem/vídeo via
  `WabaImagePicker.vue` (lista `s3.arqos.online/waba-images/<tipo>/`, `:39`); documento = URL + nome; parâmetros de
  botão (`:575`). Emite `templateParams {name, category, language, namespace, id, waba_template_id, content_mode,
  processed_params}` (`:336-351`).
- **Enviar:** `ReplyBox.vue:1146` `onSendWhatsAppReply` → se `inbox.additional_attributes.waba_webhook_url`,
  `buildWabaTemplatePayload` (`:902`) monta o envelope `message_created` e faz
  `POST /api/v1/accounts/:acc/inboxes/:inbox_id/send_template_to_webhook` com `{payload}`
  (`inboxes_controller.rb:102`, `Whatsapp::TemplateWebhookSender`). Referência Ruby do mesmo payload:
  `Followups::Runners::Send#waba_template_payload` (`services/followups/runners/send.rb:343`).
- **Erros:** `{error}` com 422 (sem URL), 502 (webhook com erro), 400 (falha de rede), 500. Rejeição da Meta chega
  depois como nota "[Mensagem do Sistema]: Falha no Meta / janela expirou".

## Como funciona no app (decidido)

**Entrada.** Botão Templates na tela de conversa quando a inbox tem `meta_inbox_config.enabled` (o tipo `Inbox` do app
ainda não tem esse campo — incluir). Com a janela fechada, a faixa vermelha atual (`ReplyWarning.tsx`) ganha o botão
"Enviar template" (minha decisão). Hoje, com janela fechada em inbox API, o app força modo nota
(`ReplyBoxContainer.tsx:175`) — isso continua; o template é o caminho para responder.

**Permissão.** Os corretores têm a permissão (confirmado pelo usuário): ela depende da função estar configurada na
inbox (`meta_inbox_config`) e da autorização do papel customizado (`meta_template_view`). O app não replica essa regra:
mostra o botão quando a inbox tem a função ligada e confia no servidor. Se o `GET meta_templates` der 401/403, o botão some para aquela inbox (minha decisão). Usar o
`skipGlobalErrorHandler` do `APIService` (criado na fase 2) — 401 não pode deslogar.

**Escolher.** Lista igual à da web (mesma normalização, mesma regra de visibilidade, mesmos filtros e busca, botão
atualizar → `sync`).

**Preencher.** Igual à web: variáveis com exemplos; `name` = nome do contato com opção de outro valor;
**`empreendimento` = lista do mapa do CV** (endpoint novo, abaixo) — com opção de digitar outro valor (minha decisão,
para não travar se faltar algum); cabeçalho imagem/vídeo escolhendo da biblioteca `waba-images` (mesma fonte da web);
documento com URL + nome; parâmetros de botão.

**Enviar.** Montar exatamente o mesmo payload da web e chamar `send_template_to_webhook`. Como o app guarda as
conversas em camelCase, o payload é montado a partir dos dados **crus** (snake_case) da conversa/inbox/contato — buscar
a conversa pela API sem passar por `camelcaseKeys` — reproduzindo a estrutura de `buildWabaTemplatePayload` campo a
campo (minha decisão: sem acesso ao fluxo do n8n, replicar a web integralmente é o caminho seguro). O teste compara com
um payload real gerado pela web (fixture). Sucesso: aviso "Template
enviado" e fecha. A mensagem aparece quando o n8n posta de volta (via ActionCable, como as demais). Erro: mostra o
`error` do servidor.

## Mudança de servidor (cw-arqos)

Endpoint novo de leitura, para qualquer agente da conta: `GET /api/v1/accounts/:acc/empreendimentos` → `{ nomes:
[string] }` com **todos** os `nome` distintos de `cv_empreendimento_entries` (mapeados ao CV ou não — os "sem CV"
também são nomes canônicos válidos), ordenados (minha decisão). O endpoint
atual (`/cv/empreendimentos`) é só admin e devolve dados internos (catálogo ao vivo do CV, aliases) — não reutilizar.
Deploy com OK do usuário, como sempre.

## Como testar

App dev contra produção, usuário **"fc teste"** (precisa ter a permissão de ver templates — conferir o papel dele) e o
**lead de teste** do usuário (conversa com janela fechada ou aberta numa inbox com templates). Mandar um template de
cada tipo usado (só texto; com imagem) para o próprio número do usuário.

## O que fica para o construtor

Estrutura de pastas e estado (seguir `src/store/<módulo>`), layout das telas (bottom sheet ou tela cheia), como
reaproveitar a lógica de normalização/parse da web (portar para TS com testes), cache da lista, textos pt-BR.

## Critério de pronto

No app dev: o corretor de teste vê o botão na inbox certa, filtra, escolhe, preenche (incluindo empreendimento da
lista e mídia), envia, e a mensagem chega no WhatsApp do lead de teste e aparece na conversa; sem permissão → sem
botão e sem logout; testes unitários de normalização, parse de variáveis e montagem do payload (comparado com um
payload real gerado pela web) passam; spec do endpoint novo passa no servidor.
