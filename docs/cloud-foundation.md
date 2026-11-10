# Cloud Foundation — contrato remoto

Atualização da fase seguinte: a aplicação/validação no Supabase real foi confirmada pelo responsável. O relato abaixo registra a entrega original da Foundation. O [Initial Sync controlado](initial-sync.md) implementa agora upload e restauração explícitos sobre este mesmo schema, sem sincronização automática.

Estado desta entrega: migrations versionadas e validadas em PostgreSQL/PGlite; aplicação no Supabase real pendente. O workspace não tinha Supabase CLI instalado/vinculado, Docker ou `psql`. Não foram usadas credenciais administrativas nem acessado o banco real. O arquivo `supabase/config.toml` adicionado descreve somente o ambiente local; não altera a configuração de Auth do projeto hospedado.

O app continua usando SQLite v5 para todo o domínio. Nenhuma tela, repository local, migration SQLite, regra de treino, rotação da Home ou fluxo Auth foi conectado ao PostgreSQL. Aplicar estas migrations **não transfere os dados do aparelho** nem transforma esta etapa em backup.

## Fonte de verdade e mapeamento

Foram inspecionadas as migrations SQLite 1–5, repositories de exercícios/treinos/sessões/histórico/estatísticas, tipos, seed, ownership, vínculo legado e Auth. Os IDs privados são UUIDs v4 criados no SQLite. O catálogo tem 19 UUIDs fixos. A identidade é sempre `auth.users.id`, obtida pelo login existente com email técnico e senha derivados de telefone/PIN; nenhum telefone, email, PIN ou senha entra nas tabelas de domínio.

| Tabela PostgreSQL | Origem SQLite e relacionamento |
| --- | --- |
| `exercises` | Mesmo UUID e atributos; padrões compartilhados, personalizados privados |
| `workouts` | Mesmo UUID, nome, descrição e criação; dono em `auth.users` |
| `workout_exercises` | Mesmo UUID; treino + exercício, posição e prescrição |
| `workout_sessions` | Mesmo UUID; template opcional, nome em snapshot, início/fim e status |
| `session_exercises` | Mesmo UUID; sessão, exercício opcional e snapshot da prescrição |
| `session_sets` | Mesmo UUID; exercício da sessão, número, carga, reps e conclusão |

Não existem tabelas de estatísticas/streak, perfil duplicado, telefone ou identidade técnica. `local_users`, `legacy_import_decisions`, `app_metadata` e aliases de busca continuam locais. Dados privados legados com `user_id IS NULL` só poderão ser enviados depois do consentimento/vínculo local já existente; o servidor rejeita privados sem dono.

UUIDs são `uuid` no PostgreSQL e não têm default gerador: o upload deve fornecer os IDs existentes, inclusive dos filhos. Nomes não são chaves. Booleanos SQLite `0/1` viram `boolean`; timestamps ISO viram `timestamptz`; carga usa `double precision` finito, não negativo. O schema admite reps não negativas como o SQLite; as regras de execução existentes continuam exigindo reps positivas para concluir.

## Catálogo padrão

Uma única tabela `exercises` contém padrões (`is_custom = false`, `user_id = NULL`) e personalizados (`is_custom = true`, `user_id = auth.uid()`). Uma constraint impede outras combinações. Isso mantém `exercise_id` único nas associações e snapshots, sem referências polimórficas ou cópias do catálogo por usuário.

A segunda migration insere exatamente os 19 exercícios do seed local com os mesmos IDs, nomes, normalização, grupos, equipamentos e data de criação. Um teste compara as linhas remotas com um SQLite inicializado pelas migrations reais. Usuários autenticados podem ler os padrões, mas não inserir, atualizar ou excluir padrões. `anon` não tem acesso às tabelas. Alterações futuras do catálogo exigem novas migrations locais/remotas coordenadas; UUIDs existentes nunca devem ser reciclados. Aliases permanecem metadados de busca empacotados no app.

## RLS, grants e relacionamentos

As seis tabelas usam `ENABLE ROW LEVEL SECURITY` e `FORCE ROW LEVEL SECURITY`. São 24 policies: `SELECT`, `INSERT`, `UPDATE` e `DELETE` em cada tabela. Os grants de `PUBLIC`/`anon` são removidos. `authenticated` recebe somente essas quatro operações, sem `TRUNCATE`, alterações de schema ou criação de triggers.

