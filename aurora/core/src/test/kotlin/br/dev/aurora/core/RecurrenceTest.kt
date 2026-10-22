package br.dev.aurora.core

import br.dev.aurora.core.model.Frequency
import br.dev.aurora.core.model.Recurrence
import br.dev.aurora.core.text.PtBrFormat
import br.dev.aurora.core.time.RecurrenceCalculator
import java.time.DayOfWeek
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class RecurrenceTest {
    private val sp = ZoneId.of("America/Sao_Paulo")

    private fun next(rule: Recurrence, anchor: LocalDateTime, after: LocalDateTime, zone: ZoneId = sp) =
        RecurrenceCalculator.nextOccurrence(rule, anchor, after.atZone(zone).toInstant(), zone).atZone(zone).toLocalDateTime()

    @Test fun `rrule ida e volta`() {
        val r = Recurrence(Frequency.WEEKLY, 2, setOf(DayOfWeek.WEDNESDAY, DayOfWeek.MONDAY))
        assertEquals("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE", r.toRule())
        assertEquals(r, Recurrence.parse(r.toRule()))
        assertNull(Recurrence.parse("FREQ=SECONDLY"))
        assertNull(Recurrence.parse(""))
        assertNull(Recurrence.parse("FREQ=DAILY;BYDAY=MO"))
    }

    @Test fun `diaria`() {
        val anchor = LocalDateTime.of(2026, 10, 22, 8, 0)
        assertEquals(LocalDateTime.of(2026, 10, 23, 8, 0), next(Recurrence(Frequency.DAILY), anchor, anchor))
        assertEquals(LocalDateTime.of(2026, 10, 24, 8, 0), next(Recurrence(Frequency.DAILY, 2), anchor, anchor))
    }

    @Test fun `semanal em varios dias`() {
        val rule = Recurrence(Frequency.WEEKLY, 1, setOf(DayOfWeek.MONDAY, DayOfWeek.THURSDAY))
        val anchor = LocalDateTime.of(2026, 10, 22, 7, 0) // quinta
        assertEquals(LocalDateTime.of(2026, 10, 26, 7, 0), next(rule, anchor, anchor))
        assertEquals(LocalDateTime.of(2026, 10, 29, 7, 0), next(rule, anchor, LocalDateTime.of(2026, 10, 26, 7, 0)))
    }

    @Test fun `semanal a cada duas semanas`() {
        val rule = Recurrence(Frequency.WEEKLY, 2, setOf(DayOfWeek.MONDAY))
        val anchor = LocalDateTime.of(2026, 10, 26, 9, 0)
        assertEquals(LocalDateTime.of(2026, 11, 9, 9, 0), next(rule, anchor, anchor))
    }

    @Test fun `mensal no dia 31 usa ultimo dia do mes`() {
        val rule = Recurrence(Frequency.MONTHLY)
        val anchor = LocalDateTime.of(2026, 1, 31, 9, 0)
        assertEquals(LocalDateTime.of(2026, 2, 28, 9, 0), next(rule, anchor, anchor))
        assertEquals(LocalDateTime.of(2026, 3, 31, 9, 0), next(rule, anchor, LocalDateTime.of(2026, 2, 28, 9, 0)))
    }

    @Test fun `anual em 29 de fevereiro`() {
        val anchor = LocalDateTime.of(2028, 2, 29, 9, 0)
        assertEquals(LocalDateTime.of(2029, 2, 28, 9, 0), next(Recurrence(Frequency.YEARLY), anchor, anchor))
    }

    @Test fun `horario local mantido com horario de verao`() {
        // Nova York: horário de verão termina em 01/11/2026. Lembrete diário às 9h continua às 9h locais.
        val ny = ZoneId.of("America/New_York")
        val anchor = LocalDateTime.of(2026, 10, 31, 9, 0)
        val result = RecurrenceCalculator.nextOccurrence(Recurrence(Frequency.DAILY), anchor, anchor.atZone(ny).toInstant(), ny)
        assertEquals(ZonedDateTime.of(2026, 11, 1, 9, 0, 0, 0, ny).toInstant(), result)
    }

    @Test fun `hora inexistente na transicao e ajustada para frente`() {
        // Em Nova York, 08/03/2026 02:30 não existe (02:00 → 03:00).
        val ny = ZoneId.of("America/New_York")
        val anchor = LocalDateTime.of(2026, 3, 7, 2, 30)
        val result = next(Recurrence(Frequency.DAILY), anchor, anchor, ny)
        assertEquals(LocalDateTime.of(2026, 3, 8, 3, 30), result)
    }

    @Test fun `descricao em portugues`() {
        assertEquals("todos os dias", PtBrFormat.recurrence(Recurrence(Frequency.DAILY)))
        assertEquals("todos os dias úteis", PtBrFormat.recurrence(Recurrence(Frequency.WEEKLY, 1, Recurrence.WEEKDAYS)))
        assertEquals("toda segunda", PtBrFormat.recurrence(Recurrence(Frequency.WEEKLY, 1, setOf(DayOfWeek.MONDAY))))
        assertEquals("todo sábado", PtBrFormat.recurrence(Recurrence(Frequency.WEEKLY, 1, setOf(DayOfWeek.SATURDAY))))
        assertEquals("toda segunda e quarta", PtBrFormat.recurrence(Recurrence(Frequency.WEEKLY, 1, setOf(DayOfWeek.WEDNESDAY, DayOfWeek.MONDAY))))
        assertEquals("a cada 3 dias", PtBrFormat.recurrence(Recurrence(Frequency.DAILY, 3)))
    }
}
