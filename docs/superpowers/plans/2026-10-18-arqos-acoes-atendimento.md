# Botões e ações de atendimento (app) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Botões do follow-up clicáveis, Descartar/Adiar/Mover p/ IA nas inboxes comerciais e Aprovar/Negar para supervisores — igual à web.

**Architecture:** Módulo `src/store/attendance` com regras puras portadas da web (inbox comercial, quem descarta direto, frame→fluxo, corpos das requisições) e thunks sobre os endpoints existentes; um "host" de fluxo de atendimento (modais Descartar/Adiar/confirmações) reutilizado pelo balão de botões, pelo cabeçalho e pelo menu da lista; faixa de aprovação na conversa. Sem mudança de servidor.

**Tech Stack:** Expo 52 / RN 0.76 / TS / Redux Toolkit / React Navigation / Jest. Repo `~/dev/cw-mobileapp`, branch `feat/arqos-acoes` criado a partir de `feat/arqos-templates`.

**Spec:** `docs/superpowers/specs/2026-10-18-arqos-acoes-atendimento-design.md`

## Global Constraints

- Fonte da verdade (cw-arqos develop): `helper/comercial.js:3`, `helper/attendanceFlow.js:12-51`, `components-next/message/bubbles/OptionsBubble.vue:56-67`, `AttendanceFlowHost.vue:75-162`, `ConversationWorkflow/attendanceMotivos.js:11-17`, `AttendanceDiscardModal.vue`, `AttendanceAdiarModal.vue:13`, `components/buttons/ResolveAction.vue`, `contextMenu/Index.vue:283-315`, `attendance_actions_controller.rb`, `interactive_messages_controller.rb`, `concerns/attendance_approval_status.rb:15-56`.
- Endpoints: `POST conversations/:id/interactive_messages` `{selected_option_label, selected_option_value, in_reply_to, frame_confirmed?}`; `POST conversations/:id/attendance_action` `{action_type, bucket?, motivo?}`; `GET conversations/:id/attendance_action/status`. Corpos em snake_case exatamente como a web; todas as chamadas com `skipGlobalErrorHandler: true`.
- Frames: `discard | adiar_modal | ia_confirm | enviar_msg_confirm`; valores legados `descartar | adiar | mover_ia | enviar_msg`; caso legado `aprovar` sem frame e sem `custom_attributes.descarte_solicitado` → Descartar em modo pedido + `suggest_discard`.
- Descartar: `bucket ∈ reativacao | descartado`; motivos = os 4 da web + "Outro" com texto; `discard` se admin, agente sem papel customizado ou papel com `conversation_direct_discard`, senão `request_discard`.
- Adiar: `vigia_adiar`, motivo ≥ 5 caracteres; 422 `code: MOTIVO_REQUIRED` mostrado no modal.
- Inbox comercial = regra de `helper/comercial.js`. Fora dela, nada muda (inclusive botões padrão).
- Caminhos que passam pelo fluxo em inbox comercial: cabeçalho, tela de ações da conversa, menu de **uma** conversa na lista. Lote, gestos e macros ficam como estão (decisão do usuário: igual à web).
- Mensagens chegam com `content_attributes` camelCase (`items[].title/value/frame`, `followupExecutionId`); `custom_attributes` da conversa chegam camelCase (`descarteSolicitado`).
- Todo `input_select` com `items` vira balão clicável (igual à web); o desvio pelo fluxo só em inbox comercial + `followupExecutionId`.
- Textos pt-BR iguais aos da web em `src/i18n/pt_BR.json` sob `ATTENDANCE` (+ `en.json`).
- Sem dependências novas; sem `@testing-library/react-native` (testar lógica pura). Gates: jest verde; tsc ≤ 71; eslint ≤ 38 problemas. Executores: `model: "opus"`.

## Review Focus

1. Inbox não comercial: cabeçalho, ações e menu da lista idênticos ao de hoje. (Task 5 teste do seletor de ações por inbox)
2. Botão com frame `discard` cancelado no modal → nada é enviado. (Task 3/4 view-model: cancelar não dispara clique)
3. Adiar com motivo curto → erro no modal, modal continua aberto. (Task 4)
4. `request_discard` para corretor com papel sem `conversation_direct_discard`. (Task 1 `canDirectDiscard`)
5. 403 em `interactive_messages` (quem não pode clicar / quem pediu a aprovação) → mensagem do servidor, sem logout. (Task 2)

