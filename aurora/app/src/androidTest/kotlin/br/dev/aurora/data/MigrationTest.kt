package br.dev.aurora.data

import androidx.room.Room
import androidx.room.testing.MigrationTestHelper
import androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import br.dev.aurora.data.db.AuroraDatabase
import br.dev.aurora.data.db.Migration1To2
import br.dev.aurora.data.repo.RoomNoteRepository
import kotlinx.coroutines.test.runTest
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Garante que dados criados na v1 sobrevivem à migração para a v2. */
@RunWith(AndroidJUnit4::class)
class MigrationTest {
    private val dbName = "migration-test.db"

    @get:Rule
    val helper = MigrationTestHelper(
        InstrumentationRegistry.getInstrumentation(),
        AuroraDatabase::class.java,
        listOf(Migration1To2()),
        FrameworkSQLiteOpenHelperFactory(),
    )

    @Test
    fun migra1Para2PreservandoDados() = runTest {
        helper.createDatabase(dbName, 1).apply {
            execSQL(
                "INSERT INTO tasks (id, title, description, priority, status, due_at, due_all_day, recurrence_rule, created_at, updated_at, completed_at) " +
                    "VALUES (1, 'Pagar aluguel', '', 'HIGH', 'PENDING', 1000, 1, NULL, 10, 10, NULL)",
            )
            execSQL(
                "INSERT INTO tasks (id, title, description, priority, status, due_at, due_all_day, recurrence_rule, created_at, updated_at, completed_at) " +
                    "VALUES (2, 'Lavar o carro', '', 'MEDIUM', 'COMPLETED', NULL, 0, NULL, 10, 20, 20)",
            )
            execSQL(
                "INSERT INTO reminders (id, title, details, scheduled_at, recurrence_rule, enabled, created_at, updated_at, last_fired_at) " +
                    "VALUES (1, 'Remédio', '', 5000, 'FREQ=DAILY;INTERVAL=1', 1, 10, 10, NULL)",
            )
            execSQL("INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (1, 'Ideia', 'Reunião sobre vendas online', 10, 10)")
            execSQL("INSERT INTO memory_entries (id, category, content, created_at, updated_at, user_approved) VALUES (1, 'FACT', 'Mora em Recife', 10, 10, 1)")
            execSQL("INSERT INTO conversation_messages (id, conversation_id, role, content, created_at) VALUES (1, 'principal', 'USER', 'oi', 10)")
            close()
        }

        // Valida o esquema v2 contra app/schemas/.../2.json (inclusive chaves estrangeiras e FTS).
        helper.runMigrationsAndValidate(dbName, 2, true).use { db ->
            db.query("SELECT status FROM tasks ORDER BY id").use { c ->
                c.moveToNext(); assertEquals("TODO", c.getString(0))
                c.moveToNext(); assertEquals("DONE", c.getString(0))
            }
            db.query("SELECT original_content, edited_content, type, processing_status FROM notes WHERE id = 1").use { c ->
                assertTrue(c.moveToFirst())
                assertEquals("Reunião sobre vendas online", c.getString(0))
                assertTrue(c.isNull(1))
                assertEquals("GENERAL", c.getString(2))
                assertEquals("ORGANIZED", c.getString(3))
            }
            db.query("SELECT COUNT(*) FROM reminders").use { c -> c.moveToFirst(); assertEquals(1, c.getInt(0)) }
            db.query("SELECT COUNT(*) FROM memory_entries").use { c -> c.moveToFirst(); assertEquals(1, c.getInt(0)) }
            db.query("SELECT COUNT(*) FROM conversation_messages").use { c -> c.moveToFirst(); assertEquals(1, c.getInt(0)) }
        }

        // Abre com o Room de verdade: a nota antiga precisa aparecer na busca de texto completo (sem acento).
        val room = Room.databaseBuilder(ApplicationProvider.getApplicationContext(), AuroraDatabase::class.java, dbName).build()
        try {
            val found = RoomNoteRepository(room).search("reuniao vendas", 5)
            assertEquals(listOf(1L), found.map { it.id })
            val task = room.tasks().get(1)!!
            assertNull(task.projectId)
            assertEquals("Pagar aluguel", task.title)
        } finally {
            room.close()
        }
    }
}
