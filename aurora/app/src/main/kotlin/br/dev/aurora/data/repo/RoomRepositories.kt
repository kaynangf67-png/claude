package br.dev.aurora.data.repo

import br.dev.aurora.core.model.ConversationMessage
import br.dev.aurora.core.model.MemoryEntry
import br.dev.aurora.core.model.CommitmentChange
import br.dev.aurora.core.model.KnowledgeNote
import br.dev.aurora.core.model.Milestone
import br.dev.aurora.core.model.Objective
import br.dev.aurora.core.model.Project
import br.dev.aurora.core.model.Reminder
import br.dev.aurora.core.model.Task
import br.dev.aurora.core.repository.CommitmentChangeRepository
import br.dev.aurora.core.repository.ConversationRepository
import br.dev.aurora.core.repository.MemoryRepository
import br.dev.aurora.core.repository.NoteRepository
import br.dev.aurora.core.repository.ObjectiveRepository
import br.dev.aurora.core.repository.ProjectRepository
import br.dev.aurora.core.repository.ReminderRepository
import br.dev.aurora.core.repository.TaskRepository
import br.dev.aurora.core.text.PtText
import br.dev.aurora.data.db.AuroraDatabase
import br.dev.aurora.data.db.FtsQuery
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/** @Upsert devolve -1 quando atualiza uma linha existente; nesse caso o id é o próprio. */
private fun upsertedId(existing: Long, returned: Long) = if (existing != 0L) existing else returned

class RoomTaskRepository(private val db: AuroraDatabase) : TaskRepository {
    override fun observeAll(): Flow<List<Task>> = db.tasks().observeAll().map { l -> l.map { it.toModel() } }
    override suspend fun getAll() = db.tasks().getAll().map { it.toModel() }
    override suspend fun get(id: Long) = db.tasks().get(id)?.toModel()
    override suspend fun upsert(task: Task) = upsertedId(task.id, db.tasks().upsert(task.toEntity()))
    override suspend fun delete(id: Long) = db.tasks().delete(id)
}

class RoomReminderRepository(private val db: AuroraDatabase) : ReminderRepository {
    override fun observeAll(): Flow<List<Reminder>> = db.reminders().observeAll().map { l -> l.map { it.toModel() } }
    override suspend fun getAll() = db.reminders().getAll().map { it.toModel() }
    override suspend fun get(id: Long) = db.reminders().get(id)?.toModel()
    override suspend fun upsert(reminder: Reminder) = upsertedId(reminder.id, db.reminders().upsert(reminder.toEntity()))
    override suspend fun delete(id: Long) = db.reminders().delete(id)
}

/**
 * Busca simples e local: todas as palavras significativas precisam aparecer (sem acento/caixa).
 * Para o volume de um usuário (centenas de notas) isso é suficiente e não exige FTS.
 */
internal fun matchesQuery(text: String, query: String): Boolean {
    val words = PtText.fold(query).split(Regex("[^\\p{L}\\p{N}]+")).filter { it.length >= 3 && it !in STOP_WORDS }
    if (words.isEmpty()) return PtText.fold(text).contains(PtText.fold(query).trim())
    val folded = PtText.fold(text)
    return words.all { folded.contains(it) }
}

/** Pontuação para memória: quantas palavras do pedido aparecem (basta uma). */
internal fun memoryScore(text: String, query: String): Int {
    val words = PtText.fold(query).split(Regex("[^\\p{L}\\p{N}]+")).filter { it.length >= 4 && it !in STOP_WORDS }
    val folded = PtText.fold(text)
    return words.count { folded.contains(it) }
}

private val STOP_WORDS = setOf(
    "que", "para", "pra", "com", "uma", "uns", "umas", "dos", "das", "nos", "nas", "por", "mais", "como", "qual",
    "quais", "voce", "minha", "meu", "minhas", "meus", "sobre", "isso", "esse", "essa", "este", "esta", "tenho",
    "quero", "sabe", "mesmo", "eu", "ela", "ele", "tem", "ser", "foi", "era",
)

