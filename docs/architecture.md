# Arquitetura — fundação, exercícios, treinos, execução e histórico local

## Limites desta etapa

O projeto é exclusivamente mobile. A fase 2 adicionou a biblioteca local, a fase 3 os templates, a fase 4 a execução básica e a fase 5 o histórico no SQLite. A Home mostra uma sessão ativa ou um treino real; ritmo/progresso semanal continuam demonstrativos. Não há criação de usuários, sincronização, estatísticas ou calendário. A infraestrutura obrigatória custa R$ 0: nenhum serviço é provisionado e o teste Android ocorre por Expo Go na rede local.

## UI e navegação

`app/` contém apenas layouts/rotas. As telas ficam em `src/features`, e os componentes base em `src/components`. Não há estado global, biblioteca de formulários, ORM ou camada genérica de repositórios. A Home consulta treinos ao ganhar foco e abre o detalhe do primeiro salvo; fixtures constantes permanecem apenas no ritmo/progresso semanal, com identificação de demonstração. Histórico consulta exclusivamente sessões reais concluídas; demonstrações nunca viram registros.

O tema é sempre escuro, incluindo o tema de navegação. `colors.json` é a fonte de cores tanto para Expo config quanto para componentes; `tokens.ts` concentra as demais medidas. Tipografia nativa, área segura, rolagem em telas pequenas, botões com altura mínima de 56 e textos com escala de acessibilidade preservada. Ícones têm importação direta de Ionicons.

Microinterações usam somente `Animated`, `LayoutAnimation` e transições do Stack já disponíveis no React Native/Expo. Pressões combinam opacidade e escala curta; confirmações entram com fade/deslocamento; checks, cards concluídos e a barra de progresso mudam em 90–220 ms. Um hook compartilhado observa `AccessibilityInfo.reduceMotionChanged`: com redução de movimento ativa, transformações e transições de layout são removidas e mudanças de estado permanecem imediatas. Listas longas não executam animações de layout; esse recurso fica restrito às listas curtas de exercícios do editor e séries detalhadas.

## Persistência local

Banco `academia.db` por `SQLiteProvider`. Inicialização assíncrona, WAL, foreign keys, migrations transacionais e `user_version = 4`. Os componentes de domínio são montados após a inicialização; não há consultas concorrentes enquanto a transação inicial está aberta. Uma versão de banco maior que a conhecida é rejeitada, sem downgrade automático ou exclusão de dados.

A migration 1 de `app_metadata(key, value)` permanece intacta. A migration 2, `src/db/migrations/002-exercises.ts`, cria `exercises`, `exercise_aliases` e o índice `(normalized_name, id)`. Estrutura, seed e incremento de versão são aplicados na mesma transação. Atualizar da versão 1 preserva os metadados existentes. Novas versões deverão adicionar migrations explícitas e ordenadas, preservando os dados existentes. Nunca editar uma migration já distribuída para mudar o schema. Consultas com entrada do usuário utilizam parâmetros, não interpolação SQL.

## Biblioteca de exercícios — fase 2

Entrada em Treinos, com rotas internas `/exercises`, `/exercises/new` e `/exercises/[id]`; as quatro abas continuam iguais. O módulo `features/exercises` contém modelo, normalização, seed, funções de persistência, hook de busca e telas. Não há camada genérica de repositórios nem novas dependências.

O modelo exposto tem `id`, `name`, `normalizedName`, `muscleGroup`, `equipment`, `imageUri`, `isCustom`, `createdAt`, `updatedAt`. SQL usa snake_case e inteiro 0/1, convertidos no módulo. Equipamento e imagem podem ser nulos. IDs padrão são UUIDs estáveis; IDs personalizados são UUIDs v4 gerados com `randomblob` do SQLite, exclusivamente como identificadores de dados, sem função de segredo. Timestamps são ISO UTC. Não há unicidade por nome: pessoas podem criar variações com o mesmo nome.

Aliases ficam em tabela separada, com chave composta por exercício e alias normalizado. O seed inclui 19 exercícios e usa `ON CONFLICT DO NOTHING`, sem substituir linhas. Ele roda na migration 2 e pode ser reaplicado sem duplicação, mas não é reexecutado a cada abertura normal. Mudanças futuras de catálogo devem usar nova migration.

