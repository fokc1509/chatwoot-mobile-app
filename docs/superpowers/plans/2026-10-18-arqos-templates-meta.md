# Templates Meta (app) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enviar templates da Meta pelo app, igual à web (escolher, preencher, enviar via n8n), com a variável empreendimento vindo do mapa do CV.

**Architecture:** Servidor ganha um endpoint de leitura `GET empreendimentos` (nomes). No app, um módulo `src/store/meta-template` com funções puras portadas da web (normalização/filtros, parse de variáveis, montagem do payload) e testadas contra fixtures da web; estado Redux mínimo; duas telas (escolher, preencher/enviar) abertas a partir da conversa.

**Tech Stack:** App: Expo 52 / RN 0.76 / TS / Redux Toolkit / Jest (repo `~/dev/cw-mobileapp`, branch `feat/arqos-templates`). Servidor: Rails 7 / RSpec (repo `~/dev/cw-arqos`, branch nova `feat/empreendimentos-nomes` a partir de `develop`; specs no container `cw-staging-rails:dev`, `RAILS_ENV=test`, `POSTGRES_DATABASE=db_cw_arqos_test`, `CW_EDITION=ee`).

**Spec:** `docs/superpowers/specs/2026-10-18-arqos-templates-meta-design.md`

## Global Constraints

- O payload enviado ao `send_template_to_webhook` reproduz campo a campo o `buildWabaTemplatePayload` da web (`~/dev/cw-arqos/app/javascript/dashboard/components/widgets/conversation/ReplyBox.vue:902`), montado a partir de dados **crus** (snake_case) da conversa/inbox/contato.
- Linhas de template, variáveis e `processed_params` **nunca** passam por `camelcaseKeys` (`src/utils/camelCaseKeys.ts`). Nomes de variáveis com `_` (ex. `msg_body`) chegam intactos ao servidor.
- Toda chamada nova usa `skipGlobalErrorHandler: true` (`src/services/APIService.ts`; fase 2): 401 do servidor não pode deslogar.
- Botão Templates aparece quando a inbox tem `meta_inbox_config.enabled` e não é nota privada; 401/403 no `GET inboxes/:id/meta_templates` escondem o botão daquela inbox.
- Mesma regra de visibilidade e filtros da web (`~/dev/cw-arqos/app/javascript/dashboard/store/modules/metaTemplates.js`: `normalizeRow` `:46`, parse do nome `definition_operation_type_content` `:34`, `visible_*` `:62`); sem filtro de status/idioma.
- Variável `empreendimento`: lista de `GET empreendimentos` + opção de digitar outro valor; endpoint ausente/erro → só texto livre. Variável `name`: nome do contato + opção de outro valor.
- Servidor: `GET /api/v1/accounts/:account_id/empreendimentos` → `{ "nomes": [string] }` = todos os `nome` distintos de `cv_empreendimento_entries`, ordenados; qualquer usuário da conta (agente ou admin).
- Textos pt-BR em `src/i18n/pt_BR.json` sob `META_TEMPLATES` (espelhar em `en.json`).
- Sem novas dependências nativas no app (vai por Metro/OTA). Sem `@testing-library/react-native` — testar lógica pura.
- Gates: `npx jest` verde; tsc ≤ 71 erros; lint ≤ 35. Executores: subagentes `model: "opus"`.

## Review Focus

1. Template sem variáveis → envia sem campos para preencher. (Task 3 teste `parseTemplateVariables` vazio; Task 4 payload com `processed_params` vazio igual ao da web)
2. Variável `msg_body` / `nome_cliente` → chega com o mesmo nome no payload. (Task 4 teste de chaves preservadas)
3. `GET empreendimentos` 404 (servidor antigo/oficial) ou vazio → campo empreendimento vira texto livre, sem erro na tela. (Task 2 service retorna `[]`; Task 6 view-model)
4. 403 no `meta_templates` → botão some, sem logout. (Task 5 teste de acesso por inbox)
5. Envio com 502/422 → mostra o `error` do servidor e mantém o formulário preenchido. (Task 2 `getTemplateErrorMessage`; Task 6)

---

### Task 1: Servidor — endpoint de nomes de empreendimentos

