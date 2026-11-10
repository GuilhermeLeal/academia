# Initial Sync controlado

A Cloud Foundation já foi aplicada e validada no projeto real, conforme informado pelo responsável. Esta fase usa as mesmas seis tabelas, RLS e migrations, sem alteração de schema remoto ou SQLite. A autenticação, navegação e execução dos treinos continuam iguais. Nenhuma operação roda automaticamente após login ou durante treino.

## Arquitetura

`src/services/initial-sync/` contém:

- `model.ts`: snapshot das seis entidades, contagens, recibo de integridade, comparação e projeção de tombstones.
- `local.ts`: exportação por `user_id` e importação com INSERTs explícitos no SQLite v5.
- `remote.ts`: adapter do SDK Supabase, paginação por UUID e upserts em lotes de até 250 registros.
- `service.ts`: coordenação de upload/restauração, regras de conflito e validação do recibo.
- `development.ts`: funções internas no console de desenvolvimento; não adiciona controles às telas.

O único ponto de integração no app é um import em `app/_layout.tsx` que registra `globalThis.__ACADEMIA_INITIAL_SYNC__` quando `__DEV__` é verdadeiro. Importar o módulo não abre banco, não consulta Auth e não gera tráfego. As operações abrem uma conexão SQLite própria, configuram foreign keys antes das transações e fecham a conexão ao terminar. Não há nova dependência.

## Upload

1. Confere a identidade pela sessão normal do Supabase. Nunca recebe telefone/email como ownership.
2. Lê um snapshot consistente do SQLite dentro de uma transação, filtrando todas as tabelas pelo usuário atual. Dados legados sem dono bloqueiam a operação até o vínculo explícito já existente no app.
3. Consulta as seis tabelas remotas com `user_id = usuário atual`, sob RLS, incluindo tombstones. Pagina por `id > último UUID` até receber página vazia; não assume que o limite do servidor é igual ao tamanho solicitado.
4. Se o remoto estiver vazio, envia `exercises` personalizados → `workouts` → `workout_exercises` → `workout_sessions` → `session_exercises` → `session_sets`. Catálogo padrão e aliases nunca são enviados.
5. Usa upsert por `id` com `ignoreDuplicates: true` (INSERT ON CONFLICT DO NOTHING). Uma corrida com um UUID já inserido não sobrescreve o registro remoto. Depois relê o remoto e compara o domínio inteiro com o snapshot enviado, além de conferir que o local não mudou.
6. Apenas uma verificação completa retorna `uploaded`, contagens e recibo. Uma segunda execução com conteúdo equivalente retorna `already-synced`, sem novas escritas, e pode recuperar o recibo.

UUIDs, ownership, relações, nomes em snapshot, prescrição, cargas, reps, booleanos, criação dos templates/exercícios/associações e início/fim das sessões são preservados. O PostgreSQL controla `updated_at`, como já definido na Cloud Foundation: o horário original de última edição local não pode ser recuperado desse campo após o round-trip. Na restauração, `updated_at` de exercícios/templates/associações recebe o marcador remoto. Não se alterou o trigger para fingir uma versão remota baseada no relógio do celular.

Sessões e seus filhos não têm `created_at`/`updated_at` no SQLite v5. Para o primeiro INSERT remoto, usam `started_at` da sessão como criação e início/fim como metadata de origem; o servidor define seu próprio `updated_at`. Esses metadados sintéticos não participam da comparação de igualdade de domínio. Datas importadas são normalizadas para ISO UTC, com a precisão em milissegundos usada pelo app. Nomes históricos nunca são reconstruídos a partir do template atual.

## Por que existe um recibo

Sem mudar o schema aplicado, seis chamadas REST não formam uma transação remota única. Uma falha pode deixar exercícios/treinos enviados e sessões ainda ausentes; FKs válidas, sozinhas, não distinguem esse estado de uma conta que nunca treinou.

O upload verificado retorna um recibo `{ version, userId, counts, sha256 }`. O SHA-256 é calculado sobre a representação determinística do snapshot remoto completo, incluindo seus timestamps e tombstones. A restauração exige o recibo e verifica se ele corresponde exatamente ao remoto consultado. Ele contém apenas UUID da conta, contagens e hash; não contém token, senha, PIN ou registros de treino. É um comprovante de integridade operacional, não uma credencial ou assinatura de autorização; RLS/sessão continuam sendo a segurança real.

