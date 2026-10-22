package br.dev.aurora.core.tools

import br.dev.aurora.core.model.MemoryCategory
import br.dev.aurora.core.model.Priority
import br.dev.aurora.core.model.Recurrence
import java.time.LocalDate
import java.time.ZonedDateTime

/** Alvo de uma ação: um id conhecido, uma busca por título ou "o último item citado". */
sealed interface ItemRef {
    data class ById(val id: Long) : ItemRef
    data class ByTitle(val query: String) : ItemRef
    data object LastMentioned : ItemRef
}

/**
 * Ferramentas que o assistente pode executar. Todas chegam aqui já validadas e tipadas — seja do parser
 * local, seja de argumentos propostos pela IA e conferidos pelo [ToolValidator].
 */
sealed interface AssistantTool {
    /** Ações que mudam ou apagam dados do usuário de forma difícil de desfazer exigem confirmação. */
    val requiresConfirmation: Boolean get() = false

    data class CreateTask(
        val title: String,
        val description: String = "",
        val priority: Priority = Priority.MEDIUM,
        val dueDateTime: ZonedDateTime? = null,
        val dueDate: LocalDate? = null,
        val recurrence: Recurrence? = null,
        /** Nome do projeto dito pelo usuário; só é vinculado se existir um projeto com esse nome. */
        val project: String? = null,
    ) : AssistantTool

    data class UpdateTask(
        val target: ItemRef,
        val title: String? = null,
        val priority: Priority? = null,
        val dueDateTime: ZonedDateTime? = null,
        val dueDate: LocalDate? = null,
        val project: String? = null,
    ) : AssistantTool

    data class CompleteTask(val target: ItemRef) : AssistantTool

    data class DeleteTask(val target: ItemRef) : AssistantTool {
        override val requiresConfirmation get() = true
    }

    /** Cancela sem apagar: a tarefa continua no histórico com o status "Cancelada" e o motivo, se houver. */
    data class CancelTask(val target: ItemRef, val reason: String? = null) : AssistantTool {
        override val requiresConfirmation get() = true
    }

    data class ListTasks(val date: LocalDate? = null, val includeCompleted: Boolean = false, val project: String? = null) : AssistantTool

    data class CreateReminder(
        val title: String,
        val at: ZonedDateTime,
        val details: String = "",
        val recurrence: Recurrence? = null,
    ) : AssistantTool

    data object ListReminders : AssistantTool

    data class RescheduleReminder(val target: ItemRef, val at: ZonedDateTime) : AssistantTool

    /** Adia uma tarefa ou lembrete (o alvo pode ser qualquer um dos dois). */
    data class Postpone(
        val target: ItemRef,
        val toDate: LocalDate?,
        val toDateTime: ZonedDateTime?,
        /** Motivo dito pelo usuário ("porque estou sem tempo"); guardado no histórico da tarefa. */
        val reason: String? = null,
    ) : AssistantTool

    data class CancelReminder(val target: ItemRef) : AssistantTool {
        override val requiresConfirmation get() = true
    }

    data class GetAgenda(val date: LocalDate) : AssistantTool

    data class CreateNote(val content: String, val title: String? = null) : AssistantTool

    data class SearchNotes(val query: String) : AssistantTool

    data class SaveMemory(val content: String, val category: MemoryCategory = MemoryCategory.FACT) : AssistantTool

    data class SearchMemory(val query: String) : AssistantTool

    data class BuildDailyPlan(val date: LocalDate) : AssistantTool

    data class OpenApp(val appName: String) : AssistantTool
}
