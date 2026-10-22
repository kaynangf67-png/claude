# Aurora — Status da implementação

Legenda: ✅ verificado · 🟡 implementado, não verificado em execução · ⏳ pendente · ❌ não planejado agora

Atualizado em 22/10/2026 (Fase 2 da especificação mestre).

## Verificação

| O quê | Como | Resultado |
|---|---|---|
| `core` compila | `./gradlew -p core test` (local) | ✅ |
| Testes do `core` | 131 testes JUnit (parser, recorrência, fuso, orquestrador, validador, planejador, provedor, filtros, frases reais) | ✅ 131/131 |
| `app` compila / APK de debug | GitHub Actions (`.github/workflows/aurora-android.yml`) | ✅ run #4 (commit b851667) |
| Testes unitários do `app` (mapeadores, busca) | GitHub Actions | ✅ |
| Android Lint (`lintDebug`) | GitHub Actions | ✅ sem erros |
| Execução em emulador/aparelho | — | ⏳ não feito |

## Marcos

| # | Marco | Status |
|---|---|---|
| M0 | Inspeção, plano, docs, esqueleto Gradle | ✅ |
| M1 | Domínio: modelos, parser pt-BR, recorrência, validação | ✅ testado |
| M2 | Orquestrador, intenções locais, esclarecimento/confirmação, planejador | ✅ testado |
| M3 | Provedor de IA (Anthropic), orçamento, erros | ✅ testado com servidor simulado; 🟡 API real |
| M4 | Room, DataStore, chave cifrada (Keystore), DI | 🟡 |
| M5 | Lembretes: AlarmManager exato/inexato, notificação, ações, reagendamento | 🟡 |
| M6 | Voz: SpeechRecognizer + TTS | 🟡 |
| M7 | UI: Início, Conversa, Agenda, Tarefas, Lembretes, Memória, Ajustes | 🟡 |
| M8 | Calendário (leitura), abrir apps, compartilhar nota | 🟡 · criação de eventos ⏳ |
| M9 | Wake word | ⏳ estudo feito; protótipo pendente |

## Testes manuais necessários (aparelho físico)

1. Instalar o APK, abrir, conceder microfone, falar "me lembra daqui a 2 minutos de testar" → notificação chega.
2. Negar "Alarmes e lembretes" → criar lembrete → mensagem de alarme inexato aparece; aviso chega (talvez com atraso).
3. Reiniciar o aparelho com lembrete futuro → aviso continua chegando.
4. Modo avião → "quais são minhas tarefas de hoje?" funciona; pergunta livre → resposta de offline.
5. Salvar chave, escolher Haiku 5.5, perguntar algo livre → resposta e gasto estimado em Ajustes.
6. Fechar e reabrir o app → tarefas, lembretes, notas e conversa continuam lá.
7. Sem voz pt-BR instalada → aviso; sem permissão de microfone → banner e teclado funcionando.

## CI

| Run | Resultado | Causa / correção |
|---|---|---|
| #1 | ❌ | `android-actions/setup-android@v3` quebrado (pacote `tools`); removido, o runner já tem o SDK |
| #2 | ❌ | AndroidX atual exige `compileSdk` 37 → ajustado (targetSdk segue 36) |
| #3 | ❌ | app compilou; teste unitário sem `kotlin-test-junit` → corrigido |
| #4 | ✅ | testes do core e do app, APK de debug, lint |

O APK fica no artefato **aurora-debug-apk** da execução (Actions → Aurora Android → run → Artifacts),
válido por 90 dias. Ele **não foi instalado nem executado** em nenhum aparelho ou emulador.


## Fase 1 — Fundação (especificação mestre)

