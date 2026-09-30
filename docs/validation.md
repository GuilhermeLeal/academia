# Validação — fundação, exercícios, treinos e execução

## Resultado da fase 4

- Migration 4 incremental; versões 1–3 e seus dados preservados.
- `npm run check`: TypeScript e ESLint aprovados; 41/41 testes aprovados (38 anteriores + 3 do fluxo rápido/detalhado).
- `npm run doctor`: 21/21 verificações aprovadas.
- `npm run export:android`: bundle Hermes de produção gerado em `dist/` (não é APK).
- `git diff --check`: aprovado.
- Nenhuma dependência adicionada e nenhum acesso Supabase ativado.
- Teste visual/físico Android pendente por ausência de aparelho/emulador neste ambiente.

Os testes de sessão cobrem upgrade 3 → 4 com rollback; criação/snapshot; sessão única; registros detalhados; modo rápido transacional; carga decimal e zero; reps específicas positivas; conclusão reversível; valores personalizados; proteção contra sobrescrita silenciosa; séries extras; independência do template; finalização/resumo; persistência após reabrir e duração por timestamps.

### Arquivos criados na fase 4

```text
app/session/[id].tsx
app/session/[id]/summary.tsx
src/db/migrations/004-workout-sessions.ts
src/features/workout-session/types.ts
src/features/workout-session/model.ts
src/features/workout-session/repository.ts
src/features/workout-session/useWorkoutSession.ts
src/features/workout-session/SessionSetRow.tsx
src/features/workout-session/ActiveWorkoutScreen.tsx
src/features/workout-session/WorkoutSessionSummaryScreen.tsx
src/features/workout-session/QuickExerciseCard.tsx
src/features/workout-session/DetailedExerciseScreen.tsx
tests/workout-sessions.test.ts
app/session/[id]/exercise/[exerciseId].tsx
```

### Arquivos alterados na fase 4

```text
app/_layout.tsx
src/db/migrations.ts
src/features/workouts/WorkoutDetailScreen.tsx
src/features/workouts/HomeWorkoutCard.tsx
README.md
docs/architecture.md
docs/validation.md
```

## Fase 4 — roteiro Android

1. Preserve os dados do Expo Go para validar o upgrade. Encerre qualquer Metro anterior, execute `npx expo start --clear` e abra o QR no Expo Go SDK 57.
2. Crie ou abra um treino com pelo menos um exercício. No detalhe, toque **Iniciar treino**. Um template vazio deve pedir que exercícios sejam adicionados.
3. Confira nome e timer no topo. Cada exercício deve ter somente nome/seta, planejamento `3 × 8–10`, dois campos e conclusão. Não deve haver tabela, descanso ou série extra na tela principal.
4. No card, digite carga `30,5`, reps `10` e **Concluir exercício**. Abra a seta: as três séries planejadas devem mostrar exatamente `30,5 kg × 10 reps`, concluídas. O intervalo `8–10` permanece apenas no planejamento.
5. Volte, desmarque o exercício e conclua novamente com carga `0` e reps positivas. Zero deve ser aceito. Reps vazias ou `0` devem gerar erro inline.
6. Abra a seta, altere as três séries para `20 × 10`, `15 × 10` e `10 × 12`. Adicione uma série extra `5 × 15`. Volte: o card deve mostrar **Personalizado**, sem fingir uma carga/reps única.
7. Preencha novos valores rápidos no card personalizado. O primeiro toque deve pedir confirmação inline. Cancele e confirme que nada mudou no detalhe. Depois confirme a substituição: somente as três planejadas mudam; a extra permanece `5 × 15`.
8. Use Voltar, navegue pelas abas e abra a Home. Ela deve priorizar **Continuar treino**. Volte e confira valores/checks. Feche/reabra o app e repita a conferência.
9. Com uma sessão ativa, abra outro template. O botão deve continuar a sessão existente; uma segunda não deve ser criada.
10. Em uma sessão sem séries marcadas, toque **Finalizar treino**. Cancele a confirmação e continue; depois confirme. Confira resumo com duração, exercícios e zero séries.
11. Inicie outra sessão, conclua exercícios e finalize. Confira a contagem no resumo e que a Home deixou de mostrar **Continuar treino**. Uma nova sessão agora pode ser iniciada.
12. Teste teclado aberto, rolagem, tela estreita, fonte ampliada, TalkBack e Voltar do Android. Suspenda o app por um minuto: ao retornar, o timer deve corrigir o tempo pelo timestamp, sem notificação ou timer de descanso.

Limites intencionais: não há remoção de série extra, timer de descanso, notificações, processamento avançado em background, listagem histórica, gráficos, streak real, sincronização ou sugestões de progressão. O resumo concluído é somente leitura. Sessões são locais à instalação e ainda não têm usuário.

