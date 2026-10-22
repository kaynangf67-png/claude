package br.dev.aurora.core.model

import java.time.Instant

enum class Priority(val label: String) {
    LOW("baixa"),
    MEDIUM("média"),
    HIGH("alta"),
}

enum class TaskStatus(val label: String) {
    TODO("A fazer"),
    IN_PROGRESS("Em andamento"),
    DONE("Concluída"),
    POSTPONED("Adiada"),
    CANCELLED("Cancelada"),
    ;

    /** Ainda exige ação: a fazer, em andamento ou adiada. */
    val isOpen: Boolean get() = this == TODO || this == IN_PROGRESS || this == POSTPONED
}

/**
 * Uma tarefa. [dueAt] é um instante absoluto (UTC). Quando [dueAllDay] é verdadeiro, só a data local
 * importa: o instante guardado é o início do dia no fuso em que a tarefa foi criada e a exibição usa a
 * data local correspondente.
 */
data class Task(
    val id: Long = 0,
    val title: String,
    val description: String = "",
    val priority: Priority = Priority.MEDIUM,
    val status: TaskStatus = TaskStatus.TODO,
    val dueAt: Instant? = null,
    val dueAllDay: Boolean = false,
    val recurrence: Recurrence? = null,
    val createdAt: Instant,
    val updatedAt: Instant,
    val completedAt: Instant? = null,
    val estimatedMinutes: Int? = null,
    /** Tempo efetivamente registrado (sessões de foco ou informado pelo usuário). */
    val actualMinutes: Int? = null,
    val projectId: Long? = null,
    val objectiveId: Long? = null,
    val milestoneId: Long? = null,
    /** Nota do Caderno que originou a tarefa (criada sempre com confirmação). */
    val sourceNoteId: Long? = null,
) {
    val isCompleted: Boolean get() = status == TaskStatus.DONE
    val isOpen: Boolean get() = status.isOpen
}

data class Reminder(
    val id: Long = 0,
    val title: String,
    val details: String = "",
    val scheduledAt: Instant,
    val recurrence: Recurrence? = null,
    val enabled: Boolean = true,
    val createdAt: Instant,
    val updatedAt: Instant,
    /** Último disparo efetivo (para lembretes concluídos ou recorrentes). */
    val lastFiredAt: Instant? = null,
    val taskId: Long? = null,
)

enum class MemoryCategory(val label: String) {
    FACT("fato"),
    PREFERENCE("preferência"),
    IDEA("ideia"),
    PROJECT("projeto"),
    OTHER("outro"),
}

data class MemoryEntry(
    val id: Long = 0,
    val category: MemoryCategory,
    val content: String,
    val createdAt: Instant,
    val updatedAt: Instant,
    /** Só entradas aprovadas pelo usuário são usadas como contexto. */
    val userApproved: Boolean,
)

enum class MessageRole { USER, ASSISTANT }

data class ConversationMessage(
    val id: Long = 0,
    val conversationId: String,
    val role: MessageRole,
    val content: String,
    val createdAt: Instant,
)

/** Evento lido do calendário do aparelho (somente leitura). */
data class CalendarEvent(
    val id: Long,
    val title: String,
    val start: Instant,
    val end: Instant,
    val allDay: Boolean,
    val location: String? = null,
)
