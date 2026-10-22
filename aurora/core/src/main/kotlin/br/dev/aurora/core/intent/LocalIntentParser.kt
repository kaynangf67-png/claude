package br.dev.aurora.core.intent

import br.dev.aurora.core.model.MemoryCategory
import br.dev.aurora.core.model.Recurrence
import br.dev.aurora.core.text.PtBrFormat
import br.dev.aurora.core.text.PtText
import br.dev.aurora.core.time.ParsedWhen
import br.dev.aurora.core.time.PtBrDateTimeParser
import br.dev.aurora.core.time.WhenResolution
import br.dev.aurora.core.tools.AssistantTool
import br.dev.aurora.core.tools.ItemRef
import java.time.LocalDate
import java.time.ZonedDateTime

/** Algo que ficou faltando e será completado pela próxima fala do usuário. */
sealed interface PendingRequest {
    data class ReminderNeedsWhen(val title: String, val recurrence: Recurrence?, val date: LocalDate?) : PendingRequest
    data class ReminderNeedsTitle(val at: ZonedDateTime, val recurrence: Recurrence?) : PendingRequest
    data class TaskNeedsTitle(val dueDateTime: ZonedDateTime?, val dueDate: LocalDate?, val recurrence: Recurrence?) : PendingRequest
    data object NoteNeedsContent : PendingRequest
    data class PostponeNeedsDate(val target: ItemRef) : PendingRequest
    data class Confirmation(val tool: AssistantTool, val summary: String) : PendingRequest
}

sealed interface LocalIntent {
    /** [periodAssumed]: a hora foi deduzida (ex.: "às nove" → 09:00) e deve ser explicitada na resposta. */
    data class Tool(val tool: AssistantTool, val periodAssumed: Boolean = false) : LocalIntent
    data class Clarify(val question: String, val pending: PendingRequest) : LocalIntent
    data class Reply(val text: String) : LocalIntent
    data object Cancelled : LocalIntent
    data object Unknown : LocalIntent
}

/**
 * Reconhece pedidos comuns em português sem usar rede. É deliberadamente conservador: na dúvida
 * devolve [LocalIntent.Unknown] e o pedido segue para a IA (se configurada).
 */
class LocalIntentParser(private val dateParser: PtBrDateTimeParser = PtBrDateTimeParser()) {

    private class Utterance(val original: String, val folded: String) {
        fun from(index: Int) = Utterance(original.substring(index), folded.substring(index))
    }

