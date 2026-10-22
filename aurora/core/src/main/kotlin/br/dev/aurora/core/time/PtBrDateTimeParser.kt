package br.dev.aurora.core.time

import br.dev.aurora.core.model.Frequency
import br.dev.aurora.core.model.Recurrence
import br.dev.aurora.core.text.PtText
import java.time.DayOfWeek
import java.time.Duration
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZonedDateTime
import java.time.temporal.TemporalAdjusters

enum class DayPeriod(val label: String, val defaultHour: Int) {
    MORNING("de manhã", 9),
    AFTERNOON("à tarde", 15),
    EVENING("à noite", 20),
    DAWN("de madrugada", 3),
}

/** Resultado bruto da extração de expressões temporais de uma frase. */
data class ParsedWhen(
    val date: LocalDate? = null,
    val time: LocalTime? = null,
    val relative: Duration? = null,
    val recurrence: Recurrence? = null,
    /** A hora foi dita sem "da manhã/tarde/noite" e o período foi deduzido (ex.: "às 9" → 09:00). */
    val periodAssumed: Boolean = false,
    /** Houve um período vago sem hora ("amanhã de manhã"). */
    val vaguePeriod: DayPeriod? = null,
    /** O dia veio de um dia da semana ("sexta"). */
    val fromWeekday: Boolean = false,
    /** Intervalos (no texto original) que correspondem a expressões temporais, para limpar o título. */
    val spans: List<IntRange> = emptyList(),
) {
    val isEmpty: Boolean
        get() = date == null && time == null && relative == null && recurrence == null && vaguePeriod == null
}

sealed interface WhenResolution {
    data class Resolved(val dateTime: ZonedDateTime, val periodAssumed: Boolean) : WhenResolution
    /** Só a data é conhecida; para lembretes é preciso perguntar a hora. */
    data class DateOnly(val date: LocalDate, val vaguePeriod: DayPeriod?) : WhenResolution
    data object Missing : WhenResolution
    data class InPast(val dateTime: ZonedDateTime) : WhenResolution
}

/**
 * Interpreta expressões de data e hora em português do Brasil, de forma determinística e local
 * (sem rede). Cobre os casos mais comuns de fala; o que não reconhece fica para a IA ou para uma
 * pergunta de esclarecimento.
 *
 * Regra para horas sem período ("às nove"): 7–11 → manhã, 1–6 → tarde, 12 → meio-dia. A resposta
 * sempre mostra o horário interpretado para o usuário poder corrigir.
 */
class PtBrDateTimeParser {

