# App Arqos Atendimento — Base: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App próprio "Arqos Atendimento" (fork do Chatwoot mobile) compilando com identidade Arqos, apontado para produção do cw-arqos, com push roteado pelo Firebase da Arqos sem afetar o app oficial e SSO preparado com scheme próprio.

**Architecture:** Dois repositórios. No **cw-arqos** (Rails), duas mudanças inertes para quem não usa o app Arqos: (1) assinaturas FCM marcadas com `app_id` Arqos vão pelo Firebase da Arqos com credenciais próprias; (2) o scheme de retorno do SSO mobile pode vir no `target`/`RelayState` (`mobile:<scheme>`) validado por lista fixa. No **app** (Expo), variantes `development`/`production` definidas num módulo puro usado pelo `app.config.ts` e lido em runtime via `expo-constants`.

**Tech Stack:** React Native 0.76.9 · Expo ~52 · TypeScript strict · Jest · pnpm 10.11 · EAS Build | Rails 7 / Ruby 3.4.4 · RSpec.

**Spec:** `docs/superpowers/specs/2026-10-18-arqos-app-base-design.md` (neste repo). Ler antes de qualquer task.

## Global Constraints

- Repositórios de trabalho: app em `~/dev/cw-mobileapp` (branch `feat/arqos-base`); servidor em `~/dev/cw-arqos` (branch `feat/mobile-app-base` a partir de `develop`). **Nunca** editar as cópias no OneDrive.
- Nome exibido: `Arqos Atendimento` (produção) e `Arqos Atendimento (dev)` (desenvolvimento).
- Identificadores: `br.com.arqos.atendimento` (produção) e `br.com.arqos.atendimento.dev` (desenvolvimento) — iOS e Android iguais.
- Schemes: `arqosatendimento` (produção) e `arqosatendimento-dev` (desenvolvimento).
- Servidor padrão: `https://atendimento.arqos.online/` (com barra final, como o `installationUrl` atual). Idioma padrão `pt_BR`.
- Testes do mobile são contra **produção**: toda mudança de servidor deve ser inerte para assinaturas/requisições que não vêm do app Arqos.
- Deploy em produção do cw-arqos e gravação de credenciais: **somente após OK explícito do usuário**, a cada vez.
- cw-arqos: PR para `develop` (push direto é bloqueado por `bin/validate_push`); tags de imagem em minúsculas (`v4.17.0-arqos7.14.0`).
- cw-arqos não tem Ruby no host: rspec roda no container `cw-staging-rails:dev` seguindo **exatamente** a receita de `~/.claude/projects/-mnt-onedrive-OneDrive---Arqos-365-claude-cw-arqos/memory/test_env_container_recipe.md`, trocando o volume do checkout por `~/dev/cw-arqos`. **Sempre** `POSTGRES_DATABASE=db_cw_arqos_test` (o padrão do container apagaria o banco de staging).
- App: `pnpm` (não npm/yarn); Prettier largura 100, aspas simples; alias `@/` → `src/`.
- Sentry, June e widget do Chatwoot ficam **desligados** (variáveis vazias); builds EAS com `SENTRY_DISABLE_AUTO_UPLOAD=true`.

## Review Focus

1. Mesmo usuário com app oficial **e** app Arqos no mesmo celular → cada app recebe sua notificação uma vez; o oficial continua pelo Hub. (Teste em Task 1.)
2. Token FCM Arqos inválido → só aquela assinatura é removida; as outras do usuário seguem. (Teste em Task 1.)
3. `target`/`RelayState` com scheme fora da lista (`mobile:javascript`, `mobile:chatwootapp-x`) → retorno pelo scheme padrão, nunca pelo valor recebido. (Teste em Task 2.)
4. Variantes dev e produção instaladas no mesmo iPhone (mesmo `identifierForVendor`) → assinaturas distintas no servidor, sem uma sobrescrever a outra. (Teste em Task 7.)
5. `extra.appVariant` ausente (Jest, Storybook, config quebrada) → app se comporta como produção, sem crash. (Teste em Task 4.)