---

### Task 1: Regras puras, tipos e serviço

**Files:** Create `src/store/attendance/attendanceTypes.ts`, `attendanceRules.ts`, `attendanceService.ts`; Modify `src/types/Inbox.ts` (campos de `automacoes_comerciais` / `custom_button_labels` como chegam camelCase), `src/types/Message.ts` (`items`, `followupExecutionId`, `stepId` em `MessageContentAttributes`); Test `src/store/attendance/specs/*.spec.ts`

**Interfaces (Produces):**
- `isCommercialInbox(inbox): boolean` (porte de `helper/comercial.js`)
- `canDirectDiscard(user, accountId): boolean` (admin / agente sem `custom_role_id` / papel com `conversation_direct_discard` — usar `getUserPermissions`)
- `resolveOptionFlow(item, { inbox, message, conversation }): 'direct' | 'discard' | 'adiar' | 'ia' | 'enviar_msg' | 'discard_request_legacy'` (porte de `attendanceFlow.js` + `OptionsBubble.vue:56-67`)
- `DISCARD_MOTIVOS` (os 4 da web, textos iguais) e `buildDiscardBody({ bucket, motivo, direct })`, `buildAdiarBody(motivo)`, `buildClickBody({ item, messageId, frameConfirmed })`
- `AttendanceService`: `click(conversationId, body)`, `action(conversationId, body)`, `status(conversationId)` — `skipGlobalErrorHandler`; `getAttendanceErrorMessage(error)` (usa `error`/`message`/`code` do servidor; `MOTIVO_REQUIRED` mapeado)
- [ ] **Step 1:** testes que falham — `isCommercialInbox` com `automacoesComerciais.enabled && botoes.enabled`, fallback `customButtonLabels.enabled`, e falso sem campos; `canDirectDiscard` nos 4 casos; `resolveOptionFlow` para cada frame, cada valor legado, `aprovar` legado com e sem `descarteSolicitado`, e `direct` fora de inbox comercial ou sem `followupExecutionId`; corpos exatos; URLs/configs do serviço.
- [ ] **Step 2–5:** FAIL → implementar → PASS + suíte → commit `feat(attendance): rules, types and service`.

### Task 2: Thunks

**Files:** Create `src/store/attendance/attendanceActions.ts` (+ spec). Sem slice novo, a menos que precise de estado de "em curso" (então slice mínimo com REHYDRATE reset).

**Interfaces (Produces):** `clickOption({conversationId, item, messageId, frameConfirmed?})`, `runAttendanceAction({conversationId, body})`, `fetchAttendanceStatus(conversationId)`; após sucesso de clique/ação despacham o refresh da conversa que o app já tem (`conversationActions.fetchConversation` ou equivalente); rejeitam com `getAttendanceErrorMessage`.
- [ ] **Step 1:** testes — 403 rejeita com a mensagem do servidor e não despacha `auth/logout`; sucesso despacha o refresh; `runAttendanceAction` com 422 `MOTIVO_REQUIRED` rejeita com objeto que a UI reconhece (`{ code: 'MOTIVO_REQUIRED', message }`).
- [ ] **Step 2–5:** FAIL → implementar → PASS → commit `feat(attendance): thunks`.

### Task 3: Fluxo de atendimento (modais) e host reutilizável

**Files:** Create `src/screens/chat-screen/components/attendance/AttendanceFlowHost.tsx`, `DiscardModal.tsx`, `AdiarModal.tsx`, `ConfirmModal.tsx`, `attendanceFlowViewModel.ts` (+ spec)