Normalização por Unicode NFD, remoção de marcas, lowercase e espaços uniformes. A consulta divide a pesquisa em termos; cada termo precisa estar no nome ou em algum alias daquele exercício. `EXISTS` evita resultados duplicados. `instr` mantém curingas e aspas literais. Ordenação prioriza nome exato, prefixo e depois nome normalizado/ID. O índice apoia ordenação; busca por trecho ainda varre o pequeno catálogo, decisão apropriada para centenas de registros. Paginação/FTS deverão ser avaliados por medição se o volume crescer muito.

`FlatList` renderiza uma janela de cards com keys por UUID e cards memoizados. A consulta retorna os registros correspondentes; não há limite silencioso que esconda exercícios. A busca fica fixa acima da lista. Textos podem crescer com acessibilidade; não se assume altura fixa em `getItemLayout`. O debounce de 100 ms limita consultas enquanto se digita. Cleanup descarta respostas de consultas anteriores e de telas sem foco. Ao voltar à biblioteca, a consulta é refeita; após salvar, abre-se uma pesquisa pelo nome salvo.

Criação e edição validam nome/grupo obrigatórios e comprimentos também fora da UI. O formulário mantém os campos em caso de erro, bloqueia envio concorrente e confirma sucesso retornando à biblioteca após a escrita. O `UPDATE` só afeta `is_custom = 1`; catálogo padrão aparece em detalhes somente leitura. ID, data de criação e imagem são preservados na edição. Gravações são comandos atômicos, sem transação longa durante a interação.

`imageUri` é suportado pelo componente de miniatura, incluindo fallback em erro; seed e formulário não fornecem/downloadam imagens. Filtros, exclusão e edição de aliases estão fora desta fase. Os personalizados são locais à instalação e ainda não são separados por conta. Limpar dados/desinstalar pode apagá-los; não há backup/sincronização implementados.

SQLite já é a fonte imediata para biblioteca, templates, sessão ativa e séries/cargas. Cache remoto, fila de alterações e sincronização ainda não existem. A persistência local atual não representa, sozinha, a resiliência offline do produto pronto.

## Treinos personalizados — fase 3

Rotas internas `/workout/new`, `/workout/[id]` e `/workout/[id]/edit`, sem nova aba. A aba Treinos usa `FlatList` com UUIDs estáveis e mantém acesso à biblioteca. O formulário e os detalhes usam os componentes base e tokens existentes; exercícios de um treino são uma lista curta rolável, sem biblioteca de drag-and-drop. Setas sobem/descem um exercício por vez, desabilitadas nas extremidades.

A migration 3 (`003-workouts.ts`) cria:

| Tabela | Dados e integridade |
| --- | --- |
| `workouts` | UUID, `name`, `description` opcional, `created_at`, `updated_at` |
| `workout_exercises` | UUID, `workout_id`, `exercise_id`, `position`, `sets`, `reps_min`, `reps_max`, `rest_seconds`, timestamps |

IDs seguem o UUID v4 local das fases anteriores. `workout_id` usa `ON DELETE CASCADE`; `exercise_id` usa `ON DELETE RESTRICT`. São únicos `(workout_id, exercise_id)` e `(workout_id, position)`. Posição começa em zero; a UI mostra a partir de um. Índices apoiam acesso por exercício e ordenação de treinos por criação/UUID. Não há seed de treinos nem alterações nas migrations 1/2.

O módulo valida nome não vazio (até 100 caracteres), descrição até 1.000, séries/reps inteiras positivas, mínimas ≤ máximas, descanso inteiro ≥ 0 e ausência de duplicados. Constraints SQL repetem os invariantes estruturais. Um treino vazio é permitido para preenchimento posterior. `10/10` é apresentado como `10 reps`; `8/10`, como `8–10 reps`.