    fun parse(text: String, now: ZonedDateTime): ParsedWhen {
        val folded = PtText.fold(text)
        val work = folded.toCharArray()
        val spans = mutableListOf<IntRange>()
        val today = now.toLocalDate()

        fun current() = String(work)
        fun consume(range: IntRange) {
            spans += range
            for (i in range) work[i] = ' '
        }
        fun find(regex: Regex): MatchResult? = regex.find(current())

        // 1. Recorrência
        var recurrence: Recurrence? = null
        var recurrenceDate: LocalDate? = null
        find(EVERY_N)?.let { m ->
            val n = PtText.parseNumber(m.groupValues[1]) ?: 1
            val freq = when {
                m.groupValues[2].startsWith("dia") -> Frequency.DAILY
                m.groupValues[2].startsWith("semana") -> Frequency.WEEKLY
                m.groupValues[2].startsWith("mes") -> Frequency.MONTHLY
                else -> Frequency.YEARLY
            }
            if (n in 1..365) {
                recurrence = Recurrence(freq, n)
                consume(m.range)
            }
        }
        if (recurrence == null) {
            find(WEEKDAYS_RECURRENCE)?.let { m ->
                recurrence = Recurrence(Frequency.WEEKLY, 1, Recurrence.WEEKDAYS)
                consume(m.range)
            }
        }
        if (recurrence == null) {
            find(EVERY_WEEKDAY)?.let { m ->
                val days = WEEKDAY_TOKEN.findAll(m.value).mapNotNull { WEEKDAY_NAMES[it.value] }.toSet()
                if (days.isNotEmpty()) {
                    recurrence = Recurrence(Frequency.WEEKLY, 1, days)
                    consume(m.range)
                }
            }
        }
        if (recurrence == null) {
            find(MONTHLY_ON_DAY)?.let { m ->
                val day = m.groupValues[1].toInt()
                if (day in 1..31) {
                    recurrence = Recurrence(Frequency.MONTHLY)
                    recurrenceDate = nextDayOfMonth(today, day)
                    consume(m.range)
                }
            }
        }
        if (recurrence == null) {
            for ((regex, freq) in SIMPLE_RECURRENCES) {
                val m = find(regex) ?: continue
                recurrence = Recurrence(freq)
                consume(m.range)
                break
            }
        }

        // 2. Duração relativa ("daqui a 20 minutos")
        var relative: Duration? = null
        find(RELATIVE)?.let { m ->
            val amountText = m.groupValues[1]
            val unit = m.groupValues[2]
            val amount: Long? = when (amountText) {
                "meia" -> null
                "uns", "umas" -> null
                else -> PtText.parseNumber(amountText)?.toLong()
            }
            val duration = when {
                amountText == "meia" && unit.startsWith("hora") -> Duration.ofMinutes(30)
                amount == null -> null
                unit.startsWith("min") -> Duration.ofMinutes(amount)
                unit.startsWith("h") -> Duration.ofHours(amount)
                unit.startsWith("dia") -> Duration.ofDays(amount)
                unit.startsWith("semana") -> Duration.ofDays(7 * amount)
                else -> null
            }
            if (duration != null && !duration.isZero) {
                relative = duration
                consume(m.range)
            }
        }

        // 3. Datas explícitas
        var date: LocalDate? = recurrenceDate
        var fromWeekday = false
        if (date == null) {
            find(NUMERIC_DATE)?.let { m ->
                val d = m.groupValues[1].toInt()
                val mo = m.groupValues[2].toInt()
                val y = m.groupValues[3].takeIf { it.isNotEmpty() }?.toInt()?.let { if (it < 100) 2000 + it else it }
                buildDate(today, d, mo, y)?.let { date = it; consume(m.range) }
            }
        }
        if (date == null) {
            find(WRITTEN_DATE)?.let { m ->
                val d = m.groupValues[1].toInt()
                val mo = MONTHS.indexOf(m.groupValues[2]) + 1
                val y = m.groupValues[3].takeIf { it.isNotEmpty() }?.toInt()
                buildDate(today, d, mo, y)?.let { date = it; consume(m.range) }
            }
        }
        if (date == null) {
            find(DAY_OF_MONTH)?.let { m ->
                val d = m.groupValues[1].toInt()
                if (d in 1..31) {
                    date = nextDayOfMonth(today, d)
                    consume(m.range)
                }
            }
        }
        if (date == null) {
            for ((regex, offset) in RELATIVE_DAYS) {
                val m = find(regex) ?: continue
                date = today.plusDays(offset)
                consume(m.range)
                break
            }
        }
        var forceNextWeek = false
        if (date == null) {
            find(WEEKDAY)?.let { m ->
                val day = WEEKDAY_NAMES.getValue(m.groupValues[2])
                forceNextWeek = m.groupValues[1].startsWith("proxim") || m.groupValues[3].isNotEmpty()
                date = if (forceNextWeek) {
                    today.with(TemporalAdjusters.next(day))
                } else {
                    today.with(TemporalAdjusters.nextOrSame(day))
                }
                fromWeekday = true
                consume(m.range)
            }
        }

        // 4. Hora
        var time: LocalTime? = null
        var periodAssumed = false
        for ((index, regex) in TIME_PATTERNS.withIndex()) {
            val m = find(regex) ?: continue
            val hourRaw = PtText.parseNumber(m.group("h")!!) ?: continue
            val minuteText = m.group("m")
            val minute = when {
                minuteText == null -> 0
                minuteText == "meia" -> 30
                else -> PtText.parseNumber(minuteText) ?: continue
            }
            val period = m.group("p")
            // Formas escritas com dígitos ("9:30", "9h", "21h") seguem o relógio de 24 horas.
            val hourWord = m.group("hw")
            val explicit24h = period == null && (index == 0 || hourWord == "h" || hourWord == "hs" || hourRaw >= 13 || hourRaw == 0)
            val resolved = if (explicit24h) hourRaw.takeIf { it in 0..23 } else applyPeriod(hourRaw, period)
            if (resolved == null || minute !in 0..59) continue
            periodAssumed = period == null && !explicit24h && hourRaw in 1..11
            time = LocalTime.of(resolved, minute)
            consume(m.range)
            break
        }
        if (time == null) {
            find(NOON_MIDNIGHT)?.let { m ->
                time = if (m.value.contains("meio")) LocalTime.NOON else LocalTime.MIDNIGHT
                consume(m.range)
            }
        }

        // 5. Período vago sem hora
        var vague: DayPeriod? = null
        val periodMatch = find(VAGUE_PERIOD)
        if (periodMatch != null) {
            val p = when (periodMatch.groupValues[1]) {
                "manha" -> DayPeriod.MORNING
                "tarde" -> DayPeriod.AFTERNOON
                "noite" -> DayPeriod.EVENING
                else -> DayPeriod.DAWN
            }
            val t = time
            if (t == null) {
                vague = p
            } else if (periodAssumed) {
                // "à noite às 8" → 20:00
                val h = t.hour % 12
                val adjusted = when (p) {
                    DayPeriod.MORNING, DayPeriod.DAWN -> h
                    DayPeriod.AFTERNOON, DayPeriod.EVENING -> h + 12
                }
                time = t.withHour(adjusted)
                periodAssumed = false
            }
            consume(periodMatch.range)
        }

        return ParsedWhen(
            date = date,
            time = time,
            relative = relative,
            recurrence = recurrence,
            periodAssumed = periodAssumed,
            vaguePeriod = vague,
            fromWeekday = fromWeekday,
            spans = spans.sortedBy { it.first },
        )
    }

