package br.dev.aurora.data

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import br.dev.aurora.core.model.ChangeType
import br.dev.aurora.core.model.CommitmentChange
import br.dev.aurora.core.model.KnowledgeNote
import br.dev.aurora.core.model.Project
import br.dev.aurora.core.model.Task
import br.dev.aurora.data.db.AuroraDatabase
import br.dev.aurora.data.db.FtsQuery
import br.dev.aurora.data.repo.RoomCommitmentChangeRepository
import br.dev.aurora.data.repo.RoomNoteRepository
import br.dev.aurora.data.repo.RoomProjectRepository
import br.dev.aurora.data.repo.RoomTaskRepository
import java.time.Instant
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

@RunWith(AndroidJUnit4::class)
class RelationsTest {
    private lateinit var db: AuroraDatabase
    private val t0 = Instant.parse("2026-10-22T12:00:00Z")

    @Before fun setUp() {
        db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), AuroraDatabase::class.java).build()
    }

    @After fun tearDown() = db.close()

    @Test fun excluirProjetoDesvinculaTarefaSemApagala() = runTest {
        val projects = RoomProjectRepository(db)
        val tasks = RoomTaskRepository(db)
        val pid = projects.upsert(Project(name = "Mudança", createdAt = t0, updatedAt = t0))
        val tid = tasks.upsert(Task(title = "Caixas", projectId = pid, createdAt = t0, updatedAt = t0))
        projects.delete(pid)
        val task = tasks.get(tid)!!
        assertNull(task.projectId)
    }

    @Test fun historicoDeCompromissoSaiJuntoComATarefa() = runTest {
        val tasks = RoomTaskRepository(db)
        val changes = RoomCommitmentChangeRepository(db)
        val tid = tasks.upsert(Task(title = "Relatório", createdAt = t0, updatedAt = t0))
        changes.record(CommitmentChange(taskId = tid, type = ChangeType.POSTPONED, reason = "sem tempo", createdAt = t0))
        assertEquals(1, changes.forTask(tid).size)
        tasks.delete(tid)
        assertTrue(changes.forTask(tid).isEmpty())
    }

    @Test fun buscaEncontraVersaoEditadaEOriginal() = runTest {
        val notes = RoomNoteRepository(db)
        val id = notes.upsert(KnowledgeNote(title = "Disciplina", originalContent = "hábitos pequenos", createdAt = t0, updatedAt = t0))
        notes.upsert(notes.get(id)!!.copy(editedContent = "consistência diária"))
        assertEquals(listOf(id), notes.search("habitos", 5).map { it.id })
        assertEquals(listOf(id), notes.search("consistencia", 5).map { it.id })
        assertEquals("hábitos pequenos", notes.get(id)!!.originalContent)
        // Direto no índice FTS (sem a busca linear de reserva): acentos ignorados e prefixo funcionando.
        assertEquals(listOf(id), db.notes().search(FtsQuery.build("hábito")!!, 5).map { it.id })
        assertEquals(listOf(id), db.notes().search(FtsQuery.build("consist")!!, 5).map { it.id })
    }
}