Persistência usa funções específicas do módulo, SQL parametrizado e transações para cabeçalho + associações. `db/writeTransaction.ts` abre uma conexão própria no mesmo caminho do provider, configura `foreign_keys = ON` e `busy_timeout` **antes** da transação e fecha em `finally`. Foreign keys pertencem à conexão; habilitá-las dentro de `BEGIN` não funcionaria. A conexão dedicada também impede que consultas de outras telas sejam incluídas acidentalmente na transação de escrita. Falhas desfazem nome, remoções, posições e configurações juntos.

Na edição, associações mantidas preservam UUID e data de criação. Posições são deslocadas temporariamente para fora do intervalo final antes de gravar a nova ordem, evitando colisões com a restrição única; tudo ocorre na mesma transação. Remover um exercício exclui só a associação. Excluir um treino elimina suas associações, preservando exercícios e outros treinos. Duplicação copia nome com ` - Cópia` (respeitando o limite), descrição, ordem e configurações, gerando novos UUIDs.

O formulário reutiliza `LibraryContent` em modo de seleção dentro de um `Modal` nativo, com a mesma pesquisa SQLite, placeholders e `FlatList` da fase 2. Itens selecionados ficam marcados e desabilitados; o rascunho e a persistência também rejeitam duplicados. O botão Voltar do seletor fecha somente a seleção. Exercícios personalizados são criados/editados pelo fluxo existente da biblioteca; dentro do seletor apenas se escolhem exercícios existentes.

O rascunho é estado local do formulário, sem escrita enquanto se digita. A seleção inclui valores iniciais editáveis (3 séries, 8–12 reps, 60 segundos), sem recomendação ou progressão automática. Salvar valida e bloqueia envios repetidos; erros preservam os campos. Sair com alterações pede confirmação dentro da tela. Rascunhos não sobrevivem ao encerramento do processo; os treinos salvos sobrevivem à reabertura. Exclusão exige confirmação na própria tela.

Lista, detalhe e Home refazem a consulta ao ganhar foco, descartando respostas antigas no cleanup. O editor carrega os dados uma vez por abertura para não sobrescrever o rascunho ao voltar do seletor. A Home escolhe o primeiro treino por `created_at, id`, sem agenda, duração estimada, calendário ou lógica de dias. Renomear um exercício personalizado na biblioteca reflete nos detalhes do treino pela associação, sem copiar o catálogo.

Templates e sessões pertencem à instalação, sem separação por usuário nem backup; Supabase continua intacto e inativo nesta feature.

## Execução básica — fase 4

Rotas internas `/session/[id]` e `/session/[id]/summary` exibem a sessão ativa e o resumo. O detalhe do template inicia a sessão; a Home consulta primeiro a sessão ativa e substitui o card normal por **Continuar treino**. Sair da tela não encerra a sessão. Não existe nova aba nem estado global.

A migration 4 (`004-workout-sessions.ts`) cria:

| Tabela | Dados e integridade |
| --- | --- |
| `workout_sessions` | UUID, referência opcional ao template, nome em snapshot, início/fim e status |
| `session_exercises` | referência opcional ao exercício, nome em snapshot, ordem e configuração planejada |
| `session_sets` | número da série, carga decimal opcional, reps inteiras opcionais e conclusão |

Um índice parcial único sobre o status `active` impede duas sessões ativas inclusive se duas ações concorrerem. `status` e `finished_at` têm constraint conjunta. Posições/números são inteiros válidos, carga é não negativa e conclusão é 0/1. A migration 4 aceitava reps não negativas; sem alterar a migration distribuída, a regra atual do serviço exige reps realizadas inteiras maiores que zero. Associações internas usam cascade; referências ao template e catálogo usam `ON DELETE SET NULL`. Os snapshots textuais mantêm a sessão legível após renomear ou excluir dados de origem.

`startWorkoutSession` executa em uma transação dedicada: verifica sessão ativa, lê o template ordenado, grava sessão/exercícios e cria as séries planejadas. Templates vazios não iniciam. Nome, exercício, ordem, séries, faixa de reps e descanso ficam copiados; futuras edições no template não alteram a sessão. Séries extras incrementam `set_number`, sem modificar `planned_sets`.

