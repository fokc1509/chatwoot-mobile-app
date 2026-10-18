# App Arqos Atendimento — Fase 1: Base

Data: 2026-10-18 · Autor: Claude (sessão com Felipe)

## Intenção

A Arqos usa hoje o app oficial do Chatwoot (lojas Apple/Google) conectado ao seu fork
cw-arqos (`https://atendimento.arqos.online`). O app oficial não conhece nada do que a
Arqos construiu no servidor (ligações WhatsApp, botões de follow-up, ações de atendimento,
templates Meta via n8n, Fila de Ligações). O objetivo é ter um app próprio, o
**Arqos Atendimento**, que é a "versão de bolso" do atendente: usado quando ele está fora do
escritório, para atender ligações e responder clientes.

Uso **somente interno** (atendentes/corretores da Arqos). Publicação futura como app privado:
iOS Unlisted ou Custom App (Apple Business Manager); Android app privado (Managed Google Play)
ou trilha de teste interno.

Esta fase constrói a fundação sobre a qual as funções vêm depois. Nenhuma função nova de
negócio entra aqui.

## Roteiro geral (acordado com o usuário)

1. **Base** (este documento)
2. Fila de Ligações (API pronta: `/api/v1/accounts/:acc/ligacoes*`)
3. Templates Meta (com endpoint simplificado no servidor)
4. Botões de follow-up (`input_select`) e ações de atendimento (Descartar / IA / Adiar)
5. Ligações WhatsApp — receber com celular bloqueado e fazer; providers **Meta e wzz**
   (o provider é escolhido por inbox API, o app segue o configurado)
6. Publicação (TestFlight / teste interno → lojas como app privado)

Cada fase 2–6 terá seu próprio documento de design antes de ser construída.

## Metas da fase Base

- Código num clone limpo fora do OneDrive, com o app compilando e rodando.
- Identidade própria (nome, identificadores, ícone, splash) — o app não se apresenta como Chatwoot.
- App aponta por padrão para produção do cw-arqos e abre em pt-BR.
- Push de mensagens funcionando no app Arqos **sem quebrar** o push do app oficial,
  que a equipe usa hoje.
- Ciclo de teste rápido: build de desenvolvimento instalado no Android físico, no simulador
  iOS do Mac e (quando a conta Apple sair) no iPhone físico, com recarga ao vivo a partir da
  máquina Linux de desenvolvimento.

## Não-metas

- Qualquer função Arqos (fases 2–5).
- Publicação nas lojas (fase 6).
- Remover o caminho de push do app oficial (fica para depois que todos migrarem).
- Redesenho visual além de ícone, splash e nome.

## Antimetas (falha mesmo que "funcione")

- Atendentes que usam o app oficial pararem de receber notificações.
- Qualquer mudança no servidor de produção que altere o comportamento para usuários atuais
  sem que um aparelho do app Arqos esteja envolvido.
- Desenvolver dentro da pasta OneDrive (a cópia lá perdeu 266 arquivos na sincronização).

## Restrições

- **Testes do mobile são feitos contra produção** (decisão do usuário). Não há staging em uso
  para este trabalho. Toda mudança de servidor tem de ser inerte para quem não usa o app Arqos.
- Máquina de desenvolvimento: Linux sem `/dev/kvm` (sem emulador Android útil). O usuário tem
  Mac, iPhone e Android físicos.
- Ainda não há conta Apple Developer: o usuário vai criar uma **conta individual paga**
  enquanto o D-U-N-S da Arqos não sai. Até lá, iOS só no simulador.
- Stack existente: React Native 0.76.9, Expo ~52, TypeScript strict, pnpm 10.11, EAS Build.
  Seguir os padrões do `CLAUDE.md` do repositório.
- Servidor: repositório `fokc1509/cw-arqos` (Rails), versão `4.17.0-arqos7.13.0`.

## Decisões

### Repositório
- Clone de `git@github.com:fokc1509/chatwoot-mobile-app.git` em `~/dev/cw-mobileapp`
  (já feito), remote `upstream` = `chatwoot/chatwoot-mobile-app` para trazer correções.
  Trabalho em branch própria a partir de `develop`. *(decisão do Claude)*

### Identidade
- Nome exibido: **Arqos Atendimento** (aprovado pelo usuário).
- Identificador final iOS/Android: `br.com.arqos.atendimento`. *(decisão do Claude)*
- Variante de desenvolvimento `br.com.arqos.atendimento.dev`, nome "Arqos Atendimento (dev)",
  instalável lado a lado com a final. É a que será registrada na conta Apple **pessoal**, para
  não prender o identificador final fora da conta da empresa. Seleção da variante por variável
  de ambiente no `app.config.ts` (padrão Expo "app variants"). *(decisão do Claude)*
