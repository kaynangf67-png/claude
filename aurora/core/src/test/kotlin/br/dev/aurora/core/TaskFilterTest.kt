package br.dev.aurora.core

import br.dev.aurora.core.model.Priority
import br.dev.aurora.core.model.Task
import br.dev.aurora.core.model.TaskStatus
import br.dev.aurora.core.query.ProjectScope
import br.dev.aurora.core.query.TaskFilter
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class TaskFilterTest {
    private val t0 = Instant.parse("2026-10-22T13:00:00Z")
    private fun task(id: Long, status: TaskStatus = TaskStatus.TODO, priority: Priority = Priority.MEDIUM, project: Long? = null) =
        Task(id = id, title = "t$id", status = status, priority = priority, projectId = project, createdAt = t0, updatedAt = t0)

    private val all = listOf(
        task(1),
        task(2, TaskStatus.IN_PROGRESS, Priority.HIGH, project = 10),
        task(3, TaskStatus.POSTPONED, project = 10),
        task(4, TaskStatus.DONE, Priority.HIGH),
        task(5, TaskStatus.CANCELLED, project = 11),
    )

    private fun ids(f: TaskFilter) = f.apply(all).map { it.id }

    @Test fun `padrao mostra so as abertas`() {
        assertTrue(TaskFilter().isDefault)
        assertEquals(listOf(1L, 2L, 3L), ids(TaskFilter()))
    }

    @Test fun `status explicito inclui concluidas e canceladas`() {
        assertEquals(listOf(4L, 5L), ids(TaskFilter(statuses = setOf(TaskStatus.DONE, TaskStatus.CANCELLED))))
    }

    @Test fun `prioridade combina com o padrao de abertas`() {
        assertEquals(listOf(2L), ids(TaskFilter(priority = Priority.HIGH)))
    }

    @Test fun `projeto especifico e sem projeto`() {
        assertEquals(listOf(2L, 3L), ids(TaskFilter(project = ProjectScope.Only(10))))
        assertEquals(listOf(1L), ids(TaskFilter(project = ProjectScope.None)))
    }
}