Na mesma transação de início, `getLastCompletedExerciseSets` procura a ocorrência mais recente de cada `exercise_id` em qualquer sessão com status `completed`, ordenada por `finished_at`. O workout de origem não participa da prioridade. A ocorrência precisa conter ao menos uma série concluída com reps positivas; sessões ativas e exercícios não executados são ignorados. Somente séries realmente concluídas são copiadas por `set_number`, preservando carga decimal e zero, sempre com `completed = 0` na nova sessão. Se faltarem posições no histórico, as séries correspondentes permanecem vazias; posições excedentes são ignoradas.

O preenchimento acontece uma única vez, durante a criação dos novos `session_sets`. Releituras da sessão não consultam o histórico e não substituem edições atuais. Resultados uniformes alimentam diretamente os campos do modo rápido; resultados diferentes continuam nos mesmos registros e aparecem no modo detalhado como **Personalizado**. Não existe cache paralelo de “última carga”, sugestão de progressão ou mutação de sessões históricas. Quando houver usuários, essa consulta deverá incluir o proprietário da sessão para manter o isolamento; autenticação não faz parte desta etapa.

A tela ativa mostra um card compacto por exercício: nome, `séries × faixa planejada`, carga/reps rápidas, conclusão e seta de detalhe. Não mostra tabela, descanso ou séries extras. `applyQuickExerciseResult` valida carga/reps e atualiza, numa transação, somente os `session_sets` cujo `set_number <= planned_sets`; cada série recebe o resultado específico e fica concluída. A faixa planejada nunca é convertida em resultado. Desmarcar altera somente `completed`, preservando valores.

O estado do card é derivado dos próprios `session_sets`, sem coluna ou armazenamento paralelo. Se todas as séries, inclusive extras, têm os mesmos valores, o card pode exibi-los. Qualquer diferença ou preenchimento parcial produz **Personalizado**. Antes de substituir séries planejadas com valores diferentes, o repositório lança `PersonalizedResultsError`; a UI pede confirmação inline. Mesmo após confirmação, séries extras não são alteradas.

A seta abre `/session/[id]/exercise/[exerciseId]`. Essa tela reutiliza `SessionSetRow`, edita cada `session_set`, permite marcar/desmarcar individualmente e concentra **Adicionar série**. Escritas válidas são enfileiradas na ordem digitada. Carga aceita ponto/vírgula e zero; vazio vira `NULL`. Reps vazias viram `NULL`, desmarcam a linha e precisam ser inteiras maiores que zero para concluir. Ao voltar, o hook focado relê o SQLite e o card reflete o estado uniforme ou personalizado.

O timer visual calcula `agora - started_at` a cada segundo. Após suspensão ou navegação, o próximo cálculo usa o timestamp real, sem tentar manter um cronômetro nativo em background. Não há timer de descanso, notificações ou automação.

Ao finalizar, a fila de campos é drenada e uma transação conta séries concluídas, define `finished_at` e muda o status. Zero séries exige confirmação inline. O resumo mostra duração, quantidade de exercícios e séries concluídas; a linha completa permanece no banco e passa a integrar o Histórico. Não há edição de sessão concluída. A conclusão libera o índice para iniciar outra sessão.

## Histórico de treinos — fase 5

A aba Histórico usa `FlatList`, refaz a consulta ao ganhar foco e mostra somente `workout_sessions.status = 'completed'`, ordenadas por `finished_at`, `started_at` e UUID em ordem decrescente. Cada card usa `workout_name`, timestamps e agregações das séries concluídas. Um exercício é contado como realizado apenas quando possui ao menos um `session_set.completed = 1`; a quantidade de séries segue a mesma condição. Sessões finalizadas sem séries continuam visíveis com totais zero. Sessões ativas nunca aparecem.

A rota interna `/history/[id]` é somente leitura. O detalhe consulta a sessão concluída, seleciona exercícios que possuam resultados e carrega somente séries concluídas em ordem de exercício/número. Carga `NULL` permanece sem peso inventado; carga zero e decimais são preservados. Data e horários usam o fuso do dispositivo, e a duração deriva exclusivamente de `started_at`/`finished_at`.

