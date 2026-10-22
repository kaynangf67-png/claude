package br.dev.aurora.core

import br.dev.aurora.core.model.CalendarEvent
import br.dev.aurora.core.model.ConversationMessage
import br.dev.aurora.core.model.MemoryEntry
import br.dev.aurora.core.model.KnowledgeNote
import br.dev.aurora.core.model.Reminder
import br.dev.aurora.core.model.Task
import br.dev.aurora.core.orchestrator.AssistantDependencies
import br.dev.aurora.core.provider.TokenUsage
import br.dev.aurora.core.provider.UsageLedger
import br.dev.aurora.core.repository.AppLaunchResult
import br.dev.aurora.core.repository.AppLauncher
import br.dev.aurora.core.repository.CalendarSource
import br.dev.aurora.core.repository.CommitmentChangeRepository
import br.dev.aurora.core.model.CommitmentChange
import br.dev.aurora.core.repository.Connectivity
import br.dev.aurora.core.repository.ConversationRepository
import br.dev.aurora.core.repository.DeviceCapabilities
import br.dev.aurora.core.repository.MemoryRepository
import br.dev.aurora.core.repository.NoteRepository
import br.dev.aurora.core.repository.ReminderRepository
import br.dev.aurora.core.repository.ReminderScheduler
import br.dev.aurora.core.repository.ScheduleOutcome
import br.dev.aurora.core.repository.TaskRepository
import br.dev.aurora.core.text.PtText
import java.time.Instant
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow

// Implementações em memória usadas SOMENTE nos testes.

class InMemoryTasks : TaskRepository {
    val items = MutableStateFlow<Map<Long, Task>>(emptyMap())
    private var next = 1L
    override fun observeAll(): Flow<List<Task>> = MutableStateFlow(items.value.values.toList())
    override suspend fun getAll() = items.value.values.toList()
    override suspend fun get(id: Long) = items.value[id]
    override suspend fun upsert(task: Task): Long {
        val id = if (task.id == 0L) next++ else task.id
        items.value = items.value + (id to task.copy(id = id))
        return id
    }
    override suspend fun delete(id: Long) { items.value = items.value - id }
}

class InMemoryReminders : ReminderRepository {
    val items = MutableStateFlow<Map<Long, Reminder>>(emptyMap())
    private var next = 1L
    override fun observeAll(): Flow<List<Reminder>> = MutableStateFlow(items.value.values.toList())
    override suspend fun getAll() = items.value.values.toList()
    override suspend fun get(id: Long) = items.value[id]
    override suspend fun upsert(reminder: Reminder): Long {
        val id = if (reminder.id == 0L) next++ else reminder.id
        items.value = items.value + (id to reminder.copy(id = id))
        return id
    }
    override suspend fun delete(id: Long) { items.value = items.value - id }
}

class InMemoryNotes : NoteRepository {
    val items = mutableMapOf<Long, KnowledgeNote>()
    private var next = 1L
    override fun observeAll(): Flow<List<KnowledgeNote>> = MutableStateFlow(items.values.toList())
    override suspend fun get(id: Long) = items[id]
    override suspend fun search(query: String, limit: Int) =
        items.values.filter { PtText.fold(it.content).contains(PtText.fold(query)) }.take(limit)
    override suspend fun upsert(note: KnowledgeNote): Long {
        val id = if (note.id == 0L) next++ else note.id
        items[id] = note.copy(id = id)
        return id
    }
    override suspend fun delete(id: Long) { items.remove(id) }
}

class InMemoryMemory : MemoryRepository {
    val items = mutableMapOf<Long, MemoryEntry>()
    private var next = 1L
    override fun observeAll(): Flow<List<MemoryEntry>> = MutableStateFlow(items.values.toList())
    override suspend fun getAll() = items.values.toList()
    override suspend fun search(query: String, limit: Int): List<MemoryEntry> {
        val words = PtText.fold(query).split(Regex("\\W+")).filter { it.length > 3 }
        return items.values.filter { e -> words.any { PtText.fold(e.content).contains(it) } }.take(limit)
    }
    override suspend fun upsert(entry: MemoryEntry): Long {
        val id = if (entry.id == 0L) next++ else entry.id
        items[id] = entry.copy(id = id)
        return id
    }
    override suspend fun delete(id: Long) { items.remove(id) }
    override suspend fun clear() = items.clear()
}

class InMemoryConversation : ConversationRepository {
    val items = mutableListOf<ConversationMessage>()
    override fun observe(conversationId: String): Flow<List<ConversationMessage>> = MutableStateFlow(items.toList())
    override suspend fun recent(conversationId: String, limit: Int) = items.filter { it.conversationId == conversationId }.takeLast(limit)
    override suspend fun add(message: ConversationMessage): Long { items += message.copy(id = items.size + 1L); return items.size.toLong() }
    override suspend fun clearAll() = items.clear()
}

class InMemoryCommitments : CommitmentChangeRepository {
    val items = mutableListOf<CommitmentChange>()
    override suspend fun record(change: CommitmentChange): Long { items += change.copy(id = items.size + 1L); return items.size.toLong() }
    override suspend fun forTask(taskId: Long) = items.filter { it.taskId == taskId }
}

class FakeScheduler(var outcome: ScheduleOutcome = ScheduleOutcome.EXACT) : ReminderScheduler {
    val scheduled = mutableMapOf<Long, Instant>()
    override suspend fun schedule(reminder: Reminder): ScheduleOutcome {
        if (outcome != ScheduleOutcome.FAILED) scheduled[reminder.id] = reminder.scheduledAt
        return outcome
    }
    override suspend fun cancel(reminderId: Long) { scheduled.remove(reminderId) }
}

class FakeCalendar(var events: List<CalendarEvent> = emptyList(), var available: Boolean = true) : CalendarSource {
    override suspend fun isAvailable() = available
    override suspend fun events(from: Instant, to: Instant) = events.filter { it.start < to && it.end > from }
}

class FakeApps(private val installed: Set<String> = setOf("whatsapp", "spotify")) : AppLauncher {
    override suspend fun open(appName: String) =
        if (appName.lowercase() in installed) AppLaunchResult.OPENED else AppLaunchResult.NOT_FOUND
}

class FakeCapabilities(var notifications: Boolean = true, var exact: Boolean = true) : DeviceCapabilities {
    override suspend fun notificationsAllowed() = notifications
    override suspend fun exactAlarmsAllowed() = exact
}

class FakeLedger(var spent: Double = 0.0) : UsageLedger {
    override suspend fun monthToDateUsd() = spent
    override suspend fun record(usd: Double, usage: TokenUsage) { spent += usd }
}

class FakeConnectivity(var online: Boolean = true) : Connectivity {
    override fun isOnline() = online
}

class TestWorld {
    val tasks = InMemoryTasks()
    val reminders = InMemoryReminders()
    val notes = InMemoryNotes()
    val memory = InMemoryMemory()
    val conversation = InMemoryConversation()
    val scheduler = FakeScheduler()
    val calendar = FakeCalendar()
    val apps = FakeApps()
    val capabilities = FakeCapabilities()
    val commitments = InMemoryCommitments()
    val deps = AssistantDependencies(tasks, reminders, notes, memory, scheduler, calendar, apps, capabilities, commitments)
}
