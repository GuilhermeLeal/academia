# Academia

Aplicativo mobile para treinos pessoais e familiares. A prioridade é abrir, encontrar o treino e continuar com poucos toques, mantendo uma interface escura, leve e previsível.

**Estado: fase 2 — biblioteca e pesquisa de exercícios local.** A biblioteca permite pesquisar, criar e editar exercícios personalizados com persistência SQLite. A Home e a prévia de treino continuam demonstrativas; ainda não há login nem registro de treinos. O app funciona sem conta Supabase, sem `.env` e sem contratar infraestrutura.

## Stack

- React Native 0.86, React 19, Expo SDK 57 e TypeScript estrito.
- Expo Router: Início, Treinos, Histórico e Conta, com biblioteca interna e rota de prévia.
- `expo-sqlite`: migrations incrementais e biblioteca local de exercícios.
- Supabase: cliente tipado e configuração opcional para PostgreSQL/Auth futuros.
- npm, Git e ESLint com a configuração oficial Expo.

Sem backend próprio, Docker, ORM, biblioteca de UI, gráficos, analytics ou serviços de SMS. Fontes do sistema e ícones Ionicons, sem imagens remotas nem animações adicionais.

## Instalar

Requisitos: Node.js **22.16 ou superior** (preferencialmente a versão LTS mantida), npm 10 ou superior e Git. Em um checkout do projeto:

```powershell
cd C:\Users\guilh\Desktop\PROJETOS\Academia
npm ci
```

`package-lock.json` deve ser versionado. Use `npm ci` para reproduzir as versões verificadas. Nesta máquina, as dependências já foram instaladas.

## Executar no Android

