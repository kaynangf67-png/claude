package br.dev.aurora.data.repo

import br.dev.aurora.core.model.ConversationMessage
import br.dev.aurora.core.model.MemoryCategory
import br.dev.aurora.core.model.MemoryEntry
import br.dev.aurora.core.model.MessageRole
import br.dev.aurora.core.model.Note
import br.dev.aurora.core.model.Priority
import br.dev.aurora.core.model.Recurrence
import br.dev.aurora.core.model.Reminder
import br.dev.aurora.core.model.Task
import br.dev.aurora.core.model.TaskStatus
import br.dev.aurora.data.db.MemoryEntity
import br.dev.aurora.data.db.MessageEntity
import br.dev.aurora.data.db.NoteEntity
import br.dev.aurora.data.db.ReminderEntity
import br.dev.aurora.data.db.TaskEntity
import java.time.Instant

private inline fun <reified E : Enum<E>> enumOr(value: String, default: E): E =
    enumValues<E>().firstOrNull { it.name == value } ?: default

fun TaskEntity.toModel() = Task(
    id = id, title = title, description = description,
    priority = enumOr(priority, Priority.MEDIUM), status = enumOr(status, TaskStatus.PENDING),
    dueAt = dueAt?.let(Instant::ofEpochMilli), dueAllDay = dueAllDay, recurrence = Recurrence.parse(recurrenceRule),
    createdAt = Instant.ofEpochMilli(createdAt), updatedAt = Instant.ofEpochMilli(updatedAt),
    completedAt = completedAt?.let(Instant::ofEpochMilli),
)

fun Task.toEntity() = TaskEntity(
    id = id, title = title, description = description, priority = priority.name, status = status.name,
    dueAt = dueAt?.toEpochMilli(), dueAllDay = dueAllDay, recurrenceRule = recurrence?.toRule(),
    createdAt = createdAt.toEpochMilli(), updatedAt = updatedAt.toEpochMilli(), completedAt = completedAt?.toEpochMilli(),
)

fun ReminderEntity.toModel() = Reminder(
    id = id, title = title, details = details, scheduledAt = Instant.ofEpochMilli(scheduledAt),
    recurrence = Recurrence.parse(recurrenceRule), enabled = enabled,
    createdAt = Instant.ofEpochMilli(createdAt), updatedAt = Instant.ofEpochMilli(updatedAt),
    lastFiredAt = lastFiredAt?.let(Instant::ofEpochMilli),
)

fun Reminder.toEntity() = ReminderEntity(
    id = id, title = title, details = details, scheduledAt = scheduledAt.toEpochMilli(),
    recurrenceRule = recurrence?.toRule(), enabled = enabled,
    createdAt = createdAt.toEpochMilli(), updatedAt = updatedAt.toEpochMilli(), lastFiredAt = lastFiredAt?.toEpochMilli(),
)

fun NoteEntity.toModel() = Note(id, title, content, Instant.ofEpochMilli(createdAt), Instant.ofEpochMilli(updatedAt))

fun Note.toEntity() = NoteEntity(id, title, content, createdAt.toEpochMilli(), updatedAt.toEpochMilli())

fun MemoryEntity.toModel() = MemoryEntry(
    id, enumOr(category, MemoryCategory.OTHER), content, Instant.ofEpochMilli(createdAt), Instant.ofEpochMilli(updatedAt), userApproved,
)

fun MemoryEntry.toEntity() = MemoryEntity(id, category.name, content, createdAt.toEpochMilli(), updatedAt.toEpochMilli(), userApproved)

fun MessageEntity.toModel() = ConversationMessage(id, conversationId, enumOr(role, MessageRole.USER), content, Instant.ofEpochMilli(createdAt))

fun ConversationMessage.toEntity() = MessageEntity(id, conversationId, role.name, content, createdAt.toEpochMilli())
