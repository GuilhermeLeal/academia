# Arquitetura — fundação e biblioteca de exercícios

## Limites desta etapa

O projeto é exclusivamente mobile. A fase 2 adiciona uma biblioteca local funcional; Home e prévia de treino continuam demonstrativas. O código não cria usuários nem registros de treino. A infraestrutura obrigatória custa R$ 0: nenhum serviço é provisionado e o teste Android ocorre por Expo Go na rede local.

## UI e navegação

`app/` contém apenas layouts/rotas. As telas ficam em `src/features`, e os componentes base em `src/components`. Não há estado global, biblioteca de formulários, ORM ou camada genérica de repositórios. A Home lê fixtures constantes; o botão principal abre uma tela explícita de prévia. Histórico permanece vazio, sem importar demonstrações como registros reais.

O tema é sempre escuro, incluindo o tema de navegação. `colors.json` é a fonte de cores tanto para Expo config quanto para componentes; `tokens.ts` concentra as demais medidas. Tipografia nativa, área segura, rolagem em telas pequenas, botões com altura mínima de 56 e textos com escala de acessibilidade preservada. Ícones têm importação direta de Ionicons.

## Persistência local

Banco `academia.db` por `SQLiteProvider`. Inicialização assíncrona, WAL, foreign keys, migrations transacionais e `user_version = 2`. Os componentes de domínio são montados após a inicialização; não há consultas concorrentes enquanto a transação inicial está aberta. Uma versão de banco maior que a conhecida é rejeitada, sem downgrade automático ou exclusão de dados.

A migration 1 de `app_metadata(key, value)` permanece intacta. A migration 2, `src/db/migrations/002-exercises.ts`, cria `exercises`, `exercise_aliases` e o índice `(normalized_name, id)`. Estrutura, seed e incremento de versão são aplicados na mesma transação. Atualizar da versão 1 preserva os metadados existentes. Novas versões deverão adicionar migrations explícitas e ordenadas, preservando os dados existentes. Nunca editar uma migration já distribuída para mudar o schema. Consultas com entrada do usuário utilizam parâmetros, não interpolação SQL.

## Biblioteca de exercícios — fase 2

Entrada em Treinos, com rotas internas `/exercises`, `/exercises/new` e `/exercises/[id]`; as quatro abas continuam iguais. O módulo `features/exercises` contém modelo, normalização, seed, funções de persistência, hook de busca e telas. Não há camada genérica de repositórios nem novas dependências.

O modelo exposto tem `id`, `name`, `normalizedName`, `muscleGroup`, `equipment`, `imageUri`, `isCustom`, `createdAt`, `updatedAt`. SQL usa snake_case e inteiro 0/1, convertidos no módulo. Equipamento e imagem podem ser nulos. IDs padrão são UUIDs estáveis; IDs personalizados são UUIDs v4 gerados com `randomblob` do SQLite, exclusivamente como identificadores de dados, sem função de segredo. Timestamps são ISO UTC. Não há unicidade por nome: pessoas podem criar variações com o mesmo nome.

Aliases ficam em tabela separada, com chave composta por exercício e alias normalizado. O seed inclui 19 exercícios e usa `ON CONFLICT DO NOTHING`, sem substituir linhas. Ele roda na migration 2 e pode ser reaplicado sem duplicação, mas não é reexecutado a cada abertura normal. Mudanças futuras de catálogo devem usar nova migration.

Normalização por Unicode NFD, remoção de marcas, lowercase e espaços uniformes. A consulta divide a pesquisa em termos; cada termo precisa estar no nome ou em algum alias daquele exercício. `EXISTS` evita resultados duplicados. `instr` mantém curingas e aspas literais. Ordenação prioriza nome exato, prefixo e depois nome normalizado/ID. O índice apoia ordenação; busca por trecho ainda varre o pequeno catálogo, decisão apropriada para centenas de registros. Paginação/FTS deverão ser avaliados por medição se o volume crescer muito.

`FlatList` renderiza uma janela de cards com keys por UUID e cards memoizados. A consulta retorna os registros correspondentes; não há limite silencioso que esconda exercícios. A busca fica fixa acima da lista. Textos podem crescer com acessibilidade; não se assume altura fixa em `getItemLayout`. O debounce de 100 ms limita consultas enquanto se digita. Cleanup descarta respostas de consultas anteriores e de telas sem foco. Ao voltar à biblioteca, a consulta é refeita; após salvar, abre-se uma pesquisa pelo nome salvo.

Criação e edição validam nome/grupo obrigatórios e comprimentos também fora da UI. O formulário mantém os campos em caso de erro, bloqueia envio concorrente e confirma sucesso retornando à biblioteca após a escrita. O `UPDATE` só afeta `is_custom = 1`; catálogo padrão aparece em detalhes somente leitura. ID, data de criação e imagem são preservados na edição. Gravações são comandos atômicos, sem transação longa durante a interação.

`imageUri` é suportado pelo componente de miniatura, incluindo fallback em erro; seed e formulário não fornecem/downloadam imagens. Filtros, exclusão e edição de aliases estão fora desta fase. Os personalizados são locais à instalação e ainda não são separados por conta. Limpar dados/desinstalar pode apagá-los; não há backup/sincronização implementados.

Futuramente SQLite será a fonte imediata para a sessão ativa, séries/cargas, cache de exercícios e alterações pendentes. Isso ainda não existe. A inicialização é uma base, não uma promessa de resiliência offline do produto pronto.

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