- Privados: `SELECT`/`DELETE` usam `(SELECT auth.uid()) = user_id`; `INSERT` usa `WITH CHECK`; `UPDATE` valida tanto a linha anterior (`USING`) quanto a nova (`WITH CHECK`).
- `exercises`: a leitura acrescenta a exceção do catálogo compartilhado; todas as escritas exigem exercício personalizado do próprio usuário.
- FKs compostas `(user_id, parent_id)` impedem filhos em treino/sessão/exercício de sessão de outra conta, inclusive na alteração de um vínculo existente.
- FKs de `exercise_id` garantem existência; policies de associações/snapshots aceitam somente exercício padrão ou personalizado do mesmo dono. Referências opcionais nulas preservam snapshots de origens excluídas.
- O trigger `stamp_cloud_row` rejeita mudanças de `id`, `user_id` e `is_custom`. Um upsert com UUID de outra conta também falha.
- Funções de trigger são `SECURITY INVOKER`, com `search_path` vazio e execução direta revogada para clientes. Não há RPC privilegiada, chave `service_role` no app ou dependência de telefone/email para autorização.

As FKs de domínio usam `NO ACTION`: exclusão física de pai referenciado é recusada. As FKs para `auth.users` usam `ON DELETE CASCADE`, para eventual remoção administrativa de uma conta; nenhuma migration exclui usuários Auth.

## Timestamps, tombstones e índices

Todas as tabelas têm `created_at`, `updated_at` e `deleted_at`. A criação local pode ser enviada no primeiro upload e é preservada em updates/upserts. `updated_at` é sempre definido pelo servidor: `clock_timestamp()` no INSERT, e o maior entre esse horário e o valor anterior + 1 microssegundo no UPDATE. O horário enviado pelo dispositivo não controla o cursor remoto. Para sessões/filhos que não possuem criação local própria, o futuro adapter poderá usar `started_at` da sessão; se omitir, o servidor registra o primeiro recebimento. Isso ainda não foi conectado ao app.

Deleções sincronizáveis são **UPDATE de `deleted_at`**, nunca `DELETE` físico. O trigger substitui o marcador por um timestamp do servidor, preserva tombstones já existentes e atualiza `updated_at`. Tombstones continuam legíveis somente pelo dono, para que outro dispositivo possa descobri-los. Não há limpeza automática, prazo de retenção ou cursor implementado nesta fase.

Ao marcar um treino, o servidor marca suas associações; snapshots históricos ficam intactos. Ao marcar uma sessão, marca seus exercícios e séries recursivamente. As FKs continuam apontando para os registros tombstonados. Na futura projeção SQLite, referências opcionais a origens apagadas deverão virar `NULL`, de acordo com o comportamento local atual. A remoção de exercícios personalizados não existe na UI e ainda exige definir tratamento de referências na fase Sync Engine.

As policies `DELETE` permitem exclusão física somente de linhas próprias e sem violar FKs, mas isso está fora do protocolo de sync: remove o sinal necessário a outros dispositivos. O repository remoto expõe apenas `markDeleted`, sem hard delete. A próxima fase deverá capturar as exclusões locais antes do `DELETE` atual, definir retenção/limpeza, restauração e conflitos com escritas atrasadas. O servidor não resolve ressurreições, filhos recebidos depois de um tombstone ou conflitos entre dispositivos nesta entrega.

Índices `(user_id, updated_at, id)` existem nas seis tabelas, incluindo tombstones. Outros cobrem criação dos treinos, nome normalizado, histórico concluído e relações pai/filho/exercício. Índices únicos parciais (`deleted_at IS NULL`) mantêm exercício/posição únicos por treino, posição por sessão, número por exercício de sessão e uma sessão ativa por usuário. Assim posições removidas podem ser reutilizadas sem apagar tombstones.

O par `(updated_at, id)` permite ordenar/paginar alterações, mas não é um cursor de commit global: transações concorrentes podem terminar fora dessa ordem. A fase Sync Engine precisa definir janela de sobreposição/releitura e checkpoints antes de depender desses timestamps.

