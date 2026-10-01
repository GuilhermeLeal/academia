# Academia

Aplicativo mobile para treinos pessoais e familiares. A prioridade é abrir, encontrar o treino e continuar com poucos toques, mantendo uma interface escura, leve e previsível.

**Estado: fase 6 — estatísticas locais com calendário mensal.** Biblioteca, templates e sessões são persistidos no SQLite. Um treino salvo pode iniciar uma sessão real, registrar resultados e gerar um resumo ao finalizar. A aba Histórico lista as sessões concluídas; a Home deriva a semana e a streak desses registros, e a tela interna Estatísticas combina calendário, resumo mensal, streaks, evolução por exercício e um resumo geral do histórico. Não há login ou sincronização. O app funciona sem conta Supabase, sem `.env` e sem contratar infraestrutura.

## Stack

- React Native 0.86, React 19, Expo SDK 57 e TypeScript estrito.
- Expo Router: Início, Treinos, Histórico e Conta, com biblioteca e edição/detalhe de treinos em telas internas.
- `expo-sqlite`: migrations incrementais, biblioteca e treinos locais.
- Supabase: cliente tipado e configuração opcional para PostgreSQL/Auth futuros.
- npm, Git e ESLint com a configuração oficial Expo.

Sem backend próprio, Docker, ORM, biblioteca de UI, gráficos, analytics ou serviços de SMS. Fontes do sistema e ícones Ionicons, sem imagens remotas nem biblioteca adicional de animações.

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
5. O app abre na aba Início. Use **Treinos → + Criar treino**. As quatro abas funcionam sem configurar a nuvem.

Para testar a fase 4: abra um treino salvo e toque em **Iniciar treino**. No card compacto, informe uma carga manual (decimais e zero aceitos), reps específicas maiores que zero e toque **Concluir exercício**; o resultado é aplicado às séries planejadas. Toque na seta para editar cada série separadamente e adicionar séries extras. Valores diferentes aparecem como **Personalizado** e só são substituídos pelo modo rápido após confirmação inline. A Home deve mostrar **Continuar treino**, e os registros devem permanecer ao voltar/reabrir. **Finalizar treino** mantém a confirmação discreta e o resumo. Ao iniciar outra sessão que contenha o mesmo exercício, inclusive em outro treino, as últimas séries realmente concluídas aparecem preenchidas por posição, mas continuam desmarcadas. Não é possível iniciar duas sessões simultâneas.

Para testar a fase 5: conclua dois treinos com cargas/repetições diferentes e abra **Histórico**. Somente as sessões finalizadas devem aparecer, da mais recente para a mais antiga, com data, duração e totais realizados. Toque em um card para conferir início/fim e apenas as séries concluídas. Depois renomeie ou exclua o template original: os nomes e resultados já registrados no histórico devem permanecer iguais.

Para testar a fase 6: conclua treinos em dias da semana atual e volte à Home. O indicador de segunda a domingo, a quantidade semanal e a streak devem refletir somente sessões finalizadas. Toque em **Ver estatísticas e evolução**: o calendário destaca cada dia local com treino concluído uma única vez, mesmo com várias sessões. Navegue entre meses e anos e confira que treinos, duração e dias treinados acompanham o mês exibido, enquanto streak atual/recorde não mudam. A evolução preserva cargas/reps reais por exercício. Ao final, **Ver resumo completo** abre somente os agregados de todo o histórico.

Para testar a criação da fase 3: informe um nome, toque em **Adicionar exercícios**, pesquise `supino` e selecione exercícios da biblioteca. Os já adicionados ficam marcados e não podem ser repetidos. Conclua a seleção, configure séries/reps/descanso e use as setas para ordenar. **Salvar treino** abre os detalhes; **Editar treino** permite modificar ou remover associações. Nos detalhes também há **Duplicar treino** e **Excluir treino**, com confirmação dentro da tela. Feche e reabra o app para conferir a persistência. Na fase atual, **Iniciar treino** abre a execução descrita acima.

Para testar a fase 2: **Treinos → Biblioteca de exercícios**. Pesquise `supino` (quatro variantes), `elevacao`, `triceps frances` ou o alias `voador`. Limpar a busca exibe todo o catálogo. Toque em **Criar exercício**, informe nome/grupo muscular e, opcionalmente, equipamento. Ao salvar, a biblioteca pesquisa o nome salvo. Toque no card personalizado para editar. Feche e reabra o app para conferir a persistência.