---

## Parte A — Servidor (cw-arqos)

### Task 1: Push FCM do app Arqos pelo Firebase da Arqos

**Files:**
- Modify: `config/installation_config.yml` (bloco "Configs added for FCM v1 notifications", ~linha 372)
- Modify: `app/services/notification/push_notification_service.rb`
- Test: `spec/services/notification/push_notification_service_spec.rb`

**Interfaces:**
- Produces: configs `ARQOS_FIREBASE_PROJECT_ID` e `ARQOS_FIREBASE_CREDENTIALS` (lidas com `GlobalConfigService.load(key, nil)`); contrato com o app: assinatura FCM cujo `subscription_attributes['app_id']` começa com `br.com.arqos.atendimento` é "do app Arqos".

- [ ] **Step 1: Preparar o clone e a branch**

```bash
cd ~/dev/cw-arqos && git checkout develop && git pull && git checkout -b feat/mobile-app-base
```

- [ ] **Step 2: Escrever os testes que falham** (no `describe` existente, seguindo os doubles `fcm_double`/`fcm_service_double` do arquivo)

Casos, cada um um `it`:
- `arqos subscription + arqos credentials` → `Notification::FcmService` recebe `new('arqos-project', '<arqos creds>')`; `send_v1` uma vez; `ChatwootHub.send_push` não chamado.
- `arqos subscription sem arqos credentials (hub habilitado)` → nem `send_v1` nem `ChatwootHub.send_push`.
- `arqos subscription com FIREBASE_* globais e sem ARQOS_*` → `send_v1` não chamado (o projeto global não é usado para o app Arqos).
- `subscription oficial (sem app_id), sem FIREBASE_* globais, com ARQOS_* configuradas` → `ChatwootHub.send_push` uma vez; `FcmService` não instanciado com credenciais Arqos.
- `usuário com as duas assinaturas (oficial + arqos), ARQOS_* configuradas, sem globais` → Hub uma vez (oficial) e `send_v1` uma vez (arqos).
- `arqos subscription com resposta de erro do FCM` (`{ results: [{ error: 'InvalidRegistration' }] }`) → só a assinatura arqos é destruída; a oficial continua existindo.

Assinatura Arqos de teste: `create(:notification_subscription, user: notification.user, subscription_type: 'fcm', subscription_attributes: { push_token: 'tok-arqos', device_id: 'br.com.arqos.atendimento:dev1', app_id: 'br.com.arqos.atendimento' })`. Configs via `create(:installation_config, name: 'ARQOS_FIREBASE_PROJECT_ID', value: 'arqos-project')` (ou `with_modified_env`, como o arquivo já faz para as globais — seguir o padrão existente).

- [ ] **Step 3: Rodar e ver falhar**

Run (container, receita do Global Constraints): `bundle exec rspec spec/services/notification/push_notification_service_spec.rb`
Expected: os novos casos FAIL; os existentes PASS.

- [ ] **Step 4: Implementar**

Em `installation_config.yml`, após `FIREBASE_CREDENTIALS`, adicionar `ARQOS_FIREBASE_PROJECT_ID` (display_title `'Arqos App Firebase Project ID'`) e `ARQOS_FIREBASE_CREDENTIALS` (`type: secret`, display_title `'Arqos App Firebase Credentials'`), `locked: false`, `value:` vazio.

Em `PushNotificationService`:
- constante `ARQOS_APP_ID_PREFIX = 'br.com.arqos.atendimento'.freeze`;
- `arqos_app_subscription?(subscription)` → `subscription.fcm? && subscription.subscription_attributes['app_id'].to_s.start_with?(ARQOS_APP_ID_PREFIX)`;
- `send_fcm_push` e `send_push_via_chatwoot_hub` retornam cedo para assinaturas Arqos;
- novo `send_arqos_fcm_push(subscription)` chamado no `perform` junto dos outros: retorna se não for Arqos ou se faltar qualquer das duas configs; usa `Notification::FcmService.new(arqos_project, arqos_credentials).fcm_client.send_v1(fcm_options(subscription))` e `remove_subscription_if_error`.
Payload (`fcm_options`) inalterado.