    fun parse(input: String, now: ZonedDateTime): LocalIntent {
        val u = stripFluff(input.trim())
        if (u.folded.isBlank()) return LocalIntent.Unknown
        val f = u.folded

        SMALL_TALK.firstOrNull { it.first.matches(f.trimEnd('.', '!', '?', ' ')) }?.let { return LocalIntent.Reply(it.second) }
        if (TIME_QUERY.containsMatchIn(f)) return LocalIntent.Reply(timeAnswer(now))

        POSTPONE.find(f)?.let { return postpone(u, it, now) }
        COMPLETE.find(f)?.let { m ->
            val rest = cleanTarget(u.from(m.range.last + 1).original)
            return LocalIntent.Tool(AssistantTool.CompleteTask(rest?.let { ItemRef.ByTitle(it) } ?: ItemRef.LastMentioned))
        }
        DELETE_TASK.find(f)?.let { m ->
            val rest = cleanTarget(u.from(m.range.last + 1).original)
            return LocalIntent.Tool(AssistantTool.DeleteTask(rest?.let { ItemRef.ByTitle(it) } ?: ItemRef.LastMentioned))
        }
        CANCEL_REMINDER.find(f)?.let { m ->
            val rest = cleanTarget(u.from(m.range.last + 1).original)
            return LocalIntent.Tool(AssistantTool.CancelReminder(rest?.let { ItemRef.ByTitle(it) } ?: ItemRef.LastMentioned))
        }
        REMINDER.find(f)?.let { return reminder(u, it.range, now) }
        CREATE_TASK.find(f)?.let { return task(u, it.range, now) }
        SAVE_MEMORY.find(f)?.let { m ->
            // "lembra que amanhã às 10 tenho reunião" com horário é, na prática, um lembrete.
            val parsed = dateParser.parse(u.original, now)
            if (parsed.time != null || parsed.relative != null) return reminder(u, m.range, now)
            val content = cleanTitle(u.from(m.range.last + 1).original)
                ?: return LocalIntent.Reply("O que você quer que eu guarde?")
            val category = if (PREFERENCE_HINT.containsMatchIn(f)) MemoryCategory.PREFERENCE else MemoryCategory.FACT
            return LocalIntent.Tool(AssistantTool.SaveMemory(PtText.capitalizeFirst(content), category))
        }
        NOTE.find(f)?.let { m ->
            val content = cleanTitle(u.from(m.range.last + 1).original)
                ?: return LocalIntent.Clarify("Pode falar. Qual é a ideia?", PendingRequest.NoteNeedsContent)
            return LocalIntent.Tool(AssistantTool.CreateNote(PtText.capitalizeFirst(content)))
        }
        LIST_REMINDERS.find(f)?.let { return LocalIntent.Tool(AssistantTool.ListReminders) }
        LIST_TASKS.find(f)?.let {
            val date = dateParser.parse(u.original, now).date
            return LocalIntent.Tool(AssistantTool.ListTasks(date = date))
        }
        PLAN.find(f)?.let {
            val date = dateParser.parse(u.original, now).date ?: now.toLocalDate()
            return LocalIntent.Tool(AssistantTool.BuildDailyPlan(date))
        }
        AGENDA.find(f)?.let {
            val date = dateParser.parse(u.original, now).date ?: now.toLocalDate()
            return LocalIntent.Tool(AssistantTool.GetAgenda(date))
        }
        SEARCH_NOTES.find(f)?.let { m ->
            val q = cleanTitle(u.from(m.range.last + 1).original) ?: return LocalIntent.Unknown
            return LocalIntent.Tool(AssistantTool.SearchNotes(q))
        }
        SEARCH_MEMORY.find(f)?.let { m ->
            val q = cleanTitle(u.from(m.range.last + 1).original).orEmpty()
            return LocalIntent.Tool(AssistantTool.SearchMemory(q))
        }
        OPEN_APP.find(f)?.let { m ->
            val name = cleanTitle(u.from(m.range.last + 1).original) ?: return LocalIntent.Unknown
            if (name.split(' ').size <= 3) return LocalIntent.Tool(AssistantTool.OpenApp(name))
        }
        return LocalIntent.Unknown
    }

