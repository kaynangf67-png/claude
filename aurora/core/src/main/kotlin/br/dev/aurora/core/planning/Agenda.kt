package br.dev.aurora.core.planning

import br.dev.aurora.core.model.CalendarEvent
import br.dev.aurora.core.model.Priority
import br.dev.aurora.core.model.Reminder
import br.dev.aurora.core.model.Task
import br.dev.aurora.core.time.RecurrenceCalculator
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime

data class ReminderOccurrence(val reminder: Reminder, val at: ZonedDateTime)

/** Tudo que acontece em um dia, já no fuso local. */
data class AgendaDay(
    val date: LocalDate,
    val events: List<CalendarEvent>,
    val reminders: List<ReminderOccurrence>,
    val tasksDue: List<Task>,
    val overdue: List<Task>,
) {
    val isEmpty: Boolean get() = events.isEmpty() && reminders.isEmpty() && tasksDue.isEmpty() && overdue.isEmpty()
}

object AgendaBuilder {

    fun build(
        date: LocalDate,
        zone: ZoneId,
        now: Instant,
        tasks: List<Task>,
        reminders: List<Reminder>,
        events: List<CalendarEvent>,
    ): AgendaDay {
        val start = date.atStartOfDay(zone).toInstant()
        val end = date.plusDays(1).atStartOfDay(zone).toInstant()
        val today = now.atZone(zone).toLocalDate()

        val pending = tasks.filter { it.isOpen }
        val due = pending.filter { t -> t.dueAt?.let { dueDate(t, zone) == date } == true }
            .sortedWith(compareBy<Task>({ it.dueAllDay }, { it.dueAt }).thenByDescending { it.priority })
        // Atrasadas = pendentes com prazo em dia anterior a hoje (aparecem em hoje e em dias futuros).
        val overdue = if (date >= today) {
            pending.filter { t -> dueDate(t, zone)?.let { it < today } == true }.sortedBy { it.dueAt }
        } else {
            emptyList()
        }

        val occurrences = reminders.filter { it.enabled }.flatMap { occurrencesBetween(it, start, end, zone) }
            .sortedBy { it.at }
        val dayEvents = events.filter { it.start < end && it.end > start }.sortedBy { it.start }
        return AgendaDay(date, dayEvents, occurrences, due, overdue)
    }

    fun dueDate(task: Task, zone: ZoneId): LocalDate? = task.dueAt?.atZone(zone)?.toLocalDate()

    /** Ocorrências de um lembrete em [from, to). Para recorrentes, segue a regra a partir de scheduledAt. */
    fun occurrencesBetween(reminder: Reminder, from: Instant, to: Instant, zone: ZoneId): List<ReminderOccurrence> {
        val rule = reminder.recurrence
        if (rule == null) {
            return if (reminder.scheduledAt >= from && reminder.scheduledAt < to) {
                listOf(ReminderOccurrence(reminder, reminder.scheduledAt.atZone(zone)))
            } else {
                emptyList()
            }
        }
        val anchor = reminder.scheduledAt.atZone(zone).toLocalDateTime()
        val result = mutableListOf<ReminderOccurrence>()
        var cursor = maxOf(from, reminder.scheduledAt).minusMillis(1)
        repeat(50) {
            val next = RecurrenceCalculator.nextOccurrence(rule, anchor, cursor, zone)
            if (next >= to) return result
            result += ReminderOccurrence(reminder, next.atZone(zone))
            cursor = next
        }
        return result
    }

    fun priorityWeight(p: Priority): Int = when (p) {
        Priority.HIGH -> 3
        Priority.MEDIUM -> 2
        Priority.LOW -> 1
    }
}
