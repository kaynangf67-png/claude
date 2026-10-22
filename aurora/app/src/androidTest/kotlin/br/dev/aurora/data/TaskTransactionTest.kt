package br.dev.aurora.data

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import br.dev.aurora.core.model.ChangeType
import br.dev.aurora.core.model.CommitmentChange
import br.dev.aurora.core.model.Task
import br.dev.aurora.core.model.TaskStatus
import br.dev.aurora.data.db.AuroraDatabase
import br.dev.aurora.data.repo.RoomCommitmentChangeRepository
import br.dev.aurora.data.repo.RoomTaskRepository
import java.time.Instant
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail

/** Tarefa e histórico precisam ser gravados juntos: nunca uma tarefa adiada sem o registro do adiamento. */
@RunWith(AndroidJUnit4::class)
class TaskTransactionTest {
    private lateinit var db: AuroraDatabase
    private val t0 = Instant.parse("2026-10-22T12:00:00Z")
    private val t1 = Instant.parse("2026-10-26T12:00:00Z")

    @Before fun setUp() {
        db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), AuroraDatabase::class.java).build()
    }

    @After fun tearDown() = db.close()

    @Test fun gravaTarefaEHistoricoJuntos() = runTest {
        val tasks = RoomTaskRepository(db)
        val changes = RoomCommitmentChangeRepository(db)
        val id = tasks.upsert(Task(title = "Relatório", dueAt = t0, createdAt = t0, updatedAt = t0))
        val task = tasks.get(id)!!
        tasks.upsertWithChange(
            task.copy(dueAt = t1, status = TaskStatus.POSTPONED),
            CommitmentChange(taskId = id, type = ChangeType.POSTPONED, fromDueAt = t0, toDueAt = t1, reason = "sem tempo", createdAt = t0),
        )
        assertEquals(TaskStatus.POSTPONED, tasks.get(id)!!.status)
        val history = changes.forTask(id)
        assertEquals(1, history.size)
        assertEquals("sem tempo", history.single().reason)
    }

    @Test fun falhaNoHistoricoDesfazAMudancaNaTarefa() = runTest {
        val tasks = RoomTaskRepository(db)
        val changes = RoomCommitmentChangeRepository(db)
        val id = tasks.upsert(Task(title = "Relatório", dueAt = t0, createdAt = t0, updatedAt = t0))
        val existingChangeId = changes.record(CommitmentChange(taskId = id, type = ChangeType.RESCHEDULED, createdAt = t0))
        val before = tasks.get(id)!!
        try {
            // Id repetido viola a chave primária: o INSERT do histórico falha dentro da transação.
            tasks.upsertWithChange(
                before.copy(dueAt = t1, status = TaskStatus.CANCELLED),
                CommitmentChange(id = existingChangeId, taskId = id, type = ChangeType.CANCELLED, createdAt = t0),
            )
            fail("a gravação deveria ter falhado")
        } catch (_: android.database.sqlite.SQLiteConstraintException) {
            // esperado
        }
        assertEquals(before, tasks.get(id))
        assertTrue(changes.forTask(id).none { it.type == ChangeType.CANCELLED })
    }
}
