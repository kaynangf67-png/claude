package br.dev.aurora.ui.tasks

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.dev.aurora.AppContainer
import br.dev.aurora.core.model.ChangeType
import br.dev.aurora.core.model.CommitmentChange
import br.dev.aurora.core.model.GoalStatus
import br.dev.aurora.core.model.Priority
import br.dev.aurora.core.model.Project
import br.dev.aurora.core.model.Recurrence
import br.dev.aurora.core.model.Task
import br.dev.aurora.core.model.TaskStatus
import br.dev.aurora.core.planning.AgendaBuilder
import br.dev.aurora.core.tools.AssistantTool
import br.dev.aurora.core.tools.ItemRef
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

enum class TaskFilter(val label: String) { PENDING("Pendentes"), OVERDUE("Atrasadas"), DONE("Concluídas") }

/** Dados do formulário de tarefa (criação ou edição). */
data class TaskDraft(
    val id: Long = 0,
    val title: String = "",
    val description: String = "",
    val priority: Priority = Priority.MEDIUM,
    val date: LocalDate? = null,
    val time: LocalTime? = null,
    val recurrence: Recurrence? = null,
    val status: TaskStatus = TaskStatus.TODO,
    val projectId: Long? = null,
    val estimatedMinutes: Int? = null,
)

class TasksViewModel(private val c: AppContainer) : ViewModel() {
    private val filter = MutableStateFlow(TaskFilter.PENDING)
    val currentFilter: StateFlow<TaskFilter> = filter.asStateFlow()

    val projects: StateFlow<List<Project>> = c.projects.observeAll()
        .map { l -> l.filter { it.status == GoalStatus.ACTIVE } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    /** `null` enquanto carrega. */
    val tasks: StateFlow<List<Task>?> = combine(c.tasks.observeAll(), filter) { all, f ->
        val zone = ZoneId.systemDefault()
        val today = LocalDate.now(zone)
        when (f) {
            TaskFilter.PENDING -> all.filter { it.isOpen }
                .sortedWith(compareBy<Task> { it.dueAt ?: Instant.MAX }.thenByDescending { AgendaBuilder.priorityWeight(it.priority) })
            TaskFilter.OVERDUE -> all.filter { t -> t.isOpen && isOverdue(t, today, zone) }.sortedBy { it.dueAt }
            TaskFilter.DONE -> all.filter { it.isCompleted }.sortedByDescending { it.completedAt }
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun isOverdue(t: Task, today: LocalDate = LocalDate.now(), zone: ZoneId = ZoneId.systemDefault()): Boolean {
        val due = t.dueAt ?: return false
        return if (t.dueAllDay) due.atZone(zone).toLocalDate() < today else due < Instant.now()
    }

    fun setFilter(f: TaskFilter) {
        filter.value = f
    }

    fun consumeMessage() {
        _message.value = null
    }

    fun draftOf(task: Task): TaskDraft {
        val zone = ZoneId.systemDefault()
        val due = task.dueAt?.atZone(zone)
        return TaskDraft(
            id = task.id, title = task.title, description = task.description, priority = task.priority,
            date = due?.toLocalDate(), time = if (task.dueAllDay) null else due?.toLocalTime(), recurrence = task.recurrence,
            status = task.status, projectId = task.projectId, estimatedMinutes = task.estimatedMinutes,
        )
    }

    fun save(d: TaskDraft) {
        val title = d.title.trim()
        if (title.isEmpty()) {
            _message.value = "Dê um título para a tarefa."
            return
        }
        viewModelScope.launch {
            val zone = ZoneId.systemDefault()
            val dueDateTime = if (d.date != null && d.time != null) d.date.atTime(d.time).atZone(zone) else null
            val dueDate = if (d.date != null && d.time == null) d.date else null
            if (d.id == 0L) {
                val outcome = c.actions.execute(
                    AssistantTool.CreateTask(title, d.description.trim(), d.priority, dueDateTime, dueDate, d.recurrence), null,
                )
                // Campos que a ferramenta de voz ainda não cobre: projeto e duração estimada.
                val id = outcome.referenced?.id
                if (id != null && (d.projectId != null || d.estimatedMinutes != null)) {
                    c.tasks.get(id)?.let { c.tasks.upsert(it.copy(projectId = d.projectId, estimatedMinutes = d.estimatedMinutes)) }
                }
                _message.value = outcome.message
            } else {
                val existing = c.tasks.get(d.id) ?: return@launch
                val now = Instant.now()
                val newDue = dueDateTime?.toInstant() ?: dueDate?.atStartOfDay(zone)?.toInstant()
                c.tasks.upsert(
                    existing.copy(
                        status = d.status,
                        completedAt = if (d.status == TaskStatus.DONE) existing.completedAt ?: now else null,
                        projectId = d.projectId,
                        estimatedMinutes = d.estimatedMinutes,
                        title = title,
                        description = d.description.trim(),
                        priority = d.priority,
                        dueAt = dueDateTime?.toInstant() ?: dueDate?.atStartOfDay(zone)?.toInstant(),
                        dueAllDay = dueDate != null,
                        recurrence = d.recurrence,
                        updatedAt = now,
                    ),
                )
                // Histórico factual: mudanças de status e de prazo ficam registradas.
                val change = when {
                    d.status != existing.status && d.status == TaskStatus.DONE -> ChangeType.COMPLETED
                    d.status != existing.status && d.status == TaskStatus.CANCELLED -> ChangeType.CANCELLED
                    d.status != existing.status && d.status == TaskStatus.POSTPONED -> ChangeType.POSTPONED
                    d.status != existing.status && existing.status == TaskStatus.DONE -> ChangeType.REOPENED
                    newDue != existing.dueAt -> ChangeType.RESCHEDULED
                    else -> null
                }
                change?.let {
                    c.commitmentChanges.record(CommitmentChange(taskId = existing.id, type = it, fromDueAt = existing.dueAt, toDueAt = newDue, createdAt = now))
                }
                _message.value = "Tarefa atualizada."
            }
        }
    }

    fun complete(task: Task) {
        viewModelScope.launch {
            _message.value = c.actions.execute(AssistantTool.CompleteTask(ItemRef.ById(task.id)), null).message
        }
    }

    fun reopen(task: Task) {
        viewModelScope.launch {
            val now = Instant.now()
            c.tasks.upsert(task.copy(status = TaskStatus.TODO, completedAt = null, updatedAt = now))
            c.commitmentChanges.record(CommitmentChange(taskId = task.id, type = ChangeType.REOPENED, fromDueAt = task.dueAt, toDueAt = task.dueAt, createdAt = now))
        }
    }

    fun postponeToTomorrow(task: Task) {
        viewModelScope.launch {
            val tomorrow = LocalDate.now().plusDays(1)
            _message.value = c.actions.execute(AssistantTool.Postpone(ItemRef.ById(task.id), tomorrow, null), null).message
        }
    }

    fun delete(task: Task) {
        viewModelScope.launch {
            c.tasks.delete(task.id)
            _message.value = "Tarefa \"${task.title}\" excluída."
        }
    }
}
