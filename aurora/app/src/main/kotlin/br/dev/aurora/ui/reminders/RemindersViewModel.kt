package br.dev.aurora.ui.reminders

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.dev.aurora.AppContainer
import br.dev.aurora.core.model.Recurrence
import br.dev.aurora.core.model.Reminder
import br.dev.aurora.core.repository.ScheduleOutcome
import br.dev.aurora.core.text.PtBrFormat
import br.dev.aurora.core.tools.AssistantTool
import br.dev.aurora.reminders.Notifications
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class ReminderDraft(
    val id: Long = 0,
    val title: String = "",
    val details: String = "",
    val date: LocalDate? = LocalDate.now(),
    val time: LocalTime? = null,
    val recurrence: Recurrence? = null,
)

data class RemindersState(val upcoming: List<Reminder> = emptyList(), val past: List<Reminder> = emptyList())

data class AlarmPermissions(val notifications: Boolean = true, val exact: Boolean = true)

class RemindersViewModel(private val c: AppContainer) : ViewModel() {
    val state: StateFlow<RemindersState> = c.reminders.observeAll().map { all ->
        RemindersState(
            upcoming = all.filter { it.enabled }.sortedBy { it.scheduledAt },
            past = all.filter { !it.enabled }.sortedByDescending { it.lastFiredAt ?: it.updatedAt }.take(50),
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), RemindersState())

    private val _permissions = MutableStateFlow(AlarmPermissions())
    val permissions: StateFlow<AlarmPermissions> = _permissions.asStateFlow()

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    fun refreshPermissions() {
        val newState = AlarmPermissions(Notifications.canPost(c.context), c.scheduler.canScheduleExact())
        val gainedExact = newState.exact && !_permissions.value.exact
        _permissions.value = newState
        // Ao ganhar a permissão de alarme exato, reagenda tudo como exato.
        if (gainedExact) br.dev.aurora.reminders.RescheduleWorker.enqueue(c.context)
    }

    fun consumeMessage() {
        _message.value = null
    }

    fun draftOf(r: Reminder): ReminderDraft {
        val at = r.scheduledAt.atZone(ZoneId.systemDefault())
        return ReminderDraft(r.id, r.title, r.details, at.toLocalDate(), at.toLocalTime(), r.recurrence)
    }

    fun save(d: ReminderDraft) {
        val title = d.title.trim()
        val date = d.date
        val time = d.time
        if (title.isEmpty() || date == null || time == null) {
            _message.value = "Informe título, data e horário."
            return
        }
        val at = date.atTime(time).atZone(ZoneId.systemDefault())
        if (!at.isAfter(ZonedDateTime.now())) {
            _message.value = "Esse horário já passou."
            return
        }
        viewModelScope.launch {
            if (d.id == 0L) {
                _message.value = c.actions.execute(AssistantTool.CreateReminder(title, at, d.details.trim(), d.recurrence), null).message
            } else {
                val existing = c.reminders.get(d.id) ?: return@launch
                val updated = existing.copy(
                    title = title, details = d.details.trim(), scheduledAt = at.toInstant(), recurrence = d.recurrence,
                    enabled = true, lastFiredAt = null, updatedAt = Instant.now(),
                )
                c.reminders.upsert(updated)
                val outcome = c.scheduler.schedule(updated)
                _message.value = when (outcome) {
                    ScheduleOutcome.EXACT -> "Lembrete atualizado para ${PtBrFormat.dateTime(at, ZonedDateTime.now())}."
                    ScheduleOutcome.INEXACT -> "Lembrete atualizado. Sem alarme exato, o aviso pode atrasar alguns minutos."
                    else -> "Salvei, mas não consegui agendar o alarme."
                }
            }
            refreshPermissions()
        }
    }

    fun cancel(r: Reminder) {
        viewModelScope.launch {
            c.scheduler.cancel(r.id)
            c.reminders.upsert(r.copy(enabled = false, updatedAt = Instant.now()))
            _message.value = "Lembrete \"${r.title}\" cancelado."
        }
    }

    fun delete(r: Reminder) {
        viewModelScope.launch {
            c.scheduler.cancel(r.id)
            c.reminders.delete(r.id)
            _message.value = "Lembrete excluído."
        }
    }
}
