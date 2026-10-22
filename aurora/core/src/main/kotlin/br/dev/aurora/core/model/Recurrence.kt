package br.dev.aurora.core.model

import java.time.DayOfWeek

enum class Frequency { DAILY, WEEKLY, MONTHLY, YEARLY }

/**
 * Regra de recorrência simples, serializada num subconjunto de RRULE (RFC 5545):
 * `FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE`.
 */
data class Recurrence(
    val frequency: Frequency,
    val interval: Int = 1,
    val daysOfWeek: Set<DayOfWeek> = emptySet(),
) {
    init {
        require(interval in 1..365) { "interval fora do limite: $interval" }
        require(daysOfWeek.isEmpty() || frequency == Frequency.WEEKLY) { "BYDAY só é suportado em WEEKLY" }
    }

    fun toRule(): String = buildString {
        append("FREQ=").append(frequency.name)
        append(";INTERVAL=").append(interval)
        if (daysOfWeek.isNotEmpty()) {
            append(";BYDAY=")
            append(daysOfWeek.sorted().joinToString(",") { DAY_CODES.getValue(it) })
        }
    }

    companion object {
        private val DAY_CODES = mapOf(
            DayOfWeek.MONDAY to "MO", DayOfWeek.TUESDAY to "TU", DayOfWeek.WEDNESDAY to "WE",
            DayOfWeek.THURSDAY to "TH", DayOfWeek.FRIDAY to "FR", DayOfWeek.SATURDAY to "SA",
            DayOfWeek.SUNDAY to "SU",
        )
        private val CODE_DAYS = DAY_CODES.entries.associate { (k, v) -> v to k }

        val WEEKDAYS: Set<DayOfWeek> = setOf(
            DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY,
        )

        /** Retorna null para regras vazias ou inválidas, em vez de lançar exceção. */
        fun parse(rule: String?): Recurrence? {
            if (rule.isNullOrBlank()) return null
            val parts = rule.split(';').mapNotNull {
                val kv = it.split('=', limit = 2)
                if (kv.size == 2) kv[0].trim().uppercase() to kv[1].trim().uppercase() else null
            }.toMap()
            val freq = parts["FREQ"]?.let { f -> Frequency.entries.firstOrNull { it.name == f } } ?: return null
            val interval = parts["INTERVAL"]?.toIntOrNull() ?: 1
            val days = parts["BYDAY"]?.split(',')?.mapNotNull { CODE_DAYS[it.trim()] }?.toSet().orEmpty()
            return runCatching { Recurrence(freq, interval, days) }.getOrNull()
        }
    }
}
