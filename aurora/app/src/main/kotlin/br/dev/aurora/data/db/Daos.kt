package br.dev.aurora.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
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

    /** Busca de texto completo. [match] deve vir pronto de [FtsQuery.build]. */
    @Query(
        "SELECT notes.* FROM notes JOIN notes_fts ON notes.id = notes_fts.rowid " +
            "WHERE notes_fts MATCH :match ORDER BY notes.updated_at DESC LIMIT :limit",
    )
    suspend fun search(match: String, limit: Int): List<NoteEntity>
}

@Dao
interface ProjectDao {
    @Query("SELECT * FROM projects ORDER BY status ASC, updated_at DESC")
    fun observeAll(): Flow<List<ProjectEntity>>

    @Query("SELECT * FROM projects WHERE id = :id")
    suspend fun get(id: Long): ProjectEntity?

    @Upsert
    suspend fun upsert(entity: ProjectEntity): Long

    @Query("DELETE FROM projects WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("DELETE FROM projects")
    suspend fun clear()
}

@Dao
interface ObjectiveDao {
    @Query("SELECT * FROM objectives ORDER BY status ASC, priority DESC, updated_at DESC")
    fun observeAll(): Flow<List<ObjectiveEntity>>

    @Query("SELECT * FROM objectives WHERE id = :id")
    suspend fun get(id: Long): ObjectiveEntity?

    @Upsert
    suspend fun upsert(entity: ObjectiveEntity): Long

    @Query("DELETE FROM objectives WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("SELECT * FROM milestones WHERE objective_id = :objectiveId ORDER BY position ASC, id ASC")
    fun observeMilestones(objectiveId: Long): Flow<List<MilestoneEntity>>

    @Upsert
    suspend fun upsertMilestone(entity: MilestoneEntity): Long

    @Query("DELETE FROM milestones WHERE id = :id")
    suspend fun deleteMilestone(id: Long)

    @Query("DELETE FROM objectives")
    suspend fun clear()
}

@Dao
interface CommitmentChangeDao {
    @Insert
    suspend fun insert(entity: CommitmentChangeEntity): Long

    @Query("SELECT * FROM commitment_changes WHERE task_id = :taskId ORDER BY created_at ASC")
    suspend fun forTask(taskId: Long): List<CommitmentChangeEntity>
}

@Dao
interface FocusSessionDao {
    @Query("SELECT * FROM focus_sessions ORDER BY started_at DESC")
    fun observeAll(): Flow<List<FocusSessionEntity>>

    @Upsert
    suspend fun upsert(entity: FocusSessionEntity): Long

    @Query("DELETE FROM focus_sessions")
    suspend fun clear()
}

@Dao
interface HabitDao {
    @Query("SELECT * FROM habits ORDER BY active DESC, name ASC")
    fun observeAll(): Flow<List<HabitEntity>>

    @Upsert
    suspend fun upsert(entity: HabitEntity): Long

    @Upsert
    suspend fun upsertCheckIn(entity: HabitCheckInEntity): Long

    @Query("SELECT * FROM habit_checkins WHERE habit_id = :habitId ORDER BY day DESC")
    suspend fun checkIns(habitId: Long): List<HabitCheckInEntity>

    @Query("DELETE FROM habits")
    suspend fun clear()
}

@Dao
interface BookDao {
    @Query("SELECT * FROM books ORDER BY updated_at DESC")
    fun observeAll(): Flow<List<BookEntity>>

    @Upsert
    suspend fun upsert(entity: BookEntity): Long

    @Query("DELETE FROM books")
    suspend fun clear()
}

@Dao
interface TagDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(entity: TagEntity): Long

    @Query("SELECT * FROM tags WHERE name = :name")
    suspend fun byName(name: String): TagEntity?

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun attach(ref: NoteTagCrossRef)

    @Query("SELECT tags.* FROM tags JOIN note_tags ON tags.id = note_tags.tag_id WHERE note_tags.note_id = :noteId ORDER BY tags.name")
    suspend fun forNote(noteId: Long): List<TagEntity>
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