    /** Completa um pedido pendente com a nova fala. */
    fun continuePending(pending: PendingRequest, input: String, now: ZonedDateTime): LocalIntent {
        val u = stripFluff(input.trim())
        val f = u.folded.trim().trimEnd('.', '!', '?')
        if (CANCEL_WORDS.matches(f)) return LocalIntent.Cancelled

        return when (pending) {
            is PendingRequest.Confirmation -> when {
                YES.containsMatchIn(f) -> LocalIntent.Tool(pending.tool)
                NO.containsMatchIn(f) -> LocalIntent.Cancelled
                else -> LocalIntent.Clarify("Só para confirmar: ${pending.summary}? Responda sim ou não.", pending)
            }
            is PendingRequest.ReminderNeedsWhen -> {
                val parsed = dateParser.parse(u.original, now)
                val merged = if (parsed.date == null && pending.date != null) parsed.copy(date = pending.date) else parsed
                val withRec = if (merged.recurrence == null && pending.recurrence != null) merged.copy(recurrence = pending.recurrence) else merged
                when (val r = dateParser.resolve(withRec, now)) {
                    is WhenResolution.Resolved ->
                        LocalIntent.Tool(AssistantTool.CreateReminder(pending.title, r.dateTime, recurrence = withRec.recurrence), r.periodAssumed)
                    is WhenResolution.DateOnly -> LocalIntent.Clarify(
                        "Que horas ${PtBrFormat.day(r.date, now.toLocalDate())}?",
                        pending.copy(date = r.date, recurrence = withRec.recurrence),
                    )
                    is WhenResolution.InPast -> LocalIntent.Clarify("Esse horário já passou. Para quando eu agendo?", pending)
                    WhenResolution.Missing -> LocalIntent.Clarify(
                        "Não entendi o horário. Diga, por exemplo, \"amanhã às 9h\" ou \"daqui a 30 minutos\".",
                        pending,
                    )
                }
            }
            is PendingRequest.ReminderNeedsTitle -> {
                val title = cleanTitle(u.original) ?: return LocalIntent.Clarify("Do que devo te lembrar?", pending)
                LocalIntent.Tool(AssistantTool.CreateReminder(PtText.capitalizeFirst(title), pending.at, recurrence = pending.recurrence))
            }
            is PendingRequest.TaskNeedsTitle -> {
                val title = cleanTitle(u.original) ?: return LocalIntent.Clarify("Qual é a tarefa?", pending)
                LocalIntent.Tool(
                    AssistantTool.CreateTask(
                        PtText.capitalizeFirst(title),
                        dueDateTime = pending.dueDateTime,
                        dueDate = pending.dueDate,
                        recurrence = pending.recurrence,
                    ),
                )
            }
            PendingRequest.NoteNeedsContent -> {
                val content = cleanTitle(u.original) ?: return LocalIntent.Clarify("Qual é a ideia?", pending)
                LocalIntent.Tool(AssistantTool.CreateNote(PtText.capitalizeFirst(content)))
            }
            is PendingRequest.PostponeNeedsDate -> {
                val parsed = dateParser.parse(u.original, now)
                postponeTool(pending.target, parsed, now)
                    ?: LocalIntent.Clarify("Para quando? Por exemplo: \"sexta-feira\" ou \"amanhã às 10h\".", pending)
            }
        }
    }

    private fun reminder(u: Utterance, trigger: IntRange, now: ZonedDateTime): LocalIntent {
        val parsed = dateParser.parse(u.original, now)
        val title = cleanTitle(PtText.removeSpans(u.original, parsed.spans + listOf(trigger)))
            ?.let(PtText::capitalizeFirst)
        return when (val r = dateParser.resolve(parsed, now)) {
            is WhenResolution.Resolved -> if (title == null) {
                LocalIntent.Clarify("Do que devo te lembrar?", PendingRequest.ReminderNeedsTitle(r.dateTime, parsed.recurrence))
            } else {
                LocalIntent.Tool(AssistantTool.CreateReminder(title, r.dateTime, recurrence = parsed.recurrence), r.periodAssumed)
            }
            is WhenResolution.DateOnly -> {
                val day = PtBrFormat.day(r.date, now.toLocalDate())
                val question = r.vaguePeriod?.let { "Que horas $day ${it.label}?" } ?: "Que horas $day?"
                LocalIntent.Clarify(question, PendingRequest.ReminderNeedsWhen(title ?: "Lembrete", parsed.recurrence, r.date))
            }
            is WhenResolution.InPast -> LocalIntent.Clarify(
                "${PtBrFormat.dateTime(r.dateTime, now).replaceFirstChar { it.uppercase() }} já passou. Para quando eu agendo?",
                PendingRequest.ReminderNeedsWhen(title ?: "Lembrete", parsed.recurrence, null),
            )
            WhenResolution.Missing -> LocalIntent.Clarify(
                if (title != null) "Para quando é o lembrete \"$title\"?" else "Do que e para quando devo te lembrar?",
                PendingRequest.ReminderNeedsWhen(title ?: "Lembrete", parsed.recurrence, null),
            )
        }
    }

