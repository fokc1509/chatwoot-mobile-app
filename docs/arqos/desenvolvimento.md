# Arqos Atendimento — guia de desenvolvimento

Guia prático para gerar, instalar e desenvolver o app. Todos os comandos rodam na raiz do
repositório (`~/dev/cw-mobileapp`) na máquina Linux, salvo quando indicado "no Mac".

## Visão geral

| Variante        | Nome no aparelho        | Identificador (iOS e Android)  | Scheme                 |
| --------------- | ----------------------- | ------------------------------ | ---------------------- |
| Desenvolvimento | Arqos Atendimento (dev) | `br.com.arqos.atendimento.dev` | `arqosatendimento-dev` |
| Produção        | Arqos Atendimento       | `br.com.arqos.atendimento`     | `arqosatendimento`     |

As duas variantes podem ficar instaladas juntas no mesmo aparelho. A variante é escolhida pela
variável `APP_VARIANT` (`development` → dev; qualquer outro valor → produção).

Os builds são feitos na nuvem pelo **EAS** (serviço da Expo). Nada de Android Studio ou Xcode
na máquina Linux, e não há emulador Android aqui (a máquina não tem KVM): os testes são no
celular Android, no simulador iOS do Mac e, depois da conta Apple, no iPhone.

Perfis de build (`eas.json`):

| Perfil                  | Para que serve                                                                               | Variante | Conta Apple?              |
| ----------------------- | -------------------------------------------------------------------------------------------- | -------- | ------------------------- |
| `development`           | App "dev client": recebe o código ao vivo do Metro. APK no Android; iPhone registrado no iOS | dev      | Android: não. iPhone: sim |
| `development-simulator` | Igual ao anterior, para o simulador iOS do Mac                                               | dev      | Não                       |
| `preview`               | Build interno sem dev client, para os primeiros testadores                                   | dev      | Android: não. iPhone: sim |
| `production`            | Versão das lojas (fase de publicação)                                                        | produção | Sim                       |

Todos os perfis desligam o envio de mapas ao Sentry (`SENTRY_DISABLE_AUTO_UPLOAD=true`).

## 1. Conta Expo e ligação do projeto

1. Crie a conta em <https://expo.dev/signup> (o plano gratuito basta para começar; os builds
   gratuitos entram numa fila e podem demorar alguns minutos).
2. Instale as dependências e faça login:

   ```bash
   pnpm install
   npx eas-cli@latest login
   npx eas-cli@latest whoami   # confere o usuário logado
   ```

3. Crie o arquivo local de variáveis a partir do modelo e preencha o dono:

   ```bash
   cp .env.example .env
   # edite .env: EXPO_OWNER=<seu usuário Expo>
   ```

4. Crie o projeto no EAS:

   ```bash
   npx eas-cli@latest init
   ```

   Como o app usa configuração dinâmica (`app.config.ts`), o comando não consegue gravar o ID
   sozinho: ele mostra o **project ID** (um UUID). Copie para o `.env`:
   `EXPO_PUBLIC_PROJECT_ID=<uuid>`. O ID também aparece em expo.dev → projeto → _Overview_.

5. O `.env` não vai para o git nem para o servidor de build. Por isso, cadastre o dono e o
   project ID também como variáveis do EAS, nos três ambientes:

   ```bash
   npx eas-cli@latest env:set --name EXPO_OWNER --value <seu usuário Expo> \
     --visibility plaintext --environment development --environment preview --environment production
   npx eas-cli@latest env:set --name EXPO_PUBLIC_PROJECT_ID --value <uuid> \
     --visibility plaintext --environment development --environment preview --environment production
   ```

   Confira com `npx eas-cli@latest env:list --environment development`.

Cada perfil usa o ambiente EAS de mesmo nome (`development-simulator` usa `development`).

## 2. Firebase (notificações push)

O push do app Arqos sai do projeto Firebase da Arqos. Faça uma vez:

1. Em <https://console.firebase.google.com>, **Adicionar projeto** → nome
   `Arqos Atendimento`. O Google Analytics pode ficar desligado.