## Resultado da fase 3

- `npm run check`: TypeScript aprovado, ESLint sem erros/warnings e 28/28 testes aprovados (16 anteriores + 12 de treinos).
- `npm run doctor`: 21/21 verificações aprovadas após alinhar os patches do SDK 57.
- `npm run export:android`: bundle Android Hermes gerado em `dist/` (não é APK).
- `git diff --check`: aprovado.
- Migration 3 incremental, com versões 1/2 e dados existentes preservados.
- Nenhuma dependência nova. Expo, Constants, Linking e Router receberam somente os patches exigidos pelo Doctor, dentro do SDK 57; serviços Supabase preservados.
- Teste visual/físico Android pendente: não há aparelho/emulador disponível neste ambiente.

O servidor Metro anterior foi encerrado porque seu watcher no Windows sobrescrevia os tipos das novas rotas incorretamente. Os tipos foram regenerados pelo gerador oficial do Expo, sem casts de navegação ou edição manual de declarações. Para testar esta versão, reinicie com `npx expo start --clear`.

Os 12 testes novos cobrem upgrade 2 → 3 com rollback e preservação do catálogo; criação e associações ordenadas; validações; edição/reordenação preservando IDs; rollback de criação/edição parcial; constraints e foreign keys; associação a exercícios personalizados; exclusão em cascata sem apagar catálogo/outros treinos; duplicação independente; persistência de criação/edição/exclusão após reabrir arquivo; botões de ordem/formatação de reps; seleção sem duplicação e parsing dos campos numéricos.

### Arquivos criados na fase 3

```text
app/workout/new.tsx
app/workout/[id]/index.tsx
app/workout/[id]/edit.tsx
src/db/migrations/003-workouts.ts
src/db/writeTransaction.ts
src/features/workouts/types.ts
src/features/workouts/model.ts
src/features/workouts/draft.ts
src/features/workouts/repository.ts
src/features/workouts/useWorkoutData.ts
src/features/workouts/WorkoutHeader.tsx
src/features/workouts/WorkoutExerciseFields.tsx
src/features/workouts/WorkoutEditorScreen.tsx
src/features/workouts/WorkoutDetailScreen.tsx
src/features/workouts/HomeWorkoutCard.tsx
tests/workouts.test.ts
```

### Arquivos alterados na fase 3

```text
app/_layout.tsx
src/db/migrations.ts
src/features/workouts/WorkoutsScreen.tsx
src/features/home/HomeScreen.tsx
src/features/exercises/ExerciseLibraryScreen.tsx
src/features/exercises/ExerciseCard.tsx
src/features/exercises/ExerciseHeader.tsx
tests/helpers/sqlite.ts
tests/exercises.test.ts
README.md
docs/architecture.md
docs/validation.md
package.json
package-lock.json
```

## Fase 3 — roteiro Android

1. Preserve os dados do app/Expo Go para validar o upgrade da fase 2. Execute `npx expo start --clear`, abra o QR no Expo Go compatível com SDK 57 e mantenha celular/computador na mesma rede. `.env` continua opcional.
2. Em **Treinos**, confirme o estado vazio e **Criar primeiro treino**, o botão **+ Criar treino** e o acesso à biblioteca. As quatro abas permanecem iguais.
3. Crie `Treino A` com descrição opcional. **Adicionar exercícios** deve abrir a biblioteca existente. Pesquise `supino`, selecione Reto e Inclinado, mude a pesquisa para `remada` e selecione outro. Os selecionados devem ficar marcados e não podem ser adicionados novamente, mesmo com toques rápidos.
4. **Concluir seleção** e o botão Voltar do Android devem fechar apenas o seletor, preservando nome/seleção. Teste também teclado aberto e rolagem. O seletor não cria outra biblioteca nem faz consultas de rede.
5. Configure 3 séries, reps 10/10, descanso 60 no primeiro; reps 8/10, descanso 0 no segundo. Use setas para cima/baixo; extremidades devem estar desabilitadas. Remova um item e confirme posteriormente que continua na biblioteca.
6. Tente salvar nome vazio, séries 0, reps 0, mínima maior que máxima e campo numérico apagado. Deve haver erro na própria tela, sem perda dos campos e sem gravação parcial. Corrija e salve uma única vez; múltiplos toques não devem criar cópias.
7. Nos detalhes, confira nome, descrição, quantidade, ordem, `3 séries × 10 reps`, `8–10 reps` e descanso. O comportamento atual de **Iniciar treino** está no roteiro da fase 4 acima.
8. Entre em **Editar treino**, altere nome/configurações, remova e acrescente um exercício e reordene. Salve e confira os detalhes. Volte à aba Treinos e à Home; devem refletir os dados salvos. A Home usa o primeiro treino por criação, sem agenda.
9. Faça uma alteração no editor e tente sair: **Continuar editando** preserva o rascunho; **Descartar e voltar** retorna sem alterar o banco. Uma nova criação sem salvar também deve ser descartável.
10. Duplique `Treino A`: deve surgir `Treino A - Cópia` com ordem/configurações iguais. Edite a cópia e confirme que o original não mudou.
11. Feche/reabra o app e confirme ambos os treinos e suas configurações. Se disponível, inspecione `academia.db`: versão 3, `workouts`, `workout_exercises`, sem violações em `PRAGMA foreign_key_check`.
12. Exclua a cópia: primeiro cancele e confirme que permanece, depois confirme a exclusão. Original e catálogo devem continuar intactos. Exclua todos os treinos e confira os estados vazios da lista/Home após voltar.
13. Crie um exercício personalizado pela biblioteca e associe-o a um treino. Renomeie o exercício pela biblioteca e confira o nome atualizado no detalhe do treino. Removê-lo do treino não deve apagar o exercício.
14. Teste tela estreita, fonte ampliada, TalkBack e os botões Voltar do app/Android. Com o app carregado, corte a internet mantendo Metro acessível: pesquisa e gravações devem continuar locais.