O histórico não consulta `workouts`, `workout_exercises` ou o nome atual em `exercises`. Ele lê `workout_name`, `exercise_name`, ordem, carga e reps armazenados no snapshot da sessão. Assim, renomear, reordenar ou excluir o template/catálogo depois da conclusão não modifica o que foi executado. As três tabelas da migration 4 já continham todos esses dados; `user_version` permanece 4 e nenhuma migration ou dependência foi necessária.

## Nuvem

Supabase/PostgreSQL está previsto para contas, treinos, exercícios, histórico, estatísticas e sincronização entre dispositivos. Storage será considerado quando imagens forem necessárias. Não há schema de negócio ou recursos criados na nuvem nesta etapa. `database.types.ts` representa deliberadamente um schema vazio e deverá ser substituído pelos tipos gerados do projeto real na primeira migration remota.

`getSupabaseClient()` retorna `null` sem ambiente ou lança erro de configuração inválida sem revelar valores. É lazy: a UI atual não chama esse método. A futura integração deve tratar erros, montar `observeSessionRefresh` uma vez e executar o cleanup ao desmontar.

A meta de R$ 0 implica permanecer nas cotas gratuitas do provedor, revisar seus limites antes de ativar recursos e não habilitar serviços pagos automaticamente. Nenhuma disponibilidade ilimitada ou custo futuro é presumido.

## Autenticação: decisão pendente

Cada usuário terá UUID interno (`UserId`), enquanto telefone será um atributo. `AuthService` define restauração, entrada, saída e assinatura de estado, sem importar Supabase nas interfaces. Nenhum adapter real ou falso faz login nesta etapa.

Telefone + PIN de quatro dígitos não deve ser tratado automaticamente como telefone + senha do Supabase Auth. Quatro dígitos têm apenas 10.000 combinações; validar um PIN exclusivamente no cliente não autoriza acesso aos dados remotos. Não usar telefone como e-mail fictício, senha compartilhada, chave primária ou segredo de acesso. Não enviar SMS/OTP nem criar funções remotas para contornar a decisão.

Na fase específica, será necessário definir a identidade inicial, proteção contra tentativas, recuperação, troca de aparelho e como obter uma sessão autorizada respeitando as restrições de custo e ausência de backend próprio. Se a experiência planejada não for compatível com o mecanismo escolhido, documentar o conflito antes de implementar. Uma opção a avaliar será distinguir autenticação remota de desbloqueio local; **não há essa decisão nesta fundação**.

A configuração de sessão está preparada com `persistSession`, renovação em primeiro plano e KV SQLite, mas persistência de um login real ainda não foi testada. KV SQLite não é armazenamento criptografado; a escolha de armazenamento protegido para tokens deve ser revisada na fase de autenticação. Nunca armazenar o PIN em texto puro. Conta atualmente informa corretamente que nenhum perfil está conectado.

Antes de dados reais: policies RLS por `auth.uid()`, isolamento por usuário, ciclo de sessão/logout e limpeza/particionamento do cache local. A visualização familiar não implica compartilhamento automático de dados entre contas.

## Sincronização futura

Sem fila, worker, listeners realtime ou polling agora. Quando necessário, modelar IDs estáveis, alterações pendentes, timestamps, exclusões e estratégia de conflitos. O treino ativo deve continuar localmente e não aguardar respostas remotas a cada série. O contrato concreto será criado junto ao primeiro fluxo real.

## Dependências

Usar `npx expo install` para módulos nativos e conferir `expo-doctor` após mudanças. O Router 57 traz dependências transitivas de navegação e funcionalidades não usadas; não há adição direta de biblioteca de animações no código do app. Overrides fixam React DOM/Reanimated/Worklets às versões da matriz SDK 57 após o npm selecionar versões incompatíveis por peers abertos. Atualizar esses pins ao atualizar o SDK.

ESLint 9 é compatível com o plugin React entregue pela configuração Expo 57, que usa uma API removida no ESLint 10. Revisar essa limitação junto às atualizações upstream. Avisos moderados da auditoria inicial estão documentados no README; não regredir versões do SDK para satisfazer sugestões automáticas.