**Interfaces (Produces):** `useAttendanceFlow()` → `{ open(flow, ctx), host }` (ou contexto equivalente) onde `flow ∈ 'discard' | 'adiar' | 'ia' | 'enviar_msg' | 'discard_request_legacy'` e `ctx = { conversationId, replayClick?: { item, messageId } }`. Sequência igual a `AttendanceFlowHost.vue:75-162`: confirmar → `runAttendanceAction` (exceto `enviar_msg`) → se `replayClick`, `clickOption({..., frameConfirmed: true})` → aviso. Cancelar não envia nada.
- View-model: `discardStepValid(step, state)`, `adiarValid(motivo)` (≥ 5 após trim), `flowActionBody(flow, state, canDirect)`.
- [ ] **Step 1:** testes do view-model — cancelar → nenhuma chamada; `discard` com "Outro" exige texto; `adiarValid('abcd') === false`; `discard_request_legacy` gera `suggest_discard`; `canDirect=false` gera `request_discard`.
- [ ] **Step 2–5:** FAIL → implementar (modais com componentes do app) → PASS + tsc/lint → commit `feat(attendance): flow host and modals`.

### Task 4: Balão de botões do follow-up

**Files:** Create `src/screens/chat-screen/components/message-components/OptionsMessageCell.tsx` (ou na pasta de células existente); Modify `src/screens/chat-screen/components/message-item/MessageItem.tsx` (desvio para `input_select` com `items` antes do fallback de texto)

**Interfaces:** Consumes Tasks 1–3. Toque → `resolveOptionFlow` → `direct` → `clickOption`; demais → `useAttendanceFlow().open(flow, { conversationId, replayClick: { item, messageId } })`. Botões desabilitados durante envio; erro → aviso com a mensagem do servidor.
- [ ] **Step 1:** teste de uma função pura `optionButtons(message, ctx)` → `[{ label, flow }]` cobrindo nota do follow-up em inbox comercial e `input_select` comum.
- [ ] **Step 2–5:** FAIL → implementar → PASS → commit `feat(attendance): follow-up option buttons`.

### Task 5: Cabeçalho, ações da conversa e menu da lista

**Files:** Modify `src/screens/chat-screen/components/chat-header/ChatHeaderContainer.tsx:118-134`, `src/screens/conversations/components/conversation-actions/...` (`ConversationBasicActions.tsx:18-63,80`; menu de uma conversa na lista — `UpdateStatus.tsx` no caso de seleção única), i18n; Create `src/store/attendance/attendanceMenu.ts` (+ spec)

**Interfaces:** `attendanceMenuItems({ inbox, status }): Array<'descartar'|'adiar'|'ia'> | null` — `null` = inbox não comercial (usar o menu padrão); `pending` → `['descartar']`; senão `['descartar','adiar','ia']`. Em inbox comercial: botão resolver do cabeçalho → Descartar (abre o fluxo); itens Adiar(snooze)/Pendente/Resolver padrão substituídos pelos itens acima; menu de uma conversa na lista idem. Lote, gestos, macros intocados.
- [ ] **Step 1:** testes de `attendanceMenuItems` (não comercial → `null`; pending; open).
- [ ] **Step 2–5:** FAIL → implementar → PASS + tsc/lint → commit `feat(attendance): header, actions and list menu for commercial inboxes`.

### Task 6: Faixa de aprovação

**Files:** Create `src/screens/chat-screen/components/attendance/ApprovalBanner.tsx`, `approvalViewModel.ts` (+ spec); Modify `ChatScreen.tsx` (consulta `fetchAttendanceStatus` ao abrir conversa de inbox comercial e após eventos da conversa)

**Interfaces:** `approvalBannerModel(status) → null | { contexto, opcoes: [{label, value}], messageId }` — só quando `estado === 'aprovacao_pendente' && pode_aprovar`. Botões → `clickOption({ item: opcao, messageId })`.
- [ ] **Step 1:** testes — outros estados → `null`; `pode_aprovar=false` → `null`; pendente com opções → modelo.
- [ ] **Step 2–5:** FAIL → implementar → PASS → commit `feat(attendance): supervisor approval banner`.

### Task 7: Verificação com o usuário (controller)

- [ ] Push; Metro; sem build novo (conferir dependências).
- [ ] Roteiro com "fc teste" e um supervisor no lead de teste: botão comum do follow-up; Descartar pelo botão do follow-up e pelo cabeçalho; Adiar curto (erro) e válido; Mover p/ IA; Aprovar/Negar; inbox não comercial sem mudança.
- [ ] PR `feat/arqos-acoes` (base `feat/arqos-templates` enquanto os anteriores estiverem abertos).