O catálogo inicial tem 19 exercícios de validação, somente leitura, e miniaturas placeholder. As imagens não são baixadas. A biblioteca consulta o SQLite local; nenhum caractere digitado gera chamada de rede.

Se não conectar, permita Node.js na rede privada do Firewall do Windows, desative VPNs e confira se a rede permite comunicação entre dispositivos. Após adicionar rotas, encerre o Metro anterior e execute `npx expo start --clear`. Não é necessário Android Studio, EAS Build nem conta paga para este teste pelo Expo Go no Android.

O Expo Go depende do servidor de desenvolvimento para carregar o aplicativo. Biblioteca, treinos e sessões salvam os dados no SQLite e funcionam localmente com o app carregado. Cache remoto e sincronização ainda serão implementados. Um APK independente fica para uma etapa de distribuição.

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
  workout-preview.tsx         Prévia histórica preservada da fundação
  exercises/                  Biblioteca, criação e consulta/edição por ID
  workout/                    Criação, detalhe por ID e edição de treinos
  session/                    Sessão em andamento e resumo por ID
  stats/                      Resumo geral interno de todo o histórico
src/
  components/                 AppScreen, AppText, AppButton, AppCard, RecoveryScreen
  theme/                      Cores, espaçamentos, raios, tipografia e tamanhos
  features/
    auth/                     Contratos desacoplados e tela Conta
    home/                     Home com treino ativo e consistência semanal real
    stats/                    Calendário, streak, agregados e evolução por exercício
    workouts/                 Lista, detalhe, formulário, validação e persistência
    workout-session/          Execução, registros locais, timer total e resumo
    history/                  Lista, detalhe e consultas do histórico local
    exercises/                Modelo, seed, pesquisa SQLite, lista e formulário
  services/supabase/          Cliente lazy, configuração e tipo do schema vazio
  db/                         Provider, migrations 1–4 e transações de escrita
  types/                      Identificador interno de usuário
tests/                        SQLite real, exercícios, treinos, sessões e configuração
docs/                         Arquitetura e roteiro de validação
```

Hooks específicos, como `useExerciseSearch` e `useStatsSummary`, ficam no próprio módulo. Não há pastas ou repositórios vazios antecipando o produto inteiro.

## Arquitetura

A UI consome módulos de `features`. Rotas são pequenas e componentes base usam tokens centralizados: fundo preto, superfícies escuras e azul oficial `#6CADDF`. As cores ficam em JSON para serem compartilhadas com a configuração nativa do Expo; os outros tokens ficam em TypeScript.

O SQLite abre `academia.db`, habilita WAL/foreign keys e executa migrations antes de exibir as telas. As migrations 1–3 permanecem intactas. A migration 4 adiciona `workout_sessions`, `session_exercises` e `session_sets`; `PRAGMA user_version` passa a 4 dentro da mesma transação. Uma falha exibe recuperação sem apagar o banco.

Cada treino tem UUID, nome, descrição opcional e timestamps. Associações mantêm posição, séries, intervalo de reps e descanso em segundos. Foreign keys e constraints protegem referências, números e unicidade por exercício/posição no treino. Criar/editar/duplicar/excluir usa transações em conexão dedicada com foreign keys habilitadas antes de `BEGIN`; uma falha desfaz a operação inteira. Remover um exercício do treino ou excluir o treino preserva a biblioteca. A mesma biblioteca é reutilizada em modo de seleção no formulário, sem dependência adicional de drag-and-drop.

Nome é obrigatório; séries/reps são inteiros positivos, reps mínimas não superam as máximas e descanso aceita zero. Um treino pode ser salvo sem exercícios e completado depois. Alterações do formulário ficam em memória até **Salvar treino**; sair pede confirmação, mas encerrar o processo não preserva rascunhos. A Home usa o primeiro treino por data de criação/UUID, sem agenda ou seleção automática por dia.

A busca normaliza caixa, acentos e espaços na escrita e na consulta, pesquisa nome e aliases e prioriza nome exato/prefixo. Usa SQL parametrizado com `instr`, sem FTS ou dependência adicional. O debounce é de 100 ms durante a digitação; resultados atrasados são ignorados. `FlatList` virtualiza os cards e usa UUIDs estáveis; a busca fica fora da área rolável. Não há lista virtualizada dentro de `ScrollView`.