    /**
     * Transforma o resultado em um instante. [requireTime] = lembretes precisam de hora; tarefas podem ser
     * só de data.
     */
    fun resolve(parsed: ParsedWhen, now: ZonedDateTime): WhenResolution {
        val zone = now.zone
        parsed.relative?.let { return WhenResolution.Resolved(now.plus(it).withNano(0), false) }

        var date = parsed.date
        val time = parsed.time

        // Recorrência semanal sem data explícita: primeira ocorrência = próximo dia da regra.
        val rec = parsed.recurrence
        if (date == null && rec != null) {
            date = firstRecurrenceDate(rec, now, time)
        }

        if (time == null) {
            return if (date != null) WhenResolution.DateOnly(date, parsed.vaguePeriod) else WhenResolution.Missing
        }

        if (date == null) {
            var candidate = ZonedDateTime.of(now.toLocalDate(), time, zone)
            if (!candidate.isAfter(now)) {
                candidate = if (parsed.periodAssumed && time.hour < 12 && candidate.plusHours(12).isAfter(now)) {
                    candidate.plusHours(12)
                } else {
                    candidate.plusDays(1)
                }
            }
            return WhenResolution.Resolved(candidate, parsed.periodAssumed)
        }

        var candidate = ZonedDateTime.of(date, time, zone)
        if (!candidate.isAfter(now)) {
            if (date == now.toLocalDate() && parsed.periodAssumed && time.hour < 12 &&
                candidate.plusHours(12).isAfter(now)
            ) {
                candidate = candidate.plusHours(12)
            } else if (parsed.fromWeekday && date == now.toLocalDate()) {
                candidate = candidate.plusWeeks(1)
            } else if (rec != null) {
                candidate = candidate.plusDays(1)
                val next = firstRecurrenceDate(rec, candidate, time)
                candidate = ZonedDateTime.of(next, time, zone)
            } else {
                return WhenResolution.InPast(candidate)
            }
        }
        return WhenResolution.Resolved(candidate, parsed.periodAssumed)
    }

