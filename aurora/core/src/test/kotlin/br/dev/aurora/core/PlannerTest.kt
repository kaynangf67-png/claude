package br.dev.aurora.core

import br.dev.aurora.core.model.CalendarEvent
import br.dev.aurora.core.model.Frequency
import br.dev.aurora.core.model.Priority
import br.dev.aurora.core.model.Recurrence
import br.dev.aurora.core.model.Reminder
import br.dev.aurora.core.model.Task
import br.dev.aurora.core.planning.AgendaBuilder
import br.dev.aurora.core.planning.DailyPlanner
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PlannerTest {
    private val zone = ZoneId.of("America/Sao_Paulo")
    private val now = ZonedDateTime.of(2026, 10, 22, 7, 0, 0, 0, zone)
    private val i = now.toInstant()
    private val today = now.toLocalDate()

    private fun at(h: Int, m: Int = 0, date: LocalDate = today) = ZonedDateTime.of(date, LocalTime.of(h, m), zone).toInstant()

    @Test fun `agenda inclui ocorrencias de lembretes recorrentes`() {
        val daily = Reminder(1, "Remédio", scheduledAt = at(8, 0, today.minusDays(3)), recurrence = Recurrence(Frequency.DAILY), createdAt = i, updatedAt = i)
        val weekly = Reminder(2, "Lixo", scheduledAt = at(20, 0, today.minusDays(7)), recurrence = Recurrence(Frequency.WEEKLY), createdAt = i, updatedAt = i)
        val other = Reminder(3, "Outro dia", scheduledAt = at(10, 0, today.plusDays(1)), createdAt = i, updatedAt = i)
        val disabled = Reminder(4, "Off", scheduledAt = at(11), enabled = false, createdAt = i, updatedAt = i)
        val day = AgendaBuilder.build(today, zone, i, emptyList(), listOf(daily, weekly, other, disabled), emptyList())
        assertEquals(listOf("Remédio", "Lixo"), day.reminders.map { it.reminder.title })
        assertEquals(LocalTime.of(8, 0), day.reminders.first().at.toLocalTime())
    }

    @Test fun `plano sugere sem alterar e respeita eventos`() {
        val tasks = listOf(
            Task(1, "Pagar conta", priority = Priority.HIGH, dueAt = at(0, 0, today.minusDays(1)), dueAllDay = true, createdAt = i, updatedAt = i),
            Task(2, "Ler contrato", dueAt = at(0), dueAllDay = true, createdAt = i, updatedAt = i),
            Task(3, "Arrumar armário", priority = Priority.LOW, dueAt = at(0), dueAllDay = true, createdAt = i, updatedAt = i),
        )
        val events = listOf(
            CalendarEvent(1, "Trabalho", at(8), at(12), false),
            CalendarEvent(2, "Trabalho", at(13), at(19, 45), false),
        )
        val day = AgendaBuilder.build(today, zone, i, tasks, emptyList(), events)
        val plan = DailyPlanner().plan(day, tasks, now)
        // Livres: 12:00–13:00 (19:45–20:00 tem só 15 min)
        assertEquals(1, plan.freeSlots.size)
        assertEquals(LocalTime.NOON, plan.freeSlots.single().start.toLocalTime())
        assertTrue(plan.suggestions.first().contains("1 tarefa atrasada"), plan.suggestions.toString())
        assertTrue(plan.suggestions.any { it.contains("\"Pagar conta\" entre 12:00 e 13:00") }, plan.suggestions.toString())
        assertTrue(plan.suggestions.any { it.contains("Considere adiar \"Arrumar armário\"") }, plan.suggestions.toString())
        assertTrue(plan.suggestions.last().contains("Nenhum compromisso foi alterado"))
    }

    @Test fun `dia livre`() {
        val day = AgendaBuilder.build(today, zone, i, emptyList(), emptyList(), emptyList())
        val plan = DailyPlanner().plan(day, emptyList(), now)
        assertTrue(plan.suggestions.first().startsWith("Dia livre"))
    }
}