## Tipos e acesso remoto mínimo

`src/services/supabase/database.types.ts` descreve Row/Insert/Update/Relationships das seis tabelas no formato aceito por `@supabase/supabase-js`. Os tipos foram escritos a partir das migrations e verificados por TypeScript e teste de colunas PostgreSQL; **não são resultado de geração a partir do projeto real**. O procedimento abaixo permite substituí-los pela geração oficial depois da aplicação.

`createRemoteWorkoutsRepository(client)` é uma primeira implementação explícita de acesso remoto: `getById`, `upsert` por UUID e `markDeleted`. Recebe o cliente tipado existente; não cria singleton, agenda trabalho, acessa SQLite ou é importado por telas. Cada operação resolve o usuário atual com `auth.getUser()`, filtra por UUID/owner e propaga erros de rede/RLS. O upload aceita uma lista explícita de campos e não aceita ownership/timestamps de servidor fornecidos pelo chamador. Leituras incluem tombstones deliberadamente. As outras entidades têm schema/tipos preparados, mas seus adapters de upload/download ficam para o fluxo real de sync.

O app continua com URL + publishable key públicas, SecureStore, `persistSession`/`autoRefreshToken` e o fluxo existente de telefone/PIN. A Cloud Foundation não adiciona chamada de rede à abertura das telas ou à execução de séries; o comportamento offline atual permanece o mesmo.

## Aplicar no Supabase real

Execute na raiz do projeto. O CLI pode ser usado via `npx`, sem adicioná-lo às dependências do app. `supabase/config.toml` já está versionado; não é necessário `supabase init`.