    private fun firstRecurrenceDate(rec: Recurrence, now: ZonedDateTime, time: LocalTime?): LocalDate {
        val today = now.toLocalDate()
        val startsToday = time == null || ZonedDateTime.of(today, time, now.zone).isAfter(now)
        val from = if (startsToday) today else today.plusDays(1)
        return if (rec.frequency == Frequency.WEEKLY && rec.daysOfWeek.isNotEmpty()) {
            generateSequence(from) { it.plusDays(1) }.first { it.dayOfWeek in rec.daysOfWeek }
        } else {
            from
        }
    }

    /** Grupo nomeado opcional: null se o regex não define o grupo ou se ele não participou do match. */
    private fun MatchResult.group(name: String): String? =
        try {
            groups[name]?.value
        } catch (_: IllegalArgumentException) {
            null
        }

    private fun applyPeriod(hour: Int, period: String?): Int? {
        if (hour !in 0..23) return null
        return when (period) {
            null -> when {
                hour in 1..6 -> hour + 12 // "às duas" → 14h
                else -> hour
            }
            "manha" -> if (hour == 12) 12 else hour.takeIf { it <= 12 }
            "tarde" -> when (hour) {
                in 1..11 -> hour + 12
                12 -> 12
                in 13..18 -> hour
                else -> null
            }
            "noite" -> when (hour) {
                12 -> 0
                in 1..11 -> if (hour <= 4) hour else hour + 12 // "duas da noite" = 2h
                in 18..23 -> hour
                else -> null
            }
            "madrugada" -> hour.takeIf { it in 0..6 }
            else -> hour
        }
    }

    private fun buildDate(today: LocalDate, day: Int, month: Int, year: Int?): LocalDate? {
        if (month !in 1..12) return null
        return runCatching {
            val y = year ?: today.year
            val d = LocalDate.of(y, month, day)
            if (year == null && d.isBefore(today)) d.plusYears(1) else d
        }.getOrNull()
    }

    private fun nextDayOfMonth(today: LocalDate, day: Int): LocalDate {
        var month = today.withDayOfMonth(1)
        repeat(13) {
            if (day <= month.lengthOfMonth()) {
                val d = month.withDayOfMonth(day)
                if (!d.isBefore(today)) return d
            }
            month = month.plusMonths(1)
        }
        return today
    }

