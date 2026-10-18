# Fila de Ligações (app) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aba "Ligações" no app Arqos Atendimento com a Fila de Ligações da web (listar, filtrar, reservar, ligar pelo discador, abrir conversa, liberar, puxar + resumo).

**Architecture:** Novo módulo Redux `src/store/ligacao` (types, service, actions, slice, selectors) sobre a API existente `/api/v1/accounts/:acc/ligacoes*` do cw-arqos; uma checagem de acesso por conta decide se a aba aparece; tela `src/screens/ligacoes` com cartões e modal de resumo; ligar passa por um ponto único `startLeadCall` (fase 5 troca a estratégia). Nenhuma mudança de servidor.

**Tech Stack:** Expo 52 / React Native 0.76 / TypeScript / Redux Toolkit / React Navigation bottom-tabs / Jest. Repo `~/dev/cw-mobileapp`, branch `feat/arqos-fila-ligacoes`.

**Spec:** `docs/superpowers/specs/2026-10-18-arqos-fila-ligacoes-design.md`

## Global Constraints

- Servidor cw-arqos não muda. Contrato da API = seção "A API existente" do spec (campos e códigos exatos).
- `:id` das rotas é o `display_id`; `ChatScreen` recebe `conversationId = display_id` (a API Chatwoot expõe o display_id como `id`).
- Janelas válidas: `30 | 60 | 90 | 120`; padrão = `meta.janela_dias` da resposta.
- Polling: 60 s enquanto a aba está em foco; puxar-para-atualizar.
- Resumo ≤ 2000 caracteres.
- Aba visível só com 2xx no `GET ligacoes`; 401/403/404 escondem; rede/timeout/5xx mantêm o último estado conhecido da conta (padrão escondida). Re-checa ao trocar de conta e ao voltar ao primeiro plano.
- `startLeadCall({ displayId, telefone })` é o único ponto que inicia ligação; nesta fase abre `tel:`.
- Textos pt-BR em `src/i18n/pt_BR.json` sob a chave `LIGACOES` (espelhar as chaves em `en.json` como fallback).
- Chamadas da fila **não** podem disparar o tratamento global do `APIService` (401 → logout; demais → toast genérico): a política do servidor devolve **401** para "sem permissão" (`request_exception_handler.rb:24-26`), o que deslogaria o corretor.
- Testes: Jest, specs em `src/**/specs/*.spec.ts(x)` no padrão de `src/store/label/specs/`. `npx jest` verde; não aumentar a contagem de erros de `tsc` (71) nem de lint (35).
- Executor: subagentes com `model: "opus"`.

## Review Focus

1. Sem permissão (401 da política) na checagem ou numa ação → o usuário **não** é deslogado; a aba some / a mensagem aparece. (Task 1 teste `skipGlobalErrorHandler`; Task 3 teste de acesso)
2. 422 de regra (ex. `reservada`, `limite_reservas`, `sem_reserva` após expirar) → mostra o `message` do servidor uma vez (sem toast genérico duplicado) e recarrega a fila. (Task 1 `getLigacaoErrorMessage`; Task 2 teste de refetch após rejeição)
3. Telefone com máscara (`+55 (11) 98765-4321`) → discador recebe `tel:+5511987654321`; telefone vazio → aviso, sem abrir nada. (Task 3 `startLeadCall`)
4. Troca de conta com a fila carregada → não mostra leads/reserva da conta anterior. (Task 2 teste de reset por conta)
5. Reserva órfã (`minha_reserva` fora de `leads`) → aviso com Liberar. (Task 2 seletor `selectOrphanReservation`)

---

### Task 1: Tipos, serviço da API e opt-out do tratamento global de erro

**Files:**
- Modify: `src/services/APIService.ts` (interceptor de resposta)
- Create: `src/store/ligacao/ligacaoTypes.ts`, `src/store/ligacao/ligacaoService.ts`
- Test: `src/services/specs/APIService.spec.ts` (criar), `src/store/ligacao/specs/ligacaoService.spec.ts`, `src/store/ligacao/specs/ligacaoMockData.ts`

