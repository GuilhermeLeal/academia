# Academia

Aplicativo mobile para treinos pessoais e familiares. A prioridade é abrir, encontrar o treino e continuar com poucos toques, mantendo uma interface escura, leve e previsível.

**Estado: fase 7 — contas familiares e isolamento local.** O app autentica com telefone + PIN de quatro dígitos usando Supabase Auth, restaura a sessão com armazenamento seguro e mantém exercícios personalizados, treinos, sessões, histórico e estatísticas separados por UUID de usuário no SQLite. O catálogo padrão continua compartilhado. Ainda não existe sincronização dos dados de treino com PostgreSQL.

## Stack

- React Native 0.86, React 19, Expo SDK 57 e TypeScript estrito.
- Expo Router: Início, Treinos, Histórico e Conta, com biblioteca e edição/detalhe de treinos em telas internas.
- `expo-sqlite`: migrations incrementais, biblioteca e treinos locais.
- Supabase Auth: telefone + senha técnica derivada, com sessão persistida em `expo-secure-store`.
- `expo-crypto`: SHA-256 da credencial técnica versionada; o PIN nunca é persistido.
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
5. O app abre em **Entrar**. Crie a primeira conta com telefone, PIN e confirmação; depois use **Treinos → + Criar treino**.

Para testar a fase 7: configure o projeto Supabase e o `.env` conforme abaixo. Crie a conta A, salve um exercício personalizado, um treino e uma sessão; saia em **Conta → Sair**. Crie a conta B e confirme que ela vê apenas o catálogo padrão. Crie dados diferentes, saia e volte à conta A: os dados originais reaparecem sem qualquer registro da conta B. Feche o app sem sair e abra novamente para validar a restauração automática da sessão. Em uma instalação atualizada com dados da fase anterior, escolha explicitamente entre **Vincular à minha conta** e **Agora não**; a segunda opção deixa o vínculo disponível em Conta.

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

São obrigatórias para autenticar. Crie o arquivo local:

```powershell
Copy-Item .env.example .env
```

Preencha com os valores públicos do seu projeto Supabase:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_sua_chave_publica
```

A configuração aceita uma URL HTTPS de projeto e a chave pública moderna `sb_publishable_...`. Se estiver ausente ou inválida, o app mostra uma mensagem de configuração e não libera a área privada.

Variáveis `EXPO_PUBLIC_*` entram no aplicativo e **não são secrets**. Nunca coloque `service_role`, `sb_secret_...`, senha PostgreSQL ou PIN no código/ambiente público. `.env`, credenciais, bancos locais e dependências estão no `.gitignore`; apenas `.env.example` é versionável.

No Dashboard do Supabase, em **Authentication → Providers → Phone**, habilite autenticação por telefone e desabilite **Confirm phone**. Sem essa confirmação, `signUp({ phone, password })` retorna uma sessão diretamente e nenhum provedor SMS é necessário. Não habilite OTP, MFA ou CAPTCHA nesta fase. A política de senha precisa aceitar a senha técnica SHA-256 de 72 caracteres. O app usa apenas a chave pública e nunca `service_role`.

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
    auth/                     Provider, telas de entrada/conta, credencial e vínculo legado
    home/                     Home com treino ativo e consistência semanal real
    stats/                    Calendário, streak, agregados e evolução por exercício
    workouts/                 Lista, detalhe, formulário, validação e persistência
    workout-session/          Execução, registros locais, timer total e resumo
    history/                  Lista, detalhe e consultas do histórico local
    exercises/                Modelo, seed, pesquisa SQLite, lista e formulário
  services/supabase/          Cliente Auth, configuração e storage seguro da sessão
  db/                         Provider, migrations 1–5 e transações de escrita
  types/                      Identificador interno de usuário
tests/                        SQLite real, exercícios, treinos, sessões e configuração
docs/                         Arquitetura e roteiro de validação
```

Hooks específicos, como `useExerciseSearch` e `useStatsSummary`, ficam no próprio módulo. Não há pastas ou repositórios vazios antecipando o produto inteiro.

## Arquitetura

A UI consome módulos de `features`. Rotas são pequenas e componentes base usam tokens centralizados: fundo preto, superfícies escuras e azul oficial `#6CADDF`. As cores ficam em JSON para serem compartilhadas com a configuração nativa do Expo; os outros tokens ficam em TypeScript.

O SQLite abre `academia.db`, habilita WAL/foreign keys e executa migrations antes de exibir as telas. As migrations 1–4 permanecem intactas. A migration 5 adiciona `user_id` aos dados privados, registra identidades locais e decisões de vínculo legado, cria índices por proprietário e valida por triggers que pais e filhos tenham o mesmo dono. Uma falha exibe recuperação sem apagar o banco.

Cada treino tem UUID, nome, descrição opcional e timestamps. Associações mantêm posição, séries, intervalo de reps e descanso em segundos. Foreign keys e constraints protegem referências, números e unicidade por exercício/posição no treino. Criar/editar/duplicar/excluir usa transações em conexão dedicada com foreign keys habilitadas antes de `BEGIN`; uma falha desfaz a operação inteira. Remover um exercício do treino ou excluir o treino preserva a biblioteca. A mesma biblioteca é reutilizada em modo de seleção no formulário, sem dependência adicional de drag-and-drop.

Nome é obrigatório; séries/reps são inteiros positivos, reps mínimas não superam as máximas e descanso aceita zero. Um treino pode ser salvo sem exercícios e completado depois. Alterações do formulário ficam em memória até **Salvar treino**; sair pede confirmação, mas encerrar o processo não preserva rascunhos. A Home usa o primeiro treino por data de criação/UUID, sem agenda ou seleção automática por dia.

