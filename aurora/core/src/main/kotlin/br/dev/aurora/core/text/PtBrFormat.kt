package br.dev.aurora.core.text

import br.dev.aurora.core.model.Frequency
import br.dev.aurora.core.model.Recurrence
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

/** Formatação de datas, horas e recorrências em português do Brasil. */
object PtBrFormat {
    private val TIME = DateTimeFormatter.ofPattern("HH:mm")

    fun weekdayName(day: DayOfWeek): String = when (day) {
        DayOfWeek.MONDAY -> "segunda-feira"
        DayOfWeek.TUESDAY -> "terça-feira"
        DayOfWeek.WEDNESDAY -> "quarta-feira"
        DayOfWeek.THURSDAY -> "quinta-feira"
        DayOfWeek.FRIDAY -> "sexta-feira"
        DayOfWeek.SATURDAY -> "sábado"
        DayOfWeek.SUNDAY -> "domingo"
    }

    private fun weekdayShort(day: DayOfWeek): String = weekdayName(day).substringBefore('-')

    fun monthName(month: Int): String = listOf(
        "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro",
        "outubro", "novembro", "dezembro",
    )[month - 1]

    fun time(time: LocalTime): String = time.format(TIME)

    /** "hoje", "amanhã", "sexta-feira (24/10)" ou "24/10/2027". */
    fun day(date: LocalDate, today: LocalDate): String {
        val diff = java.time.temporal.ChronoUnit.DAYS.between(today, date)
        val numeric = if (date.year == today.year) "%02d/%02d".format(date.dayOfMonth, date.monthValue)
        else "%02d/%02d/%d".format(date.dayOfMonth, date.monthValue, date.year)
        return when (diff) {
            0L -> "hoje"
            1L -> "amanhã"
            -1L -> "ontem"
            in 2L..6L -> "${weekdayName(date.dayOfWeek)} ($numeric)"
            else -> "${weekdayName(date.dayOfWeek)}, $numeric"
        }
    }

    /** "amanhã às 09:00", "sexta-feira (24/10) às 15:30". */
    fun dateTime(dateTime: ZonedDateTime, now: ZonedDateTime): String =
        "${day(dateTime.toLocalDate(), now.toLocalDate())} às ${time(dateTime.toLocalTime())}"

    /** Frase longa para cabeçalhos: "quarta-feira, 22 de outubro". */
    fun longDate(date: LocalDate): String = "${weekdayName(date.dayOfWeek)}, ${date.dayOfMonth} de ${monthName(date.monthValue)}"

    fun recurrence(rule: Recurrence): String {
        val every = rule.interval > 1
        return when (rule.frequency) {
            Frequency.DAILY -> if (every) "a cada ${rule.interval} dias" else "todos os dias"
            Frequency.WEEKLY -> when {
                rule.daysOfWeek == Recurrence.WEEKDAYS && !every -> "todos os dias úteis"
                rule.daysOfWeek.isEmpty() -> if (every) "a cada ${rule.interval} semanas" else "toda semana"
                else -> {
                    val names = rule.daysOfWeek.sorted().map { weekdayShort(it) }
                    val list = joinPt(names)
                    val prefix = if (rule.daysOfWeek.size == 1) {
                        if (rule.daysOfWeek.first() in setOf(DayOfWeek.SATURDAY, DayOfWeek.SUNDAY)) "todo" else "toda"
                    } else {
                        "toda"
                    }
                    if (every) "a cada ${rule.interval} semanas ($list)" else "$prefix $list"
                }
            }
            Frequency.MONTHLY -> if (every) "a cada ${rule.interval} meses" else "todo mês"
            Frequency.YEARLY -> if (every) "a cada ${rule.interval} anos" else "todo ano"
        }
    }

    fun joinPt(items: List<String>): String = when (items.size) {
        0 -> ""
        1 -> items[0]
        else -> items.dropLast(1).joinToString(", ") + " e " + items.last()
    }

    fun plural(count: Int, singular: String, plural: String): String =
        "$count ${if (count == 1) singular else plural}"
}
