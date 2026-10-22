package br.dev.aurora.core.tools

import br.dev.aurora.core.model.Frequency
import br.dev.aurora.core.model.MemoryCategory
import br.dev.aurora.core.model.Priority
import br.dev.aurora.core.model.Recurrence
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZonedDateTime
import java.time.format.DateTimeParseException

sealed interface Validation {
    data class Valid(val tool: AssistantTool) : Validation
    data class Invalid(val reason: String) : Validation
}

/**
 * Valida argumentos propostos pela IA antes de qualquer execução. Nada que venha do modelo é executado
 * sem passar por aqui: tipos, tamanhos, datas no futuro e alvos identificáveis.
 */
class ToolValidator(private val now: () -> ZonedDateTime) {

    fun validate(name: String, args: Map<String, Any?>): Validation = try {
        Validation.Valid(build(name, args))
    } catch (e: InvalidArgument) {
        Validation.Invalid(e.message ?: "argumento inválido")
    }

    private class InvalidArgument(message: String) : Exception(message)

    private fun fail(message: String): Nothing = throw InvalidArgument(message)

    private fun build(name: String, a: Map<String, Any?>): AssistantTool = when (name) {
        ToolNames.CREATE_TASK -> {
            val (dt, d) = due(a["due"])
            AssistantTool.CreateTask(
                title = text(a, "title", MAX_TITLE),
                description = optText(a, "description", MAX_BODY).orEmpty(),
                priority = priority(a["priority"]) ?: Priority.MEDIUM,
                dueDateTime = dt,
                dueDate = d,
                recurrence = recurrence(a["recurrence"]),
            )
        }
        ToolNames.UPDATE_TASK -> {
            val (dt, d) = due(a["due"])
            val title = optText(a, "title", MAX_TITLE)
            val priority = priority(a["priority"])
            if (title == null && priority == null && dt == null && d == null) fail("nenhuma alteração informada")
            AssistantTool.UpdateTask(target(a, "task_id", "task_title"), title, priority, dt, d)
        }
        ToolNames.COMPLETE_TASK -> AssistantTool.CompleteTask(target(a, "task_id", "task_title"))
        ToolNames.DELETE_TASK -> AssistantTool.DeleteTask(target(a, "task_id", "task_title"))
        ToolNames.LIST_TASKS -> AssistantTool.ListTasks(
            date = optDate(a["date"]),
            includeCompleted = a["include_completed"] as? Boolean ?: false,
        )
        ToolNames.CREATE_REMINDER -> AssistantTool.CreateReminder(
            title = text(a, "title", MAX_TITLE),
            at = futureDateTime(a["at"]),
            details = optText(a, "details", MAX_BODY).orEmpty(),
            recurrence = recurrence(a["recurrence"]),
        )
        ToolNames.LIST_REMINDERS -> AssistantTool.ListReminders
        ToolNames.RESCHEDULE_REMINDER ->
            AssistantTool.RescheduleReminder(target(a, "reminder_id", "reminder_title"), futureDateTime(a["at"]))
        ToolNames.CANCEL_REMINDER -> AssistantTool.CancelReminder(target(a, "reminder_id", "reminder_title"))
        ToolNames.GET_AGENDA -> AssistantTool.GetAgenda(optDate(a["date"]) ?: fail("date é obrigatório"))
        ToolNames.CREATE_NOTE -> AssistantTool.CreateNote(text(a, "content", MAX_NOTE), optText(a, "title", MAX_TITLE))
        ToolNames.SEARCH_NOTES -> AssistantTool.SearchNotes(text(a, "query", MAX_TITLE))
        ToolNames.SAVE_MEMORY -> AssistantTool.SaveMemory(text(a, "content", MAX_BODY), category(a["category"]))
        ToolNames.SEARCH_MEMORY -> AssistantTool.SearchMemory(text(a, "query", MAX_TITLE))
        ToolNames.BUILD_DAILY_PLAN -> AssistantTool.BuildDailyPlan(optDate(a["date"]) ?: fail("date é obrigatório"))
        ToolNames.OPEN_APP -> AssistantTool.OpenApp(text(a, "app_name", 60))
        else -> fail("ferramenta desconhecida: $name")
    }

    private fun text(a: Map<String, Any?>, key: String, max: Int): String =
        optText(a, key, max) ?: fail("$key é obrigatório")

    private fun optText(a: Map<String, Any?>, key: String, max: Int): String? {
        val v = a[key] ?: return null
        if (v !is String) fail("$key deve ser texto")
        val t = v.trim()
        if (t.isEmpty()) return null
        if (t.length > max) fail("$key excede $max caracteres")
        if (t.any { it.isISOControl() && it != '\n' && it != '\t' }) fail("$key contém caracteres de controle")
        return t
    }

