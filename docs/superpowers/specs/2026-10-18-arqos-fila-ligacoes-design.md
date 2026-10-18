# Fila de Ligações no app Arqos Atendimento — design

Data: 2026-10-18 · Fase 2 do roteiro (Base → **Fila de Ligações** → Templates Meta → Botões/ações → Ligações Meta+wzz → Publicação)

## Intenção

O corretor fora do escritório precisa trabalhar a Fila de Ligações pelo celular: ver os leads que estão com a IA,
reservar um, ligar, e registrar se falou (puxar o lead) ou não (liberar). O fluxo é **o mesmo da web** (decisão do
usuário); a diferença do app é que o telefone vira um botão que abre o discador.

Na fase 5 o botão **Ligar** passa a tentar primeiro a ligação WhatsApp da inbox (Meta ou wzz, conforme a inbox) e só
cai no discador do celular em **falha técnica** (sem conexão, inbox sem calling, chamada não conecta). Lead que não
atende **não é falha** — o corretor simplesmente marca "não atendeu" (Liberar). Decisões do usuário.

## Objetivos

- Aba **"Ligações"** no app com a fila, filtros e ações da web.
- Ligar pelo discador nativo (`tel:`) a partir da reserva.
- Ponto único de "ligar" no código, para a fase 5 trocar a estratégia sem mexer na tela.

## Não-objetivos

- Ligação WhatsApp (Meta/wzz) dentro do app — fase 5.
- Cartão de reservar/puxar/liberar dentro da conversa (o `LigacaoCard` do painel lateral da web) — fora desta fase
  (minha decisão, aceita pelo usuário).
- Qualquer mudança no servidor cw-arqos. A API já existe e é usada pela web.
- Atualização em tempo real (a web também não tem; usa polling).

## Anti-objetivos

- Comportamento divergente da web nas regras (quem pode reservar, prazo, elegibilidade): o servidor decide; o app só
  mostra e chama.
- Mostrar a aba para quem não tem acesso à fila.
- Quebrar o app oficial do Chatwoot ou a web (não há mudança de servidor).

## A API existente (cw-arqos, fonte da verdade)

Rotas em `config/routes.rb:143-151`, controller `app/controllers/api/v1/accounts/ligacoes_controller.rb`,
serviços `app/services/conversations/ligacao*.rb`, web em `app/javascript/dashboard/routes/dashboard/ligacoes/`.
`:id` é o `display_id` da conversa.

- `GET /api/v1/accounts/:acc/ligacoes?dias=30|60|90|120` →
  `{ leads: [row], minha_reserva, meta: { total, janela_dias, ver_tudo, janelas } }`
  - `row`: `id, display_id, lead, empreendimentos, respondeu_at (ISO), ia, cv: {estado: livre|vinculado|vinculado_sem_usuario, nome, minha}, ultima_tentativa: {agent_nome, at, resultado: nao_atendeu|expirou|falei}|null, reserva: {agent_id, agent_nome, until, minha}|null, pode_reservar`
  - O telefone **nunca** vem nas linhas; só em `minha_reserva: {display_id, lead, until, telefone}|null`.
- `POST …/ligacoes/:id/reservar` → `{telefone, until}`
- `POST …/ligacoes/:id/liberar` → 204 (registra "não atendeu")
- `POST …/ligacoes/:id/puxar` → `{id, display_id}` (atribui a conversa ao corretor, tira da IA)
- `POST …/ligacoes/:id/resumo` body `{texto}` (≤ 2000) → `{ok:true}`; só uma vez por "falei"
- Erros de regra: **422** `{error: "ligacoes.<código>", message}` — códigos `inelegivel, reservada, vinculada,
  limite_reservas, sem_reserva, sem_acesso_inbox, sem_dono, resumo_invalido, resumo_duplicado`. Negativa de
  permissão: 401/403.
- Permissões (servidor): ver = time de corretores, admin ou supervisor; reservar/puxar = só time de corretores;
  liberar/resumo = corretor ou admin. A reserva dura `FOLLOWUP_LIGACOES_RESERVA_MIN` (padrão 30 min) e expira
  sozinha (job a cada 5 min).

## Como funciona no app (decidido)

