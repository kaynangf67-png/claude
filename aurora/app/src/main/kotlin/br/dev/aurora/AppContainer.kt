package br.dev.aurora

import android.content.Context
import br.dev.aurora.core.model.ConversationMessage
import br.dev.aurora.core.orchestrator.AiSettings
import br.dev.aurora.core.orchestrator.AssistantDependencies
import br.dev.aurora.core.orchestrator.AssistantOrchestrator
import br.dev.aurora.core.orchestrator.ToolExecutor
import br.dev.aurora.core.provider.AnthropicProvider
import br.dev.aurora.core.provider.AssistantProvider
import br.dev.aurora.core.repository.ConversationRepository
import br.dev.aurora.data.db.AuroraDatabase
import br.dev.aurora.data.repo.RoomCommitmentChangeRepository
import br.dev.aurora.data.repo.RoomConversationRepository
import br.dev.aurora.data.repo.RoomMemoryRepository
import br.dev.aurora.data.repo.RoomNoteRepository
import br.dev.aurora.data.repo.RoomObjectiveRepository
import br.dev.aurora.data.repo.RoomProjectRepository
import br.dev.aurora.data.repo.RoomReminderRepository
import br.dev.aurora.data.repo.RoomTaskRepository
import br.dev.aurora.data.settings.SecretStore
import br.dev.aurora.data.settings.SettingsStore
import br.dev.aurora.reminders.AlarmReminderScheduler
import br.dev.aurora.system.AndroidAppLauncher
import br.dev.aurora.system.AndroidCalendarSource
import br.dev.aurora.system.AndroidCapabilities
import br.dev.aurora.system.AndroidConnectivity
import br.dev.aurora.voice.SpeechOutput
import java.time.ZonedDateTime
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Injeção de dependências manual: um único grafo de objetos para o app inteiro. */
class AppContainer(val context: Context) {
    val db = AuroraDatabase.create(context)
    val tasks = RoomTaskRepository(db)
    val reminders = RoomReminderRepository(db)
    val notes = RoomNoteRepository(db)
    val memory = RoomMemoryRepository(db)
    val projects = RoomProjectRepository(db)
    val objectives = RoomObjectiveRepository(db)
    val commitmentChanges = RoomCommitmentChangeRepository(db)
    val settings = SettingsStore(context)
    val secrets = SecretStore(context)
    val scheduler = AlarmReminderScheduler(context)
    val calendar = AndroidCalendarSource(context, settings)
    val connectivity = AndroidConnectivity(context)
    val capabilities = AndroidCapabilities(context, scheduler)
    val conversation = HistoryAwareConversation(RoomConversationRepository(db), settings)

    val deps = AssistantDependencies(
        tasks = tasks,
        reminders = reminders,
        notes = notes,
        memory = memory,
        scheduler = scheduler,
        calendar = calendar,
        apps = AndroidAppLauncher(context),
        capabilities = capabilities,
        commitments = commitmentChanges,
    )

    /** Ações disparadas pela UI usam as mesmas regras (e mensagens) do assistente. */
    val actions = ToolExecutor(deps, { ZonedDateTime.now() })

    private val providerMutex = Mutex()
    private var cachedProvider: Pair<Int, AssistantProvider>? = null

    /** Provedor de IA atual, ou null se não houver chave salva. Recriado só quando chave ou modelo mudam. */
    suspend fun provider(): AssistantProvider? = providerMutex.withLock {
        val key = secrets.apiKey() ?: return@withLock null.also { cachedProvider = null }
        val model = settings.current().modelId
        val fingerprint = (key + "|" + model).hashCode()
        cachedProvider?.takeIf { it.first == fingerprint }?.second
            ?: AnthropicProvider(apiKey = key, model = model).also { cachedProvider = fingerprint to it }
    }

    val orchestrator = AssistantOrchestrator(
        deps = deps,
        conversation = conversation,
        providerFactory = { provider() },
        ledger = settings,
        connectivity = connectivity,
        settings = {
            val s = settings.current()
            AiSettings(enabled = s.aiEnabled, monthlyBudgetUsd = s.monthlyBudgetUsd, assistantName = s.assistantName)
        },
        now = { ZonedDateTime.now() },
    )

    val speechOutput: SpeechOutput by lazy { SpeechOutput(context) }

    suspend fun clearConversation() {
        conversation.clearAll()
        orchestrator.resetConversationState()
    }

    /** Apaga tudo: dados, alarmes, configurações e a chave da IA. */
    suspend fun deleteAllData() {
        reminders.getAll().forEach { scheduler.cancel(it.id) }
        // Ordem respeita as chaves estrangeiras (filhos com CASCADE/SET NULL são tratados pelo banco).
        db.focusSessions().clear()
        db.habits().clear()
        db.tasks().clear()
        db.reminders().clear()
        db.notes().clear()
        db.books().clear()
        db.projects().clear()
        db.objectives().clear()
        db.memory().clear()
        clearConversation()
        secrets.clearApiKey()
        settings.clearAll()
    }

    companion object {
        const val CONVERSATION_ID = "principal"
    }
}

/**
 * Se o usuário desligar "manter histórico", a conversa fica só na memória enquanto o app está aberto.
 */
class HistoryAwareConversation(
    private val persistent: ConversationRepository,
    private val settings: SettingsStore,
) : ConversationRepository {
    private val volatile = MutableStateFlow<List<ConversationMessage>>(emptyList())
    private val keep = MutableStateFlow(true)

    private suspend fun keepHistory() = settings.current().keepConversationHistory.also { keep.value = it }

    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    override fun observe(conversationId: String): Flow<List<ConversationMessage>> =
        keep.flatMapLatest { if (it) persistent.observe(conversationId) else volatile }

    override suspend fun recent(conversationId: String, limit: Int): List<ConversationMessage> =
        if (keepHistory()) persistent.recent(conversationId, limit) else volatile.value.takeLast(limit)

    override suspend fun add(message: ConversationMessage): Long =
        if (keepHistory()) {
            persistent.add(message)
        } else {
            volatile.value = volatile.value + message.copy(id = volatile.value.size + 1L)
            volatile.value.size.toLong()
        }

    override suspend fun clearAll() {
        persistent.clearAll()
        volatile.value = emptyList()
    }

    suspend fun refresh() {
        keepHistory()
    }
}
