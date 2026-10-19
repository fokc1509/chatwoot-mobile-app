# Botões e ações de atendimento no app Arqos Atendimento — design

Data: 2026-10-18 · Fase 4 do roteiro (Base → Fila → Templates → **Botões/ações de atendimento** → Ligações → Publicação)

## Intenção

O corretor fora do escritório precisa conduzir o lead como faz na web: responder aos botões que o follow-up posta na
conversa e usar Descartar / Adiar / Mover p/ IA com os mesmos motivos e regras. Hoje o app mostra os botões do
follow-up como texto e, nas inboxes comerciais, oferece Resolver/Adiar/Pendente padrão do Chatwoot — que **pulam** o
fluxo da Arqos (sem motivo, sem push ao CV, sem cancelar o vigia). Isso já é um risco com o app oficial.

Escopo proposto pelo Claude e aceito pelo usuário (sem objeção): os três itens abaixo, com comportamento igual ao da
web.

## Objetivos

1. **Botões do follow-up** na conversa (notas `input_select` do engine), clicáveis, com o mesmo pré-fluxo da web para
   Descartar/Adiar/IA/Enviar mensagem.
2. **Ações de atendimento** nas inboxes comerciais: Descartar (com destino e motivo), Adiar (com motivo), Mover p/ IA —
   no lugar de Resolver/Adiar(snooze)/Pendente do app.
3. **Aprovar / Negar** para supervisores, quando a conversa tem aprovação pendente que eles podem decidir.

## Não-objetivos

- Aviso de divergência com o CV antes de etiquetas terminais/atribuição (`useCvGuard`) — fica para depois.
- Cartão "Registrou uma nota. E o lead?" (`NotaPromptHost.vue`).
- Página/deep link `/atendimento/:display_id` da web.
- Mudanças no servidor (os endpoints já existem).

## Anti-objetivos

- Qualquer caminho no app que resolva/adie/pendure uma conversa de inbox comercial sem passar pelo
  `attendance_action` (é exatamente o defeito de hoje).
- Clique em botão de Descartar/Adiar sem `frame_confirmed` (o servidor responde "precisa ser concluída no navegador").
- Comportamento diferente da web nas regras (quem descarta direto, prazo do adiamento, aprovação) — o servidor decide;
  o app replica só o que a web replica no cliente.
- Alterar o comportamento das inboxes **não** comerciais (app oficial/fluxos padrão).

## Como a web faz hoje (fonte da verdade — cw-arqos develop)

**Condição** de inbox comercial com botões: `Comercial.botoes?(inbox)` (`app/services/comercial.rb:56-62`; espelho JS
`app/javascript/dashboard/helper/comercial.js:3`) — `automacoes_comerciais.enabled && botoes.enabled`, com fallback
`custom_button_labels.enabled`. O JSON da inbox já traz os campos (`_inbox.json.jbuilder:22-23`).

**Botões do follow-up**
- Nota privada `content_type: input_select`, `content_attributes: {items: [{title, value, frame?}],
  followup_execution_id, step_id}`; `frame ∈ discard | adiar_modal | ia_confirm | enviar_msg_confirm`; valores legados
  `descartar | adiar | mover_ia | enviar_msg` também abrem fluxo (`helper/attendanceFlow.js:12-51`). Criada por
  `Followups::ButtonsMessage.post!`. Só agentes veem.
- Render: `components-next/message/bubbles/OptionsBubble.vue` (conteúdo markdown + um botão por item).
- Clique: `POST /api/v1/accounts/:acc/conversations/:id/interactive_messages` com `{selected_option_label,
  selected_option_value, in_reply_to: <id da nota>, frame_confirmed?}` (`api/interactiveMessages.js:9`). 403 `{error}`
  quando o usuário não pode clicar (`interactive_messages_controller.rb:28-40`).
- Com frame/valor legado: abre o diálogo (`AttendanceFlowHost.vue:75-115`) → chama `attendance_action` → reenvia o
  clique com `frame_confirmed: true` → recarrega a conversa.

**Ações** — `POST /conversations/:id/attendance_action` `{action_type, bucket?, motivo?}`;
`GET …/attendance_action/status` (`attendance_actions_controller.rb`). Inbox sem a função → 403; tipo inválido → 422.
- Descartar: `bucket ∈ reativacao | descartado`; `motivo` = uma das 4 opções fixas ou texto livre em "Outro"
  (`ConversationWorkflow/attendanceMotivos.js:11-17`; modal em 2 passos `AttendanceDiscardModal.vue`). `discard` para
  admin, agente sem papel customizado ou papel com `conversation_direct_discard`; senão a web manda `request_discard`
  (controller `:105-112`). Faltando campos → 422 "bucket e motivo sao obrigatorios".
- Mover p/ IA: `switch_to_ia`, sem parâmetros, qualquer agente.
- Adiar: `vigia_adiar`, `motivo` livre ≥ 5 caracteres (sempre 15 dias); curto → 422 `code: MOTIVO_REQUIRED` mostrado no
  modal (`AttendanceAdiarModal.vue:13`). Adiamento consecutivo vai para o supervisor (servidor decide).
- Onde aparece: botão dividido Resolver do cabeçalho vira **Descartar**, menu com **Adiar** e **Mover p/ IA**; em
  conversa `pending` o menu só tem Descartar (`components/buttons/ResolveAction.vue:46-58,111-118,156-160,272-321`);
  também no menu de contexto do card de conversa (`contextMenu/Index.vue:283-315`).