**Interfaces:**
- Produces:
  - `APIService`: requisição com config `{ skipGlobalErrorHandler: true }` rejeita o erro sem logout e sem toast. Declarar o campo via module augmentation de `AxiosRequestConfig` (`declare module 'axios'`).
  - `ligacaoTypes.ts`: `LigacaoJanela = 30|60|90|120`; `LigacaoResultado = 'nao_atendeu'|'expirou'|'falei'`; `LigacaoCvEstado = 'livre'|'vinculado'|'vinculado_sem_usuario'`; `LigacaoLead` (`id, display_id, lead, empreendimentos, respondeu_at, ia, cv{estado,nome,minha}, ultima_tentativa{agent_nome,at,resultado}|null, reserva{agent_id,agent_nome,until,minha}|null, pode_reservar`); `LigacaoMinhaReserva {display_id, lead, until, telefone}`; `LigacaoListResponse { leads, minha_reserva: LigacaoMinhaReserva|null, meta: {total, janela_dias, ver_tudo, janelas} }`. Chaves em snake_case como o servidor envia (sem camelCase).
  - `LigacaoService` (todas com `skipGlobalErrorHandler: true`):
    - `list(dias?: LigacaoJanela): Promise<LigacaoListResponse>` → `GET 'ligacoes'` com `params: { dias }` só quando informado
    - `reservar(displayId: number): Promise<{ telefone: string; until: string }>` → `POST 'ligacoes/${displayId}/reservar'`
    - `liberar(displayId: number): Promise<void>` → `POST …/liberar`
    - `puxar(displayId: number): Promise<{ id: number; display_id: number }>` → `POST …/puxar`
    - `resumo(displayId: number, texto: string): Promise<void>` → `POST …/resumo` body `{ texto }`
  - `getLigacaoErrorMessage(error: unknown): string` — `response.data.message` quando status 422 e houver; senão `I18n.t('LIGACOES.ERRORS.GENERIC')`.
  - `getHttpStatus(error: unknown): number | undefined`.

- [ ] **Step 1: Testes que falham**
  - `APIService.spec.ts`: com o adaptador axios mockado devolvendo 401 e `skipGlobalErrorHandler: true`, a promessa rejeita, `store.dispatch` **não** recebe `auth/logout` e `showToast` não é chamado; sem a flag, 401 continua despachando `{ type: 'auth/logout' }` e 500 continua chamando `showToast`.
  - `ligacaoService.spec.ts`: `list()` chama `apiService.get('ligacoes', { params: {}, skipGlobalErrorHandler: true })` ou equivalente sem `dias`; `list(60)` envia `params: { dias: 60 }`; `reservar(42)` chama `post('ligacoes/42/reservar', undefined, { skipGlobalErrorHandler: true })` e devolve `{telefone, until}`; `resumo(42,'ok')` envia `{ texto: 'ok' }`; `getLigacaoErrorMessage` devolve `'Lead já reservado'` para `{response:{status:422,data:{error:'ligacoes.reservada',message:'Lead já reservado'}}}` e a chave genérica para erro de rede.
- [ ] **Step 2:** `npx jest src/services/specs/APIService.spec.ts src/store/ligacao` → FAIL.
- [ ] **Step 3:** Implementar conforme Interfaces.
- [ ] **Step 4:** Mesmo comando → PASS; `npx jest` inteiro verde.
- [ ] **Step 5:** Commit `feat(ligacoes): API service and per-request opt-out of global error handling`.

### Task 2: Estado Redux (lista, ações, acesso por conta, seletores)

