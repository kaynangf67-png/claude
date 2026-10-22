package br.dev.aurora.core

import br.dev.aurora.core.model.Frequency
import br.dev.aurora.core.model.Recurrence
import br.dev.aurora.core.time.DayPeriod
import br.dev.aurora.core.time.PtBrDateTimeParser
import br.dev.aurora.core.time.WhenResolution
import java.time.DayOfWeek
import java.time.Duration
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PtBrDateTimeParserTest {
    private val zone = ZoneId.of("America/Sao_Paulo")
    // Quinta-feira, 22/10/2026, 10:00
    private val now = ZonedDateTime.of(2026, 10, 22, 10, 0, 0, 0, zone)
    private val parser = PtBrDateTimeParser()

    private fun resolve(text: String, at: ZonedDateTime = now): WhenResolution =
        parser.resolve(parser.parse(text, at), at)

    private fun resolvedAt(text: String, at: ZonedDateTime = now): ZonedDateTime {
        val r = resolve(text, at)
        assertIs<WhenResolution.Resolved>(r, "esperava horário resolvido para '$text', veio $r")
        return r.dateTime
    }

    @Test fun `amanha as nove vira 9h do dia seguinte`() {
        val dt = resolvedAt("Me lembra amanhã às nove")
        assertEquals(LocalDate.of(2026, 10, 23), dt.toLocalDate())
        assertEquals(LocalTime.of(9, 0), dt.toLocalTime())
    }

    @Test fun `hora sem periodo e marcada como deduzida`() {
        val r = resolve("amanhã às nove") as WhenResolution.Resolved
        assertTrue(r.periodAssumed)
    }

    @Test fun `as duas sem periodo vira 14h`() {
        assertEquals(LocalTime.of(14, 0), resolvedAt("às duas").toLocalTime())
    }

    @Test fun `nove da noite vira 21h`() {
        assertEquals(LocalTime.of(21, 0), resolvedAt("hoje às nove da noite").toLocalTime())
        assertEquals(LocalTime.of(21, 0), resolvedAt("nove da noite").toLocalTime())
    }

    @Test fun `periodo antes da hora corrige a hora`() {
        assertEquals(LocalTime.of(20, 0), resolvedAt("amanhã à noite às 8").toLocalTime())
    }

    @Test fun `nove e meia`() {
        assertEquals(LocalTime.of(9, 30), resolvedAt("amanhã às nove e meia").toLocalTime())
    }

    @Test fun `formatos numericos sao 24h explicitos`() {
        assertEquals(LocalTime.of(15, 30), resolvedAt("amanhã 15:30").toLocalTime())
        assertEquals(LocalTime.of(9, 15), resolvedAt("amanhã às 9h15").toLocalTime())
        val r = resolve("amanhã às 9h") as WhenResolution.Resolved
        assertEquals(LocalTime.of(9, 0), r.dateTime.toLocalTime())
        assertEquals(false, r.periodAssumed)
    }

    @Test fun `hoje com hora deduzida ja passada vai para a noite`() {
        // 10:00 agora; "hoje às nove" → 21:00
        assertEquals(LocalTime.of(21, 0), resolvedAt("hoje às nove").toLocalTime())
    }

    @Test fun `hora explicita ja passada hoje e informada como passado`() {
        assertIs<WhenResolution.InPast>(resolve("hoje às 08:00"))
    }

    @Test fun `so hora ja passada vai para amanha`() {
        val dt = resolvedAt("às 8h")
        assertEquals(LocalDate.of(2026, 10, 23), dt.toLocalDate())
    }

    @Test fun `sexta-feira e a proxima sexta`() {
        val dt = resolvedAt("sexta-feira às 10h")
        assertEquals(LocalDate.of(2026, 10, 23), dt.toLocalDate())
        assertEquals(DayOfWeek.FRIDAY, dt.dayOfWeek)
    }

    @Test fun `mesmo dia da semana com hora passada vai para a semana seguinte`() {
        val dt = resolvedAt("quinta às 9h")
        assertEquals(LocalDate.of(2026, 10, 29), dt.toLocalDate())
    }

    @Test fun `que vem pula o dia de hoje`() {
        val dt = resolvedAt("quinta que vem às 15h")
        assertEquals(LocalDate.of(2026, 10, 29), dt.toLocalDate())
    }

    @Test fun `depois de amanha`() {
        assertEquals(LocalDate.of(2026, 10, 24), resolvedAt("depois de amanhã às 7h").toLocalDate())
    }

    @Test fun `datas numericas e por extenso`() {
        assertEquals(LocalDate.of(2026, 12, 25), resolvedAt("25/12 às 10h").toLocalDate())
        assertEquals(LocalDate.of(2026, 11, 3), resolvedAt("dia 3 de novembro às 10h").toLocalDate())
        // Dia 5 já passou em outubro → novembro
        assertEquals(LocalDate.of(2026, 11, 5), resolvedAt("dia 5 às 10h").toLocalDate())
        // Data passada sem ano → ano seguinte
        assertEquals(LocalDate.of(2027, 1, 10), resolvedAt("10/01 às 10h").toLocalDate())
    }

    @Test fun `data invalida e ignorada`() {
        val p = parser.parse("31/02 às 10h", now)
        assertNull(p.date)
    }

    @Test fun `relativo em minutos e horas`() {
        assertEquals(now.plusMinutes(20), resolvedAt("daqui a 20 minutos"))
        assertEquals(now.plusMinutes(30), resolvedAt("daqui a meia hora"))
        assertEquals(now.plusHours(2), resolvedAt("em duas horas"))
        assertEquals(Duration.ofMinutes(15), parser.parse("daqui a quinze minutos", now).relative)
    }

    @Test fun `so data sem hora pede horario`() {
        val r = resolve("amanhã")
        assertIs<WhenResolution.DateOnly>(r)
        assertEquals(LocalDate.of(2026, 10, 23), r.date)
    }

    @Test fun `periodo vago e registrado`() {
        val r = resolve("amanhã de manhã")
        assertIs<WhenResolution.DateOnly>(r)
        assertEquals(DayPeriod.MORNING, r.vaguePeriod)
    }

    @Test fun `sem data nem hora`() {
        assertIs<WhenResolution.Missing>(resolve("comprar pão"))
    }

    @Test fun `meio-dia e meia-noite`() {
        assertEquals(LocalTime.NOON, resolvedAt("amanhã ao meio-dia").toLocalTime())
        assertEquals(LocalTime.MIDNIGHT, resolvedAt("amanhã à meia-noite").toLocalTime())
    }

    @Test fun `recorrencia semanal toda segunda-feira`() {
        val p = parser.parse("Marca uma tarefa recorrente toda segunda-feira", now)
        assertEquals(Recurrence(Frequency.WEEKLY, 1, setOf(DayOfWeek.MONDAY)), p.recurrence)
        val r = parser.resolve(p, now)
        assertIs<WhenResolution.DateOnly>(r)
        assertEquals(LocalDate.of(2026, 10, 26), r.date)
    }

    @Test fun `recorrencia com varios dias`() {
        val p = parser.parse("toda segunda e quarta às 7h", now)
        assertEquals(setOf(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY), p.recurrence?.daysOfWeek)
        // próxima ocorrência: segunda, 26/10
        assertEquals(LocalDate.of(2026, 10, 26), resolvedAt("toda segunda e quarta às 7h").toLocalDate())
    }

    @Test fun `recorrencias simples`() {
        assertEquals(Frequency.DAILY, parser.parse("todo dia às 8h", now).recurrence?.frequency)
        assertEquals(Recurrence.WEEKDAYS, parser.parse("nos dias úteis às 8h", now).recurrence?.daysOfWeek)
        assertEquals(Recurrence(Frequency.DAILY, 2), parser.parse("a cada dois dias", now).recurrence)
        val monthly = parser.parse("todo dia 10 às 9h", now)
        assertEquals(Frequency.MONTHLY, monthly.recurrence?.frequency)
        assertEquals(LocalDate.of(2026, 11, 10), monthly.date)
    }

    @Test fun `todo dia as 8 com hora passada comeca amanha`() {
        assertEquals(LocalDate.of(2026, 10, 23), resolvedAt("todo dia às 8h").toLocalDate())
    }

    @Test fun `spans permitem limpar o titulo`() {
        val text = "Me lembra amanhã às nove de ligar pro dentista"
        val p = parser.parse(text, now)
        val cleaned = br.dev.aurora.core.text.PtText.removeSpans(text, p.spans)
        assertEquals("Me lembra de ligar pro dentista", cleaned)
    }

    @Test fun `fuso horario diferente usa o horario local`() {
        val tokyo = now.withZoneSameInstant(ZoneId.of("Asia/Tokyo"))
        val dt = resolvedAt("amanhã às 9h", tokyo)
        assertEquals(ZoneId.of("Asia/Tokyo"), dt.zone)
        assertEquals(LocalTime.of(9, 0), dt.toLocalTime())
    }
}
