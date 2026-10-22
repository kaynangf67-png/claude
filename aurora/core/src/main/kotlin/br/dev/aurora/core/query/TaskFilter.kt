package br.dev.aurora.core.query

import br.dev.aurora.core.model.Priority
import br.dev.aurora.core.model.Task
import br.dev.aurora.core.model.TaskStatus

/** Projeto no filtro: qualquer um, sem projeto ou um projeto específico. */
sealed interface ProjectScope {
    data object Any : ProjectScope
    data object None : ProjectScope
    data class Only(val projectId: Long) : ProjectScope
}

/**
 * Filtro de tarefas usado pela lista. Vazio em [statuses] significa "todas as abertas" — o padrão da tela —
 * para que concluídas e canceladas só apareçam quando pedidas explicitamente.
 */
data class TaskFilter(
    val statuses: Set<TaskStatus> = emptySet(),
    val priority: Priority? = null,
    val project: ProjectScope = ProjectScope.Any,
) {
    val isDefault: Boolean get() = this == TaskFilter()

    fun matches(task: Task): Boolean {
        val statusOk = if (statuses.isEmpty()) task.isOpen else task.status in statuses
        val priorityOk = priority == null || task.priority == priority
        val projectOk = when (project) {
            ProjectScope.Any -> true
            ProjectScope.None -> task.projectId == null
            is ProjectScope.Only -> task.projectId == project.projectId
        }
        return statusOk && priorityOk && projectOk
    }

    fun apply(tasks: List<Task>): List<Task> = tasks.filter(::matches)
}