    companion object {
        private const val NUM = PtText.NUMBER_PATTERN

        val WEEKDAY_NAMES = mapOf(
            "segunda" to DayOfWeek.MONDAY, "terca" to DayOfWeek.TUESDAY, "quarta" to DayOfWeek.WEDNESDAY,
            "quinta" to DayOfWeek.THURSDAY, "sexta" to DayOfWeek.FRIDAY, "sabado" to DayOfWeek.SATURDAY,
            "domingo" to DayOfWeek.SUNDAY,
        )
        private const val WD = "(?:segunda|terca|quarta|quinta|sexta|sabado|domingo)"
        private const val FEIRA = "(?:s?-feiras?|s? feiras?|s)?"
        private val WEEKDAY_TOKEN = Regex("segunda|terca|quarta|quinta|sexta|sabado|domingo")

        private val MONTHS = listOf(
            "janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro",
            "outubro", "novembro", "dezembro",
        )

        private val EVERY_N = Regex("\\ba cada ($NUM) (dias?|semanas?|mes|meses|anos?)\\b")
        private val WEEKDAYS_RECURRENCE = Regex("\\b(?:(?:todos os |nos |em )?dias uteis|de segunda a sexta(?:-feira| feira)?)\\b")
        private val EVERY_WEEKDAY = Regex(
            "\\b(?:toda|todo|todas as|todos os|todas|todos)\\s+$WD$FEIRA(?:\\s*(?:,|e)\\s*(?:a |o |as |os )?$WD$FEIRA)*\\b",
        )
        private val MONTHLY_ON_DAY = Regex("\\btodo (?:santo )?dia (\\d{1,2})(?: de cada mes| do mes)?\\b")
        private val SIMPLE_RECURRENCES = listOf(
            Regex("\\b(?:todos os dias|todo dia|todo santo dia|diariamente)\\b") to Frequency.DAILY,
            Regex("\\b(?:toda semana|todas as semanas|semanalmente)\\b") to Frequency.WEEKLY,
            Regex("\\b(?:todo mes|todos os meses|mensalmente)\\b") to Frequency.MONTHLY,
            Regex("\\b(?:todo ano|todos os anos|anualmente)\\b") to Frequency.YEARLY,
        )

        private val RELATIVE = Regex(
            "\\b(?:daqui a|daqui|em|dentro de|depois de)\\s+(meia|$NUM)\\s*(minutos?|min|horas?|h|dias?|semanas?)\\b",
        )

        private val NUMERIC_DATE = Regex("\\b(?:dia\\s+)?(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?\\b")
        private val WRITTEN_DATE = Regex(
            "\\b(?:(?:no |para o |pro )?dia\\s+)?(\\d{1,2})\\s+de\\s+(${MONTHS.joinToString("|")})(?:\\s+de\\s+(\\d{4}))?\\b",
        )
        private val DAY_OF_MONTH = Regex("\\b(?:no |para o |pro )?dia (\\d{1,2})\\b(?!\\s*(?:de |/))")
        private val RELATIVE_DAYS = listOf(
            Regex("\\bdepois de amanha\\b") to 2L,
            Regex("\\b(?:de )?amanha\\b") to 1L,
            Regex("\\b(?:de )?hoje\\b") to 0L,
        )
        private val WEEKDAY = Regex(
            "\\b(?:(na|no|nesta|neste|nessa|nesse|esta|este|essa|esse|proxima|proximo|para|pra|ate|ate a|ate o)\\s+)?" +
                "(segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:-feira| feira)?(\\s+que vem)?\\b",
        )

        private const val PERIOD = "(?:\\s+(?:horas?\\s+)?(?:da|de|na|a)\\s+(?<p>manha|tarde|noite|madrugada))?"
        private val TIME_PATTERNS = listOf(
            // 9:30, 9h30, 15h
            Regex("\\b(?:(?:para |ate |la )?(?:as|pelas|pras)\\s+)?(?<h>\\d{1,2})(?::|h)(?<m>\\d{2})\\b$PERIOD"),
            Regex("\\b(?:(?:para |ate |la )?(?:as|pelas|pras)\\s+)?(?<h>\\d{1,2})\\s*(?<hw>h|hs|horas?)\\b(?:\\s+e\\s+(?<m>meia|$NUM)(?:\\s+minutos?)?)?$PERIOD"),
            // "às nove e meia", "às 9", "à uma da tarde"
            Regex("(?:\\b(?:para |ate |la )?(?:as|pelas|pras)\\s+|\\ba\\s+(?=uma\\b|1\\b))(?<h>$NUM)(?:\\s+e\\s+(?<m>meia|$NUM))?(?:\\s+(?<hw>horas?))?$PERIOD\\b"),
            // "nove da noite" sem "às"
            Regex("\\b(?<h>$NUM)(?:\\s+e\\s+(?<m>meia|$NUM))?\\s+(?:horas?\\s+)?(?:da|de)\\s+(?<p>manha|tarde|noite|madrugada)\\b"),
        )
        private val NOON_MIDNIGHT = Regex("\\b(?:ao |as |a )?(?:meio[- ]dia|meia[- ]noite)\\b")
        private val VAGUE_PERIOD = Regex("\\b(?:de|da|a|na|pela|hoje a)\\s+(manha|tarde|noite|madrugada)\\b")
    }
}