class RoomNoteRepository(private val db: AuroraDatabase) : NoteRepository {
    override fun observeAll(): Flow<List<KnowledgeNote>> = db.notes().observeAll().map { l -> l.map { it.toModel() } }
    override suspend fun get(id: Long) = db.notes().get(id)?.toModel()

    /** Índice de texto completo; sem resultado (ou consulta inválida), cai na busca linear por palavras. */
    override suspend fun search(query: String, limit: Int): List<KnowledgeNote> {
        val fts = FtsQuery.build(query)?.let { m -> runCatching { db.notes().search(m, limit) }.getOrNull() }.orEmpty()
        if (fts.isNotEmpty()) return fts.map { it.toModel() }
        return db.notes().getAll().map { it.toModel() }
            .filter { matchesQuery(it.title + " " + it.content, query) }
            .sortedByDescending { it.updatedAt }.take(limit)
    }

    override suspend fun upsert(note: KnowledgeNote) = upsertedId(note.id, db.notes().upsert(note.toEntity()))
    override suspend fun delete(id: Long) = db.notes().delete(id)
}

class RoomProjectRepository(private val db: AuroraDatabase) : ProjectRepository {
    override fun observeAll(): Flow<List<Project>> = db.projects().observeAll().map { l -> l.map { it.toModel() } }
    override suspend fun get(id: Long) = db.projects().get(id)?.toModel()
    override suspend fun upsert(project: Project) = upsertedId(project.id, db.projects().upsert(project.toEntity()))
    override suspend fun delete(id: Long) = db.projects().delete(id)
}

class RoomObjectiveRepository(private val db: AuroraDatabase) : ObjectiveRepository {
    override fun observeAll(): Flow<List<Objective>> = db.objectives().observeAll().map { l -> l.map { it.toModel() } }
    override suspend fun get(id: Long) = db.objectives().get(id)?.toModel()
    override suspend fun upsert(objective: Objective) = upsertedId(objective.id, db.objectives().upsert(objective.toEntity()))
    override suspend fun delete(id: Long) = db.objectives().delete(id)
    override fun observeMilestones(objectiveId: Long): Flow<List<Milestone>> =
        db.objectives().observeMilestones(objectiveId).map { l -> l.map { it.toModel() } }
    override suspend fun upsertMilestone(milestone: Milestone) =
        upsertedId(milestone.id, db.objectives().upsertMilestone(milestone.toEntity()))
    override suspend fun deleteMilestone(id: Long) = db.objectives().deleteMilestone(id)
}

class RoomCommitmentChangeRepository(private val db: AuroraDatabase) : CommitmentChangeRepository {
    override suspend fun record(change: CommitmentChange) = db.commitmentChanges().insert(change.toEntity())
    override suspend fun forTask(taskId: Long) = db.commitmentChanges().forTask(taskId).map { it.toModel() }
}

class RoomMemoryRepository(private val db: AuroraDatabase) : MemoryRepository {
    override fun observeAll(): Flow<List<MemoryEntry>> = db.memory().observeAll().map { l -> l.map { it.toModel() } }
    override suspend fun getAll() = db.memory().getAll().map { it.toModel() }
    override suspend fun search(query: String, limit: Int): List<MemoryEntry> =
        getAll().map { it to memoryScore(it.content, query) }.filter { it.second > 0 }
            .sortedByDescending { it.second }.take(limit).map { it.first }
    override suspend fun upsert(entry: MemoryEntry) = upsertedId(entry.id, db.memory().upsert(entry.toEntity()))
    override suspend fun delete(id: Long) = db.memory().delete(id)
    override suspend fun clear() = db.memory().clear()
}

class RoomConversationRepository(private val db: AuroraDatabase) : ConversationRepository {
    override fun observe(conversationId: String): Flow<List<ConversationMessage>> =
        db.messages().observe(conversationId).map { l -> l.map { it.toModel() } }
    override suspend fun recent(conversationId: String, limit: Int) = db.messages().recent(conversationId, limit).map { it.toModel() }
    override suspend fun add(message: ConversationMessage) = db.messages().insert(message.toEntity())
    override suspend fun clearAll() = db.messages().clear()
}
