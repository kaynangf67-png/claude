package br.dev.aurora.core.time

import br.dev.aurora.core.model.Frequency
import br.dev.aurora.core.model.Recurrence
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.temporal.ChronoUnit
import java.time.temporal.TemporalAdjusters

/**
 * Calcula ocorrências de regras de recorrência no **horário local** do fuso informado.
 * Um lembrete "toda segunda às 9h" continua às 9h locais mesmo após mudança de fuso ou horário de verão.
 */
object RecurrenceCalculator {

    /**
     * Próxima ocorrência estritamente posterior a [after].
     * [anchor] é a primeira ocorrência (data/hora local de referência da série).
     */
    fun nextOccurrence(rule: Recurrence, anchor: LocalDateTime, after: Instant, zone: ZoneId): Instant {
        val afterLocal = after.atZone(zone).toLocalDate()
        val time = anchor.toLocalTime()
        var date = firstCandidate(rule, anchor.toLocalDate(), maxOf(afterLocal, anchor.toLocalDate()))
        // Limite de segurança: no máximo ~2 anos de iterações por dia.
        repeat(800) {
            val candidate = ZonedDateTime.of(date, time, zone).toInstant()
            if (candidate.isAfter(after) && matches(rule, anchor.toLocalDate(), date)) return candidate
            date = step(rule, anchor.toLocalDate(), date)
        }
        error("Nenhuma ocorrência encontrada para ${rule.toRule()}")
    }

    /** Se [date] pertence à série iniciada em [anchorDate]. */
    fun matches(rule: Recurrence, anchorDate: LocalDate, date: LocalDate): Boolean {
        if (date.isBefore(anchorDate)) return false
        return when (rule.frequency) {
            Frequency.DAILY -> ChronoUnit.DAYS.between(anchorDate, date) % rule.interval == 0L
            Frequency.WEEKLY -> {
                val days = rule.daysOfWeek.ifEmpty { setOf(anchorDate.dayOfWeek) }
                val anchorWeek = anchorDate.with(TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY))
                val week = date.with(TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY))
                date.dayOfWeek in days && ChronoUnit.WEEKS.between(anchorWeek, week) % rule.interval == 0L
            }
            Frequency.MONTHLY -> {
                val months = ChronoUnit.MONTHS.between(anchorDate.withDayOfMonth(1), date.withDayOfMonth(1))
                months % rule.interval == 0L && date.dayOfMonth == clampDay(anchorDate.dayOfMonth, date)
            }
            Frequency.YEARLY -> {
                val years = date.year - anchorDate.year
                years % rule.interval == 0 && date.month == anchorDate.month &&
                    date.dayOfMonth == clampDay(anchorDate.dayOfMonth, date)
            }
        }
    }

    // Dia 31 em meses curtos vira o último dia do mês.
    private fun clampDay(day: Int, inMonthOf: LocalDate): Int = minOf(day, inMonthOf.lengthOfMonth())

    private fun firstCandidate(rule: Recurrence, anchorDate: LocalDate, from: LocalDate): LocalDate =
        when (rule.frequency) {
            Frequency.DAILY, Frequency.WEEKLY -> from
            Frequency.MONTHLY -> {
                val d = from.withDayOfMonth(clampDay(anchorDate.dayOfMonth, from))
                if (d.isBefore(from)) from.plusMonths(1).let { it.withDayOfMonth(clampDay(anchorDate.dayOfMonth, it)) } else d
            }
            Frequency.YEARLY -> {
                val base = from.withMonth(anchorDate.monthValue).withDayOfMonth(1)
                val d = base.withDayOfMonth(clampDay(anchorDate.dayOfMonth, base))
                if (d.isBefore(from)) d.plusYears(1).let { it.withDayOfMonth(clampDay(anchorDate.dayOfMonth, it)) } else d
            }
        }

    private fun step(rule: Recurrence, anchorDate: LocalDate, date: LocalDate): LocalDate = when (rule.frequency) {
        Frequency.DAILY, Frequency.WEEKLY -> date.plusDays(1)
        Frequency.MONTHLY -> date.plusMonths(1).withDayOfMonth(1).let { it.withDayOfMonth(clampDay(anchorDate.dayOfMonth, it)) }
        Frequency.YEARLY -> date.plusYears(1).withDayOfMonth(1).let { it.withDayOfMonth(clampDay(anchorDate.dayOfMonth, it)) }
    }
}