    private fun task(u: Utterance, trigger: IntRange, now: ZonedDateTime): LocalIntent {
        val parsed = dateParser.parse(u.original, now)
        val title = cleanTitle(PtText.removeSpans(u.original, parsed.spans + listOf(trigger)))
            ?.let(PtText::capitalizeFirst)
        var dueDateTime: ZonedDateTime? = null
        var dueDate: LocalDate? = null
        var assumed = false
        when (val r = dateParser.resolve(parsed, now)) {
            is WhenResolution.Resolved -> { dueDateTime = r.dateTime; assumed = r.periodAssumed }
            is WhenResolution.DateOnly -> dueDate = r.date
            is WhenResolution.InPast -> dueDateTime = r.dateTime
            WhenResolution.Missing -> Unit
        }
        if (title == null) {
            val suffix = parsed.recurrence?.let { " que devo repetir ${PtBrFormat.recurrence(it)}" } ?: ""
            return LocalIntent.Clarify("Qual é a tarefa$suffix?", PendingRequest.TaskNeedsTitle(dueDateTime, dueDate, parsed.recurrence))
        }
        return LocalIntent.Tool(AssistantTool.CreateTask(title, dueDateTime = dueDateTime, dueDate = dueDate, recurrence = parsed.recurrence), assumed)
    }

    private fun postpone(u: Utterance, m: MatchResult, now: ZonedDateTime): LocalIntent {
        val parsed = dateParser.parse(u.original, now)
        // Texto entre o verbo e o "para ..." identifica o alvo ("adia a reunião para sexta").
        val afterVerb = u.from(m.range.last + 1)
        val targetText = PtText.removeSpans(afterVerb.original, parsed.spans.mapNotNull { span ->
            val shifted = (span.first - (m.range.last + 1))..(span.last - (m.range.last + 1))
            shifted.takeIf { it.first >= 0 }
        })
        val target = cleanTarget(targetText.replace(Regex("\\s+(?:para|pra|pro)\\s*$", RegexOption.IGNORE_CASE), ""))
            ?.let { ItemRef.ByTitle(it) } ?: ItemRef.LastMentioned
        return postponeTool(target, parsed, now)
            ?: LocalIntent.Clarify("Para quando devo adiar?", PendingRequest.PostponeNeedsDate(target))
    }

    private fun postponeTool(target: ItemRef, parsed: ParsedWhen, now: ZonedDateTime): LocalIntent? =
        when (val r = dateParser.resolve(parsed, now)) {
            is WhenResolution.Resolved -> LocalIntent.Tool(AssistantTool.Postpone(target, null, r.dateTime), r.periodAssumed)
            is WhenResolution.DateOnly -> LocalIntent.Tool(AssistantTool.Postpone(target, r.date, null))
            else -> null
        }

    private fun stripFluff(text: String): Utterance {
        var u = Utterance(text, PtText.fold(text))
        while (true) {
            val m = FLUFF.find(u.folded) ?: break
            if (m.range.first != 0 || m.value.isEmpty()) break
            u = u.from(m.range.last + 1)
        }
        return u
    }

    private fun timeAnswer(now: ZonedDateTime): String =
        "Agora são ${PtBrFormat.time(now.toLocalTime())} de ${PtBrFormat.longDate(now.toLocalDate())}."