A busca normaliza caixa, acentos e espaços na escrita e na consulta, pesquisa nome e aliases e prioriza nome exato/prefixo. Usa SQL parametrizado com `instr`, sem FTS ou dependência adicional. O debounce é de 100 ms durante a digitação; resultados atrasados são ignorados. `FlatList` virtualiza os cards e usa UUIDs estáveis; a busca fica fora da área rolável. Não há lista virtualizada dentro de `ScrollView`.

Ao iniciar uma sessão, uma transação copia nome do treino, nome/ordem dos exercícios e configurações planejadas. Alterações posteriores no template ou catálogo não mudam o snapshot. Um índice parcial garante uma única sessão ativa **por usuário**. Carga aceita decimal não negativa, incluindo zero; reps realizadas são inteiras maiores que zero. O timer total deriva de `started_at`, portanto retorna ao tempo correto após troca de tela ou suspensão, sem timer de descanso/background avançado.

Na tela principal, cada exercício tem um card compacto. O modo rápido aplica uma carga e reps específicas a todas as séries planejadas em uma transação; a faixa planejada nunca é gravada como resultado. A seta abre o modo detalhado, que edita os mesmos registros de `session_sets` e concentra séries extras. O card deriva o estado dos registros: valores iguais aparecem nos campos; valores diferentes aparecem como **Personalizado**. Uma aplicação rápida sobre séries planejadas personalizadas pede confirmação inline e nunca altera séries extras.

Finalizar marca status/`finished_at` em transação e abre um resumo local. A aba Histórico consulta somente sessões concluídas, ordena por `finished_at` decrescente e conta exercícios que possuam ao menos uma série concluída. O detalhe lê nomes e resultados do snapshot, exibindo somente séries concluídas; mudanças ou exclusões posteriores no template não alteram o registro. Referências usam `ON DELETE SET NULL`, de modo que excluir o template não destrói a sessão. A Home consulta primeiro a sessão ativa e oferece **Continuar treino**.

Exercícios personalizados têm UUID gerado localmente pelo SQLite, timestamps ISO e `user_id`; edição preserva ID, criação e URI da imagem. Exercícios padrão usam `user_id = NULL` e são protegidos por trigger para permanecer compartilhados. Desinstalar ou limpar os dados do app ainda pode remover os registros locais, pois sincronização não foi implementada.

O `AuthProvider` restaura a sessão antes de montar o banco e as rotas privadas. O cliente Supabase usa `persistSession`, renovação em primeiro plano e um adapter de `expo-secure-store` com fragmentação de valores grandes. Logout usa escopo local, remove a sessão persistida e desmonta todo o conteúdo privado antes de outra conta entrar.

Na UI, telefone e PIN continuam strings; `"0042"` não perde zeros. O telefone é normalizado para E.164 e a senha enviada ao Supabase é `acad-v1-` + SHA-256 de uma entrada versionada com telefone e PIN. Nem PIN nem senha técnica são armazenados. Essa derivação atende à compatibilidade com Auth, mas não torna um PIN de 10.000 combinações forte; os rate limits do Supabase continuam relevantes.

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

A auditoria atual do npm sinaliza 32 ocorrências transitivas (9 moderadas, 22 altas e 1 crítica) na cadeia Expo/Metro/React Native, incluindo `shell-quote`, `braces`, `node-forge`, `uuid` e `query-string`. A maioria das correções automáticas propostas faria downgrade incompatível do Expo 57 ou upgrade de SDK; não aplicar `npm audit fix --force`. O alerta de `shell-quote` admite correção não forçada, mas mudanças transitivas devem ser validadas junto à matriz Expo antes de distribuição. `expo-doctor` permanece a referência de compatibilidade e deve continuar 21/21.

O roteiro de teste em aparelho está em [docs/validation.md](docs/validation.md). Não há medição de fluidez ou teste físico automatizado nesta entrega.

## Pronto nesta etapa

Fases 1–6 preservadas. Autenticação real, restauração segura de sessão, logout, migration v5 e isolamento local por usuário estão implementados. Dados privados anteriores permanecem sem proprietário até consentimento explícito e são vinculados em uma única transação, preservando UUIDs, snapshots e datas. Foram adicionadas somente as dependências Expo `expo-secure-store` e `expo-crypto`.

O polimento visual usa microinterações curtas para pressão, conclusão, confirmações, progresso e transições internas. A configuração de redução de movimento do Android/iOS é respeitada, sem animações contínuas ou biblioteca adicional.

## Próximas etapas

Implementar sincronização SQLite ↔ PostgreSQL, schema remoto e RLS em uma fase própria; nenhum dado de treino é enviado ao Supabase agora. Timer de descanso, notificações, comportamento avançado em background, distribuição, filtros, imagens oficiais e exclusão de exercícios também ficam para depois. Gráficos, metas diárias e progressão automática não foram implementados.

## Referências

- [Instalação do Expo Router](https://docs.expo.dev/router/installation/)
- [SQLite no Expo](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)
- [FlatList no React Native](https://reactnative.dev/docs/flatlist)
- [Supabase com Expo React Native](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native)
- [Supabase Auth com telefone e senha](https://supabase.com/docs/guides/auth/passwords#with-phone)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Cotas e cobrança do Supabase](https://supabase.com/docs/guides/platform/billing-on-supabase)