**Files (cw-arqos, branch `feat/empreendimentos-nomes`):**
- Modify: `config/routes.rb` (dentro do escopo `accounts`, junto ao `namespace :empreendimentos` existente: `resources :empreendimentos, only: [:index]` no nível da conta — conferir que não colide com `empreendimentos/medias`)
- Create: `app/controllers/api/v1/accounts/empreendimentos_controller.rb` (herda `Api::V1::Accounts::BaseController`; sem `check_admin_authorization?`)
- Test: `spec/controllers/api/v1/accounts/empreendimentos_controller_spec.rb` (ou request spec no padrão vizinho)
- Marcar com comentário `# ARQOS:` como o resto do fork.

**Interfaces:** Produces `GET /api/v1/accounts/:account_id/empreendimentos` → 200 `{ "nomes": ["Alameda", "Blvd Alti", ...] }`.

- [ ] **Step 1: Specs que falham** — agente da conta recebe 200 com `nomes` distintos e ordenados a partir de entradas `[{nome:'Bravo', cv_id:2}, {nome:'Alameda', cv_id:6}, {nome:'Alameda', cv_id:5}, {nome:'Distritq', cv_id:nil}]` → `["Alameda","Bravo","Distritq"]`; admin também 200; sem autenticação → 401; tabela vazia → `{ nomes: [] }`.
- [ ] **Step 2:** rodar o spec no container → FAIL.
- [ ] **Step 3:** implementar (`CvEmpreendimentoEntry.distinct.order(:nome).pluck(:nome)`).
- [ ] **Step 4:** spec → PASS; rubocop limpo nos arquivos tocados.
- [ ] **Step 5:** commit, push do branch, abrir PR para `develop` em `fokc1509/cw-arqos` (corpo em pt-BR). **Não** mergear nem deployar (Task 7).

### Task 2: App — tipos e serviço

**Files:** Create `src/store/meta-template/metaTemplateTypes.ts`, `metaTemplateService.ts`; Test `src/store/meta-template/specs/metaTemplateService.spec.ts`, `specs/metaTemplateMockData.ts`

**Interfaces:**
- Produces:
  - Tipos crus (snake_case) do que `GET inboxes/:id/meta_templates` devolve (conferir `meta_templates_controller.rb` e o jbuilder/serializer) e `MetaTemplate` normalizado (campos de `normalizeRow`).
  - `MetaTemplateService` (todas com `skipGlobalErrorHandler: true`, resposta **sem** camelCase):
    - `list(inboxId: number): Promise<MetaTemplateRow[]>` → `GET inboxes/${inboxId}/meta_templates`
    - `sync(inboxId: number): Promise<void>` → `POST inboxes/${inboxId}/meta_templates/sync`
    - `empreendimentos(): Promise<string[]>` → `GET empreendimentos` → `nomes`; **qualquer erro → `[]`**
    - `rawConversation(displayId: number): Promise<Record<string, unknown>>` → `GET conversations/${displayId}` cru
    - `rawInbox(inboxId: number): Promise<Record<string, unknown>>` → `GET inboxes/${inboxId}` cru
    - `sendToWebhook(inboxId: number, payload: unknown): Promise<void>` → `POST inboxes/${inboxId}/send_template_to_webhook` body `{ payload }`
  - `getTemplateErrorMessage(error: unknown): string` — `response.data.error` (string não vazia) ou `I18n.t('META_TEMPLATES.ERRORS.GENERIC')`.
- [ ] **Step 1: testes que falham** — URLs e configs exatas acima; `empreendimentos()` devolve `['Alameda']` para `{data:{nomes:['Alameda']}}` e `[]` para rejeição 404; `getTemplateErrorMessage` devolve `'Webhook returned 500'` para `{response:{status:502,data:{error:'Webhook returned 500'}}}`; uma linha com chave `msg_body` volta com `msg_body` (sem camelCase).
- [ ] **Step 2:** `npx jest src/store/meta-template` → FAIL. **Step 3:** implementar. **Step 4:** PASS + suíte. **Step 5:** commit `feat(templates): meta template service`.

### Task 3: App — normalização, filtros e parse de variáveis (porte da web)

**Files:** Create `src/store/meta-template/metaTemplateNormalize.ts`, `metaTemplateVariables.ts`; Test `specs/metaTemplateNormalize.spec.ts`, `specs/metaTemplateVariables.spec.ts`