- [ ] **Step 5: Rodar e ver passar**

Run: `bundle exec rspec spec/services/notification/push_notification_service_spec.rb spec/services/notification/fcm_service_spec.rb`
Expected: PASS, 0 failures. Também `bundle exec rubocop app/services/notification/push_notification_service.rb` sem ofensas.

- [ ] **Step 6: Commit**

```bash
git add config/installation_config.yml app/services/notification/push_notification_service.rb spec/services/notification/push_notification_service_spec.rb
git commit -m "feat(push): assinaturas do app Arqos via Firebase próprio"
```

### Task 2: Scheme do SSO mobile por requisição

**Files:**
- Create: `app/services/mobile_deep_link.rb`
- Modify: `app/controllers/devise_overrides/omniauth_callbacks_controller.rb:27-41` (`sign_in_user_on_mobile`)
- Modify: `enterprise/app/controllers/enterprise/devise_overrides/omniauth_callbacks_controller.rb` (`for_mobile?`, `sign_in_saml_user`, `handle_saml_auth_error`, `redirect_to_mobile_error`, `omniauth_failure`)
- Modify: `enterprise/app/controllers/api/v1/auth_controller.rb` (`saml_login`, `render_saml_error`, `mobile_target?`)
- Test: `spec/services/mobile_deep_link_spec.rb` (novo), `spec/enterprise/controllers/api/v1/auth_controller_spec.rb`, `spec/enterprise/controllers/enterprise/devise_overrides/omniauth_callbacks_controller_spec.rb`

**Interfaces:**
- Produces: `MobileDeepLink::ALLOWED_SCHEMES = %w[arqosatendimento arqosatendimento-dev].freeze`; `MobileDeepLink.mobile_target?(value) -> Boolean`; `MobileDeepLink.base_for(value) -> String`.
- Contrato com o app (Task 6): o app abre `<installationUrl>app/login/sso?target=mobile:<scheme>`; o `Saml.vue` repassa `target` sem alterar (não mexer no front).

- [ ] **Step 1: Testes que falham — `spec/services/mobile_deep_link_spec.rb`**

```ruby
RSpec.describe MobileDeepLink do
  describe '.mobile_target?' do
    it { expect(described_class.mobile_target?(nil)).to be(false) }
    it { expect(described_class.mobile_target?('web')).to be(false) }
    it { expect(described_class.mobile_target?('mobile')).to be(true) }
    it { expect(described_class.mobile_target?('MOBILE')).to be(true) }
    it { expect(described_class.mobile_target?('mobile:arqosatendimento')).to be(true) }
    it { expect(described_class.mobile_target?('mobileapp')).to be(false) }
  end

  describe '.base_for' do
    it { expect(described_class.base_for('mobile')).to eq('chatwootapp') }
    it { expect(described_class.base_for(nil)).to eq('chatwootapp') }
    it { expect(described_class.base_for('mobile:arqosatendimento')).to eq('arqosatendimento') }
    it { expect(described_class.base_for('mobile:arqosatendimento-dev')).to eq('arqosatendimento-dev') }
    it { expect(described_class.base_for('mobile:javascript')).to eq('chatwootapp') }
    it 'respeita MOBILE_DEEP_LINK_BASE quando o scheme não é permitido' do
      create(:installation_config, name: 'MOBILE_DEEP_LINK_BASE', value: 'outroapp')
      expect(described_class.base_for('mobile:evil')).to eq('outroapp')
    end
  end
end
```

