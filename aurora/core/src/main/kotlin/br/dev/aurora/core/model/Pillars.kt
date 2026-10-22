package br.dev.aurora.core.model

import java.time.Instant
import java.time.LocalDate

// Entidades dos pilares Foco, Caderno e Hábitos. Todas compartilham o mesmo banco e se ligam por id.

enum class GoalStatus(val label: String) {
    ACTIVE("Ativo"),
    PAUSED("Pausado"),
    COMPLETED("Concluído"),
    ABANDONED("Encerrado"),
}

data class Objective(
    val id: Long = 0,
    val name: String,
    val description: String = "",
    /** Por que isto importa para o usuário, nas palavras dele. */
    val why: String = "",
    val targetOutcome: String = "",
    val deadline: LocalDate? = null,
    val priority: Priority = Priority.MEDIUM,
    val status: GoalStatus = GoalStatus.ACTIVE,
    val weeklyMinutes: Int? = null,
    val createdAt: Instant,
    val updatedAt: Instant,
)

data class Milestone(
    val id: Long = 0,
    val objectiveId: Long,
    val title: String,
    val dueDate: LocalDate? = null,
    val done: Boolean = false,
    val position: Int = 0,
    val createdAt: Instant,
    val updatedAt: Instant,
)

data class Project(
    val id: Long = 0,
    val name: String,
    val description: String = "",
    val status: GoalStatus = GoalStatus.ACTIVE,
    val objectiveId: Long? = null,
    val createdAt: Instant,
    val updatedAt: Instant,
)

enum class ChangeType(val label: String) {
    POSTPONED("adiada"),
    RESCHEDULED("remarcada"),
    CANCELLED("cancelada"),
    SCOPE_REDUCED("escopo reduzido"),
    COMPLETED("concluída"),
    REOPENED("reaberta"),
}

/**
 * Registro factual de mudança em um compromisso. É a única fonte usada para afirmações como
 * "você adiou esta tarefa duas vezes".
 */
data class CommitmentChange(
    val id: Long = 0,
    val taskId: Long,
    val type: ChangeType,
    val fromDueAt: Instant? = null,
    val toDueAt: Instant? = null,
    val reason: String? = null,
    val createdAt: Instant,
)

enum class FocusStatus { RUNNING, PAUSED, FINISHED, CANCELLED }

/** Sessão de foco: o tempo é derivado de horários gravados, não de um processo em execução. */
data class FocusSession(
    val id: Long = 0,
    val taskId: Long? = null,
    val objectiveId: Long? = null,
    val plannedMinutes: Int,
    val startedAt: Instant,
    val endedAt: Instant? = null,
    val pausedAt: Instant? = null,
    val pausedMillis: Long = 0,
    val status: FocusStatus = FocusStatus.RUNNING,
    val accomplished: String? = null,
    val obstacle: String? = null,
    val createdAt: Instant,
    val updatedAt: Instant,
)

data class Habit(
    val id: Long = 0,
    val name: String,
    val description: String = "",
    /** Dias em que o hábito é esperado; vazio = todos os dias. */
    val recurrence: Recurrence? = null,
    val targetPerPeriod: Int? = null,
    val active: Boolean = true,
    val objectiveId: Long? = null,
    val createdAt: Instant,
    val updatedAt: Instant,
)

data class HabitCheckIn(
    val id: Long = 0,
    val habitId: Long,
    val date: LocalDate,
    val value: Int = 1,
    val note: String? = null,
    val createdAt: Instant,
)

enum class NoteType(val label: String) {
    GENERAL("Nota geral"),
    IDEA("Ideia"),
    BOOK_LEARNING("Aprendizado de livro"),
    REFLECTION("Reflexão pessoal"),
    BUSINESS_IDEA("Ideia de negócio"),
    RESEARCH("Pesquisa"),
    LESSON("Lição aprendida"),
    QUESTION("Pergunta"),
    REFERENCE("Referência"),
    MEETING("Reunião ou conversa"),
}

enum class ProcessingStatus(val label: String) {
    INBOX("Para organizar"),
    ORGANIZED("Organizada"),
    ARCHIVED("Arquivada"),
}

enum class SuggestionStatus { NONE, PENDING, ACCEPTED, REJECTED }

/**
 * Nota do Caderno. O conteúdo original nunca é sobrescrito: edições do usuário vão para [editedContent] e
 * resumos da IA para [aiSummary], que só vale depois de aceito.
 */
data class KnowledgeNote(
    val id: Long = 0,
    val title: String,
    val originalContent: String,
    val editedContent: String? = null,
    val aiSummary: String? = null,
    val aiSummaryStatus: SuggestionStatus = SuggestionStatus.NONE,
    val type: NoteType = NoteType.GENERAL,
    val source: String? = null,
    val sourceUrl: String? = null,
    val processingStatus: ProcessingStatus = ProcessingStatus.INBOX,
    val chapter: String? = null,
    val bookId: Long? = null,
    val projectId: Long? = null,
    val objectiveId: Long? = null,
    val createdAt: Instant,
    val updatedAt: Instant,
) {
    /** O texto que o usuário considera atual: a edição, se houver; senão, o original. */
    val content: String get() = editedContent ?: originalContent
}

data class Tag(val id: Long = 0, val name: String)

data class KnowledgeLink(val id: Long = 0, val fromNoteId: Long, val toNoteId: Long, val createdAt: Instant)

enum class ReadingStatus(val label: String) {
    WANT_TO_READ("Quero ler"),
    READING("Lendo"),
    FINISHED("Lido"),
    ABANDONED("Abandonado"),
}

data class Book(
    val id: Long = 0,
    val title: String,
    val author: String = "",
    val status: ReadingStatus = ReadingStatus.WANT_TO_READ,
    val startedOn: LocalDate? = null,
    val finishedOn: LocalDate? = null,
    val topic: String = "",
    /** 1 a 5, opcional. */
    val rating: Int? = null,
    val personalSummary: String = "",
    val createdAt: Instant,
    val updatedAt: Instant,
)