**Files:**
- Create: `src/store/ligacao/ligacaoActions.ts`, `ligacaoSlice.ts`, `ligacaoSelectors.ts`
- Modify: `src/store/reducers.ts` (registrar `ligacoes: ligacaoSlice`)
- Test: `src/store/ligacao/specs/ligacaoActions.spec.ts`, `ligacaoSlice.spec.ts`, `ligacaoSelectors.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`LigacaoService`, tipos, `getHttpStatus`, `getLigacaoErrorMessage`).
- Produces:
  - Estado `ligacoes`: `{ accountId: number|null, leads: LigacaoLead[], minhaReserva: LigacaoMinhaReserva|null, janela: LigacaoJanela|null, janelas: number[], tab: 'todos'|'meus_cv', isLoading: boolean, pendingDisplayId: number|null, accessByAccount: Record<number, boolean> }`.
  - `ligacaoActions`:
    - `fetchLigacoes(dias?: LigacaoJanela)` — guarda `accountId` atual (de `state.auth.user.account_id`); se mudou desde a última carga, limpa `leads`/`minhaReserva` antes de preencher.
    - `checkAccess()` — chama `list()`; 2xx → `accessByAccount[acc]=true` (e preenche a lista); 401/403/404 → `false`; outros erros → não altera.
    - `reservar(displayId)`, `liberar(displayId)`, `puxar(displayId)`, `resumo({displayId, texto})` — em sucesso **ou** erro despacham `fetchLigacoes(janela atual)`; erro rejeita com `getLigacaoErrorMessage(error)`; `reservar` em sucesso grava `{display_id, lead, until, telefone}` em `minhaReserva` antes do refetch; `puxar` resolve com o `display_id`.
  - Reducers síncronos: `setTab(tab)`.
  - Seletores: `selectLigacaoAccess(state): boolean` (conta atual, padrão `false`), `selectVisibleLeads` (tab `meus_cv` → `cv.estado==='vinculado' && cv.minha`), `selectMinhaReserva`, `selectOrphanReservation` (`minhaReserva` cujo `display_id` não está em `leads`, senão `null`), `selectLigacaoJanela`, `selectLigacaoJanelas`, `selectIsLigacaoLoading`, `selectPendingDisplayId`.
  - Função pura `getLeadCardState(lead: LigacaoLead, minhaReserva: LigacaoMinhaReserva|null): 'mine'|'reserved_by_other'|'reservable'|'disabled'` — `mine` se `lead.reserva?.minha` ou `minhaReserva?.display_id===lead.display_id`; `reserved_by_other` se `lead.reserva` e não minha; `reservable` se `pode_reservar`; senão `disabled`.

- [ ] **Step 1: Testes que falham**
  - actions: `checkAccess` com 401 → `accessByAccount[1]===false` e nenhum `auth/logout`; com rejeição de rede (sem `response`) mantém valor anterior `true`; com 200 → `true`.
  - actions: `reservar` rejeitado com 422 `reservada` → rejeita com a `message` do servidor **e** despacha `fetchLigacoes`.
  - slice: `fetchLigacoes.fulfilled` com `accountId` diferente do armazenado substitui leads (não mistura); `fetchLigacoes.pending` para outra conta limpa `leads` e `minhaReserva`.
  - selectors: `selectVisibleLeads` em `meus_cv` filtra só `vinculado && minha`; `selectOrphanReservation` devolve a reserva quando o `display_id` não está em `leads` e `null` quando está; `getLeadCardState` cobre os 4 estados.
- [ ] **Step 2:** `npx jest src/store/ligacao` → FAIL.
- [ ] **Step 3:** Implementar no padrão de `src/store/team` / `src/store/label` (createAsyncThunk + createSlice).
- [ ] **Step 4:** `npx jest` → PASS.
- [ ] **Step 5:** Commit `feat(ligacoes): redux state, actions and selectors`.

### Task 3: Aba, acesso e ponto único de ligação

**Files:**
- Create: `src/utils/leadCall.ts`, `src/navigation/stack/LigacoesStack.tsx`, ícone `src/svg-icons/tabs/PhoneIcon.tsx` (Filled/Outline, mesmo estilo dos ícones vizinhos), `src/hooks/useLigacaoAccess.ts`
- Modify: `src/navigation/tabs/AppTabs.tsx` (`TabParamList.Ligacoes`, `Tab.Screen name="Ligacoes"` entre Conversations e Settings, só quando `selectLigacaoAccess`), `src/navigation/tabs/BottomTabBar.tsx` (ícone e rótulo), `src/svg-icons/tabs/index.ts`, `src/navigation/stack/index.ts`, `src/i18n/pt_BR.json` + `en.json` (`LIGACOES.TAB` = "Ligações")
- Test: `src/utils/specs/leadCall.spec.ts`, `src/hooks/specs/useLigacaoAccess.spec.ts` (ou teste do mecanismo de disparo equivalente)

**Interfaces:**
- Consumes: Task 2 (`ligacaoActions.checkAccess`, `selectLigacaoAccess`).
- Produces:
  - `startLeadCall({ displayId, telefone }: { displayId: number; telefone: string }): Promise<void>` — normaliza para `+` inicial opcional + dígitos; vazio após normalizar → `showToast(I18n.t('LIGACOES.ERRORS.NO_PHONE'))` e retorna; senão `Linking.openURL('tel:' + normalizado)`; se lançar → `showToast(I18n.t('LIGACOES.ERRORS.DIALER'))`. `displayId` ainda não é usado (reservado para a fase 5).
  - `useLigacaoAccess()` — despacha `checkAccess()` na montagem de `Tabs`, quando `accountId` muda e em `AppState` → `'active'`.
  - Rota `Ligacoes` → `LigacoesStack` com a tela `LigacoesScreen` (Task 4 cria a tela; nesta task um placeholder simples que a Task 4 substitui).
- [ ] **Step 1: Testes que falham** — `startLeadCall({displayId:1, telefone:'+55 (11) 98765-4321'})` → `Linking.openURL('tel:+5511987654321')`; `'(11) 3333-4444'` → `'tel:1133334444'`; `''` → `showToast` com `LIGACOES.ERRORS.NO_PHONE` e sem `openURL`; `openURL` rejeitando → `showToast` com `LIGACOES.ERRORS.DIALER`. Hook: despacha `checkAccess` na montagem e de novo ao receber `AppState` `'active'` e ao mudar `accountId`.
- [ ] **Step 2:** `npx jest src/utils/specs/leadCall.spec.ts src/hooks` → FAIL.
- [ ] **Step 3:** Implementar; registrar a aba.
- [ ] **Step 4:** `npx jest` → PASS; `npx tsc --noEmit | grep -c "error TS"` ≤ 71.
- [ ] **Step 5:** Commit `feat(ligacoes): tab gated by access check and startLeadCall`.

### Task 4: Tela da fila

**Files:**
- Create: `src/screens/ligacoes/LigacoesScreen.tsx`, `src/screens/ligacoes/components/LigacaoLeadCard.tsx`, `LigacaoFilters.tsx`, `LigacaoResumoModal.tsx`, `OrphanReservationBanner.tsx`
- Modify: `src/navigation/stack/LigacoesStack.tsx` (trocar placeholder), `src/i18n/pt_BR.json` + `en.json` (`LIGACOES.*`)
- Create: `src/screens/ligacoes/ligacaoViewModel.ts` (funções puras que a tela usa)
- Test: `src/screens/ligacoes/specs/ligacaoViewModel.spec.ts` — o projeto **não** tem `@testing-library/react-native`; não adicionar dependência. Testar a lógica extraída: `getCardView(lead, minhaReserva, now)` → `{ state, telefone?, reservedLabel?, untilLabel?, actions: Array<'reservar'|'ligar'|'abrir'|'puxar'|'liberar'> }` e `normalizeResumo(texto)` / `canSaveResumo(texto)`.

**Interfaces:**
- Consumes: Task 2 (actions, selectors, `getLeadCardState`), Task 3 (`startLeadCall`, rota).
- Produces (comportamento):
  - Lista com `RefreshControl` (puxar-para-atualizar → `fetchLigacoes(janela)`); `useFocusEffect` busca ao focar e agenda `setInterval` de 60 000 ms, limpo ao desfocar.
  - Filtros: janelas de `selectLigacaoJanelas` (padrão `meta.janela_dias`) → `fetchLigacoes(d)`; abas Todos / Meus do CV → `setTab`.
  - Cartão: nome (`lead`), `empreendimentos`, "respondeu há X" de `respondeu_at`, `ia`, CV (`cv.nome` / estado), última tentativa "`agent_nome` · resultado · tempo"; por `getLeadCardState`:
    - `reservable` → botão "Vou ligar" → `reservar`
    - `reserved_by_other` → "Reservado por {agent_nome} até HH:MM"
    - `disabled` → botão desabilitado
    - `mine` → telefone (de `minhaReserva.telefone`), "sua até HH:MM", botões Ligar (`startLeadCall`), Abrir conversa (`navigation.navigate('ChatScreen', { conversationId: display_id })`), Puxar, Liberar
  - Botões do cartão ficam desabilitados enquanto `pendingDisplayId === display_id`.
  - Puxar → sucesso abre `LigacaoResumoModal` (contador até 2000; Salvar desabilitado com texto vazio só de espaços; Salvar → `resumo` → navega para a conversa; Pular → navega para a conversa).
  - Erros das ações → `showToast(mensagem rejeitada)`.
  - `OrphanReservationBanner` no topo quando `selectOrphanReservation` ≠ null, com botão Liberar.
  - Estado vazio: texto `LIGACOES.EMPTY`.
- [ ] **Step 1: Testes que falham** — `getCardView` para `mine` devolve o telefone de `minhaReserva` e `actions = ['ligar','abrir','puxar','liberar']`; para `reserved_by_other` devolve `reservedLabel` com `agent_nome` "Ana" e hora "14:35" (until `…T14:35:00-03:00`, fuso do aparelho mockado em America/Sao_Paulo) e `actions = []`; `reservable` → `['reservar']`; `disabled` → `[]`. `canSaveResumo('   ') === false`; `normalizeResumo` corta em 2000 caracteres.
- [ ] **Step 2:** `npx jest src/screens/ligacoes` → FAIL.
- [ ] **Step 3:** Implementar usando componentes/tema existentes do app (`src/components-next`, `src/theme`).
- [ ] **Step 4:** `npx jest` → PASS; tsc ≤ 71; lint ≤ 35 (`pnpm lint` ou o script equivalente do `package.json`).
- [ ] **Step 5:** Commit `feat(ligacoes): queue screen with cards, filters, actions and summary modal`.

### Task 5: Verificação com o usuário (sem subagente de código)

- [ ] **Step 1:** Push do branch; Metro rodando (`npx expo start --dev-client --host lan`); não precisa de build novo (só JS) — confirmar que nenhuma dependência nativa foi adicionada; se foi, gerar build `development`.
- [ ] **Step 2:** Pedir ao usuário: incluir o usuário **"fc teste"** no time de corretores da inbox comercial, se ainda não estiver; criar o lead de teste (mensagem do número dele para o WhatsApp comercial, IA assume, etiqueta `fup-ia`).
- [ ] **Step 3:** Roteiro no app logado como "fc teste": aba aparece; lead de teste na lista; filtros; Vou ligar → telefone; Ligar abre o discador; Abrir conversa; Liberar; Vou ligar de novo → Puxar → resumo → conversa aberta e atribuída. Usuário sem acesso (ex.: admin fora do time) → sem aba e sem logout.
- [ ] **Step 4:** Abrir PR `feat/arqos-fila-ligacoes` → `develop` em `fokc1509/chatwoot-mobile-app` (base: após o merge do PR #1; se #1 ainda aberto, base `feat/arqos-base`).
