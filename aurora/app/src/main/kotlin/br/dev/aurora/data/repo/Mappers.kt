package br.dev.aurora.data.repo

import br.dev.aurora.core.model.ChangeType
import br.dev.aurora.core.model.CommitmentChange
import br.dev.aurora.core.model.ConversationMessage
import br.dev.aurora.core.model.GoalStatus
import br.dev.aurora.core.model.KnowledgeNote
import br.dev.aurora.core.model.MemoryCategory
import br.dev.aurora.core.model.MemoryEntry
import br.dev.aurora.core.model.MessageRole
import br.dev.aurora.core.model.Milestone
import br.dev.aurora.core.model.NoteType
import br.dev.aurora.core.model.Objective
import br.dev.aurora.core.model.Priority
import br.dev.aurora.core.model.ProcessingStatus
import br.dev.aurora.core.model.Project
import br.dev.aurora.core.model.Recurrence
import br.dev.aurora.core.model.Reminder
import br.dev.aurora.core.model.SuggestionStatus
import br.dev.aurora.core.model.Task
import br.dev.aurora.core.model.TaskStatus
import br.dev.aurora.data.db.CommitmentChangeEntity
import br.dev.aurora.data.db.MemoryEntity
import br.dev.aurora.data.db.MessageEntity
import br.dev.aurora.data.db.MilestoneEntity
import br.dev.aurora.data.db.NoteEntity
import br.dev.aurora.data.db.ObjectiveEntity
import br.dev.aurora.data.db.ProjectEntity
import br.dev.aurora.data.db.ReminderEntity
import br.dev.aurora.data.db.TaskEntity
import java.time.Instant
import java.time.LocalDate

private inline fun <reified E : Enum<E>> enumOr(value: String, default: E): E =
    enumValues<E>().firstOrNull { it.name == value } ?: default

/** Valores da v1 ainda gravados em backups/exportações antigas. */
private fun taskStatus(value: String): TaskStatus = when (value) {
    "PENDING" -> TaskStatus.TODO
    "COMPLETED" -> TaskStatus.DONE
    else -> enumOr(value, TaskStatus.TODO)
}

private fun Long.toDate(): LocalDate = LocalDate.ofEpochDay(this)

fun TaskEntity.toModel() = Task(
    id = id, title = title, description = description,
    priority = enumOr(priority, Priority.MEDIUM), status = taskStatus(status),
    dueAt = dueAt?.let(Instant::ofEpochMilli), dueAllDay = dueAllDay, recurrence = Recurrence.parse(recurrenceRule),
    createdAt = Instant.ofEpochMilli(createdAt), updatedAt = Instant.ofEpochMilli(updatedAt),
    completedAt = completedAt?.let(Instant::ofEpochMilli),
    estimatedMinutes = estimatedMinutes, actualMinutes = actualMinutes,
    projectId = projectId, objectiveId = objectiveId, milestoneId = milestoneId, sourceNoteId = sourceNoteId,
)

fun Task.toEntity() = TaskEntity(
    id = id, title = title, description = description, priority = priority.name, status = status.name,
    dueAt = dueAt?.toEpochMilli(), dueAllDay = dueAllDay, recurrenceRule = recurrence?.toRule(),
    createdAt = createdAt.toEpochMilli(), updatedAt = updatedAt.toEpochMilli(), completedAt = completedAt?.toEpochMilli(),
    estimatedMinutes = estimatedMinutes, actualMinutes = actualMinutes,
    projectId = projectId, objectiveId = objectiveId, milestoneId = milestoneId, sourceNoteId = sourceNoteId,
)

fun ReminderEntity.toModel() = Reminder(
    id = id, title = title, details = details, scheduledAt = Instant.ofEpochMilli(scheduledAt),
    recurrence = Recurrence.parse(recurrenceRule), enabled = enabled,
    createdAt = Instant.ofEpochMilli(createdAt), updatedAt = Instant.ofEpochMilli(updatedAt),
    lastFiredAt = lastFiredAt?.let(Instant::ofEpochMilli), taskId = taskId,
)

