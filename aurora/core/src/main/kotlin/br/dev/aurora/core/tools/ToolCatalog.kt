package br.dev.aurora.core.tools

/** Descrição de uma ferramenta para o provedor de IA (JSON Schema como mapas Kotlin simples). */
data class ToolSpec(
    val name: String,
    val description: String,
    val properties: Map<String, Map<String, Any>>,
    val required: List<String> = emptyList(),
)

object ToolNames {
    const val CREATE_TASK = "create_task"
    const val UPDATE_TASK = "update_task"
    const val COMPLETE_TASK = "complete_task"
    const val DELETE_TASK = "delete_task"
    const val LIST_TASKS = "list_tasks"
    const val CREATE_REMINDER = "create_reminder"
    const val LIST_REMINDERS = "list_reminders"
    const val RESCHEDULE_REMINDER = "reschedule_reminder"
    const val CANCEL_REMINDER = "cancel_reminder"
    const val GET_AGENDA = "get_agenda"
    const val CREATE_NOTE = "create_note"
    const val SEARCH_NOTES = "search_notes"
    const val SAVE_MEMORY = "save_memory"
    const val SEARCH_MEMORY = "search_memory"
    const val BUILD_DAILY_PLAN = "build_daily_plan"
    const val OPEN_APP = "open_app"
}

object ToolCatalog {
    private fun str(description: String) = mapOf("type" to "string", "description" to description)
    private fun int(description: String) = mapOf("type" to "integer", "description" to description)
    private fun enumOf(description: String, vararg values: String) =
        mapOf("type" to "string", "enum" to values.toList(), "description" to description)

    private val DATE = str("Data local no formato AAAA-MM-DD.")
    private val DATE_TIME = str("Data e hora locais do usuário no formato AAAA-MM-DDTHH:MM (sem fuso).")
    private val DUE = str("Prazo: AAAA-MM-DD (dia inteiro) ou AAAA-MM-DDTHH:MM (horário local).")
    private val PRIORITY = enumOf("Prioridade.", "baixa", "media", "alta")
    private val RECURRENCE = mapOf(
        "type" to "object",
        "description" to "Recorrência opcional.",
        "properties" to mapOf(
            "frequency" to enumOf("Frequência.", "daily", "weekly", "monthly", "yearly"),
            "interval" to int("Intervalo (1 = toda vez, 2 = a cada duas...). Padrão 1."),
            "days_of_week" to mapOf(
                "type" to "array",
                "items" to enumOf("Dia da semana.", "MO", "TU", "WE", "TH", "FR", "SA", "SU"),
                "description" to "Só para weekly.",
            ),
        ),
        "required" to listOf("frequency"),
    )
    private val TASK_ID = int("Id da tarefa, se conhecido.")
    private val TASK_TITLE = str("Parte do título da tarefa, quando o id não é conhecido.")
    private val REMINDER_ID = int("Id do lembrete, se conhecido.")
    private val REMINDER_TITLE = str("Parte do título do lembrete, quando o id não é conhecido.")

    val all: List<ToolSpec> = listOf(
        ToolSpec(
            ToolNames.CREATE_TASK, "Cria uma tarefa na lista do usuário.",
            mapOf(
                "title" to str("Título curto da tarefa."),
                "description" to str("Detalhes opcionais."),
                "priority" to PRIORITY,
                "due" to DUE,
                "recurrence" to RECURRENCE,
            ),
            listOf("title"),
        ),
        ToolSpec(
            ToolNames.UPDATE_TASK, "Altera título, prioridade ou prazo de uma tarefa existente.",
            mapOf("task_id" to TASK_ID, "task_title" to TASK_TITLE, "title" to str("Novo título."), "priority" to PRIORITY, "due" to DUE),
        ),
        ToolSpec(ToolNames.COMPLETE_TASK, "Marca uma tarefa como concluída.", mapOf("task_id" to TASK_ID, "task_title" to TASK_TITLE)),
        ToolSpec(
            ToolNames.DELETE_TASK, "Exclui uma tarefa. O app pedirá confirmação ao usuário antes de excluir.",
            mapOf("task_id" to TASK_ID, "task_title" to TASK_TITLE),
        ),
        ToolSpec(
            ToolNames.LIST_TASKS, "Lista tarefas pendentes (opcionalmente de uma data).",
            mapOf("date" to DATE, "include_completed" to mapOf("type" to "boolean", "description" to "Incluir concluídas.")),
        ),
        ToolSpec(
            ToolNames.CREATE_REMINDER, "Cria um lembrete com notificação no horário indicado.",
            mapOf("title" to str("O que lembrar."), "at" to DATE_TIME, "details" to str("Detalhes opcionais."), "recurrence" to RECURRENCE),
            listOf("title", "at"),
        ),
        ToolSpec(ToolNames.LIST_REMINDERS, "Lista os próximos lembretes ativos.", emptyMap()),
        ToolSpec(
            ToolNames.RESCHEDULE_REMINDER, "Muda o horário de um lembrete existente.",
            mapOf("reminder_id" to REMINDER_ID, "reminder_title" to REMINDER_TITLE, "at" to DATE_TIME),
            listOf("at"),
        ),
        ToolSpec(
            ToolNames.CANCEL_REMINDER, "Cancela um lembrete. O app pedirá confirmação ao usuário.",
            mapOf("reminder_id" to REMINDER_ID, "reminder_title" to REMINDER_TITLE),
        ),
        ToolSpec(ToolNames.GET_AGENDA, "Retorna tarefas, lembretes e eventos de calendário de um dia.", mapOf("date" to DATE), listOf("date")),
        ToolSpec(
            ToolNames.CREATE_NOTE, "Salva uma nota ou ideia.",
            mapOf("content" to str("Conteúdo da nota."), "title" to str("Título opcional.")),
            listOf("content"),
        ),
        ToolSpec(ToolNames.SEARCH_NOTES, "Busca nas notas do usuário.", mapOf("query" to str("Termos de busca.")), listOf("query")),
        ToolSpec(
            ToolNames.SAVE_MEMORY,
            "Guarda um fato ou preferência do usuário. Use SOMENTE quando o usuário pedir explicitamente para lembrar algo.",
            mapOf(
                "content" to str("O fato, em uma frase."),
                "category" to enumOf("Categoria.", "fato", "preferencia", "ideia", "projeto", "outro"),
            ),
            listOf("content"),
        ),
        ToolSpec(ToolNames.SEARCH_MEMORY, "Busca fatos e preferências salvos.", mapOf("query" to str("Termos de busca.")), listOf("query")),
        ToolSpec(
            ToolNames.BUILD_DAILY_PLAN, "Monta um plano sugerido para o dia. Não altera nenhum compromisso.",
            mapOf("date" to DATE), listOf("date"),
        ),
        ToolSpec(ToolNames.OPEN_APP, "Abre um aplicativo instalado pelo nome.", mapOf("app_name" to str("Nome do app.")), listOf("app_name")),
    )
}
