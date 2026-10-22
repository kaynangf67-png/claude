package br.dev.aurora.data.db

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface TaskDao {
    @Query("SELECT * FROM tasks ORDER BY status ASC, due_at IS NULL, due_at ASC, id DESC")
    fun observeAll(): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks")
    suspend fun getAll(): List<TaskEntity>

    @Query("SELECT * FROM tasks WHERE id = :id")
    suspend fun get(id: Long): TaskEntity?

    @Upsert
    suspend fun upsert(entity: TaskEntity): Long

    @Query("DELETE FROM tasks WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("DELETE FROM tasks")
    suspend fun clear()
}

@Dao
interface ReminderDao {
    @Query("SELECT * FROM reminders ORDER BY scheduled_at ASC")
    fun observeAll(): Flow<List<ReminderEntity>>

    @Query("SELECT * FROM reminders")
    suspend fun getAll(): List<ReminderEntity>

    @Query("SELECT * FROM reminders WHERE id = :id")
    suspend fun get(id: Long): ReminderEntity?

    @Upsert
    suspend fun upsert(entity: ReminderEntity): Long

    @Query("DELETE FROM reminders WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("DELETE FROM reminders")
    suspend fun clear()
}

@Dao
interface NoteDao {
    @Query("SELECT * FROM notes ORDER BY updated_at DESC")
    fun observeAll(): Flow<List<NoteEntity>>

    @Query("SELECT * FROM notes")
    suspend fun getAll(): List<NoteEntity>

    @Query("SELECT * FROM notes WHERE id = :id")
    suspend fun get(id: Long): NoteEntity?

    @Upsert
    suspend fun upsert(entity: NoteEntity): Long

    @Query("DELETE FROM notes WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("DELETE FROM notes")
    suspend fun clear()
}

@Dao
interface MemoryDao {
    @Query("SELECT * FROM memory_entries ORDER BY updated_at DESC")
    fun observeAll(): Flow<List<MemoryEntity>>

    @Query("SELECT * FROM memory_entries")
    suspend fun getAll(): List<MemoryEntity>

    @Upsert
    suspend fun upsert(entity: MemoryEntity): Long

    @Query("DELETE FROM memory_entries WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("DELETE FROM memory_entries")
    suspend fun clear()
}

@Dao
interface MessageDao {
    @Query("SELECT * FROM conversation_messages WHERE conversation_id = :conversationId ORDER BY id ASC")
    fun observe(conversationId: String): Flow<List<MessageEntity>>

    @Query("SELECT * FROM (SELECT * FROM conversation_messages WHERE conversation_id = :conversationId ORDER BY id DESC LIMIT :limit) ORDER BY id ASC")
    suspend fun recent(conversationId: String, limit: Int): List<MessageEntity>

    @Query("SELECT * FROM conversation_messages ORDER BY id ASC")
    suspend fun getAll(): List<MessageEntity>

    @Upsert
    suspend fun insert(entity: MessageEntity): Long

    @Query("DELETE FROM conversation_messages")
    suspend fun clear()
}
