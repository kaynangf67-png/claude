package br.dev.aurora

import br.dev.aurora.core.model.Frequency
import br.dev.aurora.core.model.Priority
import br.dev.aurora.core.model.Recurrence
import br.dev.aurora.core.model.Reminder
import br.dev.aurora.core.model.Task
import br.dev.aurora.core.model.TaskStatus
import br.dev.aurora.data.db.TaskEntity
import br.dev.aurora.data.repo.matchesQuery
import br.dev.aurora.data.repo.memoryScore
import br.dev.aurora.data.repo.toEntity
import br.dev.aurora.data.repo.toModel
import java.time.DayOfWeek
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class MappersTest {
    private val t0 = Instant.parse("2026-10-22T13:00:00Z")

    @Test fun `tarefa ida e volta preserva todos os campos`() {
        val task = Task(
            id = 7, title = "Academia", description = "perna", priority = Priority.HIGH, status = TaskStatus.IN_PROGRESS, estimatedMinutes = 30, projectId = 4,
            dueAt = t0, dueAllDay = false, recurrence = Recurrence(Frequency.WEEKLY, 1, setOf(DayOfWeek.MONDAY, DayOfWeek.THURSDAY)),
            createdAt = t0, updatedAt = t0,
        )
        assertEquals(task, task.toEntity().toModel())
    }

    @Test fun `lembrete ida e volta`() {
        val r = Reminder(3, "Remédio", "1 comprimido", t0, Recurrence(Frequency.DAILY), true, t0, t0, null)
        assertEquals(r, r.toEntity().toModel())
    }

    @Test fun `valores desconhecidos no banco nao quebram a leitura`() {
        val e = TaskEntity(1, "x", "", "URGENTE", "???", null, false, "FREQ=NUNCA", 0, 0, null)
        val m = e.toModel()
        assertEquals(Priority.MEDIUM, m.priority)
        assertEquals(TaskStatus.TODO, m.status)
        assertNull(m.recurrence)
    }

    @Test fun `busca de notas ignora acentos e palavras vazias`() {
        assertTrue(matchesQuery("Ideia: app de receitas por voz", "receitas por voz"))
        assertTrue(matchesQuery("Reunião com a Ana", "reuniao"))
        assertFalse(matchesQuery("Lista de compras", "receitas"))
    }

    @Test fun `memoria pontua por palavras relacionadas`() {
        assertEquals(1, memoryScore("Prefiro café sem açúcar", "que tipo de café eu gosto?"))
        assertEquals(0, memoryScore("Minha filha se chama Luiza", "que tipo de café eu gosto?"))
    }
}