- `owner` e `projectId` do EAS: conta Expo a ser criada pelo usuário.
- Ícone: arquivo fornecido pelo usuário — "A" escuro (#2a2622 aprox.) sobre fundo creme
  (#e9e5df aprox.), em `/home/fokc/.claude/uploads/b6c6bbeb-54de-4116-92a0-654f9194163f/7ed75873-image.jpg`.
  Só tem 180×180; ícone de loja exige 1024×1024. O builder recria o "A" em vetor (ou pede
  arquivo maior ao usuário) e gera ícone, adaptive icon Android e splash nessas cores.
  A variante dev recebe uma marca visual (ex.: faixa "DEV") para não confundir.
- Remover referências que fazem o app se passar pelo Chatwoot: `scheme` próprio
  (ex.: `arqosatendimento`; variante dev com scheme distinto), domínio `app.chatwoot.com` em `associatedDomains`/intent filters
  trocado por `atendimento.arqos.online` (ou removido, se universal links não forem configurados
  nesta fase — ver "Deixado ao builder").

### Servidor e idioma
- URL padrão: `https://atendimento.arqos.online`. A tela de "digite a URL do servidor" deixa de
  ser o primeiro passo; a troca de URL continua possível escondida (ex.: nas ações de debug já
  existentes em `src/screens/settings/components/DebugActions.tsx`). *(decisão do Claude)*
- Idioma padrão pt-BR (hoje `src/i18n` fixa `en`), respeitando a escolha do usuário no app.
- `EXPO_PUBLIC_MINIMUM_CHATWOOT_VERSION` permanece abaixo de 4.17.0 (a versão do fork é semver
  válida com prerelease e passa na checagem atual).

### Push — dois caminhos durante a transição
Hoje o servidor, sem `FIREBASE_PROJECT_ID`/`FIREBASE_CREDENTIALS`, entrega push FCM pelo relay
do Chatwoot Hub, que só alcança o app oficial (`app/services/notification/push_notification_service.rb`).
Configurar essas duas chaves globais desviaria **todo** o push para o Firebase da Arqos e
quebraria o app oficial. Por isso:

- **App**: ao registrar o aparelho (`src/store/settings/settingsActions.ts`, `saveDeviceDetails`),
  enviar em `subscription_attributes` um campo identificando o app, ex.: `app_id: 'br.com.arqos.atendimento'`
  (ou o identificador da variante). O controller já aceita chaves livres
  (`permit(subscription_attributes: {})`).
- **Servidor (cw-arqos)**: em `send_fcm_push`/`send_push_via_chatwoot_hub`, assinaturas FCM
  marcadas como app Arqos são enviadas pelo projeto Firebase da Arqos, usando credenciais
  **separadas** das globais (ex.: novas chaves de config `ARQOS_FIREBASE_PROJECT_ID` /
  `ARQOS_FIREBASE_CREDENTIALS`); todas as outras continuam exatamente no caminho atual.
  Sem as novas credenciais configuradas, assinaturas Arqos simplesmente não recebem push —
  nada muda para o resto.
- O payload FCM continua o mesmo de hoje (o app já sabe ler).
- Projeto Firebase "Arqos Atendimento": criado pelo usuário na conta Google dele, com apps
  Android e iOS para as duas variantes. O builder escreve o passo a passo e configura os
  arquivos `google-services.json` / `GoogleService-Info.plist` (fora do git) e a chave APNs
  (.p8) no Firebase quando a conta Apple existir.
- Atenção ao identificador da assinatura (`device_id`): é a chave única no servidor. Entre o
  app oficial e o app Arqos ele difere (vendor/assinatura diferentes), mas entre as variantes
  final e dev do iOS pode coincidir. O builder decide como tratar (ex.: compor com o `app_id`).
- A mudança de servidor vai para o cw-arqos pelo fluxo normal de deploy do projeto, com teste
  automatizado do roteamento.

### Login SSO preparado (decisão do usuário: ninguém usa SSO hoje, mas o sistema precisa estar pronto)
- O servidor devolve o login SSO mobile para `<MOBILE_DEEP_LINK_BASE>://auth/saml?...`, valor
  global que hoje é `chatwootapp` (o scheme do app oficial). Lido em
  `app/controllers/devise_overrides/omniauth_callbacks_controller.rb:39`,
  `enterprise/app/controllers/enterprise/devise_overrides/omniauth_callbacks_controller.rb:89` e
  `enterprise/app/controllers/api/v1/auth_controller.rb:57`.
- **Servidor**: o scheme de retorno passa a poder ser escolhido por requisição, a partir de um
  parâmetro enviado pelo app, validado contra uma lista fixa de schemes permitidos (os das duas
  variantes Arqos). Sem o parâmetro (ou com valor fora da lista), comportamento idêntico ao de hoje.
- **App**: trocar o `chatwootapp` fixo em `src/constants/index.ts` (`SSO_CALLBACK_URL`),
  `src/utils/ssoUtils.ts` e `src/navigation/index.tsx` pelo scheme da variante, e enviar o
  parâmetro no início do fluxo SSO.
- Pronto quando: teste automatizado no servidor cobre os três casos (sem parâmetro, permitido,
  não permitido). Teste ponta a ponta com um provedor SSO real não é exigido nesta fase.

### Servidor: onde e como entra
- Clone limpo de `git@github.com:fokc1509/cw-arqos.git` fora do OneDrive (ex.: `~/dev/cw-arqos`),
  branch a partir de `develop`, com testes.
- Deploy em produção pelo processo de `docs/build-deploy.md` do cw-arqos (build da imagem →
  GHCR → `docker compose pull/up` de rails e sidekiq). O builder executa o deploy, **mas pede OK
  explícito do usuário antes de cada deploy**. O mesmo vale para gravar as credenciais Firebase
  da Arqos na configuração de produção. (Decisão do usuário.)

### Testes / ciclo de desenvolvimento
- Conta Expo (usuário cria). Perfis EAS:
  - `development` — dev client, distribuição interna, variante dev (APK no Android);
  - `development-simulator` — dev client para simulador iOS (não exige conta Apple);
  - `preview` — build interno sem dev client, para os primeiros testadores;
  - `production` — variante final (usado na fase 6).
- O servidor de desenvolvimento (Metro) roda na máquina Linux; os aparelhos se conectam pela
  rede local ou por túnel. O builder documenta o comando e o caminho em um README curto.
- Após a conta Apple pessoal: build `development` para o iPhone físico (aparelho registrado).

## Critério de pronto

No Android físico e no simulador iOS (e no iPhone, se a conta Apple já existir):
1. O app instalado aparece como "Arqos Atendimento (dev)" com o ícone novo.
2. Abre em pt-BR direto no login do `atendimento.arqos.online`, sem pedir URL.
3. Login, lista de conversas e envio de mensagem funcionam como no app oficial.
4. Uma mensagem nova numa conversa atribuída ao testador gera notificação push no Android
   (e no iPhone físico quando houver conta), com o app em segundo plano.
5. No mesmo momento, um aparelho com o app oficial continua recebendo push normalmente.
6. Uma alteração de código feita na máquina Linux aparece no aparelho sem reinstalar.
7. Login por e-mail/senha funciona; os testes do scheme SSO por requisição passam.
8. Testes existentes (`pnpm test`, `pnpm lint`) passam; o teste novo do roteamento de push no
   cw-arqos passa.

## Deixado ao builder

- Estrutura exata das variantes no `app.config.ts`, nomes das variáveis de ambiente, perfis EAS.
- Como recriar o ícone em alta resolução e o desenho da marca "DEV".
- Universal links (`apple-app-site-association` / `assetlinks.json` em
  `atendimento.arqos.online`): configurar agora ou deixar o app só com o `scheme` próprio nesta
  fase — se adiar, remover as referências a `app.chatwoot.com`.
- Sentry e June SDK: desligar ou apontar para projeto Arqos; não enviar dados para as contas
  do Chatwoot.
- Remover/ocultar o widget de suporte do Chatwoot (`@chatwoot/react-native-widget`), se ele
  aponta para o suporte do Chatwoot.
- Como esconder a troca de URL do servidor.
- Detalhes do tratamento de `device_id` entre variantes.
- Correção do deep link de push que hoje fixa `/app/accounts/1/` (`src/utils/pushUtils.ts`),
  se afetar a Arqos.

## Ações do usuário (fora do código)

- Criar conta Expo (expo.dev) e informar o usuário/organização.
- Criar projeto Firebase e seguir o passo a passo que o builder fornecer.
- Criar conta Apple Developer individual paga; mais tarde, D-U-N-S e conta da Arqos.
- Autorizar cada deploy em produção e a gravação das credenciais Firebase (o builder executa).