- Status: `estado ∈ aguardando_acao | countdown(deadline_at) | sem_cobranca(motivo) | aprovacao_pendente({tipo,
  pode_aprovar, message_id, opcoes, contexto})` (`concerns/attendance_approval_status.rb:15-56`). Aprovar/Negar = clique
  em `interactive_messages` com as `opcoes`.
- Depois de cada ação: eventos ActionCable padrão + `getConversation` + aviso.

**App hoje:** `ContentType` já lista `input_select` (`src/types/Message.ts:8-19`), mas não há `items` no tipo nem
componente — cai em `TextMessageCell`. Mensagens chegam com `content_attributes` em camelCase
(`transformMessage`, `src/utils/camelCaseKeys.ts:35`): `items[].title/value/frame`, `followupExecutionId`. Ação de
resolver no cabeçalho: `chat-header/ChatHeaderContainer.tsx:118-134`; ações padrão em
`conversation-actions/components/ConversationBasicActions.tsx:18-63,80`. Inbox não tem `automacoes_comerciais` no tipo.

## Como funciona no app (decidido)

**Inbox comercial** = mesma regra de `helper/comercial.js` (portar a função; incluir os campos no tipo `Inbox`).

**Botões do follow-up.** Como na web, toda mensagem `input_select` com `items` vira um balão com o texto e um botão
por item (minha decisão: igual à web, que torna todos clicáveis); o desvio pelo fluxo Arqos só acontece em inbox
comercial e quando a mensagem tem `followupExecutionId`. Toque:
- item sem frame e valor não legado → `interactive_messages` direto;
- item com frame/valor legado → abre o fluxo correspondente (mesmo do cabeçalho: Descartar, Adiar, confirmar IA,
  confirmar Enviar mensagem) → `attendance_action` (quando o fluxo tem ação) → reenvia o clique com
  `frame_confirmed: true`.
- caso legado da web: valor `aprovar`, sem frame e sem `custom_attributes.descarte_solicitado` → abre Descartar em modo
  pedido, chama `attendance_action` `suggest_discard` e reenvia o clique (`OptionsBubble.vue:56-67`,
  `AttendanceFlowHost.vue:140-162`) — portado igual (minha decisão).
- 403 → mostra o `error` do servidor. Botões desabilitados enquanto o envio está em curso.

**Outros caminhos de status (decisão do usuário: igual à web).** Na web só o cabeçalho e o menu de contexto do card
passam pelo fluxo; ações em lote e macros não. No app: o menu de ações de **uma** conversa na lista (equivalente ao
menu de contexto do card) passa pelo fluxo em inbox comercial; ações em lote, gestos de arrastar e macros ficam como
estão. O anti-objetivo "nenhum caminho…" vale para o cabeçalho, as ações da conversa e o menu de uma conversa na lista.

**Cabeçalho e ações da conversa** (só em inbox comercial): o botão de resolver vira **Descartar**; o menu de ações
mostra **Adiar** e **Mover p/ IA** no lugar de Adiar(snooze)/Pendente/Resolver padrão; conversa `pending` → só
Descartar. Inbox não comercial: nada muda.
- **Descartar**: passo 1 escolhe destino (Reativação / Descartado), passo 2 o motivo (as 4 opções da web + Outro com
  texto). Manda `discard` quando o usuário pode descartar direto (mesma regra do cliente web: admin, agente sem papel
  customizado, ou papel com `conversation_direct_discard`), senão `request_discard`.
- **Adiar**: campo de motivo (mín. 5 caracteres); erro `MOTIVO_REQUIRED` exibido no próprio modal.
- **Mover p/ IA**: confirmação simples.
- Depois: recarrega a conversa e mostra aviso; erros 403/422 mostram a mensagem do servidor.

**Aprovar / Negar.** Ao abrir uma conversa de inbox comercial, o app consulta o `status`; se `aprovacao_pendente` com
`pode_aprovar`, mostra uma faixa com o contexto e os botões das `opcoes` (Aprovar/Negar), que enviam o clique por
`interactive_messages` (minha decisão de lugar: faixa no topo da conversa).

**Chaves:** como as mensagens chegam camelCase, ler `items/frame/followupExecutionId` em camelCase; o que vai ao
servidor (`selected_option_value`, `in_reply_to`, `bucket`, `motivo`) segue o formato da web, sem conversão.

**Textos** pt-BR iguais aos da web (rótulos, motivos, mensagens dos modais).

**Branch:** a partir de `feat/arqos-templates` (minha decisão: as fases tocam a tela de conversa e os tipos de
mensagem; empilhar evita conflito).

## Como testar

App dev contra produção, usuário "fc teste" (corretor) e um supervisor; lead de teste do usuário numa inbox comercial.
Testar: botão comum do follow-up; Descartar pelo botão do follow-up e pelo cabeçalho (direto e, se o papel exigir,
pedido); Adiar com motivo curto (erro) e válido; Mover p/ IA; Aprovar/Negar com o supervisor. Cada ação real altera o
lead de teste — aceitável por ser de teste.

## O que fica para o construtor

Estrutura de pastas/estado, layout dos balões e modais, onde exatamente encaixar no cabeçalho e no menu de ações,
como obter permissões do papel customizado do usuário no app (o app já tem `getUserPermissions`), testes.

## Critério de pronto

Em inbox comercial, cabeçalho, ações da conversa e menu de uma conversa na lista não resolvem/adiam/penduram sem
`attendance_action` (lote, gestos e macros como na web); os botões do follow-up
funcionam inclusive os com frame; Aprovar/Negar funciona para supervisor; em inbox não comercial nada muda; testes
unitários das regras (inbox comercial, quem descarta direto, mapeamento de frame→fluxo, montagem dos corpos) passam.