Ao iniciar uma sessão, uma transação copia nome do treino, nome/ordem dos exercícios e configurações planejadas. Alterações posteriores no template ou catálogo não mudam o snapshot. Um índice parcial garante uma única sessão ativa. Carga aceita decimal não negativa, incluindo zero; reps realizadas são inteiras maiores que zero. O timer total deriva de `started_at`, portanto retorna ao tempo correto após troca de tela ou suspensão, sem timer de descanso/background avançado.

Na tela principal, cada exercício tem um card compacto. O modo rápido aplica uma carga e reps específicas a todas as séries planejadas em uma transação; a faixa planejada nunca é gravada como resultado. A seta abre o modo detalhado, que edita os mesmos registros de `session_sets` e concentra séries extras. O card deriva o estado dos registros: valores iguais aparecem nos campos; valores diferentes aparecem como **Personalizado**. Uma aplicação rápida sobre séries planejadas personalizadas pede confirmação inline e nunca altera séries extras.

Finalizar marca status/`finished_at` em transação e abre um resumo local. A aba Histórico consulta somente sessões concluídas, ordena por `finished_at` decrescente e conta exercícios que possuam ao menos uma série concluída. O detalhe lê nomes e resultados do snapshot, exibindo somente séries concluídas; mudanças ou exclusões posteriores no template não alteram o registro. Referências usam `ON DELETE SET NULL`, de modo que excluir o template não destrói a sessão. A Home consulta primeiro a sessão ativa e oferece **Continuar treino**.

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

- `check`: TypeScript, lint sem warnings e testes de persistência, exercícios, treinos, sessões, estatísticas e configuração.
- `doctor`: compatibilidade Expo, configuração e dependências nativas.
- `export:*`: gera bundle de produção em `dist/`; **não gera APK/IPA** e não substitui teste no celular.
- Testes usam `node:test` e `node:sqlite`, sem instalar framework de testes. Node 22 pode emitir avisos de APIs experimentais; isso se limita ao executor local, não ao app.

Os overrides de `react-dom`, Reanimated e Worklets fixam dependências transitivas instaladas pelo Router nas versões compatíveis com SDK 57. Não são usados para criar animações ou suporte web. ESLint 9 está fixado porque o plugin React da configuração Expo 57 ainda falha com ESLint 10; a versão 9 emite aviso de fim de suporte. Reavaliar junto à atualização da configuração Expo.

A auditoria inicial identificou 13 avisos moderados na árvore Expo, originados em `uuid`/`xcode` e `decode-uri-component`/`query-string`. Não houve aviso alto ou crítico. As correções automáticas propostas incluem downgrades incompatíveis de Expo/Router; não aplicar `npm audit fix --force`. Acompanhar correção upstream antes de distribuir a versão definitiva.

O roteiro de teste em aparelho está em [docs/validation.md](docs/validation.md). Não há medição de fluidez ou teste físico automatizado nesta entrega.

## Pronto nesta etapa

Fases 1–5 preservadas. A Home mostra streak semanal, dias e treinos concluídos reais. A tela Estatísticas agora consulta o mês exibido para montar o calendário e seu resumo, preserva streaks globais e evolução por exercício, e oferece um resumo geral de todo o histórico concluído. Nenhuma migration ou dependência foi adicionada nesta etapa.

O polimento visual usa microinterações curtas para pressão, conclusão, confirmações, progresso e transições internas. A configuração de redução de movimento do Android/iOS é respeitada, sem animações contínuas ou biblioteca adicional.

## Próximas etapas

Implementar timer de descanso, notificações e comportamento avançado em background em fase própria. Resolver autenticação/isolamento por usuário, dados remotos/RLS, estatísticas avançadas, sincronização e distribuição posteriormente. Filtros, imagens oficiais e exclusão de exercícios também ficam para depois. Gráficos, metas diárias e progressão automática não foram implementados.

## Referências

- [Instalação do Expo Router](https://docs.expo.dev/router/installation/)
- [SQLite no Expo](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)
- [FlatList no React Native](https://reactnative.dev/docs/flatlist)
- [Supabase com Expo React Native](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native)