**Aba.** Nova aba "Ligações" na barra inferior (`src/navigation/tabs/AppTabs.tsx`), ao lado de Conversas. Só aparece
quando o `GET /ligacoes` responde 2xx para o usuário/conta atual; 401/403 escondem a aba (minha decisão — é o
equivalente do que a web faz). 404 também esconde (servidor sem o endpoint, ex. Chatwoot oficial). Rede fora, timeout
ou 5xx mantêm o último estado conhecido daquela conta (padrão: escondida) e tentam de novo. A checagem refaz ao trocar
de conta e quando o app volta para o primeiro plano, para quem entrar no time depois ganhar a aba sem relogar (minha
decisão).

**Lista.** Cartão por lead com: nome, empreendimento, "respondeu há X" (tempo relativo), IA, situação no CV, última
tentativa ("Fulano · não atendeu · ontem"). Ordem = a do servidor. Filtros: janela 30/60/90/120 (vai ao servidor;
padrão = `meta.janela_dias`) e abas "Todos" / "Meus do CV" (filtro local: `cv.estado==='vinculado' && cv.minha`).
Atualiza a cada 60 s enquanto a aba está em foco e com puxar-para-atualizar.

**Estados do cartão** (como a web):
- `pode_reservar` → botão **Vou ligar**.
- reserva de outro → "Reservado por X até HH:MM" (sem ação).
- não pode reservar por outro motivo → botão desabilitado (sem texto de motivo obrigatório).
- minha reserva → telefone em destaque (de `minha_reserva.telefone` ou da resposta do `reservar`), "sua até HH:MM",
  botões **Ligar**, **Abrir conversa**, **Puxar**, **Liberar**.

**Ações.**
- Vou ligar → `reservar`; em sucesso o cartão vira "minha reserva".
- Ligar → abre o discador nativo com o número (`tel:`). Fica atrás de um ponto único
  `startLeadCall({ displayId, telefone })` que na fase 5 ganha a tentativa WhatsApp + fallback; a fase 5 descobre a
  inbox (Meta/wzz) a partir do `displayId`, então a assinatura não muda (minha decisão).
- Abrir conversa → tela de conversa existente do app (`ChatScreen`) pelo `display_id`. Funciona porque a reserva
  torna o corretor participante da conversa.
- Puxar → `puxar`, depois modal de resumo (texto ≤ 2000, Salvar → `resumo` / Pular) e, em ambos, abre a conversa.
- Liberar → `liberar`; o lead volta para a fila.
- Reserva órfã (`minha_reserva` cujo `display_id` não está em `leads`) → aviso no topo com botão Liberar.

**Erros.** 422 mostra o `message` do servidor (já vem em pt-BR) num aviso; depois recarrega a lista. Falha de rede
mostra aviso genérico e mantém a lista atual.

**Idioma.** Textos em pt-BR (o app já está em pt-BR).

## O que fica para o construtor

Estrutura de pastas/estado (seguir o padrão do app: `src/store/<módulo>` com slice/actions/service/selectors e
`src/screens/<tela>`), ícone da aba, layout visual dos cartões e modal, como agendar o polling, formato do tempo
relativo, testes. Usar os componentes e o tema existentes do app.

## Como testar (decisão do usuário)

Contra produção, com **lead de teste** e o usuário de testes **"fc teste"** (Chatwoot) — nunca em leads reais. O lead
de teste é um contato do Felipe (ex.: o próprio celular) que manda mensagem para a inbox comercial e fica na fila com a IA (conversa
`pending`, etiqueta `fup-ia`, mensagem recente). O usuário "fc teste" precisa estar no time de corretores da inbox
comercial; se não estiver, incluir antes do teste (admin não reserva nem puxa). Puxar tira o lead de teste da IA e
grava no CV — aceitável por ser um lead de teste; para repetir o teste, devolver a conversa para a fila (nova mensagem/etiqueta).

## Critério de pronto

No app dev contra produção, um corretor do time consegue: ver a fila igual à da web, filtrar, reservar, abrir o
discador com o número, abrir a conversa, liberar, e puxar com resumo; um usuário sem acesso não vê a aba; testes
unitários do estado/serviço passam.
