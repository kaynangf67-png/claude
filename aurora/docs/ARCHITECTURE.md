# Aurora — Arquitetura

> Este documento descreve o **estado atual** (commit `bd9a89b`) e, na última seção, a **arquitetura-alvo** da
> especificação mestre. Plano de transição: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Visão geral (estado atual)

```
aurora/
├── core/   build Gradle incluída (Kotlin/JVM puro, sem Android)
│   ├── model/        Task, Reminder, Note, MemoryEntry, ConversationMessage, CalendarEvent, Recurrence
│   ├── text/         PtText (normalização), PtBrFormat (datas, horas, recorrência em pt-BR)
│   ├── time/         PtBrDateTimeParser, RecurrenceCalculator
│   ├── intent/       LocalIntentParser + PendingRequest (esclarecimento/confirmação)
│   ├── tools/        AssistantTool (tipado), ToolValidator, ToolCatalog (schemas para a IA)
│   ├── repository/   interfaces de persistência e integrações (implementadas no app)
│   ├── planning/     AgendaBuilder, DailyPlanner (sugestões, nunca altera compromissos)
│   ├── provider/     AssistantProvider, AnthropicProvider, ModelCatalog/ModelPrice, UsageLedger
│   └── orchestrator/ AssistantOrchestrator, ToolExecutor, AssistantDependencies
└── app/    módulo Android (Compose, Room, DataStore, AlarmManager, Speech, TTS)
    ├── AppContainer, AuroraApp, MainActivity
    ├── data/         Room (entidades, DAOs), repositórios, SettingsStore, SecretStore, DataExporter
    ├── reminders/    AlarmReminderScheduler, receivers, RescheduleWorker, Notifications
    ├── voice/        SpeechInput (SpeechRecognizer), SpeechOutput (TextToSpeech)
    ├── system/       AndroidCalendarSource, AndroidAppLauncher, AndroidCapabilities, AndroidConnectivity
    └── ui/           tema, navegação e telas (MVVM com ViewModel + StateFlow)
```

O `core` não conhece Android. Tudo que depende de plataforma entra por interface
(`TaskRepository`, `ReminderScheduler`, `CalendarSource`, `AppLauncher`, `AssistantProvider`...).
Isso permite testar o cérebro do assistente na JVM, rápido, sem emulador.

Injeção de dependência: manual (`AppContainer` criado no `Application`). Hilt/Koin não se justificam
para um app de um usuário com ~20 dependências.

## Pipeline de voz

1. Usuário toca no microfone (ou atalho/notificação/tile).
2. `SpeechInput` verifica `RECORD_AUDIO`; sem permissão → estado "permissão negada" com botão para conceder.
3. Cria `SpeechRecognizer` (on-device se disponível e escolhido), idioma `pt-BR`, resultados parciais.
4. Estados reais vindos dos callbacks: `Pronto → Ouvindo → Processando → (Falando) → Ocioso` ou `Erro(tipo)`.
   "Ouvindo" só aparece após `onReadyForSpeech` — nunca um estado falso.
5. Texto final → `AssistantOrchestrator.handle()`.
6. Resposta exibida e, se habilitado, falada por `SpeechOutput` (interrompível).
7. `SpeechRecognizer.destroy()` ao fim de cada sessão. Nenhum áudio é gravado em disco.

## Orquestrador

```
entrada (texto) ─► normalização ─► há confirmação/esclarecimento pendente? ─► resolve
                                 └► LocalIntentParser ─► intenção completa? ─► ToolValidator ─► ToolExecutor
                                                       └► incompleta (ex.: sem hora) ─► pergunta de esclarecimento
                                                       └► desconhecida ─► IA disponível? ─► AssistantProvider (com ferramentas)
                                                                                         └► não ─► resposta offline honesta
```

- A IA só **propõe** chamadas de ferramenta. Os argumentos passam pelo `ToolValidator` (tipos, datas futuras,
  limites de tamanho, IDs existentes) antes de qualquer execução. Nada de código/shell gerado pela IA.
- Ações destrutivas (excluir, limpar memória) exigem confirmação explícita.
- O sucesso só é anunciado depois que o repositório confirma a persistência.
- Contexto enviado à IA é mínimo: últimas N mensagens + agenda resumida do dia + memórias que
  casam com a pergunta (busca local), nunca a memória inteira.

## IA e custo

- Interface `AssistantProvider` → implementação `AnthropicProvider` (SDK Java oficial, `com.anthropic:anthropic-java`).
- Modelo configurável em Ajustes. Preços (US$/1M tokens entrada/saída, out/2026): Opus 5.5 4/20,
  Sonnet 5.5 2/10, Haiku 5.5 0,10/0,50.
- `UsageBudget`: soma o custo estimado de cada chamada (tokens reais retornados pela API × tabela de preços)
  e bloqueia novas chamadas quando o limite mensal configurado é atingido.
- Pedidos simples (criar lembrete, listar tarefas, anotar) são resolvidos localmente, sem chamar a IA.
- Timeout, cancelamento e até 2 novas tentativas (feitas pelo SDK) em erros transitórios.

## Segredos

- A chave de API é digitada no app, cifrada com AES-GCM usando chave do **Android Keystore** e
  guardada no DataStore. Nunca está no código, Gradle, APK ou Git.
- Limite honesto: num APK distribuído para terceiros, qualquer chave usada pelo app pode ser extraída
  por quem controla o aparelho. Para uso pessoal (a chave é sua, no seu aparelho) o risco é aceitável.
  Para distribuir, use um backend mínimo autenticado que guarde a chave.

## Lembretes