2. Registre **quatro apps** (ícone de engrenagem → _Configurações do projeto_ → _Seus apps_ →
   _Adicionar app_):

   - Android `br.com.arqos.atendimento`
   - Android `br.com.arqos.atendimento.dev`
   - iOS (Apple) `br.com.arqos.atendimento`
   - iOS (Apple) `br.com.arqos.atendimento.dev`

   Pule as etapas de "adicionar SDK" do assistente; o projeto já tem tudo.

3. Baixe os arquivos de configuração para uma pasta **fora do repositório** (ex.:
   `~/arqos-firebase/`):

   - **Android**: depois de registrar os dois apps Android, baixe o `google-services.json` de
     qualquer um deles — o arquivo traz os dois identificadores. Um arquivo só serve para todas
     as variantes.
   - **iOS**: cada app iOS tem o seu `GoogleService-Info.plist`. Baixe os dois e renomeie, ex.:
     `GoogleService-Info.dev.plist` e `GoogleService-Info.prod.plist`.

   Esses arquivos estão no `.gitignore`; nunca faça commit deles.

4. Envie os arquivos ao EAS como variáveis do tipo **arquivo**. O servidor de build grava o
   arquivo e coloca o caminho na variável, que o `app.config.ts` lê:

   ```bash
   # Android: o mesmo arquivo nos três ambientes
   npx eas-cli@latest env:set --type file --visibility plaintext \
     --name EXPO_PUBLIC_ANDROID_GOOGLE_SERVICES_FILE --value ~/arqos-firebase/google-services.json \
     --environment development --environment preview --environment production

   # iOS dev (perfis development, development-simulator e preview)
   npx eas-cli@latest env:set --type file --visibility plaintext \
     --name EXPO_PUBLIC_IOS_GOOGLE_SERVICES_FILE --value ~/arqos-firebase/GoogleService-Info.dev.plist \
     --environment development --environment preview

   # iOS produção
   npx eas-cli@latest env:set --type file --visibility plaintext \
     --name EXPO_PUBLIC_IOS_GOOGLE_SERVICES_FILE --value ~/arqos-firebase/GoogleService-Info.prod.plist \
     --environment production
   ```

   (Comandos antigos usam `eas env:create --type file`; ele ainda funciona, mas a CLI atual o
   marca como obsoleto em favor de `env:set`.) Esses arquivos não são segredos — vão dentro do
   app instalado —, por isso `plaintext`.

5. **Conta de serviço para o servidor**: _Configurações do projeto_ → _Contas de serviço_ →
   _Gerar nova chave privada_. Isso baixa um JSON com credenciais de envio de push.
   - Esse JSON vai **somente para o servidor** cw-arqos, nas configurações
     `ARQOS_FIREBASE_PROJECT_ID` (o ID do projeto Firebase, ex.: `arqos-atendimento-xxxxx`) e
     `ARQOS_FIREBASE_CREDENTIALS` (o conteúdo do JSON). Essa gravação é feita pelo Claude com o
     seu OK explícito.
   - **Nunca** coloque esse JSON no repositório do app, no EAS ou em mensagens. Guarde fora do
     repositório e apague cópias soltas depois de configurado.
6. **Quando a conta Apple existir** (necessário para push no iPhone):
   - Em <https://developer.apple.com/account/resources/authkeys/list> crie uma chave com
     _Apple Push Notifications service (APNs)_ marcado e baixe o arquivo `.p8` (só é possível
     baixar uma vez). Anote o _Key ID_ e o _Team ID_ (canto superior direito da página).
   - No Firebase: _Configurações do projeto_ → _Cloud Messaging_ → em cada app iOS, _Chave de
     autenticação de APNs_ → _Enviar_: o `.p8`, o Key ID e o Team ID. A mesma chave serve para os
     dois apps iOS e para desenvolvimento e produção.

Sem os arquivos do passo 4 os builds falham (Android e iOS): o módulo de push exige os dois.
Por isso o Firebase vem antes do primeiro build. Depois de cadastrar
ou trocar algum arquivo, gere um build novo — eles entram no app no momento do build.

## 3. Builds

Comandos (a URL do build e um QR code aparecem no fim; também ficam em expo.dev → _Builds_):

```bash
# Android — celular (APK com dev client)
npx eas-cli@latest build --platform android --profile development

# iOS — simulador do Mac (não precisa de conta Apple)
npx eas-cli@latest build --platform ios --profile development-simulator

# iOS — iPhone físico (precisa da conta Apple e do aparelho registrado; veja abaixo)
npx eas-cli@latest build --platform ios --profile development

# Testadores (sem dev client)
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform ios --profile preview

# Lojas (fase de publicação)
npx eas-cli@latest build --platform all --profile production
```

