# Aurora — Status da implementação

Legenda: ✅ verificado · 🟡 implementado, não verificado em execução · ⏳ pendente · ❌ não planejado agora

Atualizado em 22/10/2026 (Fase 1 da especificação mestre).

## Verificação

| O quê | Como | Resultado |
|---|---|---|
| `core` compila | `./gradlew -p core test` (local) | ✅ |
| Testes do `core` | 100 testes JUnit (parser, recorrência, fuso, orquestrador, validador, planejador, provedor) | ✅ 100/100 |
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
| Migração automática 1→2 (status antigos → novos, notas reindexadas) | ver CI | `MigrationTest` no emulador: dados da v1 preservados, esquema validado, busca encontra notas antigas |
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
