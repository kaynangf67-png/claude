package br.dev.aurora.data.db

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

// Instantes guardados como epoch millis (UTC); exibição sempre no fuso do aparelho.

@Entity(tableName = "tasks", indices = [Index("status"), Index("due_at")])
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
)

@Entity(tableName = "reminders", indices = [Index("scheduled_at"), Index("enabled")])
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
)

@Entity(tableName = "notes")
data class NoteEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val content: String,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
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