- [ ] **Step 2: Testes de controller que falham** (seguir o estilo dos specs existentes nesses arquivos)
- `auth_controller_spec`: com usuário sem SAML, `POST /api/v1/auth/saml_login` com `email` e `target: 'mobile:arqosatendimento'` → redirect para `arqosatendimento://auth/saml?error=saml-authentication-failed`; com `target: 'mobile'` → `chatwootapp://auth/saml?error=...` (comportamento atual preservado); com SAML habilitado e `target: 'mobile:arqosatendimento'` → redirect para `/auth/saml?account_id=<id>&RelayState=mobile%3Aarqosatendimento`.
- `omniauth_callbacks_controller_spec` (enterprise): login SAML com sucesso e `RelayState=mobile:arqosatendimento` → redirect começa com `arqosatendimento://auth/saml?` e contém `sso_auth_token`; falha SAML com `RelayState=mobile:arqosatendimento` → `arqosatendimento://auth/saml?error=`; `RelayState=mobile` → `chatwootapp://` (inalterado).

- [ ] **Step 3: Rodar e ver falhar**

Run: `bundle exec rspec spec/services/mobile_deep_link_spec.rb spec/enterprise/controllers/api/v1/auth_controller_spec.rb spec/enterprise/controllers/enterprise/devise_overrides/omniauth_callbacks_controller_spec.rb`
Expected: novos casos FAIL (`uninitialized constant MobileDeepLink` e redirects com `chatwootapp`).

- [ ] **Step 4: Implementar**
- `MobileDeepLink` (módulo com métodos de módulo): `mobile_target?` aceita `mobile` ou `mobile:<qualquer coisa>`, sem diferenciar maiúsculas; `base_for` devolve o scheme após `mobile:` só se estiver em `ALLOWED_SCHEMES`, senão `GlobalConfigService.load('MOBILE_DEEP_LINK_BASE', 'chatwootapp')`.
- Base `sign_in_user_on_mobile(relay_state = nil)` usa `MobileDeepLink.base_for(relay_state)`.
- Enterprise: `for_mobile?` → `MobileDeepLink.mobile_target?`; `sign_in_saml_user` passa `relay_state` para `sign_in_user_on_mobile`; `redirect_to_mobile_error(error, relay_state)` usa `base_for(relay_state)` (atualizar os dois chamadores).
- `auth_controller`: `mobile_target?` → `MobileDeepLink.mobile_target?(params[:target])`; `render_saml_error` usa `base_for(params[:target])`; em `saml_login`, `RelayState` vai codificado com `ERB::Util.url_encode(relay_state)`.

- [ ] **Step 5: Rodar e ver passar**

Run: o mesmo comando do Step 3 mais `spec/controllers/devise/omniauth_callbacks_controller_spec.rb`.
Expected: PASS, 0 failures. `bundle exec rubocop` nos arquivos tocados sem ofensas.

- [ ] **Step 6: Commit**

```bash
git add app/services/mobile_deep_link.rb app/controllers/devise_overrides/omniauth_callbacks_controller.rb enterprise/app/controllers spec
git commit -m "feat(sso): scheme de retorno mobile por requisição (lista fixa de apps Arqos)"
```

### Task 3: PR, versão e deploy (com portão do usuário)

> Depende das Tasks 1–2.

**Files:**
- Modify: `config/app.yml:2` → `version: '4.17.0-arqos7.14.0'`