Limites intencionais: treinos sem exercícios podem ser salvos; rascunhos não sobrevivem ao encerramento do processo; não há backup nem separação por usuário. Valores iniciais são editáveis, sem progressão automática. Execução, cargas, timer, descanso ativo, sessões/histórico, streak, estatísticas, autenticação, sincronização, notificações e calendário ficam para fases posteriores. O ritmo semanal existente na Home continua identificado como demonstração.

## Resultado da fase 2

- TypeScript: aprovado.
- ESLint: aprovado, sem erros ou warnings.
- Testes: 16/16 aprovados, incluindo os sete testes da fundação.
- Expo Doctor: 21/21 aprovado.
- Exportação Android: bundle Hermes gerado em `dist/` (não é APK).
- `git diff --check`: aprovado.
- Nenhuma dependência adicionada ou sincronização ativada.

Verificação física/visual Android continua pendente: não há aparelho/emulador disponível neste ambiente. O cache de tipos de rotas foi regenerado pelo gerador oficial do Expo após adicionar as rotas internas.

### Arquivos criados nesta fase

```text
app/exercises/index.tsx
app/exercises/new.tsx
app/exercises/[id].tsx
src/db/migrations/002-exercises.ts
src/features/exercises/types.ts
src/features/exercises/normalize.ts
src/features/exercises/seed.ts
src/features/exercises/repository.ts
src/features/exercises/useExerciseSearch.ts
src/features/exercises/ExerciseCard.tsx
src/features/exercises/ExerciseHeader.tsx
src/features/exercises/ExerciseLibraryScreen.tsx
src/features/exercises/ExerciseEditorScreen.tsx
tests/exercises.test.ts
tests/helpers/sqlite.ts
```

### Arquivos alterados nesta fase

```text
app/_layout.tsx
src/db/migrations.ts
src/features/workouts/WorkoutsScreen.tsx
src/theme/tokens.ts
tests/database.test.ts
README.md
docs/architecture.md
docs/validation.md
```

A migration 1, as quatro abas e os serviços Supabase foram preservados. As listas desta seção registram somente o trabalho histórico da fase 2.

## Resultado da fundação (fase 1)

- `npm run check`: aprovado; TypeScript estrito, ESLint sem erros/warnings e 7/7 testes.
- Expo Doctor: 21/21 verificações aprovadas.
- `npm run export:android`: aprovado; bundle Hermes gerado em `dist/`.
- `npm run export:ios`: aprovado; bundle Hermes gerado em `dist/ios/`.
- Git: diff sem erros de whitespace; `.env`, credenciais, dependências e bundles ignorados.
- Auditoria npm: 13 avisos moderados herdados; nenhum alto/crítico, com limitações documentadas no README.

Os checks foram executados em Windows/Node 22.16. Não havia aparelho Android ou emulador disponível para inspeção visual e execução nativa.

## Checks locais

```powershell
npm run check
npm run doctor
npm run export:android
npm run export:ios
```

Os 16 testes anteriores preservam os sete cenários da fundação e acrescentam: normalização Unicode; upgrade preservando dados; rollback de seed parcial e nova tentativa; seed idempotente; pesquisa por nome/aliases; caracteres especiais e prioridade de resultados; criação/validação/UUID; edição com proteção de catálogo padrão; persistência de criação e edição após reabrir o banco. A fase 3 acrescentou os 12 testes descritos acima.

