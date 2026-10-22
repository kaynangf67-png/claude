package br.dev.aurora.core.planning

import br.dev.aurora.core.model.Priority
import br.dev.aurora.core.model.Task
import br.dev.aurora.core.text.PtBrFormat
import java.time.Duration
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZonedDateTime

data class TimeSlot(val start: ZonedDateTime, val end: ZonedDateTime) {
    val duration: Duration get() = Duration.between(start, end)
}

data class DailyPlan(
    val date: LocalDate,
    val agenda: AgendaDay,
    val focusTasks: List<Task>,
    val freeSlots: List<TimeSlot>,
    val suggestions: List<String>,
)

/**
 * Monta um plano sugerido para o dia. Apenas sugere: nunca move, apaga ou cria compromissos.
 */
class DailyPlanner(
    private val dayStart: LocalTime = LocalTime.of(8, 0),
    private val dayEnd: LocalTime = LocalTime.of(20, 0),
    private val minSlot: Duration = Duration.ofMinutes(30),
) {

    fun plan(agenda: AgendaDay, allPendingTasks: List<Task>, now: ZonedDateTime): DailyPlan {
        val zone = now.zone
        val date = agenda.date
        val isToday = date == now.toLocalDate()

        var windowStart = ZonedDateTime.of(date, dayStart, zone)
        val windowEnd = ZonedDateTime.of(date, dayEnd, zone)
        if (isToday && now.isAfter(windowStart)) {
            // Começa no próximo quarto de hora.
            val rounded = now.withSecond(0).withNano(0).plusMinutes((15 - now.minute % 15).toLong() % 15)
            windowStart = rounded
        }

        val busy = agenda.events.filter { !it.allDay }.map { it.start.atZone(zone) to it.end.atZone(zone) }
            .sortedBy { it.first }
        val slots = mutableListOf<TimeSlot>()
        var cursor = windowStart
        for ((s, e) in busy) {
            if (s.isAfter(cursor)) addSlot(slots, cursor, minOf(s, windowEnd))
            if (e.isAfter(cursor)) cursor = e
        }
        addSlot(slots, cursor, windowEnd)

        // Foco: atrasadas, depois as do dia, depois as sem prazo de alta prioridade.
        val undatedHigh = allPendingTasks.filter { it.dueAt == null && it.priority == Priority.HIGH }
        val focus = (agenda.overdue.sortedByDescending { AgendaBuilder.priorityWeight(it.priority) } +
            agenda.tasksDue.sortedByDescending { AgendaBuilder.priorityWeight(it.priority) } +
            undatedHigh).distinctBy { it.id }

        val suggestions = mutableListOf<String>()
        if (agenda.overdue.isNotEmpty()) {
            val first = agenda.overdue.maxBy { AgendaBuilder.priorityWeight(it.priority) }
            suggestions += "Você tem ${PtBrFormat.plural(agenda.overdue.size, "tarefa atrasada", "tarefas atrasadas")}. " +
                "Sugiro começar por \"${first.title}\"."
        }
        val flexible = focus.filter { it.dueAllDay || it.dueAt == null || it in agenda.overdue }
        flexible.zip(slots).forEach { (task, slot) ->
            suggestions += "Encaixe \"${task.title}\" entre ${PtBrFormat.time(slot.start.toLocalTime())} e " +
                "${PtBrFormat.time(slot.end.toLocalTime())}."
        }
        if (flexible.size > slots.size) {
            val leftover = flexible.drop(slots.size)
            val low = leftover.filter { it.priority == Priority.LOW }.ifEmpty { leftover }
            suggestions += if (slots.isEmpty()) {
                "Não há intervalos livres de pelo menos ${minSlot.toMinutes()} minutos. Considere adiar \"${low.first().title}\"."
            } else {
                "Há mais tarefas do que intervalos livres. Considere adiar \"${low.first().title}\"."
            }
        }
        if (focus.isEmpty() && agenda.events.isEmpty() && agenda.reminders.isEmpty()) {
            suggestions += "Dia livre: nenhuma tarefa, lembrete ou evento previsto."
        }
        if (suggestions.isNotEmpty()) suggestions += "Nenhum compromisso foi alterado; são apenas sugestões."

        return DailyPlan(date, agenda, focus, slots, suggestions)
    }

    private fun addSlot(slots: MutableList<TimeSlot>, start: ZonedDateTime, end: ZonedDateTime) {
        if (end.isAfter(start) && Duration.between(start, end) >= minSlot) slots += TimeSlot(start, end)
    }
}