- `AlarmManager.setExactAndAllowWhileIdle` quando `canScheduleExactAlarms()`; senão
  `setAndAllowWhileIdle` (inexato — o app informa que pode atrasar).
- `RescheduleReceiver` reagenda tudo em `BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`, `TIME_SET`, `TIMEZONE_CHANGED`.
- Horários guardados em UTC (epoch millis) + recorrência em regras locais; exibidos no fuso do aparelho.
  Recorrência é recalculada no fuso local (lembrete "toda segunda às 9h" continua às 9h após mudança de horário de verão/fuso).

## Fluxo de dados e serviços externos

| Dado | Onde fica | Sai do aparelho? |
|---|---|---|
| Tarefas, lembretes, notas, memórias, histórico | Room (local) | Só trechos relevantes, quando a IA é chamada |
| Áudio do microfone | Não é armazenado | Depende do reconhecedor do sistema (on-device = não; serviço Google = sim) |
| Chave de API | DataStore cifrado (Keystore) | Só no cabeçalho HTTPS para api.anthropic.com |
| Calendário | Lido do CalendarContract sob demanda | Só o resumo do dia, quando a IA é chamada |

Serviço externo único: `api.anthropic.com` (opcional). Sem analytics, sem backend próprio.

## Wake word ("Ei, Aurora") — análise de viabilidade

Restrições verificadas na documentação oficial:
- Serviço em primeiro plano de microfone **não pode ser criado com o app em segundo plano** (Android 14+ lança
  `SecurityException`), nem mesmo após `BOOT_COMPLETED`. Exceções: interação com notificação/widget, ou app
  que fornece `VoiceInteractionService`.
- Portanto: escuta contínua só pode ser **iniciada pelo usuário** com o app visível (ou por toque em
  notificação/widget) e mantida com notificação persistente. Após reiniciar o aparelho, o usuário precisa reativar.
- `SpeechRecognizer` não serve como detector contínuo (sessões curtas, bipes, consumo, rede).
- Picovoice Porcupine: exige AccessKey validada online; o plano gratuito foi reportado como encerrado em 30/06/2026
  (informação conflitante com a página de preços). Descartado como dependência principal.

Opções a prototipar (M9):
- **A. Detector local** — Vosk (Apache 2.0, offline, Maven Central) com gramática restrita a "ei aurora",
  rodando em `ForegroundService` tipo `microphone`. Custo de bateria a medir em aparelho real.
- **B. Integração oficial de assistente** — `VoiceInteractionService` + papel de assistente (`RoleManager.ROLE_ASSISTANT`).
  Dá ativação por gesto/botão do sistema. **Não** dá frase de ativação personalizada: hotword do sistema é
  restrita a apps privilegiados/pré-instalados.

Fallbacks já implementáveis: atalho do launcher ("Falar com a Aurora"), atividade para `ACTION_ASSIST`,
ação na notificação, bloco de Configurações Rápidas.

## Arquitetura-alvo (especificação mestre)

### Organização

O `core` continua sendo o lugar de **todas as regras**. O `app` passa a se organizar por funcionalidade:

```
core/   model · text · time · intent · tools · orchestrator · provider · repository
        + agenda (tarefas, compromissos, CommitmentChange)
        + focus (objetivos, marcos, sessões, coaching, "Retomar o foco")
        + knowledge (notas, livros, tags, ligações, busca, recuperação com referências)
        + habits (frequência, consistência)
        + reviews (briefing, revisão diária/semanal: fatos × interpretação)
app/    data (Room v2+, migrações, DAOs, repositórios) · voice · androidintegration (alarmes, notificações,
        calendário, compartilhar, atalhos, bloco rápido, widget) · settings
        ui: home · focus · knowledge · projects · settings · conversation · shared components
```

Módulos Gradle separados por pilar só se o tempo de build justificar; por enquanto, pacotes bastam.

### Os cinco pilares sobre um modelo único

```
                 ┌──────────── AssistantOrchestrator (voz e texto) ────────────┐
                 │ intenções locais · ferramentas tipadas · validação · IA     │
                 └──────┬──────────┬───────────┬───────────┬─────────┬─────────┘
                        │          │           │           │         │
                    Agenda      Foco       Caderno      Hábitos   Revisões
                        │          │           │           │         │
                        └──────────┴─── Repositórios (interfaces no core) ──┘
                                              │
                                     Room (um banco, FKs)
```

- Uma `KnowledgeNote` ligada a um `Project` é **um** registro, lido pelo Caderno e pela tela do projeto.
- Criar tarefa a partir de nota grava `Task.sourceNoteId`; nunca automaticamente, sempre com confirmação.
- O coaching e as revisões leem **somente** registros (`CommitmentChange`, `FocusSession`, `HabitCheckIn`,
  status de tarefas). A IA recebe esses fatos já calculados e só interpreta.

### Procedência das respostas

Toda resposta do assistente passará a carregar a origem de cada afirmação:

| Origem | Exemplo | Exibição |
|---|---|---|
| Registro local | "Você concluiu 4 tarefas esta semana" | com link para os registros |
| Conversa atual | algo dito há pouco pelo usuário | sem marcação especial |
| Sugestão da IA | "Que tal começar por 5 minutos?" | rotulada como sugestão |
| Precisa de busca externa | pergunta factual fora dos registros | dito explicitamente |

### Sessões de foco sem serviço em primeiro plano

O timer é derivado de horários gravados (início, pausas, fim), não de um processo rodando. Um alarme agenda a
notificação de fim. Assim o tempo continua correto se o Android encerrar o app, sem precisar de serviço de
primeiro plano (que exige justificativa de tipo no Android 14+).
