package br.dev.aurora.data.db

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Fts4
import androidx.room.FtsOptions
import androidx.room.Index
import androidx.room.PrimaryKey

// Instantes guardados como epoch millis (UTC); datas sem hora como epoch day (dias desde 1970-01-01).
// Exibição sempre no fuso do aparelho.
// Esquema v2: base compartilhada dos cinco pilares (tarefas, foco, caderno, hábitos, projetos).

@Entity(
    tableName = "objectives",
    indices = [Index("status")],
)
data class ObjectiveEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val description: String,
    val why: String,
    @ColumnInfo(name = "target_outcome") val targetOutcome: String,
    @ColumnInfo(name = "deadline_day") val deadlineDay: Long?,
    val priority: String,
    val status: String,
    @ColumnInfo(name = "weekly_minutes") val weeklyMinutes: Int?,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
)

@Entity(
    tableName = "milestones",
    foreignKeys = [ForeignKey(ObjectiveEntity::class, ["id"], ["objective_id"], onDelete = ForeignKey.CASCADE)],
    indices = [Index("objective_id")],
)
data class MilestoneEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "objective_id") val objectiveId: Long,
    val title: String,
    @ColumnInfo(name = "due_day") val dueDay: Long?,
    val done: Boolean,
    val position: Int,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
)

@Entity(
    tableName = "projects",
    foreignKeys = [ForeignKey(ObjectiveEntity::class, ["id"], ["objective_id"], onDelete = ForeignKey.SET_NULL)],
    indices = [Index("objective_id"), Index("status")],
)
data class ProjectEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val description: String,
    val status: String,
    @ColumnInfo(name = "objective_id") val objectiveId: Long?,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
)

@Entity(
    tableName = "tasks",
    foreignKeys = [
        ForeignKey(ProjectEntity::class, ["id"], ["project_id"], onDelete = ForeignKey.SET_NULL),
        ForeignKey(ObjectiveEntity::class, ["id"], ["objective_id"], onDelete = ForeignKey.SET_NULL),
        ForeignKey(MilestoneEntity::class, ["id"], ["milestone_id"], onDelete = ForeignKey.SET_NULL),
        ForeignKey(NoteEntity::class, ["id"], ["source_note_id"], onDelete = ForeignKey.SET_NULL),
    ],
    indices = [
        Index("status"), Index("due_at"), Index("project_id"), Index("objective_id"),
        Index("milestone_id"), Index("source_note_id"),
    ],
)
data class TaskEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val description: String,
    val priority: String,
    val status: String,
    @ColumnInfo(name = "due_at") val dueAt: Long?,
    @ColumnInfo(name = "due_all_day") val dueAllDay: Boolean,
    @ColumnInfo(name = "recurrence_rule") val recurrenceRule: String?,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
    @ColumnInfo(name = "completed_at") val completedAt: Long?,
    @ColumnInfo(name = "estimated_minutes") val estimatedMinutes: Int? = null,
    @ColumnInfo(name = "actual_minutes") val actualMinutes: Int? = null,
    @ColumnInfo(name = "project_id") val projectId: Long? = null,
    @ColumnInfo(name = "objective_id") val objectiveId: Long? = null,
    @ColumnInfo(name = "milestone_id") val milestoneId: Long? = null,
    @ColumnInfo(name = "source_note_id") val sourceNoteId: Long? = null,
)

@Entity(
    tableName = "commitment_changes",
    foreignKeys = [ForeignKey(TaskEntity::class, ["id"], ["task_id"], onDelete = ForeignKey.CASCADE)],
    indices = [Index("task_id")],
)
data class CommitmentChangeEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "task_id") val taskId: Long,
    val type: String,
    @ColumnInfo(name = "from_due_at") val fromDueAt: Long?,
    @ColumnInfo(name = "to_due_at") val toDueAt: Long?,
    val reason: String?,
    @ColumnInfo(name = "created_at") val createdAt: Long,
)

@Entity(
    tableName = "reminders",
    foreignKeys = [ForeignKey(TaskEntity::class, ["id"], ["task_id"], onDelete = ForeignKey.SET_NULL)],
    indices = [Index("scheduled_at"), Index("enabled"), Index("task_id")],
)
data class ReminderEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val details: String,
    @ColumnInfo(name = "scheduled_at") val scheduledAt: Long,
    @ColumnInfo(name = "recurrence_rule") val recurrenceRule: String?,
    val enabled: Boolean,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
    @ColumnInfo(name = "last_fired_at") val lastFiredAt: Long?,
    @ColumnInfo(name = "task_id") val taskId: Long? = null,
)

@Entity(
    tableName = "focus_sessions",
    foreignKeys = [
        ForeignKey(TaskEntity::class, ["id"], ["task_id"], onDelete = ForeignKey.SET_NULL),
        ForeignKey(ObjectiveEntity::class, ["id"], ["objective_id"], onDelete = ForeignKey.SET_NULL),
    ],
    indices = [Index("task_id"), Index("objective_id"), Index("started_at")],
)
data class FocusSessionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "task_id") val taskId: Long?,
    @ColumnInfo(name = "objective_id") val objectiveId: Long?,
    @ColumnInfo(name = "planned_minutes") val plannedMinutes: Int,
    @ColumnInfo(name = "started_at") val startedAt: Long,
    @ColumnInfo(name = "ended_at") val endedAt: Long?,
    @ColumnInfo(name = "paused_at") val pausedAt: Long?,
    @ColumnInfo(name = "paused_millis") val pausedMillis: Long,
    val status: String,
    val accomplished: String?,
    val obstacle: String?,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
)

