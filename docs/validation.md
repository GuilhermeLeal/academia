# Validação — fundação e biblioteca de exercícios

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

A migration 1, as quatro abas e os serviços Supabase foram preservados. Há alterações não commitadas da fundação que já existiam antes desta fase; a lista acima identifica somente o trabalho da fase 2.

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

Os 16 testes preservam os sete cenários da fundação e acrescentam: normalização Unicode; upgrade 1 → 2 preservando dados; rollback de seed parcial e nova tentativa; seed idempotente; pesquisa por nome/aliases; caracteres especiais e prioridade de resultados; criação/validação/UUID; edição com proteção de catálogo padrão; persistência de criação e edição após reabrir o banco.

O banco usado nos testes é o SQLite real do Node, através de um adapter mínimo. Isso verifica o SQL e as transações, mas não executa a ponte nativa do `expo-sqlite`. Os bundles validam a resolução e compilação de módulos para os alvos mobile, não um APK ou IPA.

## Teste manual no Android — pendente em aparelho físico

1. Sem criar `.env`, execute `npm start` e abra pelo Expo Go SDK 57. Confirme Home escura, ícones visíveis e quatro abas.
2. Toque Iniciar treino; confirme que a prévia explica que nada foi salvo. Use Voltar e também o botão Voltar do Android.
3. Abra Treinos, Histórico e Conta. Explore prévia em Treinos e retorne. Confirme que o histórico está vazio e a conta não afirma existir usuário autenticado.
4. Confira a Home em uma tela estreita e com fonte ampliada. Role até o rodapé; abas e botões devem permanecer acessíveis, sem recorte pela barra de gestos. Com TalkBack, verifique rótulos de dias, progresso e botão da conta.
5. Na ferramenta SQLite do ambiente Expo, inspecione `academia.db`: `PRAGMA user_version` deve ser 2 e `SELECT * FROM app_metadata` deve conter `foundation | ready`. Há tabelas de exercícios/aliases, mas nenhuma tabela de treino.
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
