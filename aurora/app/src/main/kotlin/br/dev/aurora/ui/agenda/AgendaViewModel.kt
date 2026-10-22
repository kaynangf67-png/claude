package br.dev.aurora.ui.agenda

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.dev.aurora.AppContainer
import br.dev.aurora.core.model.CalendarEvent
import br.dev.aurora.core.planning.AgendaBuilder
import br.dev.aurora.core.planning.AgendaDay
import br.dev.aurora.core.planning.DailyPlan
import br.dev.aurora.core.planning.DailyPlanner
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.temporal.TemporalAdjusters
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

enum class AgendaMode { DAY, WEEK }

data class AgendaState(
    val selected: LocalDate = LocalDate.now(),
    val mode: AgendaMode = AgendaMode.DAY,
    val days: List<AgendaDay> = emptyList(),
    val calendarEnabled: Boolean = false,
)

@OptIn(ExperimentalCoroutinesApi::class)
class AgendaViewModel(private val c: AppContainer) : ViewModel() {
    private val selected = MutableStateFlow(LocalDate.now())
    private val mode = MutableStateFlow(AgendaMode.DAY)
    private val refresh = MutableStateFlow(0)

    private val range = combine(selected, mode) { d, m ->
        if (m == AgendaMode.DAY) listOf(d) else {
            val monday = d.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
            (0L..6L).map { monday.plusDays(it) }
        }
    }

    private val events = combine(range, refresh, c.settings.settings.map { it.calendarEnabled }) { r, _, _ -> r }
        .flatMapLatest { dates ->
            flow {
                val zone = ZoneId.systemDefault()
                emit(
                    if (c.calendar.isAvailable()) {
                        c.calendar.events(dates.first().atStartOfDay(zone).toInstant(), dates.last().plusDays(1).atStartOfDay(zone).toInstant())
                    } else {
                        emptyList<CalendarEvent>()
                    },
                )
            }
        }

    val state: StateFlow<AgendaState> = combine(
        combine(selected, mode, range) { s, m, r -> Triple(s, m, r) },
        c.tasks.observeAll(), c.reminders.observeAll(), events, c.settings.settings,
    ) { (sel, m, dates), tasks, reminders, ev, settings ->
        val zone = ZoneId.systemDefault()
        val now = ZonedDateTime.now(zone).toInstant()
        AgendaState(
            selected = sel,
            mode = m,
            days = dates.map { AgendaBuilder.build(it, zone, now, tasks, reminders, ev) },
            calendarEnabled = settings.calendarEnabled,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AgendaState())

    private val _plan = MutableStateFlow<DailyPlan?>(null)
    val plan: StateFlow<DailyPlan?> = _plan.asStateFlow()

    fun select(date: LocalDate) {
        selected.value = date
        _plan.value = null
    }

    fun shift(forward: Boolean) {
        val step = if (mode.value == AgendaMode.DAY) 1L else 7L
        select(if (forward) selected.value.plusDays(step) else selected.value.minusDays(step))
    }

    fun setMode(m: AgendaMode) {
        mode.value = m
    }

    fun buildPlan() {
        viewModelScope.launch {
            val day = state.value.days.firstOrNull { it.date == selected.value } ?: return@launch
            val pending = c.tasks.getAll().filter { !it.isCompleted }
            _plan.value = DailyPlanner().plan(day, pending, ZonedDateTime.now())
        }
    }

    fun enableCalendar(enabled: Boolean) {
        viewModelScope.launch {
            c.settings.update { it.copy(calendarEnabled = enabled) }
            refresh.value++
        }
    }
}