Instalação:

- **Android**: abra o link/QR do build no celular, baixe o APK e instale (o Android pede para
  permitir "instalar apps desconhecidos" para o navegador na primeira vez).
- **Simulador iOS (no Mac)**: com o Xcode e um simulador abertos, rode no Mac (na cópia do
  repositório ou em qualquer pasta, logado na mesma conta Expo):
  `npx eas-cli@latest build:run --platform ios --latest`. Alternativa: baixe o `.tar.gz` do
  build, descompacte e arraste o `.app` para a janela do simulador.
- **iPhone**: depois que a conta Apple (Developer Program) estiver ativa:
  1. `npx eas-cli@latest device:create` → escolha o link/QR, abra no iPhone e instale o perfil
     (Ajustes → _Perfil baixado_). Faça o mesmo para cada iPhone de testador.
  2. Gere o build `development` (ou `preview`) para iOS. Na primeira vez a CLI pede login na
     Apple e cria certificados e perfis sozinha — aceite as opções padrão.
  3. Abra o link do build no iPhone e instale. No iOS 16 ou mais novo, ative
     Ajustes → Privacidade e Segurança → _Modo de Desenvolvedor_ quando o sistema pedir.
  4. Registrou um aparelho novo depois do build? Gere o build de novo para incluí-lo.

Só é preciso gerar um build novo quando muda algo **nativo** (dependências nativas,
`app.config.ts`, ícone, arquivos do Firebase). Mudanças de código JavaScript/TypeScript chegam
ao vivo pelo Metro (próxima seção).

## 4. Desenvolvimento ao vivo (Metro)

O app dev ("Arqos Atendimento (dev)") busca o código no Metro rodando na máquina Linux.

1. No `.env`, mantenha `APP_VARIANT=development` (o Metro entrega a configuração da variante;
   sem isso o app dev rodaria com a identidade de produção).
2. Inicie o Metro:

   ```bash
   pnpm start            # celular/Mac na mesma rede que a máquina Linux
   pnpm start --tunnel   # fora da rede local (4G, outra rede); mais lento
   ```

   Na primeira vez com `--tunnel` a CLI oferece instalar o `@expo/ngrok`; aceite.

3. Abra o app no aparelho:
   - **Android**: abra o "Arqos Atendimento (dev)"; o servidor aparece na lista
     _Development servers_ (mesma rede) — toque nele. Ou leia o QR code do terminal com a câmera
     / pelo botão _Scan QR code_ do app.
   - **Simulador iOS (Mac)**: abra o app dev no simulador e toque no servidor listado, ou em
     _Enter URL manually_ e digite `http://<IP-da-máquina-Linux>:8081` (veja o IP com
     `hostname -I`). Com túnel, use a URL `exp+...`/`https://...` mostrada pelo terminal.
   - **iPhone**: igual ao Android (lista de servidores ou QR code pela câmera).
4. Salve um arquivo em `src/` e a tela atualiza sozinha. No terminal do Metro: `r` recarrega o
   app, `j` abre o depurador, `?` mostra os atalhos. Sacudir o aparelho abre o menu do dev client.

Se o aparelho não encontrar o servidor na rede local: confirme que estão na mesma rede, que o
firewall da máquina Linux libera a porta `8081` (ex.: `sudo ufw allow 8081/tcp`) e, em último
caso, use `--tunnel`.

## Onde fica cada coisa

| O quê                                              | Onde                                                          |
| -------------------------------------------------- | ------------------------------------------------------------- |
| Usuário Expo, project ID                           | `.env` (local) e variáveis do EAS                             |
| `google-services.json`, `GoogleService-Info.plist` | Pasta fora do repositório + variáveis do EAS (tipo arquivo)   |
| Conta de serviço do Firebase (JSON)                | Somente no servidor cw-arqos (`ARQOS_FIREBASE_*`)             |
| Chave APNs `.p8`                                   | Firebase (Cloud Messaging); guarde o original em local seguro |
| Certificados/perfis Apple                          | Gerenciados pelo EAS (`npx eas-cli@latest credentials`)       |
