package br.dev.aurora.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

/**
 * Versão 1 do esquema. Mudanças futuras devem vir com [androidx.room.migration.Migration] explícita
 * (o esquema é exportado em app/schemas para comparação) — nada de destructive migration com dados pessoais.
 */
@Database(
    entities = [TaskEntity::class, ReminderEntity::class, NoteEntity::class, MemoryEntity::class, MessageEntity::class],
    version = 1,
    exportSchema = true,
)
abstract class AuroraDatabase : RoomDatabase() {
    abstract fun tasks(): TaskDao
    abstract fun reminders(): ReminderDao
    abstract fun notes(): NoteDao
    abstract fun memory(): MemoryDao
    abstract fun messages(): MessageDao

    companion object {
        fun create(context: Context): AuroraDatabase =
            Room.databaseBuilder(context, AuroraDatabase::class.java, "aurora.db").build()
    }
}