    private fun target(a: Map<String, Any?>, idKey: String, titleKey: String): ItemRef {
        val id = a[idKey]
        if (id != null) {
            val n = (id as? Number)?.toLong() ?: (id as? String)?.toLongOrNull() ?: fail("$idKey deve ser inteiro")
            if (n <= 0) fail("$idKey inválido")
            return ItemRef.ById(n)
        }
        val title = optText(a, titleKey, MAX_TITLE) ?: fail("informe $idKey ou $titleKey")
        return ItemRef.ByTitle(title)
    }

    private fun priority(v: Any?): Priority? = when (v) {
        null -> null
        !is String -> fail("priority deve ser texto")
        else -> when (v.lowercase().trim()) {
            "baixa", "low" -> Priority.LOW
            "media", "média", "medium" -> Priority.MEDIUM
            "alta", "high" -> Priority.HIGH
            else -> fail("priority inválida: $v")
        }
    }

    private fun category(v: Any?): MemoryCategory = when ((v as? String)?.lowercase()?.trim()) {
        null, "fato" -> MemoryCategory.FACT
        "preferencia", "preferência" -> MemoryCategory.PREFERENCE
        "ideia" -> MemoryCategory.IDEA
        "projeto" -> MemoryCategory.PROJECT
        "outro" -> MemoryCategory.OTHER
        else -> fail("category inválida: $v")
    }

    private fun optDate(v: Any?): LocalDate? {
        if (v == null) return null
        if (v !is String) fail("data deve ser texto AAAA-MM-DD")
        return try {
            LocalDate.parse(v.trim())
        } catch (_: DateTimeParseException) {
            fail("data inválida: $v (use AAAA-MM-DD)")
        }
    }

    private fun parseLocalDateTime(v: String): LocalDateTime = try {
        LocalDateTime.parse(v.trim().removeSuffix("Z").let { if (it.length == 16) "$it:00" else it })
    } catch (_: DateTimeParseException) {
        fail("data/hora inválida: $v (use AAAA-MM-DDTHH:MM)")
    }

    private fun futureDateTime(v: Any?): ZonedDateTime {
        if (v !is String) fail("at é obrigatório (AAAA-MM-DDTHH:MM)")
        val current = now()
        val dt = parseLocalDateTime(v).atZone(current.zone)
        // Tolerância de 1 minuto para atrasos entre a fala e a execução.
        if (dt.isBefore(current.minusMinutes(1))) fail("o horário $v já passou")
        if (dt.isAfter(current.plusYears(MAX_YEARS_AHEAD))) fail("horário muito distante: $v")
        return dt
    }

    private fun due(v: Any?): Pair<ZonedDateTime?, LocalDate?> {
        if (v == null) return null to null
        if (v !is String) fail("due deve ser texto")
        val s = v.trim()
        return if (s.contains('T')) {
            parseLocalDateTime(s).atZone(now().zone) to null
        } else {
            null to (optDate(s) ?: fail("due inválido"))
        }
    }

    private fun recurrence(v: Any?): Recurrence? {
        if (v == null) return null
        val m = v as? Map<*, *> ?: fail("recurrence deve ser objeto")
        val freq = when ((m["frequency"] as? String)?.lowercase()) {
            "daily" -> Frequency.DAILY
            "weekly" -> Frequency.WEEKLY
            "monthly" -> Frequency.MONTHLY
            "yearly" -> Frequency.YEARLY
            else -> fail("recurrence.frequency inválida")
        }
        val interval = (m["interval"] as? Number)?.toInt() ?: 1
        if (interval !in 1..365) fail("recurrence.interval fora do limite")
        val days = (m["days_of_week"] as? List<*>)?.map { d ->
            DAY_CODES[(d as? String)?.uppercase()] ?: fail("dia da semana inválido: $d")
        }?.toSet().orEmpty()
        if (days.isNotEmpty() && freq != Frequency.WEEKLY) fail("days_of_week só vale para weekly")
        return Recurrence(freq, interval, days)
    }

    companion object {
        const val MAX_TITLE = 200
        const val MAX_BODY = 2_000
        const val MAX_NOTE = 10_000
        const val MAX_YEARS_AHEAD = 5L
        private val DAY_CODES = mapOf(
            "MO" to DayOfWeek.MONDAY, "TU" to DayOfWeek.TUESDAY, "WE" to DayOfWeek.WEDNESDAY,
            "TH" to DayOfWeek.THURSDAY, "FR" to DayOfWeek.FRIDAY, "SA" to DayOfWeek.SATURDAY, "SU" to DayOfWeek.SUNDAY,
        )
    }
}