1. Instale no celular o **Expo Go compatível com SDK 57**, disponível na [página oficial de downloads](https://expo.dev/go?sdkVersion=57&platform=android&device=true).
2. Conecte computador e celular à mesma rede Wi-Fi.
3. Na pasta do projeto, execute:

   ```powershell
   npm start
   ```

4. No Expo Go, escolha **Scan QR code** e leia o QR code do terminal.
5. O app abre na aba Início. `Iniciar treino` abre uma prévia; `Voltar` retorna à tela anterior. As quatro abas funcionam sem configurar a nuvem.

Para testar a fase 2: **Treinos → Biblioteca de exercícios**. Pesquise `supino` (quatro variantes), `elevacao`, `triceps frances` ou o alias `voador`. Limpar a busca exibe todo o catálogo. Toque em **Criar exercício**, informe nome/grupo muscular e, opcionalmente, equipamento. Ao salvar, a biblioteca pesquisa o nome salvo. Toque no card personalizado para editar. Feche e reabra o app para conferir a persistência.

O catálogo inicial tem 19 exercícios de validação, somente leitura, e miniaturas placeholder. As imagens não são baixadas. A biblioteca consulta o SQLite local; nenhum caractere digitado gera chamada de rede.

Se não conectar, permita Node.js na rede privada do Firewall do Windows, desative VPNs e confira se a rede permite comunicação entre dispositivos. Para limpar o cache do Metro: `npm start -- --clear`. Não é necessário Android Studio, EAS Build nem conta paga para este teste pelo Expo Go no Android.

O Expo Go depende do servidor de desenvolvimento para carregar o aplicativo. A biblioteca salva seus exercícios localmente e funciona sem internet com o app carregado. Sessões de treino, cache remoto e sincronização ainda serão implementados. Um APK independente fica para uma etapa de distribuição.

O código também tem alvo iOS e comando de exportação; este ambiente Windows não compila um binário iOS. A validação inicial solicitada é Android.

## Variáveis de ambiente

São opcionais nesta fase. Para preparar a integração:

```powershell
Copy-Item .env.example .env
```

Preencha com os valores públicos do seu projeto Supabase:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_sua_chave_publica
```

A configuração aceita uma URL HTTPS de projeto e a chave pública moderna `sb_publishable_...`. Ambas vazias significam integração não configurada; valores incompletos ou inválidos são rejeitados quando o cliente é solicitado. A Home não solicita esse cliente e nunca bloqueia por falta de `.env`.

Variáveis `EXPO_PUBLIC_*` entram no aplicativo e **não são secrets**. Nunca coloque `service_role`, `sb_secret_...`, senha PostgreSQL ou PIN no código/ambiente público. `.env`, credenciais, bancos locais e dependências estão no `.gitignore`; apenas `.env.example` é versionável. A proteção dos dados reais dependerá de Auth e RLS, ainda não implementados.

## Estrutura

```text
app/                          Rotas e layouts; nenhuma regra de treino
  (tabs)/                     Início, Treinos, Histórico, Conta
  workout-preview.tsx         Prévia sem criação de sessão
  exercises/                  Biblioteca, criação e consulta/edição por ID
src/
  components/                 AppScreen, AppText, AppButton, AppCard, RecoveryScreen
  theme/                      Cores, espaçamentos, raios, tipografia e tamanhos
  features/
    auth/                     Contratos desacoplados e tela Conta
    home/                     Home e fixtures de demonstração
    workouts/                 Tela inicial de treinos
    workout-session/          Prévia da experiência de treino
    history/                  Estado vazio do histórico
    exercises/                Modelo, seed, pesquisa SQLite, lista e formulário
  services/supabase/          Cliente lazy, configuração e tipo do schema vazio
  db/                         Provider SQLite, migration 1 e migration 2 de exercícios
  types/                      Identificador interno de usuário
tests/                        SQLite real, exercícios e validação de configuração
docs/                         Arquitetura e roteiro de validação
```

`stats` será adicionado quando houver sua primeira implementação. Hooks específicos, como `useExerciseSearch`, ficam no próprio módulo. Não há pastas ou repositórios vazios antecipando o produto inteiro.

## Arquitetura

A UI consome módulos de `features`. Rotas são pequenas e componentes base usam tokens centralizados: fundo preto, superfícies escuras e azul oficial `#6CADDF`. As cores ficam em JSON para serem compartilhadas com a configuração nativa do Expo; os outros tokens ficam em TypeScript.

O SQLite abre `academia.db`, habilita WAL/foreign keys e executa migrations antes de exibir as telas. A migration 1 preserva `app_metadata`; a migration 2 adiciona `exercises`, `exercise_aliases`, índice de ordenação e seed idempotente. `PRAGMA user_version` passa a 2, com alteração e seed na mesma transação. Uma falha exibe recuperação sem apagar o banco. A biblioteca usa `useSQLiteContext()` e funções de consulta/gravação do módulo de exercícios.

A busca normaliza caixa, acentos e espaços na escrita e na consulta, pesquisa nome e aliases e prioriza nome exato/prefixo. Usa SQL parametrizado com `instr`, sem FTS ou dependência adicional. O debounce é de 100 ms durante a digitação; resultados atrasados são ignorados. `FlatList` virtualiza os cards e usa UUIDs estáveis; a busca fica fora da área rolável. Não há lista virtualizada dentro de `ScrollView`.

Exercícios personalizados têm UUID gerado localmente pelo SQLite e timestamps ISO; edição preserva ID, criação e URI da imagem. Exercícios padrão são protegidos também pela condição `is_custom = 1` na escrita. Nesta fase, os personalizados pertencem à instalação local, sem identidade de usuário/sincronização; desinstalar ou limpar dados do app pode removê-los.

O cliente Supabase só é criado por `getSupabaseClient()`. Há armazenamento de sessão com `expo-sqlite/kv-store`, `persistSession` e um helper de renovação ligado ao ciclo de vida do app, para integração no futuro provider de autenticação. Nenhuma autenticação, conexão de rede, tabela remota ou assinatura realtime é iniciada pela UI atual.

Telefone + PIN de quatro dígitos é **um requisito de experiência ainda em definição**, não um login implementado. O contrato `AuthService` preserva essa separação; usuário tem UUID interno, independente de telefone. Não há OTP/SMS, cadastro simulado nem conversão do PIN em senha Supabase. Leia as decisões pendentes em [docs/architecture.md](docs/architecture.md).

## Qualidade e verificações

```powershell
npm run check
npm run doctor
npm run export:android
npm run export:ios
```

- `check`: TypeScript, lint sem warnings e 16 testes de persistência, exercícios e configuração.
- `doctor`: compatibilidade Expo, configuração e dependências nativas.
- `export:*`: gera bundle de produção em `dist/`; **não gera APK/IPA** e não substitui teste no celular.
- Testes usam `node:test` e `node:sqlite`, sem instalar framework de testes. Node 22 pode emitir avisos de APIs experimentais; isso se limita ao executor local, não ao app.

Os overrides de `react-dom`, Reanimated e Worklets fixam dependências transitivas instaladas pelo Router nas versões compatíveis com SDK 57. Não são usados para criar animações ou suporte web. ESLint 9 está fixado porque o plugin React da configuração Expo 57 ainda falha com ESLint 10; a versão 9 emite aviso de fim de suporte. Reavaliar junto à atualização da configuração Expo.

A auditoria inicial identificou 13 avisos moderados na árvore Expo, originados em `uuid`/`xcode` e `decode-uri-component`/`query-string`. Não houve aviso alto ou crítico. As correções automáticas propostas incluem downgrades incompatíveis de Expo/Router; não aplicar `npm audit fix --force`. Acompanhar correção upstream antes de distribuir a versão definitiva.

O roteiro de teste em aparelho está em [docs/validation.md](docs/validation.md). Não há medição de fluidez ou teste físico automatizado nesta entrega.

## Pronto nesta etapa

Fundação preservada e biblioteca local com 19 exercícios, aliases, pesquisa, placeholders, criação/edição de personalizados, validação de campos e estados de carregamento, erro e nenhum resultado. Nenhuma dependência foi adicionada na fase 2.

## Próximas etapas

Resolver autenticação/isolamento por usuário; modelar dados remotos e RLS; construir treinos; implementar sessão local com séries e cargas; adicionar histórico e estatísticas; definir sincronização e distribuição. Filtros, gestão de aliases personalizados, imagens oficiais e exclusão de exercícios também ficaram de fora desta fase. Streak real, gráficos, notificações e progressão automática não foram implementados.

## Referências

- [Instalação do Expo Router](https://docs.expo.dev/router/installation/)
- [SQLite no Expo](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)
- [FlatList no React Native](https://reactnative.dev/docs/flatlist)
- [Supabase com Expo React Native](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native)