| Item | Status | Verificação |
|---|---|---|
| Esquema Room v1 versionado em `app/schemas` | ✅ | CI compara o esquema gerado com o versionado (falha se divergir) |
| Esquema v2: objetivos, marcos, projetos, histórico de compromissos, sessões de foco, hábitos, livros, notas do Caderno, tags, ligações, FTS4 | ✅ | `2.json` conferido byte a byte (SHA-256) com o gerado pelo Room |
| Migração automática 1→2 (status antigos → novos, notas reindexadas) | ✅ run #18 | `MigrationTest` no emulador: dados da v1 preservados, esquema validado, busca encontra notas antigas |
| Chaves estrangeiras (SET NULL / CASCADE) | ✅ | `RelationsTest` no emulador |
| Busca de texto completo sem acento | ✅ | `RelationsTest` consulta o índice FTS diretamente |
| Tarefa com 5 status, duração estimada, projeto | 🟡 | compila; UI não testada em aparelho |
| Histórico de compromissos (adiar, remarcar, concluir, cancelar, reabrir) | ✅ core · 🟡 UI | teste do orquestrador no `core` |
| Nota preserva o original; edição separada | ✅ | teste de domínio + `RelationsTest` |
| Tema claro e escuro (sistema/claro/escuro) | 🟡 | compila; visual não verificado |
| Navegação Início · Foco · Caderno · Projetos · Configurações + botão de falar central | 🟡 | compila |
| Tela de Projetos (criar, editar, status, excluir sem apagar tarefas) | 🟡 | compila; exclusão coberta por `RelationsTest` |
| Estados de carregamento | ⚠️ | Tarefas e Projetos; Lembretes e Caderno ainda não |

Não feito nesta fase (previsto em fases seguintes): telas de objetivos/sessões de foco/hábitos/livros, tags e
ligações na UI, captura pelo menu Compartilhar, coaching, revisões.

## Fase 2 — Tarefas, projetos e histórico de compromissos

CI run #21 (commit a77f5b8) verde: core, testes unitários do app, APK, lint, esquema e testes instrumentados no emulador API 34.

| Item | Status | Verificação |
|---|---|---|
| Tarefa + histórico gravados na mesma transação (`upsertWithChange`) | ✅ run #21 | `core`: falha simulada não altera a tarefa; `TaskTransactionTest` (emulador) força erro no INSERT do histórico e confere o rollback |
| Cancelar tarefa (voz, IA e tela) sem apagar; confirmação obrigatória; motivo opcional | ✅ core · 🟡 UI | testes do parser e do orquestrador ("cancela a tarefa academia porque machuquei o joelho") |
| Motivo do adiamento ("adia isso para sexta porque…") e status "Adiada" | ✅ core · 🟡 UI | testes do parser (motivo antes/depois da data, pendente até a data) e do orquestrador |
| Projeto por voz/IA ("cria uma tarefa X no projeto Y", "move a tarefa X para o projeto Y", `list_tasks` por projeto) | ✅ core | projeto inexistente **não é criado**; o usuário é avisado |
| Filtros por status, prioridade e projeto (`TaskFilter` no core) | ✅ core · 🟡 UI | `TaskFilterTest` |
| Histórico factual no editor de tarefa; campo "tempo gasto" | 🟡 | compila; não visto rodando |
| Projetos listam notas vinculadas | 🟡 | compila; notas ainda não podem ser vinculadas pela UI (Fase 3) |

## Primeiro teste em aparelho real (22/10/2026)

Feito pelo usuário com o APK da run #21, tema escuro, sem chave de IA.

| O quê | Resultado |
|---|---|
| App abre, conversa, tema escuro | ✅ visto em print |
| Reconhecimento de voz (transcrição pt-BR) | ✅ |
| Fala da resposta (TTS) | ✅ ("Falando…" / "Parar fala") |
| "tudo bem?" / "quero ver sua agenda de hoje" | ✅ |
| "agende uma reunião para as 2:30" | ❌ → corrigido (lembrete às 14:30, horário dito na resposta) |
| "Marque uma agenda no lembrete para daqui 5 horas buscar na escola" | ❌ mostrou a agenda → corrigido (lembrete "Buscar na escola") |
| "adicione na agenda" | ❌ mostrou a agenda → corrigido (pergunta o quê e quando) |

Causas: verbos de agendar não reconhecidos; qualquer frase com "agenda" virava consulta; "2:30" escrito pelo
reconhecedor era lido como 02:30; verbos no subjuntivo ("marque", "coloque", "apague", "risque") não casavam.
As frases estão em `RealDevicePhrasesTest`. Ainda não testados em aparelho: notificação de lembrete, tarefas,
adiar/cancelar, histórico, tema claro.