fun Reminder.toEntity() = ReminderEntity(
    id = id, title = title, details = details, scheduledAt = scheduledAt.toEpochMilli(),
    recurrenceRule = recurrence?.toRule(), enabled = enabled,
    createdAt = createdAt.toEpochMilli(), updatedAt = updatedAt.toEpochMilli(), lastFiredAt = lastFiredAt?.toEpochMilli(),
    taskId = taskId,
)

fun NoteEntity.toModel() = KnowledgeNote(
    id = id, title = title, originalContent = originalContent, editedContent = editedContent,
    aiSummary = aiSummary, aiSummaryStatus = enumOr(aiSummaryStatus, SuggestionStatus.NONE),
    type = enumOr(type, NoteType.GENERAL), source = source, sourceUrl = sourceUrl,
    processingStatus = enumOr(processingStatus, ProcessingStatus.INBOX), chapter = chapter,
    bookId = bookId, projectId = projectId, objectiveId = objectiveId,
    createdAt = Instant.ofEpochMilli(createdAt), updatedAt = Instant.ofEpochMilli(updatedAt),
)

fun KnowledgeNote.toEntity() = NoteEntity(
    id = id, title = title, originalContent = originalContent,
    createdAt = createdAt.toEpochMilli(), updatedAt = updatedAt.toEpochMilli(),
    editedContent = editedContent, aiSummary = aiSummary, aiSummaryStatus = aiSummaryStatus.name, type = type.name,
    source = source, sourceUrl = sourceUrl, processingStatus = processingStatus.name, chapter = chapter,
    bookId = bookId, projectId = projectId, objectiveId = objectiveId,
)

fun MemoryEntity.toModel() = MemoryEntry(
    id, enumOr(category, MemoryCategory.OTHER), content, Instant.ofEpochMilli(createdAt), Instant.ofEpochMilli(updatedAt), userApproved,
)

fun MemoryEntry.toEntity() = MemoryEntity(id, category.name, content, createdAt.toEpochMilli(), updatedAt.toEpochMilli(), userApproved)

fun MessageEntity.toModel() = ConversationMessage(id, conversationId, enumOr(role, MessageRole.USER), content, Instant.ofEpochMilli(createdAt))

fun ConversationMessage.toEntity() = MessageEntity(id, conversationId, role.name, content, createdAt.toEpochMilli())

fun ProjectEntity.toModel() = Project(
    id, name, description, enumOr(status, GoalStatus.ACTIVE), objectiveId, Instant.ofEpochMilli(createdAt), Instant.ofEpochMilli(updatedAt),
)

fun Project.toEntity() = ProjectEntity(id, name, description, status.name, objectiveId, createdAt.toEpochMilli(), updatedAt.toEpochMilli())

fun ObjectiveEntity.toModel() = Objective(
    id = id, name = name, description = description, why = why, targetOutcome = targetOutcome,
    deadline = deadlineDay?.toDate(), priority = enumOr(priority, Priority.MEDIUM), status = enumOr(status, GoalStatus.ACTIVE),
    weeklyMinutes = weeklyMinutes, createdAt = Instant.ofEpochMilli(createdAt), updatedAt = Instant.ofEpochMilli(updatedAt),
)

fun Objective.toEntity() = ObjectiveEntity(
    id, name, description, why, targetOutcome, deadline?.toEpochDay(), priority.name, status.name, weeklyMinutes,
    createdAt.toEpochMilli(), updatedAt.toEpochMilli(),
)

fun MilestoneEntity.toModel() = Milestone(
    id, objectiveId, title, dueDay?.toDate(), done, position, Instant.ofEpochMilli(createdAt), Instant.ofEpochMilli(updatedAt),
)

fun Milestone.toEntity() = MilestoneEntity(
    id, objectiveId, title, dueDate?.toEpochDay(), done, position, createdAt.toEpochMilli(), updatedAt.toEpochMilli(),
)

fun CommitmentChangeEntity.toModel() = CommitmentChange(
    id, taskId, enumOr(type, ChangeType.RESCHEDULED), fromDueAt?.let(Instant::ofEpochMilli), toDueAt?.let(Instant::ofEpochMilli),
    reason, Instant.ofEpochMilli(createdAt),
)

fun CommitmentChange.toEntity() = CommitmentChangeEntity(
    id, taskId, type.name, fromDueAt?.toEpochMilli(), toDueAt?.toEpochMilli(), reason, createdAt.toEpochMilli(),
)