- [ ] **Step 1:** Bump da versão, commit `chore(release): 4.17.0-arqos7.14.0`, push da branch e PR para `develop` com seção "How to test" do ponto de vista do produto (sem listar comandos de teste, conforme `AGENTS.md`).
- [ ] **Step 2: PARAR e pedir OK ao usuário** para merge + deploy em produção. Não prosseguir sem resposta afirmativa explícita.
- [ ] **Step 3:** Após o OK: merge do PR; deploy seguindo a skill `production-deploy` do cw-arqos (`/mnt/onedrive/OneDrive - Arqos 365/claude/cw-arqos/.claude/skills/production-deploy/`) e `docs/build-deploy.md`, buildando a partir de `~/dev/cw-arqos` (não do OneDrive), tag `v4.17.0-arqos7.14.0`, atualizando compose **e** a linha `services` do Coolify.
- [ ] **Step 4: Verificar** — `GET https://atendimento.arqos.online/api` retorna `"version":"4.17.0-arqos7.14.0"`; nos logs do rails (últimos 10 min) nenhuma exceção nova em `PushNotificationService`; enviar mensagem numa conversa atribuída a um usuário com o app oficial e confirmar com o usuário que a notificação chegou.
- [ ] **Step 5:** Gravar `ARQOS_FIREBASE_PROJECT_ID`/`ARQOS_FIREBASE_CREDENTIALS` em produção **somente** depois que o projeto Firebase existir (Task 9) e **após novo OK** do usuário (via Super Admin → Settings, ou `InstallationConfig` pelo rails runner).

---

## Parte B — App (cw-mobileapp)

### Task 4: Variantes e identidade do app

**Files:**
- Create: `appVariant.ts` (raiz; módulo puro, sem imports de React Native — é lido pelo `app.config.ts` em Node)
- Create: `src/utils/appIdentity.ts`
- Modify: `app.config.ts`
- Test: `src/utils/specs/appVariant.spec.ts`, `src/utils/specs/appIdentity.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  // appVariant.ts
  export type AppVariantName = 'development' | 'production';
  export interface AppVariant { name: AppVariantName; appName: string; appId: string; scheme: string; isDev: boolean; }
  export function getAppVariant(value: string | undefined): AppVariant; // qualquer valor ≠ 'development' → production
  // src/utils/appIdentity.ts
  export function getAppIdentity(): AppVariant; // lê Constants.expoConfig?.extra?.appVariant; ausente → getAppVariant(undefined)
  ```
- `app.config.ts` expõe `extra.appVariant` (o objeto `AppVariant` inteiro).

- [ ] **Step 1: `pnpm install`** em `~/dev/cw-mobileapp`; rodar `pnpm test` e anotar a linha de base (falhas pré-existentes não são deste trabalho).
- [ ] **Step 2: Testes que falham**
  - `getAppVariant('development')` → `{ name: 'development', appName: 'Arqos Atendimento (dev)', appId: 'br.com.arqos.atendimento.dev', scheme: 'arqosatendimento-dev', isDev: true }`.
  - `getAppVariant('production')`, `getAppVariant(undefined)`, `getAppVariant('foo')` → `{ name: 'production', appName: 'Arqos Atendimento', appId: 'br.com.arqos.atendimento', scheme: 'arqosatendimento', isDev: false }`.
  - `getAppIdentity()` com `jest.mock('expo-constants', ...)` retornando `extra.appVariant` dev → objeto dev; com `expoConfig: null` → produção, sem lançar.
- [ ] **Step 3: Rodar e ver falhar** — `pnpm test src/utils/specs/appVariant.spec.ts src/utils/specs/appIdentity.spec.ts` → FAIL (módulos não existem).
- [ ] **Step 4: Implementar** `appVariant.ts`, `appIdentity.ts` e ajustar `app.config.ts`:
  - `const variant = getAppVariant(process.env.APP_VARIANT)`;
  - `name: variant.appName`, `slug: 'arqos-atendimento'`, `scheme: variant.scheme`, `ios.bundleIdentifier` e `android.package` = `variant.appId`;
  - `owner: process.env.EXPO_OWNER`, `extra.eas.projectId` continua de `EXPO_PUBLIC_PROJECT_ID`, `extra.appVariant: variant`;
  - ícones por variante: `./assets/icon.png` / `./assets/icon-dev.png` e `./assets/adaptive-icon.png` / `./assets/adaptive-icon-dev.png` (arquivos chegam na Task 5; até lá apontar para os existentes não quebra o teste);
  - remover `associatedDomains` e o intent filter `https`/`app.chatwoot.com` (universal links adiados — decisão registrada na spec); o intent filter de scheme passa a usar `variant.scheme`;
  - textos de permissão iOS em pt-BR (ex.: `'O app usa a câmera para enviar fotos e vídeos nas conversas.'`).
