package br.dev.aurora.core.repository

import br.dev.aurora.core.model.CalendarEvent
import br.dev.aurora.core.model.CommitmentChange
import br.dev.aurora.core.model.ConversationMessage
import br.dev.aurora.core.model.MemoryEntry
import br.dev.aurora.core.model.KnowledgeNote
import br.dev.aurora.core.model.Milestone
import br.dev.aurora.core.model.Objective
import br.dev.aurora.core.model.Project
import br.dev.aurora.core.model.Reminder
import br.dev.aurora.core.model.Task
import java.time.Instant
import kotlinx.coroutines.flow.Flow

interface TaskRepository {
    fun observeAll(): Flow<List<Task>>
    suspend fun getAll(): List<Task>
    suspend fun get(id: Long): Task?
    /** Insere ou atualiza; retorna o id persistido. */
    suspend fun upsert(task: Task): Long
    suspend fun delete(id: Long)
}

interface ReminderRepository {
    fun observeAll(): Flow<List<Reminder>>
    suspend fun getAll(): List<Reminder>
    suspend fun get(id: Long): Reminder?
    suspend fun upsert(reminder: Reminder): Long
    suspend fun delete(id: Long)
}

/** Notas do Caderno. A busca usa índice de texto completo no app. */
interface NoteRepository {
    fun observeAll(): Flow<List<KnowledgeNote>>
    suspend fun get(id: Long): KnowledgeNote?
    suspend fun search(query: String, limit: Int = 10): List<KnowledgeNote>
    suspend fun upsert(note: KnowledgeNote): Long
    suspend fun delete(id: Long)
}

interface ProjectRepository {
    fun observeAll(): Flow<List<Project>>
    suspend fun get(id: Long): Project?
    suspend fun upsert(project: Project): Long
    suspend fun delete(id: Long)
}

interface ObjectiveRepository {
    fun observeAll(): Flow<List<Objective>>
    suspend fun get(id: Long): Objective?
    suspend fun upsert(objective: Objective): Long
    suspend fun delete(id: Long)
    fun observeMilestones(objectiveId: Long): Flow<List<Milestone>>
    suspend fun upsertMilestone(milestone: Milestone): Long
    suspend fun deleteMilestone(id: Long)
}

/** Histórico factual de mudanças em compromissos (só inclusão; nunca editado). */
interface CommitmentChangeRepository {
    suspend fun record(change: CommitmentChange): Long
    suspend fun forTask(taskId: Long): List<CommitmentChange>
}

interface MemoryRepository {
    fun observeAll(): Flow<List<MemoryEntry>>
    suspend fun getAll(): List<MemoryEntry>
    suspend fun search(query: String, limit: Int = 5): List<MemoryEntry>
    suspend fun upsert(entry: MemoryEntry): Long
    suspend fun delete(id: Long)
    suspend fun clear()
}

interface ConversationRepository {
    fun observe(conversationId: String): Flow<List<ConversationMessage>>
    suspend fun recent(conversationId: String, limit: Int): List<ConversationMessage>
    suspend fun add(message: ConversationMessage): Long
    suspend fun clearAll()
}

/** Resultado honesto do agendamento: o app precisa saber se o alarme será exato. */
enum class ScheduleOutcome { EXACT, INEXACT, NOT_SCHEDULED_PAST, FAILED }

interface ReminderScheduler {
    suspend fun schedule(reminder: Reminder): ScheduleOutcome
    suspend fun cancel(reminderId: Long)
}

interface CalendarSource {
    /** false se o usuário não concedeu permissão ou desativou a integração. */
    suspend fun isAvailable(): Boolean
    suspend fun events(from: Instant, to: Instant): List<CalendarEvent>
}

enum class AppLaunchResult { OPENED, NOT_FOUND, AMBIGUOUS }

interface AppLauncher {
    suspend fun open(appName: String): AppLaunchResult
}

/** Estado das permissões e capacidades do aparelho, usado para respostas honestas. */
interface DeviceCapabilities {
    suspend fun notificationsAllowed(): Boolean
    suspend fun exactAlarmsAllowed(): Boolean
}
