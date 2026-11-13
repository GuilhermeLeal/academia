# Catálogo padrão de 150 exercícios

Implementação em 13/11/2026. O catálogo é conteúdo interno do aplicativo Academia, não um dataset, pacote de dados ou API de exercícios para terceiros.

## Inspeção anterior às alterações

- SQLite: migration 2 cria `exercises` e `exercise_aliases`; versão 5 acrescenta `user_id`, índices e triggers de ownership; versão 6 mantém outbox/checkpoints/supressão de sync.
- Seed original: 19 exercícios, IDs `00000000-0000-4000-8000-000000000001` até `00000000-0000-4000-8000-000000000019`. Não foi substituído. A migration 2 continua semear apenas esses registros.
- Supabase: inspecionados schema, constraints, grants, RLS e triggers nas migrations `20261110000000_cloud_foundation.sql` e `20261110000001_standard_exercises.sql`. Esta inspeção foi dos arquivos do projeto; não foi uma auditoria do banco remoto implantado.
- Busca: SQLite local com normalização de acentos/caixa/espaços, termos em qualquer ordem, `instr` parametrizado e aliases por exercício. Aliases continuam internos do app, conforme a arquitetura existente; não são entidades do sync nem uma nova API remota.
- Sync Engine: initial sync exporta apenas exercícios personalizados do usuário; incremental usa `user_id` no push/pull, e triggers só registram linhas com proprietário. Padrões têm `user_id IS NULL`, um único catálogo compartilhado. Nenhuma alteração no protocolo foi necessária.
- UI: biblioteca/seleção já usava `FlatList`; havia componente de miniatura com placeholder e detalhe somente textual. Foram mantidos navegação, criação/edição de personalizados e seleção direta.

## Fonte e licença