- [ ] **Step 5: Verificar** — testes PASS; `APP_VARIANT=development npx expo config --type public | grep -E "name|bundleIdentifier|package|scheme"` mostra os valores dev; sem `APP_VARIANT` mostra produção; `npx tsc --noEmit` sem erros novos.
- [ ] **Step 6: Commit** — `feat: variantes dev/produção com identidade Arqos`.

### Task 5: Ícone e splash

**Files:**
- Create/Replace: `assets/icon.png`, `assets/icon-dev.png`, `assets/adaptive-icon.png`, `assets/adaptive-icon-dev.png`, `assets/splash.png`
- Create: `assets/source/arqos-a.svg` (vetor fonte) e `scripts/generate-icons.py` (gerador reprodutível)
- Modify: `app.config.ts` (cores de fundo)

**Interfaces:**
- Consumes: caminhos de ícone definidos na Task 4.

- [ ] **Step 1: Vetor do "A"** — fonte: imagem do usuário `/home/fokc/.claude/uploads/b6c6bbeb-54de-4116-92a0-654f9194163f/7ed75873-image.jpg` (180×180) e o "A" do logotipo em `/mnt/onedrive/OneDrive - Arqos 365/claude/arqos-site/fe-sitearqos/public/logo-dark.png` (1054×248). Vetorizar (ex.: potrace) para `assets/source/arqos-a.svg`. Amostrar as cores exatas da imagem do usuário (referência: glifo ≈ `#2A2622`, fundo ≈ `#E9E5DF`).
- [ ] **Step 2: Gerar PNGs** com o script: `icon.png` 1024×1024 fundo creme sem transparência (exigência da Apple), "A" centralizado ocupando ~60% da altura; `adaptive-icon.png` 1024×1024 fundo transparente com o "A" dentro da zona segura central de 66%; `splash.png` 1284×2778 fundo creme com o "A" a ~25% da largura; variantes `-dev` iguais com faixa diagonal "DEV" no canto inferior.
- [ ] **Step 3:** `app.config.ts`: `splash.backgroundColor`, `android.adaptiveIcon.backgroundColor` e `androidNavigationBar.backgroundColor` = cor do fundo amostrada.
- [ ] **Step 4: Verificar** — `file assets/*.png` confirma dimensões; abrir cada PNG (ferramenta Read) e conferir visualmente nitidez das bordas do "A" em 1024px. Se a vetorização ficar visivelmente pior que o original, parar e pedir ao usuário um arquivo vetorial do logo.
- [ ] **Step 5: Commit** — `feat: ícone e splash Arqos`.

### Task 6: Servidor padrão, idioma, tela de login e SSO

**Files:**
- Create: `src/utils/ssoUrls.ts`
- Modify: `src/store/settings/settingsSlice.ts:23-30`, `src/i18n/index.js` (linha `i18n.locale = 'en'`), `src/screens/auth/LoginScreen.tsx` (~linhas 107-115 e 289), `src/utils/ssoUtils.ts:24-33,102`, `src/constants/index.ts:197`, `src/navigation/index.tsx:51,68-69,114,142`
- Test: `src/utils/specs/ssoUrls.spec.ts`

