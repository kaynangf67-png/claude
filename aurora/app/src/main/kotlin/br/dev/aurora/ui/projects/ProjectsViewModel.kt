package br.dev.aurora.ui.projects

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.dev.aurora.AppContainer
import br.dev.aurora.core.model.GoalStatus
import br.dev.aurora.core.model.KnowledgeNote
import br.dev.aurora.core.model.Project
import br.dev.aurora.core.model.Task
import java.time.Instant
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class ProjectSummary(val project: Project, val openTasks: List<Task>, val doneCount: Int, val notes: List<KnowledgeNote>)

class ProjectsViewModel(private val c: AppContainer) : ViewModel() {
    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    /** `null` enquanto carrega. */
    val projects: StateFlow<List<ProjectSummary>?> = combine(c.projects.observeAll(), c.tasks.observeAll(), c.notes.observeAll()) { projects, tasks, notes ->
        projects.map { p ->
            val linked = tasks.filter { it.projectId == p.id }
            ProjectSummary(p, linked.filter { it.isOpen }, linked.count { it.isCompleted }, notes.filter { it.projectId == p.id }.sortedByDescending { it.updatedAt })
        }.sortedWith(compareBy<ProjectSummary> { it.project.status.ordinal }.thenByDescending { it.project.updatedAt })
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun consumeMessage() {
        _message.value = null
    }

    fun save(id: Long, name: String, description: String, status: GoalStatus) {
        val clean = name.trim()
        if (clean.isEmpty()) {
            _message.value = "Dê um nome ao projeto."
            return
        }
        viewModelScope.launch {
            val now = Instant.now()
            val existing = if (id != 0L) c.projects.get(id) else null
            c.projects.upsert(
                existing?.copy(name = clean, description = description.trim(), status = status, updatedAt = now)
                    ?: Project(name = clean, description = description.trim(), status = status, createdAt = now, updatedAt = now),
            )
            _message.value = if (existing == null) "Projeto \"$clean\" criado." else "Projeto atualizado."
        }
    }

    /** Excluir o projeto não apaga tarefas nem notas: elas só deixam de estar vinculadas. */
    fun delete(project: Project) {
        viewModelScope.launch {
            c.projects.delete(project.id)
            _message.value = "Projeto \"${project.name}\" excluído. Tarefas e notas vinculadas foram mantidas."
        }
    }
}