O banco usado nos testes é o SQLite real do Node, através de um adapter mínimo. Isso verifica o SQL e as transações, mas não executa a ponte nativa do `expo-sqlite`. Os bundles validam a resolução e compilação de módulos para os alvos mobile, não um APK ou IPA.

## Teste manual no Android — pendente em aparelho físico

1. Sem criar `.env`, execute `npm start` e abra pelo Expo Go SDK 57. Confirme Home escura, ícones visíveis e quatro abas.
2. Sem treinos, confira o convite para criar o primeiro. Com treino salvo, **Ver treino** deve abrir o detalhe. Use Voltar e também o botão Voltar do Android.
3. Abra Treinos, Histórico e Conta. Confirme que o histórico está vazio e a conta não afirma existir usuário autenticado.
4. Confira a Home em uma tela estreita e com fonte ampliada. Role até o rodapé; abas e botões devem permanecer acessíveis, sem recorte pela barra de gestos. Com TalkBack, verifique rótulos de dias, progresso e botão da conta.
5. Na ferramenta SQLite do ambiente Expo, inspecione `academia.db`: `PRAGMA user_version` deve ser 4 e `SELECT * FROM app_metadata` deve conter `foundation | ready`. Há tabelas de exercícios/aliases, treinos/associações e sessões/séries.
6. Feche e reabra o app pelo servidor. Confira o mesmo marcador sem duplicação. A Home só aparece após a verificação de inicialização ter passado.
7. Com o aplicativo já carregado, corte a internet mantendo a rede local acessível ao Metro. Navegue pelas abas: nenhuma depende de chamada Supabase. Esse teste não demonstra carregamento offline a frio do Expo Go nem sincronização.

Um erro no banco deve acionar recuperação sem apagar dados. Não simule corrupção em bancos com informações reais. O cenário de falha transacional já é coberto pelo teste isolado.

Ainda pendentes: teste físico Android, inspeção visual real, medição de desempenho, teste físico iOS, login/persistência de sessão autenticada, integração com um projeto Supabase e distribuição independente.

## Fase 2 — roteiro Android

1. Se o Metro já estava aberto durante a criação de rotas, encerre-o e execute `npx expo start --clear`. Abra o projeto pelo Expo Go SDK 57, na mesma rede. Não apague os dados do app: isso também permite validar a atualização da fase 1.
2. Vá a **Treinos → Biblioteca de exercícios**. Confira os 19 itens iniciais, placeholders e campo de pesquisa visível. As abas principais continuam Início, Treinos, Histórico e Conta.
3. Pesquise `supino`: devem aparecer Supino Reto, Inclinado, Máquina e Articulado. Teste `SUPINO`, `elevacao`, `triceps frances`, `voador` e `bench press`. Limpe a pesquisa para voltar à lista completa.
4. Digite rapidamente, apague e troque o termo: resultados de pesquisas anteriores não devem reaparecer. Uma pesquisa como `zzzinexistente` deve mostrar o estado vazio, sem pop-up.
5. Toque em um exercício padrão e confirme que seus detalhes são somente leitura. Use Voltar do app e do Android.
6. Em **Criar exercício**, tente salvar sem preencher nome/grupo: a mensagem deve aparecer junto aos campos. Preencha `Remada da família`, grupo `Costas`, equipamento `Elástico`. Salve; a biblioteca deve mostrar a pesquisa pelo nome criado e o selo Personalizado.
7. Toque no card, altere para `Remada em casa` e salve. Pesquise `remada casa`; confirme o novo nome. O botão de salvar deve bloquear envios repetidos enquanto a escrita está em andamento.
8. Feche/reabra o app e pesquise `remada casa`: dados editados devem continuar salvos. Reabrir não deve duplicar os 19 exercícios padrão.
9. Teste teclado aberto, fonte ampliada, tela estreita e TalkBack. A lista deve rolar sem ocultar o campo de busca; o formulário permite avançar entre campos pelo teclado.
10. Com o bundle carregado e Metro acessível na rede local, desconecte a internet. Buscar/criar/editar continuam locais. Isso não comprova carregamento a frio do Expo Go sem servidor.

Erros de consulta apresentam mensagem e botão de nova tentativa na biblioteca/formulário; erros de gravação preservam os campos. Não altere o banco real para simular falhas: rollback é testado em banco temporário isolado.

Não há teste visual automatizado nem aparelho conectado neste ambiente. Nenhuma sincronização, imagem remota, montagem ou execução de treino foi incluída na fase 2.