**Interfaces:**
- Consumes: `getAppIdentity()` (Task 4).
- Produces:
  ```ts
  export function getSsoCallbackUrl(scheme: string): string;              // `${scheme}://auth/saml`
  export function buildSsoAuthUrl(installationUrl: string, scheme: string): string; // `${installationUrl}app/login/sso?target=mobile:${scheme}`
  ```
  Contrato com Task 2 do servidor: `target=mobile:<scheme>`.

- [ ] **Step 1: Testes que falham** (`ssoUrls.spec.ts`)
  - `getSsoCallbackUrl('arqosatendimento')` → `'arqosatendimento://auth/saml'`.
  - `buildSsoAuthUrl('https://atendimento.arqos.online/', 'arqosatendimento-dev')` → `'https://atendimento.arqos.online/app/login/sso?target=mobile:arqosatendimento-dev'`.
  - `SsoUtils.parseCallbackUrl('arqosatendimento://auth/saml?email=a%40b.com&sso_auth_token=t')` → `{ email: 'a@b.com', sso_auth_token: 't', error: undefined }` (mockar `expo-auth-session`/`expo-web-browser` se o import exigir).
- [ ] **Step 2: Rodar e ver falhar** — `pnpm test src/utils/specs/ssoUrls.spec.ts`.
- [ ] **Step 3: Implementar**
  - `settingsSlice` initialState: `baseUrl: 'atendimento.arqos.online'`, `installationUrl: 'https://atendimento.arqos.online/'`, `localeValue: 'pt_BR'`; `i18n.locale = 'pt_BR'`.
  - `LoginScreen`: link "Change URL" renderizado só quando `getAppIdentity().isDev`; `showSsoLogin = process.env.EXPO_PUBLIC_SSO_ENABLED === 'true'` (substitui o teste por `app.chatwoot.com`); adicionar `EXPO_PUBLIC_SSO_ENABLED=false` ao `.env.example`.
  - Remover a constante `SSO_CALLBACK_URL`; `ssoUtils` e `navigation/index.tsx` usam `getSsoCallbackUrl(getAppIdentity().scheme)`, `makeRedirectUri({ scheme: getAppIdentity().scheme, path: 'sso/callback' })` e `buildSsoAuthUrl`; o parse em `getStateFromPath` usa o scheme da identidade no lugar de `chatwootapp://`.
- [ ] **Step 4: Verificar** — `pnpm test` (sem regressões contra a linha de base), `pnpm lint`, `npx tsc --noEmit`; `grep -rn "chatwootapp\|app.chatwoot.com" src app.config.ts` não retorna nada.
- [ ] **Step 5: Commit** — `feat: produção Arqos por padrão, pt-BR e SSO com scheme próprio`.

### Task 7: Registro de push com `app_id`

**Files:**
- Modify: `src/utils/pushUtils.ts` (nova função), `src/store/settings/settingsActions.ts:112-125`, `src/store/settings/settingsTypes.ts:40-51`
- Test: `src/utils/specs/pushUtils.spec.ts`

**Interfaces:**
- Consumes: `getAppIdentity().appId` (Task 4).
- Produces:
  ```ts
  export function buildPushPayload(args: {
    appId: string; fcmToken: string; deviceId: string; deviceName: string;
    devicePlatform: string; apiLevel: string; brandName: string; buildNumber: string;
  }): PushPayload; // subscription_attributes.app_id = appId; device_id = `${appId}:${deviceId}`
  ```
  `PushPayload.subscription_attributes` ganha `app_id: string`. Contrato com Task 1 do servidor: `app_id` começa com `br.com.arqos.atendimento`.

- [ ] **Step 1: Testes que falham**
  - `buildPushPayload({ appId: 'br.com.arqos.atendimento', deviceId: 'abc', fcmToken: 'tok', ... })` → `subscription_type: 'fcm'`, `subscription_attributes.app_id === 'br.com.arqos.atendimento'`, `device_id === 'br.com.arqos.atendimento:abc'`, `push_token === 'tok'`.
  - Mesmo `deviceId` com `appId` dev e produção → `device_id` diferentes.
- [ ] **Step 2: Rodar e ver falhar** — `pnpm test src/utils/specs/pushUtils.spec.ts`.
- [ ] **Step 3: Implementar** `buildPushPayload` e usá-lo em `saveDeviceDetails` com `getAppIdentity().appId`.
- [ ] **Step 4: Verificar** — testes PASS; `pnpm lint`; `npx tsc --noEmit`.
- [ ] **Step 5: Commit** — `feat: push registra app_id Arqos`.