Fonte oficial gratuita: [RepDB/exercise-dataset](https://github.com/RepDB/exercise-dataset), snapshot de 701 exercícios no commit `8e2fb4a6e1131223769332e401833eb6d40c483a`. Só os campos necessários à curadoria e as ilustrações gratuitas `images/flat/` são utilizados. O JSON completo é lido temporariamente em memória pelo preparador, não gravado no repositório. Nenhuma pasta `premium-samples` é consultada.

Licença verificada **antes da importação**: [RepDB Free Tier License v1.0, texto fixado](https://github.com/RepDB/exercise-dataset/blob/8e2fb4a6e1131223769332e401833eb6d40c483a/LICENSE-DATA.md), SHA-256 `ef3dc963ae8f7640fc1f816664933c639a6170b021ae3c7976210810cbea1c12`.

A licença permite uso pessoal/comercial dentro do app com atribuição visível e redimensionamento de imagens. Proíbe republicação como dataset/API, inclusive derivados, uso das imagens como entrada/referência de IA generativa e uso de previews pagos em produção. O preparador só redimensiona WebP com Sharp; não utiliza IA generativa.

Atribuição com link visível em **Conta → Sobre / Créditos**: `Exercise data by RepDB (repdb.co)`. Também consta no README. A licença acompanha a pasta privada de preparação. O código específico do app e seus seeds não conferem direito de extrair/republicar os dados RepDB; não publique o diretório de assets, manifestos ou arquivos de origem como biblioteca/dataset.

## Curadoria

São **150 padrões: 19 preservados + 131 novos**, com nome pt-BR, grupo, equipamento, aliases populares e nome oficial inglês para busca. Prioridade para exercícios usuais de musculação, cobrindo padrões de empurrar/puxar, agachar/avançar, extensão/flexão de quadril/joelho, braços, panturrilhas e core. Equipamentos predominantes: barra, halteres, cabo/polia, máquinas, Smith, banco e peso corporal. Sem importação de yoga, movimentos olímpicos, habilidades avançadas de calistenia ou dezenas de variações de pausa/pegada.

| Grupo principal | Quantidade |
| --- | ---: |
| Peitoral | 20 |
| Costas, incluindo extensão lombar | 19 |
| Ombros, incluindo trapézio | 18 |
| Bíceps | 14 |
| Tríceps | 14 |
| Quadríceps | 18 |
| Posterior de coxa | 11 |
| Glúteos | 12 |
| Adutores | 2 |
| Panturrilha | 6 |
| Abdômen/core | 16 |
| **Total** | **150** |

Grupos são a classificação principal do app; compostos recrutam outros músculos. Foram mantidas variantes relevantes por equipamento, inclinação ou apoio unilateral. A redundância herdada entre **Supino Máquina** e **Supino Articulado** foi preservada para manter identidade/histórico. O RepDB gratuito possui uma representação de chest press para ambos; eles compartilham essa ilustração. Resultado: **149 fontes únicas para 150 registros**.

## Persistência e migrations

- SQLite **007-exercise-catalog**, versão do banco **7**: insere somente os IDs ausentes, associa imagens e acrescenta aliases com conflito ignorado, dentro da transação do inicializador. Preserva IDs, nomes/datas originais, personalizados, treinos, sessões, séries e histórico. Sem `REPLACE`, deleções ou recriação de tabelas.
- Supabase **20261113000000_exercise_catalog_150.sql**: 131 inserts compartilhados com conflito ignorado; associação de mídia aos 150 IDs somente quando `is_custom = false` e `user_id IS NULL`. RLS, FKs e ownership continuam iguais. `updated_at` remoto é estampado pelo trigger existente ao anexar a imagem; `created_at` original permanece.
- Supabase **20261113000001_exercise_images.sql**: prepara bucket `exercise-images`, público para servir arquivos individuais, apenas WebP, limite de 256 KiB por objeto. Não cria policies de listagem/escrita para usuários. Em PostgreSQL sem extensão Storage, o bloco é ignorado; há teste separado com schema Storage emulado.

O campo existente `image_uri` guarda referências portáveis `repdb://<fonte>/thumb.webp`, iguais em SQLite e Supabase. O app resolve essas referências no domínio do seu projeto. Não armazena URLs de terceiros nem precisa alterar schemas/contratos de personalizados e sync. A migration SQL é gerada por `npm run catalog:sql` a partir da curadoria do app; um teste compara catálogo SQLite e PostgreSQL completos.

## Imagens e desempenho

`npm run catalog:assets` lê somente o JSON gratuito oficial em memória, baixa somente fontes selecionadas do commit fixado, valida caminhos estritos, WebP estático 512×512 e poses disponíveis, e cria miniaturas 128×128 com qualidade 72. Paralelismo limitado a 4. Arquivos e manifesto com SHA-256 ficam em **`.repdb-assets/`, ignorado pelo Git**. O upload valida todos os arquivos antes da primeira escrita e envia somente WebP do conjunto esperado, sem JSON/manifesto/dataset.

Preparação validada: **444 objetos / 5.647.518 bytes (5,39 MiB)**:

- 149 miniaturas: 239.926 bytes no total; maior 2.832 bytes.
- 146 pares start/peak: 292 imagens; originais gratuitos 512px, sem recompressão.
- 3 imagens main: prancha, prancha lateral e agachamento isométrico na parede.
- Maior imagem: 38.040 bytes, abaixo do limite do bucket.

Lista mostra a contração como miniatura, ou main quando estático. Detalhe/visualização na seleção mostram imagens amplas rotuladas início → contração ou posição. `expo-image` usa cache em memória/disco; fallback discreto na lista, feedback e retry no detalhe. Sem prefetch de catálogo. `FlatList`: 10 itens iniciais, lotes de 6, janela de 3 telas; não monta 150 imagens ao mesmo tempo. Busca local mantém debounce de 100 ms e não depende de rede. Imagens já carregadas podem ser reutilizadas offline enquanto permanecerem no cache; ele pode ser removido pelo sistema.

## Supabase gratuito e implantação

Uso esperado do bucket: **5,39 MiB**, aproximadamente **0,6% de 1 GB** disponível no [plano gratuito](https://supabase.com/pricing), verificado em 13/11/2026. Não usa a transformação de imagens do Storage: miniaturas são geradas localmente. Cache-Control de um ano e caminho versionado `v1/` reduzem tráfego; alterações futuras de conteúdo exigem nova versão do caminho. O plano informa 5 GB de saída e mais 5 GB de saída em cache; tráfego depende dos acessos e outros usos do projeto. Uma transferência de todos os assets é 5,65 MB; normalmente o celular baixa só as miniaturas renderizadas e os detalhes abertos.

Bucket público serve imagens individuais dentro do app; não oferece endpoint de catálogo, listagem ou escrita para usuários. Não compartilhe ZIPs, manifestos de assets ou um serviço de dados RepDB para terceiros. Não há cobrança nova configurada pela implementação. Limites são compartilhados com o restante do projeto.

As migrations foram executadas nos testes SQLite/PostgreSQL locais. **Não foram aplicadas ao Supabase remoto e nenhum objeto foi enviado**, pois não há uma credencial administrativa disponibilizada para isso nesta tarefa. Siga esta ordem:

1. Aplique as duas novas migrations ao projeto que já possui a Cloud Foundation. Use seu fluxo habitual de migrations; ou execute os dois arquivos SQL completos no SQL Editor, primeiro catálogo e depois bucket. Não reaplique a migration inicial de criação das tabelas.
2. Execute `npm run catalog:assets` (já preparado neste workspace; necessário em outro checkout).
3. No ambiente local do operador, configure `SUPABASE_URL` e **`SUPABASE_SECRET_KEY`** (chave secreta administrativa do projeto). Nunca use prefixo `EXPO_PUBLIC_` para secrets, nunca os versione, nem os envie ao app. `catalog:upload` também pode ler a URL pública do `.env`; a chave secreta deve ser fornecida apenas ao processo de upload.
4. Execute `npm run catalog:upload`. A operação é repetível e só envia os 444 assets selecionados. Não publica o manifesto ou JSON RepDB. Remova a variável secreta da sessão após terminar.
5. Distribua a atualização do app somente depois de aplicar o catálogo remoto, para que treinos com novos IDs encontrem suas FKs na nuvem. A URL pública já configurada do Supabase determina o domínio das imagens.
6. No celular, confira miniaturas, início/contração, main estático, preview pelo ícone de olho na seleção, busca com/sem acentos e Conta → Créditos. Abra um detalhe online e depois offline para avaliar cache/fallback. Confira um treino/histórico antigo e alternância entre duas contas.

## Validação

Os testes cobrem exatamente 150 padrões/IDs distintos, 19 UUIDs originais e seus metadados preservados em upgrade real de versão 6, rollback/retry, idempotência, integridade de FKs, personalizados, treinos, sessão ativa/histórico, outbox intacta, aliases pt-BR/inglês e URLs de mídia. Os testes existentes de initial/incremental sync e RLS continuam exercitando isolamento entre duas contas e ausência de catálogo por usuário. O schema remoto testado é o das migrations locais, com a fronteira Auth/Storage emulada em PostgreSQL; não equivale a um teste do projeto Supabase em produção. Validação visual nativa no aparelho ainda é manual.

Checks executados e aprovados:

| Check | Resultado |
| --- | --- |
| `npm run typecheck` | Sem erros |
| `npm run lint` | Sem erros/avisos |
| `npm test` | 99 testes aprovados |
| `npx expo-doctor` | 20/20 |
| `npx expo install --check` | Dependências compatíveis |
| `git diff --check` | Sem erros |
| `npm run export:android` | Bundle Android/Hermes gerado |
| `npm run catalog:assets` | 444 WebP validados, 5,39 MiB |

O sandbox inicialmente bloqueou rede e subprocessos (`spawn EPERM`); os comandos afetados foram repetidos com permissão de execução e passaram. Não houve teste visual no emulador/aparelho nem upload remoto.

## Arquivos desta alteração

- Catálogo/banco: `src/features/exercises/catalog.ts`, `src/features/exercises/seed.ts`, `src/db/migrations.ts`, `src/db/migrations/007-exercise-catalog.ts`.
- Imagens/UI: `src/features/exercises/media.ts`, `ExerciseImages.tsx`, `ExerciseCard.tsx`, `ExerciseEditorScreen.tsx`, `ExerciseLibraryScreen.tsx`; créditos em `src/features/auth/AccountScreen.tsx`.
- Supabase: `supabase/migrations/20261113000000_exercise_catalog_150.sql`, `20261113000001_exercise_images.sql`, `supabase/validation/cloud_foundation.sql`.
- Ferramentas: `scripts/generate-exercise-migration.ts`, `prepare-exercise-assets.ts`, `upload-exercise-assets.ts`.
- Configuração/dependências: `.gitignore`, `app.config.ts`, `package.json`, `package-lock.json` (`expo-image` em produção; `sharp` somente desenvolvimento).
- Testes: `tests/exercise-catalog.test.ts`, `exercises.test.ts`, `initial-sync.test.ts`, `workout-sessions.test.ts`, `workouts.test.ts`.
- Documentação: `README.md`, `docs/exercise-catalog.md`.

Os 444 assets e a licença/manifesto de preparação em `.repdb-assets/` são artefatos locais ignorados, não arquivos para commit. Nenhum commit ou push foi realizado.
