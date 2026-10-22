package br.dev.aurora.data

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import br.dev.aurora.data.db.AuroraDatabase
import br.dev.aurora.data.db.TaskEntity
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.test.assertEquals

@RunWith(AndroidJUnit4::class)
class DatabaseSmokeTest {
    private lateinit var db: AuroraDatabase

    @Before fun setUp() {
        db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), AuroraDatabase::class.java).build()
    }

    @After fun tearDown() = db.close()

    @Test fun gravaELeTarefa() = runTest {
        val id = db.tasks().upsert(TaskEntity(0, "Teste", "", "MEDIUM", "PENDING", null, false, null, 1, 1, null))
        assertEquals("Teste", db.tasks().get(id)?.title)
    }
}