Guarde o recibo junto ao teste de transferência. Se o perder, repetir upload na origem com os mesmos dados retorna `already-synced` e outro recibo correspondente. Se o remoto ou os dados da origem tiverem mudado, a fase atual retorna conflito; não invente recibos nem apague dados para contornar isso. Um manifesto/commit remoto transacional persistido poderá substituir a transferência manual do recibo em outra fase.

## Download/restauração

O destino deve ter o schema SQLite inicializado e o catálogo padrão, mas nenhum registro privado da conta atual nas seis tabelas. Pode conter dados de outras contas; eles não são tocados.

A operação lê o remoto somente pela identidade atual, valida ownership/relações/catálogo e faz uma segunda leitura finita para detectar alterações durante o download. Antes de gravar, compara hash, contagens e usuário com o recibo. Dentro de uma única transação local, verifica novamente a ausência de dados da conta/legados, insere em ordem de FKs e confere novamente a sessão. Qualquer erro, colisão de UUID ou troca de conta reverte toda a importação. Não usa `INSERT OR REPLACE` nem limpa tabelas.

Tombstones não viram linhas privadas vivas no SQLite. Referências opcionais a templates/exercícios excluídos viram NULL, preservando os snapshots. Filhos de sessões excluídas e associações de origens excluídas são omitidos. Um catálogo desconhecido/relacionamento inválido bloqueia a restauração em vez de fabricar dados. Mudanças remotas posteriores ao recibo, inclusive deleções, retornam `receipt-mismatch`; a projeção de tombstones não autoriza aceitar um backup diferente silenciosamente.

Sessões ativas são incluídas e voltam como ativas; a Home continua usando seu fluxo atual de “Continuar treino”. Nada é finalizado ou iniciado automaticamente.

## Estados e limites

| Situação | Resultado |
| --- | --- |
| Upload: local com dados, remoto vazio | `uploaded` + recibo após verificação |
| Upload: dois lados equivalentes | `already-synced` + recibo, sem escrita |
| Upload: remoto contém dados diferentes, extras, tombstones ou upload parcial | `conflict / both-have-data` |
| Restore: conta local já contém dados | `conflict / local-not-empty` |
| Dados legados sem vínculo | `conflict / legacy-data` |
| Restore sem recibo, com dados remotos vivos | `conflict / receipt-required` |
| Recibo de outra conta/dataset ou desatualizado | `conflict / receipt-mismatch` |
| Dados mudam durante a operação | `conflict / local-changed` ou `remote-changed` |
| Nenhum dado a transferir/restaurar | `empty` |
| Rede/Auth/SQL inválido | Promise rejeitada; importação local revertida; upload pode ter deixado registros parciais |

O gatilho bloqueia execuções simultâneas no mesmo runtime. Não edite dados em outros aparelhos ou no Dashboard enquanto transfere; as duas leituras não são um snapshot transacional global nem um lock distribuído. Edições posteriores ao upload não são sincronizadas por esta fase.

Em falha de upload, conserve o aparelho de origem. Não há retry automático (inclusive o retry de consultas PostgREST está desabilitado), remoção de uploads parciais, merge ou retomada automática. A próxima execução informa o conflito; não apresenta o conjunto parcial como backup completo. As operações não registram credenciais ou payloads no console.

## Testar troca de aparelho sem apagar a origem

Use uma conta de teste normal, com as migrations da Cloud Foundation aplicadas. As variáveis públicas existentes bastam; não é necessário CLI, token administrativo ou `service_role`. Para o primeiro teste, essa conta deve estar vazia no remoto. Não execute exclusões no Dashboard para forçar esse estado em uma conta com dados importantes.

1. No computador, na raiz do projeto, execute `npm start`. Abra o app no Expo Go do aparelho de origem, entre na conta de teste A e aguarde a Home. Crie um personalizado e um treino com exercício padrão + personalizado; conclua uma sessão e, opcionalmente, deixe outra ativa. Pare de editar durante a transferência.
2. Pressione `j` no terminal do Expo para abrir React Native DevTools. Se houver vários aparelhos, selecione o runtime da origem. No Console execute:

   ```javascript
   var initialUpload = await globalThis.__ACADEMIA_INITIAL_SYNC__.upload();
   initialUpload
   ```