@Entity(
    tableName = "habits",
    foreignKeys = [ForeignKey(ObjectiveEntity::class, ["id"], ["objective_id"], onDelete = ForeignKey.SET_NULL)],
    indices = [Index("objective_id")],
)
data class HabitEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val description: String,
    @ColumnInfo(name = "recurrence_rule") val recurrenceRule: String?,
    @ColumnInfo(name = "target_per_period") val targetPerPeriod: Int?,
    val active: Boolean,
    @ColumnInfo(name = "objective_id") val objectiveId: Long?,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
)

@Entity(
    tableName = "habit_checkins",
    foreignKeys = [ForeignKey(HabitEntity::class, ["id"], ["habit_id"], onDelete = ForeignKey.CASCADE)],
    indices = [Index(value = ["habit_id", "day"], unique = true)],
)
data class HabitCheckInEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "habit_id") val habitId: Long,
    val day: Long,
    val value: Int,
    val note: String?,
    @ColumnInfo(name = "created_at") val createdAt: Long,
)

@Entity(tableName = "books", indices = [Index("status")])
data class BookEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val author: String,
    val status: String,
    @ColumnInfo(name = "started_day") val startedDay: Long?,
    @ColumnInfo(name = "finished_day") val finishedDay: Long?,
    val topic: String,
    val rating: Int?,
    @ColumnInfo(name = "personal_summary") val personalSummary: String,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
)

/**
 * Nota do Caderno. A tabela mantém o nome "notes" da v1; a coluna `content` virou `original_content`
 * (o texto original nunca é sobrescrito).
 */
@Entity(
    tableName = "notes",
    foreignKeys = [
        ForeignKey(BookEntity::class, ["id"], ["book_id"], onDelete = ForeignKey.SET_NULL),
        ForeignKey(ProjectEntity::class, ["id"], ["project_id"], onDelete = ForeignKey.SET_NULL),
        ForeignKey(ObjectiveEntity::class, ["id"], ["objective_id"], onDelete = ForeignKey.SET_NULL),
    ],
    indices = [Index("book_id"), Index("project_id"), Index("objective_id"), Index("type"), Index("processing_status")],
)
data class NoteEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    @ColumnInfo(name = "original_content") val originalContent: String,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
    @ColumnInfo(name = "edited_content") val editedContent: String? = null,
    @ColumnInfo(name = "ai_summary") val aiSummary: String? = null,
    @ColumnInfo(name = "ai_summary_status", defaultValue = "NONE") val aiSummaryStatus: String = "NONE",
    @ColumnInfo(defaultValue = "GENERAL") val type: String = "GENERAL",
    val source: String? = null,
    @ColumnInfo(name = "source_url") val sourceUrl: String? = null,
    @ColumnInfo(name = "processing_status", defaultValue = "ORGANIZED") val processingStatus: String = "INBOX",
    val chapter: String? = null,
    @ColumnInfo(name = "book_id") val bookId: Long? = null,
    @ColumnInfo(name = "project_id") val projectId: Long? = null,
    @ColumnInfo(name = "objective_id") val objectiveId: Long? = null,
)

/**
 * Índice de texto completo das notas (sincronizado pelo Room via triggers). O tokenizador unicode61 sem
 * acentos faz "reunião" e "reuniao" serem equivalentes.
 */
@Fts4(contentEntity = NoteEntity::class, tokenizer = FtsOptions.TOKENIZER_UNICODE61, tokenizerArgs = ["remove_diacritics=1"])
@Entity(tableName = "notes_fts")
data class NoteFtsEntity(
    val title: String,
    @ColumnInfo(name = "original_content") val originalContent: String,
    @ColumnInfo(name = "edited_content") val editedContent: String?,
)

@Entity(tableName = "tags", indices = [Index(value = ["name"], unique = true)])
data class TagEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
)

@Entity(
    tableName = "note_tags",
    primaryKeys = ["note_id", "tag_id"],
    foreignKeys = [
        ForeignKey(NoteEntity::class, ["id"], ["note_id"], onDelete = ForeignKey.CASCADE),
        ForeignKey(TagEntity::class, ["id"], ["tag_id"], onDelete = ForeignKey.CASCADE),
    ],
    indices = [Index("tag_id")],
)
data class NoteTagCrossRef(
    @ColumnInfo(name = "note_id") val noteId: Long,
    @ColumnInfo(name = "tag_id") val tagId: Long,
)

@Entity(
    tableName = "note_links",
    foreignKeys = [
        ForeignKey(NoteEntity::class, ["id"], ["from_note_id"], onDelete = ForeignKey.CASCADE),
        ForeignKey(NoteEntity::class, ["id"], ["to_note_id"], onDelete = ForeignKey.CASCADE),
    ],
    indices = [Index(value = ["from_note_id", "to_note_id"], unique = true), Index("to_note_id")],
)
data class NoteLinkEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "from_note_id") val fromNoteId: Long,
    @ColumnInfo(name = "to_note_id") val toNoteId: Long,
    @ColumnInfo(name = "created_at") val createdAt: Long,
)

@Entity(tableName = "memory_entries")
data class MemoryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val category: String,
    val content: String,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
    @ColumnInfo(name = "user_approved") val userApproved: Boolean,
)

@Entity(tableName = "conversation_messages", indices = [Index("conversation_id")])
data class MessageEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "conversation_id") val conversationId: String,
    val role: String,
    val content: String,
    @ColumnInfo(name = "created_at") val createdAt: Long,
)