### Task 8: Perfis EAS e guia de desenvolvimento

**Files:**
- Modify: `eas.json`, `.env.example`
- Create: `docs/arqos/desenvolvimento.md`

- [ ] **Step 1: `eas.json`** — todos os perfis com `env.SENTRY_DISABLE_AUTO_UPLOAD = "true"`:
  - `development`: `developmentClient: true`, `distribution: internal`, `env.APP_VARIANT: development`, `android.buildType: apk`;
  - `development-simulator`: `extends: development`, `ios.simulator: true`;
  - `preview`: `distribution: internal`, `env.APP_VARIANT: development`, `android.buildType: apk` (usa a identidade dev, que é a registrada na conta Apple pessoal);
  - `production`: `autoIncrement: true`, `env.APP_VARIANT: production`.
  Remover o comentário inline do bloco `submit` (JSON puro).
- [ ] **Step 2: `.env.example`** — `EXPO_PUBLIC_CHATWOOT_BASE_URL=https://atendimento.arqos.online`, `EXPO_OWNER=`, `APP_VARIANT=development`, `EXPO_PUBLIC_SSO_ENABLED=false`; manter Sentry/June/website token vazios.
- [ ] **Step 3: `docs/arqos/desenvolvimento.md`** (pt-BR, para o Felipe): (a) criar conta Expo e `eas login`/`eas init`; (b) passo a passo do Firebase — criar projeto "Arqos Atendimento", registrar apps Android/iOS para os dois identificadores, baixar `google-services.json`/`GoogleService-Info.plist`, enviar ao EAS como variáveis do tipo arquivo (`eas env:create --type file`) apontadas por `EXPO_PUBLIC_ANDROID_GOOGLE_SERVICES_FILE`/`EXPO_PUBLIC_IOS_GOOGLE_SERVICES_FILE`, gerar a conta de serviço (JSON) para o servidor, e — quando houver conta Apple — subir a chave APNs .p8 no Firebase; (c) comandos de build por perfil; (d) como rodar o Metro (`pnpm start`, ou `pnpm start --tunnel` fora da rede local) e abrir o app dev no celular/simulador.
- [ ] **Step 4: Verificar** — `npx eas-cli config --platform android --profile development` resolve sem erro (requer login; se não houver, validar o JSON com `node -e "JSON.parse(require('fs').readFileSync('eas.json'))"`).
- [ ] **Step 5: Commit** — `chore: perfis EAS e guia de desenvolvimento Arqos`.

### Task 9: Primeiros builds e verificação ponta a ponta (com o usuário)

Depende das Tasks 1–8. Exige ações do usuário — pedir cada uma e esperar.

- [ ] **Step 1:** Usuário cria conta Expo, projeto Firebase (guia da Task 8) e informa o owner; rodar `eas init` e gravar o `projectId`.
- [ ] **Step 2:** `eas build -p android --profile development` → enviar link do APK ao usuário; `eas build -p ios --profile development-simulator` → instruir instalação no simulador do Mac.
- [ ] **Step 3:** Task 3 Step 5 (credenciais Arqos no servidor, com OK).
- [ ] **Step 4: Checklist da spec, com o usuário** — (1) nome "Arqos Atendimento (dev)" e ícone; (2) abre em pt-BR no login de `atendimento.arqos.online` sem pedir URL; (3) login, conversas e envio de mensagem; (4) push de mensagem nova no Android com app em segundo plano; (5) no mesmo momento, app oficial recebe push; (6) alteração de código aparece ao vivo; (7) login por e-mail/senha ok; (8) `pnpm test`/`pnpm lint` verdes.
- [ ] **Step 5:** Abrir PR `feat/arqos-base` → `develop` em `fokc1509/chatwoot-mobile-app` com o resultado do checklist.
- [ ] **Step 6 (quando a conta Apple pessoal existir):** `eas build -p ios --profile development` com o iPhone registrado (`eas device:create`) e repetir itens 1–4 no iPhone.