3. Confirme `status: 'uploaded'` ou `'already-synced'` e confira as seis contagens. Obtenha e guarde o JSON do recibo:

   ```javascript
   JSON.stringify(initialUpload.receipt)
   ```

4. Repetir `upload()` imediatamente deve retornar `already-synced`, sem duplicar dados. Não crie/edite novos registros depois de obter o recibo para este teste.
5. Abra o mesmo projeto em um **segundo aparelho ou instalação limpa de teste**, entre na mesma conta A e aguarde a Home vazia. Não desinstale nem limpe o armazenamento da origem; o segundo aparelho permite validar a recuperação primeiro. O login cria/restaura a sessão Auth e o catálogo local; ainda não importa treinos automaticamente.
6. Abra DevTools para o runtime do destino. Cole o objeto JSON real obtido no passo 3 em uma variável e execute:

   ```javascript
   var initialReceipt = /* cole aqui o objeto JSON do recibo */;
   var initialRestore = await globalThis.__ACADEMIA_INITIAL_SYNC__.restore(initialReceipt);
   initialRestore
   ```

   Substitua o comentário pelo objeto; não informe PIN/token nesse console. Deve retornar `restored` e as contagens. Se retornar conflito, examine `reason`; não há opção de sobrescrever dados nesta fase.

7. Saia da aba Home e volte, ou recarregue o app, para os hooks existentes relerem SQLite. Confira personalizado, treino/prescrição, histórico e séries/cargas; se havia sessão ativa, confira “Continuar treino”. Feche/reabra para conferir persistência. Com o bundle já carregado, teste o domínio sem rede, como antes.
8. No destino, saia de A e entre em B: os dados de A não devem aparecer. Volte a A: os mesmos UUIDs e dados permanecem. Repetir `restore(initialReceipt)` em A já populada deve retornar `local-not-empty`.

O gatilho é exclusivo de desenvolvimento (`__DEV__`). Não aparece em build de produção e não acrescenta UX. Os exports `createInitialSync` e `createSupabaseInitialSyncRemote` podem ser integrados futuramente a um fluxo explícito de produto.

## Validação automatizada

`tests/initial-sync.test.ts` usa repositories/migrations SQLite reais, o SDK Supabase real e PostgreSQL/PGlite com as migrations da Cloud Foundation e papel `authenticated`. O adapter HTTP de teste emula somente a parte de PostgREST usada aqui e a sessão Auth; as FKs, policies, unicidades, timestamps e upserts executam SQL real. O servidor de teste limita páginas a dois registros para comprovar a paginação completa de séries/histórico.

Há cobertura de upload completo, UUIDs, segunda execução, restauração, snapshots após renomear template, personalizado, catálogo não duplicado, isolamento A/B, sessão ativa, conflitos, alterações locais durante download, legados, logout durante importação, rollback por erro tardio/colisão, falha parcial sem retry e recibo invalidado por tombstone.

Não foi executado login/write em contas reais nesta implementação: não há sessão de usuário de teste disponível ao executor. A sessão no Expo Go não é acessível ao terminal. O roteiro acima testa as mesmas funções contra o projeto real usando somente a sessão normal do usuário.

Checks finais desta entrega: TypeScript aprovado; ESLint sem warnings; 92/92 testes aprovados (12 do Initial Sync); Expo Doctor 20/20; `expo install --check` com dependências alinhadas; `git diff --check` aprovado. Não houve alterações em dependências, migrations, regras de treino ou autenticação.

## Próxima fase

Ficam pendentes manifesto remoto/commit de upload, retomada de parcial, fila durável local, captura de mutations/deleções, merge/conflitos entre aparelhos, envio de mudanças posteriores, sincronização automática/background, realtime, retries e polling. Arquivos de imagem não são transferidos: `image_uri` é preservado como metadata, mas caminhos locais não passam a existir em outro aparelho. Nenhum esquema ou comportamento de treino foi alterado para simular essas capacidades.

Referências: [upsert no Supabase](https://supabase.com/docs/reference/javascript/upsert) e [contrato da Cloud Foundation](cloud-foundation.md).