**Interfaces:**
- Consumes: Task 2 tipos.
- Produces (portar fielmente; fontes: `store/modules/metaTemplates.js` e `components-next/whatsapp/WhatsAppTemplateParser.vue:128-205,299,336-351,521,575`):
  - `normalizeTemplateRow(row): MetaTemplate`; `parseTemplateName(name): { definition, operation, type, content }`
  - `filterVisibleTemplates(templates, metaInboxConfig): MetaTemplate[]` (regra `visible_definitions/operations/types`)
  - `filterTemplates(templates, { category?, definition?, operation?, type?, search? }): MetaTemplate[]`; `getFilterOptions(templates)` (valores distintos para os dropdowns)
  - `parseTemplateVariables(template): TemplateVariable[]` (`{ key, example, kind: 'text'|'name'|'empreendimento' }`, de `body_variables.vars` ou regex `{{x}}`)
  - `initialVariableValues(variables, contactName): Record<string,string>` (exemplos; `name` = nome do contato)
  - `parseButtonParams(template)` e `parseHeader(template): { format: 'NONE'|'TEXT'|'IMAGE'|'VIDEO'|'DOCUMENT', ... }`
  - `buildTemplateParams(template, values, header, buttons): TemplateParams` = o objeto `templateParams {name, category, language, namespace, id, waba_template_id, content_mode, processed_params}` que a web emite.
- [ ] **Step 1: testes que falham** — fixtures copiadas de linhas reais/mocks da web (specs da web em `~/dev/cw-arqos/spec/javascript` ou `app/javascript/**/specs` se existirem; senão montar a partir do código): nome `rev_conf_txt_boasvindas` vira `{definition:'rev', operation:'conf', type:'txt', content:'boasvindas'}` (ajustar ao formato real encontrado); visibilidade esconde definição fora de `visible_definitions`; template sem variáveis → `[]`; `{{1}}`/`{{name}}`/`{{empreendimento}}` → kinds corretos; `name` inicial = nome do contato; `processed_params` preserva `msg_body`; `buildTemplateParams` igual ao objeto que o código da web produziria para a mesma entrada.
- [ ] **Step 2–5:** FAIL → implementar → PASS + suíte → commit `feat(templates): port template normalization and variable parsing from web`.

### Task 4: App — montagem do payload (porte de `buildWabaTemplatePayload`)

**Files:** Create `src/store/meta-template/metaTemplatePayload.ts`; Test `specs/metaTemplatePayload.spec.ts`, fixture `specs/fixtures/webTemplatePayload.json`

**Interfaces:**
- Consumes: Task 2 (`rawConversation`, `rawInbox` shapes), Task 3 (`TemplateParams`).
- Produces: `buildWabaTemplatePayload({ conversation, inbox, sender, account, templateParams, now }): WabaTemplatePayload` — mesma estrutura e valores da web (`ReplyBox.vue:902`; referência Ruby `~/dev/cw-arqos/app/services/followups/runners/send.rb:343`). `sender` = usuário logado (cru, de `state.auth.user`); `account` = conta atual; `now` injetável para teste.
- [ ] **Step 1: teste que falha** — fixture gerada a partir do código da web: executar a função da web isolada em node (extrair o corpo de `buildWabaTemplatePayload` para um script temporário fora do repo, alimentar com a mesma conversa/inbox/sender/templateParams crus do teste) e salvar o JSON em `specs/fixtures/webTemplatePayload.json`; o teste exige igualdade profunda com a saída do app. Segundo caso: `processed_params` vazio. Terceiro: chaves `msg_body` intactas.
- [ ] **Step 2–5:** FAIL → implementar → PASS + suíte → commit `feat(templates): build webhook payload identical to web`.

### Task 5: App — estado, acesso por inbox e entrada na conversa