```powershell
npx supabase --version
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

Use o project ref do projeto real exibido no Dashboard; não é a publishable key. Login/vínculo podem pedir autenticação da conta Supabase e senha do banco. Forneça-as somente no prompt do CLI. Não coloque esses valores em `.env` do Expo nem no Git. Os flags `--linked` continuam compatíveis com CLI v2/v3; no CLI v3 também há `--remote` para o projeto vinculado.

O dry-run deve listar apenas:

1. `20261110000000_cloud_foundation.sql` — tabelas, constraints, índices, triggers, grants e policies.
2. `20261110000001_standard_exercises.sql` — catálogo padrão.

Se houver outras migrations remotas ou tabelas de domínio com os mesmos nomes, reconcilie o histórico/schema antes de aplicar; estas migrations não usam `IF NOT EXISTS` para esconder divergências. Não use `db reset` no projeto real nem faça `migration repair` para simular migrations não executadas. Depois de revisar o destino e o dry-run:

```powershell
npx supabase db push --linked
npx supabase migration list --linked
npx supabase db lint --linked --schema public
```

`db push` aplica SQL versionado e registra o histórico; não envia o SQLite nem altera providers do Auth. Email provider e confirmação de email devem continuar como já estão configurados no projeto atual.

Para gerar tipos em um arquivo temporário no PowerShell, preservando o arquivo atual se o comando falhar:

```powershell
$cloudTypes = npx supabase gen types typescript --linked --schema public
if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar tipos; arquivo atual preservado.' }
$cloudTypes | Set-Content -Encoding utf8 src/services/supabase/database.generated.ts
```

Revise esse arquivo contra `database.types.ts`, substitua o arquivo anterior após conferir o schema e remova o temporário. Depois execute `npm run typecheck`, `npm run lint` e `npm test`. Não mantenha credenciais junto aos tipos.

## Validação reproduzível de RLS

`npm test` inclui PGlite somente como dependência de desenvolvimento. O harness cria os papéis `authenticated`/`anon` e uma implementação mínima de `auth.users`/`auth.uid()`; as migrations, RLS, grants, constraints, SQL e triggers de domínio são os arquivos reais, sem mock. O teste de repository usa o SDK real com respostas HTTP simuladas. Isso não substitui um teste ponta a ponta do Auth/PostgREST hospedado.

Para validar no Supabase real após o push:

1. Abra o SQL Editor do **mesmo projeto** usando o papel administrativo padrão `postgres`.
2. Copie e execute **inteiro** `supabase/validation/cloud_foundation.sql`.
3. O script cria duas identidades/entidades de teste com UUIDs aleatórios dentro de `BEGIN`, alterna para `authenticated`/`anon` e configura as claims que `auth.uid()` lê. Os testes não são executados com privilégios de administrador.
4. O resultado final deve ser `cloud foundation: all RLS, ownership, UUID and tombstone assertions passed`.
5. `ROLLBACK` remove todos os fixtures, inclusive as duas linhas temporárias em Auth, sem excluir ou alterar usuários existentes. Se a execução for interrompida em uma conexão SQL persistente, execute `ROLLBACK;` antes de continuar. Não execute fragmentos isolados nem acrescente `COMMIT`.

Asserções cobrem todas as tabelas: A não lê/atualiza/exclui B, não insere com dono B nem transfere ownership; filhos não podem referenciar pais ou personalizados de B; catálogo é compartilhado e read-only; logout bloqueia SELECT/INSERT/UPDATE/DELETE para `anon`; relogin recupera o mesmo UUID/owner; upsert preserva IDs/criação; timestamps são do servidor; tombstones são visíveis ao dono e propagados sem apagar histórico.

Com PostgreSQL local/Supabase local disponível, o mesmo roteiro é executável por `psql` (não é um arquivo pgTAP para `supabase test db`):

```powershell
npx supabase start
npx supabase migration up
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/validation/cloud_foundation.sql
```

Essa URL é somente o padrão local; não contém credenciais reais. Para o projeto hospedado, prefira o SQL Editor ou uma conexão administrativa segura já configurada. Nenhuma chave administrativa é necessária no app.

## Resultado da validação desta entrega (10/11/2026)

| Check | Resultado |
| --- | --- |
| `npm run typecheck` | Aprovado |
| `npm run lint` | Aprovado, sem warnings |
| `npm test` | 80/80 aprovados; 7 novos testes de cloud, incluindo o roteiro SQL com várias asserções |
| Migrations, grants, RLS e catálogo em PGlite | Aprovados; roles `authenticated`/`anon` e isolamento A/B exercitados |
| `git diff --check` | Aprovado |
| `npx expo-doctor` | 19/20; falha somente na matriz de versões |
| `npx expo install --check` | Apontou 10 pacotes abaixo da recomendação atual |
| Supabase hospedado / CLI vinculado | Não executado: vínculo e credenciais administrativas não estavam configurados |

As divergências Expo já estavam nas versões do `HEAD`, antes desta fase. `package.json`/lock ganharam apenas `@electric-sql/pglite@0.5.16` em desenvolvimento. O alinhamento de versões nativas ficou pendente, sem misturar essa atualização com o schema remoto:

| Pacote | Instalado | Recomendação retornada pelo Expo |
| --- | --- | --- |
| expo | 58.0.20 | ~58.0.23 |
| expo-constants | 58.0.13 | ~58.0.15 |
| expo-font | 58.0.10 | ~58.0.11 |
| expo-linking | 58.0.14 | ~58.0.16 |
| expo-router | 58.0.27 | ~58.0.30 |
| expo-sqlite | 58.0.14 | ~58.0.15 |
| expo-system-ui | 58.0.6 | ~58.0.7 |
| react-native | 0.88.0 | 0.88.1 |
| react-native-safe-area-context | 5.10.1 | ~5.11.1 |
| react-native-screens | 4.30.0 | ~4.30.1 |

## Próxima fase: Sync Engine

Permanecem pendentes upload inicial dos dados já vinculados, adapters completos das seis entidades, captura de alterações/exclusões no SQLite, atomicidade de agregados/reordenação, paginação e checkpoints, conflitos (incluindo duas sessões ativas em aparelhos distintos), restauração/tombstones, retomada/retry e testes multiaparelho. Não foram implementados fila, background sync, realtime, polling ou sincronização bidirecional automática. Não existe ainda garantia de recuperação dos treinos após desinstalação.

Referências oficiais: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [migrations](https://supabase.com/docs/guides/local-development/database-migrations), [CLI](https://supabase.com/docs/reference/cli/supabase-db-push), [tipos TypeScript](https://supabase.com/docs/guides/api/rest/generating-types) e [PGlite](https://pglite.dev/docs/).