    companion object {
        private const val START = "^\\s*"

        private val FLUFF = Regex(
            "^\\s*(?:ei\\s+|oi\\s+|ola\\s+)?(?:aurora[,!.]?\\s*|por favor[,]?\\s*|voce (?:pode|poderia|consegue)\\s+|pode\\s+|poderia\\s+|preciso que (?:voce )?)",
        )

        /** Remove conectivos e pontuação nas pontas; null se não sobrar nada útil. */
        fun cleanTitle(text: String): String? {
            var t = PtText.collapseSpaces(text)
            val leading = Regex("^(?:de|que|para|pra|pro|sobre|do|da|dos|das|a|o|e|:|,|-|–)(?:\\s+|$)", RegexOption.IGNORE_CASE)
            val trailing = Regex("(?:\\s+(?:e|de|as|às|a|para|pra|pro|no|na))+$|[\\s.,;:!?-]+$", RegexOption.IGNORE_CASE)
            repeat(4) {
                t = t.replace(leading, "").replace(trailing, "").trim()
            }
            return t.takeIf { it.isNotBlank() && it.any(Char::isLetterOrDigit) }
        }

        private val PRONOUN_ONLY = Regex(
            "^(?:isso|isto|essa|esse|esta|este|ela|ele|a tarefa|o lembrete|essa tarefa|esse lembrete|esta tarefa|este lembrete|como feita|como feito|como concluida|como concluido)$",
        )

        /** Alvo textual de uma ação, ignorando pronomes ("isso") que apontam para o último item citado. */
        fun cleanTarget(text: String): String? {
            val t = cleanTitle(text) ?: return null
            val f = PtText.fold(t).trim()
            if (PRONOUN_ONLY.matches(f)) return null
            val stripped = t.replace(
                Regex("^(?:a |o )?(?:tarefa|lembrete)\\s+(?:de\\s+|do\\s+|da\\s+)?", RegexOption.IGNORE_CASE),
                "",
            ).replace(Regex("\\s+como\\s+(?:feit[ao]|conclu[ií]d[ao])$", RegexOption.IGNORE_CASE), "")
            return cleanTitle(stripped)?.takeUnless { PRONOUN_ONLY.matches(PtText.fold(it)) }
        }

        private val SMALL_TALK = listOf(
            Regex("(?:oi|ola|e ai|opa)(?: aurora)?") to "Oi! Como posso ajudar?",
            Regex("(?:bom dia|boa tarde|boa noite)(?: aurora)?") to "Olá! Em que posso ajudar?",
            Regex("(?:obrigad[oa]|valeu|brigad[oa])(?: aurora)?(?: mesmo)?") to "De nada!",
            Regex("tudo bem\\??") to "Tudo certo por aqui. Quer ver sua agenda de hoje?",
        )
        private val TIME_QUERY = Regex("\\b(?:que horas sao|que dia e hoje|qual (?:e )?a data de hoje|que dia (?:e|eh) hoje)\\b")

        private val REMINDER = Regex(
            "$START(?:me\\s+lembr[ae]|lembre-me|lembra-me|me\\s+avis[ae]|cri[ae]r?\\s+(?:um\\s+)?lembrete|" +
                "agend[ae]r?\\s+(?:um\\s+)?lembrete|(?:novo|um)\\s+lembrete|lembrete)\\b\\s*:?",
        )
        private val SAVE_MEMORY = Regex(
            "$START(?:lembr[ae](?:-se)?\\s+(?:de\\s+)?que|guard[ae]\\s+(?:que|isso|isto)|memoriz[ae](?:\\s+que)?|" +
                "grav[ae]\\s+(?:que|isso)|salv[ae]\\s+na\\s+(?:sua\\s+)?memoria(?:\\s+que)?|saiba\\s+que)\\b\\s*:?",
        )
        private val PREFERENCE_HINT = Regex("\\b(?:prefiro|gosto|nao gosto|odeio|adoro|curto|detesto|favorit[oa])\\b")
        private val NOTE = Regex(
            "$START(?:anot[ae]r?|cri[ae]r?\\s+(?:uma\\s+)?nota|nova\\s+nota|toma\\s+nota|registr[ae]r?|salv[ae]r?)" +
                "(?:\\s+(?:a\\s+|uma\\s+|essa\\s+|esta\\s+|ai\\s+|aqui\\s+)?(?:ideia|nota|isso|isto|aqui|ai))?\\b\\s*:?",
        )
        private val CREATE_TASK = Regex(
            "$START(?:(?:cri[ae]r?|adicion[ae]r?|coloc[ae]r?|marc[ae]r?|bot[ae]r?|inclu[ia]r?|cadastr[ae]r?|anot[ae]r?)\\s+" +
                "(?:uma\\s+)?(?:nova\\s+)?tarefa(?:\\s+recorrente)?|nova\\s+tarefa(?:\\s+recorrente)?|tarefa(?:\\s+recorrente)?\\s*:)\\b\\s*:?",
        )
        private val LIST_REMINDERS = Regex("\\b(?:quais|qual|lista|listar|mostr[ae]|ver|meus|tenho)\\b.*\\blembretes\\b|^lembretes$")
        private val LIST_TASKS = Regex(
            "\\b(?:quais|qual|lista|listar|mostr[ae]|ver|minhas|tenho|me (?:diz|diga|fala|fale))\\b.*\\btarefas?\\b|\\bo que (?:eu )?(?:tenho|preciso) (?:pra|para) fazer\\b",
        )
        private val PLAN = Regex("\\b(?:organiz[ae]r?|planej[ae]r?|mont[ae]r?)\\b.*\\b(?:dia|agenda|manha|tarde)\\b|\\bplano do dia\\b")
        private val AGENDA = Regex(
            "\\b(?:agenda|compromissos?|o que (?:eu )?tenho (?:hoje|amanha|pra hoje|para hoje|pra amanha|para amanha)|como (?:esta|e|vai ser) (?:o )?meu dia|resumo do dia)\\b",
        )
        private val POSTPONE = Regex(
            "$START(?:adi[ae]r?|adiar|empurr[ae]r?|transfer[ei]r?|remarc[ae]r?|reagend[ae]r?)\\b",
        )
        private val COMPLETE = Regex(
            "$START(?:conclu[ia]r?|conclui|finaliz[ae]r?|termin(?:ei|ar|a|e)|complet[ae]r?|risc[ae]r?|" +
                "marc[ae]r?\\s+(?:a\\s+tarefa\\s+.*\\s+)?como\\s+(?:feit[ao]|conclu[ií]d[ao])|ja\\s+fiz)\\b",
        )
        private val DELETE_TASK = Regex("$START(?:apag[ae]r?|exclu[ia]r?|delet[ae]r?|remov[ae]r?)\\s+(?:a\\s+|essa\\s+)?tarefa\\b")
        private val CANCEL_REMINDER = Regex(
            "$START(?:cancel[ae]r?|apag[ae]r?|exclu[ia]r?|desativ[ae]r?|remov[ae]r?|delet[ae]r?)\\s+(?:o\\s+|esse\\s+|este\\s+)?lembrete\\b",
        )
        private val SEARCH_NOTES = Regex(
            "(?:o que (?:eu )?anotei (?:sobre|de)|procur[ae]r?\\s+(?:nas\\s+)?(?:minhas\\s+)?notas(?:\\s+(?:por|sobre|de))?|" +
                "busc[ae]r?\\s+(?:nas\\s+)?(?:minhas\\s+)?notas(?:\\s+(?:por|sobre|de))?)\\b",
        )
        private val SEARCH_MEMORY = Regex("(?:o que (?:voce )?(?:sabe|lembra) (?:sobre (?:mim|isso)|de mim)|o que voce sabe sobre|do que voce lembra(?: sobre)?)\\b")
        private val OPEN_APP = Regex("$START(?:abr[ae]|abrir|inici[ae]r?|execut[ae]r?)\\s+(?:o\\s+|a\\s+)?(?:app\\s+|aplicativo\\s+)?(?:do\\s+|da\\s+)?")

        private val YES = Regex("^(?:sim|s|pode|pode sim|confirmo|confirma|isso|ok|okay|claro|certo|manda ver|com certeza|exato|beleza|blz|pode ser)\\b")
        private val NO = Regex("^(?:nao|n|negativo|nem|cancela|deixa)\\b")
        private val CANCEL_WORDS = Regex("^(?:cancela|cancelar|deixa pra la|deixa para la|esquece|esqueca|nada|nao precisa|para|pare)$")
    }
}