**Files:** Create `src/store/meta-template/metaTemplateActions.ts`, `metaTemplateSlice.ts`, `metaTemplateSelectors.ts`; Modify `src/store/reducers.ts` (`metaTemplates`), `src/types/Inbox.ts` (`metaInboxConfig?: { enabled: boolean; visibleDefinitions?: string[]; visibleOperations?: string[]; visibleTypes?: string[] }` — vem camelCase pelo `transformInbox`, ok para leitura), `src/screens/chat-screen/components/reply-box/ReplyBoxContainer.tsx` e `ReplyWarning.tsx` (botão), navegação (`TabBarExcludedScreenParamList`: `MetaTemplatePicker: { conversationId: number; inboxId: number }`, `MetaTemplateFill: { conversationId: number; inboxId: number; templateId: number | string }`), i18n.
- Test: `specs/metaTemplateSlice.spec.ts`, `specs/metaTemplateActions.spec.ts`, `specs/metaTemplateSelectors.spec.ts`

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces: estado `{ byInbox: Record<number, { templates: MetaTemplate[]; access: boolean | null; isLoading: boolean }>, empreendimentos: string[] }`; thunks `fetchTemplates(inboxId)` (401/403 → `access=false`; 2xx → `true` + lista normalizada e filtrada por visibilidade), `syncTemplates(inboxId)` (depois refaz `fetchTemplates`), `fetchEmpreendimentos()`; seletores `selectTemplateAccess(inboxId)`, `selectTemplates(inboxId)`, `selectEmpreendimentos`; `shouldShowTemplateButton(inbox, access, isPrivateNote): boolean` = `inbox.metaInboxConfig?.enabled && !isPrivateNote && access !== false`.
- Entrada: botão "Templates" no reply box quando `shouldShowTemplateButton`; em `ReplyWarning` (janela fechada) botão "Enviar template" quando a inbox tem a função; ambos navegam para `MetaTemplatePicker`. `fetchTemplates` dispara ao abrir a conversa de uma inbox com a função ligada.
- [ ] **Step 1: testes que falham** — 403 → `access=false` e `shouldShowTemplateButton` false, sem `auth/logout`; 200 → lista filtrada pela visibilidade; `fetchEmpreendimentos` com erro → `[]`; nota privada → false.
- [ ] **Step 2–5:** FAIL → implementar → PASS + suíte + tsc/lint → commit `feat(templates): state, per-inbox access and entry points`.

### Task 6: App — telas escolher e preencher/enviar

**Files:** Create `src/screens/meta-templates/MetaTemplatePickerScreen.tsx`, `MetaTemplateFillScreen.tsx`, `components/*`, `metaTemplateViewModel.ts`; Modify navegação (registrar as telas no stack raiz de `AppTabs.tsx`), i18n.
- Test: `src/screens/meta-templates/specs/metaTemplateViewModel.spec.ts`

**Interfaces:**
- Consumes: Tasks 2–5.
- Produces (comportamento):
  - Escolher: busca por nome, dropdowns de `getFilterOptions`, lista com nome legível + prévia do corpo; botão atualizar → `syncTemplates`; vazio/sem acesso com texto.
  - Preencher: prévia do corpo com valores aplicados; um campo por variável; `name` com opção "outro valor"; `empreendimento` com lista de `selectEmpreendimentos` + "outro valor" (lista vazia → texto livre); cabeçalho IMAGE/VIDEO: escolher da biblioteca `waba-images` (mesma listagem que `WabaImagePicker.vue:39` usa — portar a chamada) com prévia; DOCUMENT: URL + nome; parâmetros de botão.
  - Enviar: `rawConversation` + `rawInbox` → `buildTemplateParams` → `buildWabaTemplatePayload` → `sendToWebhook`; botão desabilitado enquanto envia ou com campo obrigatório vazio; sucesso → aviso `META_TEMPLATES.SENT` e volta para a conversa; erro → `getTemplateErrorMessage` exibido **na tela** (não só toast) e formulário preservado.
  - `metaTemplateViewModel`: `applyVariables(body, values)`, `canSend(variables, values, header)`, `variableInputMode(variable, empreendimentos)` → `'text'|'name'|'select'`.
- [ ] **Step 1: testes que falham** — `applyVariables('Olá {{name}}', {name:'Ana'}) === 'Olá Ana'`; `canSend` false com valor só de espaços ou cabeçalho IMAGE sem mídia; `variableInputMode` de `empreendimento` com lista vazia → `'text'`, com lista → `'select'`.
- [ ] **Step 2–5:** FAIL → implementar → PASS + suíte + tsc/lint → commit `feat(templates): picker and fill/send screens`.

### Task 7: Deploy do endpoint e verificação com o usuário (controller)

- [ ] **Step 1:** pedir OK ao usuário para merge do PR da Task 1 + deploy em produção (subagente com a skill `production-deploy`, versão `4.17.0-arqos7.15.0`, compose + linha `services` do Coolify). Sem OK, não deployar — o app cai no texto livre.
- [ ] **Step 2:** push do branch do app; Metro rodando (sem build novo — conferir que não entrou dependência nativa).
- [ ] **Step 3:** roteiro com o usuário, logado como "fc teste", no lead de teste: botão aparece; filtros; template só texto; template com imagem; empreendimento da lista; envio chega no WhatsApp e aparece na conversa; erro (ex.: modo avião) mostrado na tela.
- [ ] **Step 4:** abrir PR `feat/arqos-templates` (base `feat/arqos-fila-ligacoes` enquanto #1/#2 abertos).
