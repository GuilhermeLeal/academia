# Sync Engine incremental

Esta fase mantém o SQLite como fonte imediata da interface e usa o Supabase somente de forma assíncrona. Ela reutiliza integralmente o schema, RLS, UUIDs, timestamps e tombstones da Cloud Foundation e não acrescenta migration remota.

## Rastreamento local

A migration SQLite 6 cria quatro tabelas técnicas, todas particionadas por `user_id`:

- `sync_changes`: outbox coalescida por `(user_id, table_name, entity_id)`, com operação `upsert/delete` e `generation` monotônica;
- `sync_checkpoints`: cursor de pull por usuário e tabela;
- `sync_entity_state`: último `updated_at` confirmado/observado e estado de tombstone por entidade;
- `sync_suppression`: marcador transacional usado somente enquanto mudanças remotas são aplicadas localmente.

Triggers `AFTER INSERT/UPDATE/DELETE` nas seis tabelas privadas alimentam a outbox dentro da mesma transação da escrita de negócio. Portanto, uma queda do app não separa a alteração de sua pendência. Atualizações repetidas são coalescidas sem varrer ou comparar o banco inteiro. O `generation` impede que a confirmação de um envio antigo remova uma edição mais nova feita durante o request. A migration preserva todas as linhas v5 e não as reinsere.

## Push e retry

O push lê somente a fila do usuário autenticado e envia upserts na ordem `exercises → workouts → workout_exercises → workout_sessions → session_exercises → session_sets`. Exclusões são tombstones e usam a ordem inversa. UUID e ownership são preservados; o adapter usa a sessão pública normal, confirma a identidade antes/depois das operações e continua submetido a RLS.

Cada item só sai da outbox depois que o Supabase devolve a linha confirmada. Falha de rede, encerramento do app ou erro remoto deixa a pendência intacta. Repetir um upsert usa conflito por `id`; repetir tombstone é um update idempotente. Se uma criação local for apagada antes de chegar ao servidor, a ausência remota também confirma que nada ficou para remover.

## Pull e checkpoint

Cada tabela é consultada por `user_id` e `updated_at >= checkpoint`, incluindo tombstones, paginada e ordenada por `updated_at, id`. Todas as páginas são obtidas antes de qualquer escrita local. As seis coleções são então aplicadas em uma única transação SQLite: tombstones em ordem inversa de FKs e linhas vivas em ordem normal. Snapshots de sessão continuam intactos; apagar um treino usa o `ON DELETE SET NULL` local para preservar seu histórico.

O checkpoint só é gravado dentro dessa mesma transação, depois de todas as linhas. Qualquer falha de download ou aplicação conserva os seis checkpoints anteriores. O cursor salvo mantém uma sobreposição de cinco minutos; `sync_entity_state` elimina reaplicações. Essa janela trata commits concorrentes cujo timestamp foi atribuído pouco antes de ficarem visíveis e torna releituras seguras. Não há polling nem Realtime.

## Conflitos

A regra é determinística: **local pending wins; otherwise newer remote wins**.

Uma linha remota nunca sobrescreve uma entidade que ainda esteja na outbox local. O push local ocorre primeiro e recebe um novo `updated_at` do servidor; o pull seguinte registra essa versão como base. Assim, para a mesma entidade editada offline em dois aparelhos, vence a última alteração local que for confirmada pelo servidor, sem perder silenciosamente a edição pendente. Tombstone versus edição segue a mesma regra: uma edição local pendente pode ressuscitar a entidade; um tombstone local pendente prevalece sobre uma edição remota. Sem pendência, somente um `updated_at` remoto posterior ao conhecido é aplicado.

Conflitos estruturais diferentes — por exemplo duas sessões ativas com IDs distintos — continuam protegidos pela constraint remota. A segunda escrita permanece na outbox e será tentada depois; o treino local não é bloqueado nem apagado.

## Execução

`IncrementalSyncProvider` monta depois da preparação local da conta e dispara em background:

- após login ou restauração de sessão;
- quando o app volta a `active`;
- 1,5 s depois de alterações relevantes, coalescendo novos sinais;
- novamente quando um sinal chega durante uma execução.

Erros são silenciosos para a UX e deixam a outbox para o próximo gatilho. Iniciar, registrar séries e finalizar treino nunca aguarda rede. Logout desmonta o worker e invalida o adapter, mas não remove dados, fila ou checkpoints da conta.

## Teste manual com dois aparelhos

1. Instale a mesma build nos aparelhos A e B, configure a mesma URL/chave pública e entre na mesma conta.
2. No A, crie um exercício personalizado e um treino. Ative modo avião, inicie o treino, registre séries e finalize. Feche e reabra o app ainda offline; confirme que treino e histórico continuam presentes.
3. Reative a rede no A, abra o app e aguarde alguns segundos. Coloque o app em background e foreground uma vez para forçar outro retry.
4. Abra o B com rede. Após login/foreground, confirme exercício, treino e histórico, inclusive pesos/repetições e snapshots de nomes.
5. Edite o nome do treino no B; leve o app a background/foreground. No A, faça o mesmo e confirme a chegada da edição.
6. Para conflito, deixe ambos offline, edite o mesmo treino com nomes diferentes, conecte A e depois B. Ao final, ambos devem convergir para a edição de B, pois foi a última pendência confirmada.
7. Exclua o treino em um aparelho, sincronize e abra o outro. O template deve sumir, mas a sessão concluída e seu snapshot devem permanecer.
8. Saia e entre com outra conta no mesmo aparelho. Crie dados offline na conta B, volte à A e sincronize. Nada de B pode aparecer ou ser enviado por A; ao voltar à B, sua pendência deve continuar disponível.

Para observar o ciclo no Supabase, filtre cada tabela por `user_id`, confira UUIDs e `updated_at/deleted_at`. Não use `service_role` no app ou neste roteiro.
