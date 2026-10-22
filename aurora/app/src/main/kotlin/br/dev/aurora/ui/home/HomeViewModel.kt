package br.dev.aurora.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.dev.aurora.AppContainer
import br.dev.aurora.core.model.CalendarEvent
import br.dev.aurora.core.model.Task
import br.dev.aurora.core.model.TaskStatus
import br.dev.aurora.core.planning.AgendaBuilder
import br.dev.aurora.core.planning.AgendaDay
import br.dev.aurora.core.planning.ReminderOccurrence
import br.dev.aurora.core.provider.ModelCatalog
import br.dev.aurora.core.tools.AssistantTool
import br.dev.aurora.core.tools.ItemRef
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class HomeState(
    val now: ZonedDateTime = ZonedDateTime.now(),
    val assistantName: String = "Aurora",
    val today: AgendaDay? = null,
    val pendingTasks: List<Task> = emptyList(),
    val nextReminder: ReminderOccurrence? = null,
    val aiStatus: String = "",
    val aiReady: Boolean = false,
)

class HomeViewModel(private val c: AppContainer) : ViewModel() {
    private val ticker = flow {
        while (true) {
            emit(ZonedDateTime.now())
            delay(30_000)
        }
    }
    private val events = MutableStateFlow<List<CalendarEvent>>(emptyList())

    val state: StateFlow<HomeState> = combine(
        ticker, c.tasks.observeAll(), c.reminders.observeAll(), c.settings.settings, c.secrets.hasApiKey,
    ) { now, tasks, reminders, settings, hasKey ->
        val zone = now.zone
        val day = AgendaBuilder.build(now.toLocalDate(), zone, now.toInstant(), tasks, reminders, events.value)
        val next = reminders.filter { it.enabled }.flatMap {
            AgendaBuilder.occurrencesBetween(it, now.toInstant(), now.toInstant().plusSeconds(60L * 60 * 24 * 60), zone).take(1)
        }.minByOrNull { it.at }
        val online = c.connectivity.isOnline()
        val model = ModelCatalog.options.firstOrNull { it.id == settings.modelId }?.label ?: settings.modelId
        val (status, ready) = when {
            !settings.aiEnabled -> "IA desligada · funções locais ativas" to false
            !hasKey -> "IA não configurada · funções locais ativas" to false
            !online -> "Sem internet · funções locais ativas" to false
            else -> "$model pronta" to true
        }
        HomeState(
            now = now,
            assistantName = settings.assistantName,
            today = day,
            pendingTasks = tasks.filter { it.status == TaskStatus.PENDING }
                .sortedWith(compareByDescending<Task> { AgendaBuilder.priorityWeight(it.priority) }.thenBy { it.dueAt ?: Instant.MAX })
                .take(4),
            nextReminder = next,
            aiStatus = status,
            aiReady = ready,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), HomeState())

    init {
        refreshCalendar()
    }

    fun refreshCalendar() {
        viewModelScope.launch {
            if (c.calendar.isAvailable()) {
                val zone = ZoneId.systemDefault()
                val today = java.time.LocalDate.now(zone)
                events.value = c.calendar.events(today.atStartOfDay(zone).toInstant(), today.plusDays(1).atStartOfDay(zone).toInstant())
            } else {
                events.value = emptyList()
            }
        }
    }

    /** Usa a mesma regra do assistente: tarefa recorrente avança para a próxima ocorrência. */
    fun complete(task: Task) {
        viewModelScope.launch { c.actions.execute(AssistantTool.CompleteTask(ItemRef.ById(task.id)), null) }
    }
}
