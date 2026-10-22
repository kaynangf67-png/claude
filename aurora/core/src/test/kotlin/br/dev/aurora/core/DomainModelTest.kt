package br.dev.aurora.core

import br.dev.aurora.core.model.KnowledgeNote
import br.dev.aurora.core.model.Task
import br.dev.aurora.core.model.TaskStatus
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class DomainModelTest {
    private val t0 = Instant.parse("2026-10-22T12:00:00Z")

    @Test fun `status abertos e fechados`() {
        assertEquals(setOf(TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.POSTPONED), TaskStatus.entries.filter { it.isOpen }.toSet())
        val done = Task(title = "x", status = TaskStatus.DONE, createdAt = t0, updatedAt = t0)
        assertTrue(done.isCompleted)
        assertFalse(done.isOpen)
        assertFalse(Task(title = "x", status = TaskStatus.CANCELLED, createdAt = t0, updatedAt = t0).isOpen)
    }

    @Test fun `nota mostra a edicao mas preserva o original`() {
        val note = KnowledgeNote(title = "t", originalContent = "texto falado", createdAt = t0, updatedAt = t0)
        assertEquals("texto falado", note.content)
        val edited = note.copy(editedContent = "texto corrigido")
        assertEquals("texto corrigido", edited.content)
        assertEquals("texto falado", edited.originalContent)
    }
}
