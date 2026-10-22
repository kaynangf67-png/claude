package br.dev.aurora.data.db

import android.content.Context
import androidx.room.AutoMigration
import androidx.room.Database
import androidx.room.RenameColumn
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.AutoMigrationSpec
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Histórico do esquema (arquivos em app/schemas, conferidos pelo CI):
 * - v1: tarefas, lembretes, notas simples, memória, conversa.
 * - v2: base dos cinco pilares (objetivos, marcos, projetos, histórico de compromissos, sessões de foco,
 *   hábitos, livros, tags, ligações) + notas do Caderno com original preservado e busca de texto completo.
 *
 * Nunca usar destructive migration: os dados são pessoais.
 */
@Database(
    entities = [
        ObjectiveEntity::class, MilestoneEntity::class, ProjectEntity::class, TaskEntity::class,
        CommitmentChangeEntity::class, ReminderEntity::class, FocusSessionEntity::class, HabitEntity::class,
        HabitCheckInEntity::class, BookEntity::class, NoteEntity::class, NoteFtsEntity::class, TagEntity::class,
        NoteTagCrossRef::class, NoteLinkEntity::class, MemoryEntity::class, MessageEntity::class,
    ],
    version = 2,
    exportSchema = true,
    autoMigrations = [AutoMigration(from = 1, to = 2, spec = Migration1To2::class)],
)
abstract class AuroraDatabase : RoomDatabase() {
    abstract fun tasks(): TaskDao
    abstract fun reminders(): ReminderDao
    abstract fun notes(): NoteDao
    abstract fun memory(): MemoryDao
    abstract fun messages(): MessageDao
    abstract fun projects(): ProjectDao
    abstract fun objectives(): ObjectiveDao
    abstract fun commitmentChanges(): CommitmentChangeDao
    abstract fun focusSessions(): FocusSessionDao
    abstract fun habits(): HabitDao
    abstract fun books(): BookDao
    abstract fun tags(): TagDao

    companion object {
        const val NAME = "aurora.db"

        fun create(context: Context): AuroraDatabase =
            Room.databaseBuilder(context, AuroraDatabase::class.java, NAME).build()
    }
}

/** 1 → 2: "content" das notas vira o conteúdo original; status de tarefa passam para os cinco novos. */
@RenameColumn(tableName = "notes", fromColumnName = "content", toColumnName = "original_content")
class Migration1To2 : AutoMigrationSpec {
    override fun onPostMigrate(db: SupportSQLiteDatabase) {
        db.execSQL("UPDATE tasks SET status = 'TODO' WHERE status = 'PENDING'")
        db.execSQL("UPDATE tasks SET status = 'DONE' WHERE status = 'COMPLETED'")
        // Notas existentes entram no índice de busca.
        db.execSQL("INSERT INTO notes_fts(notes_fts) VALUES('rebuild')")
    }
}
