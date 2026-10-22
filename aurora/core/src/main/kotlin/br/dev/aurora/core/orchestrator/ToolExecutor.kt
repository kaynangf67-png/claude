package br.dev.aurora.core.orchestrator

import br.dev.aurora.core.model.MemoryEntry
import br.dev.aurora.core.model.Note
import br.dev.aurora.core.model.Reminder
import br.dev.aurora.core.model.Task
import br.dev.aurora.core.model.TaskStatus
import br.dev.aurora.core.planning.AgendaBuilder
import br.dev.aurora.core.planning.AgendaDay
import br.dev.aurora.core.planning.DailyPlanner
import br.dev.aurora.core.repository.AppLaunchResult
import br.dev.aurora.core.repository.AppLauncher
import br.dev.aurora.core.repository.CalendarSource
import br.dev.aurora.core.repository.DeviceCapabilities
import br.dev.aurora.core.repository.MemoryRepository
import br.dev.aurora.core.repository.NoteRepository
import br.dev.aurora.core.repository.ReminderRepository
import br.dev.aurora.core.repository.ReminderScheduler
import br.dev.aurora.core.repository.ScheduleOutcome
import br.dev.aurora.core.repository.TaskRepository
import br.dev.aurora.core.text.PtBrFormat
import br.dev.aurora.core.text.PtText
import br.dev.aurora.core.time.RecurrenceCalculator
import br.dev.aurora.core.tools.AssistantTool
import br.dev.aurora.core.tools.ItemRef
import java.time.LocalDate
import java.time.ZonedDateTime

enum class ItemKind { TASK, REMINDER }

data class ItemPointer(val kind: ItemKind, val id: Long)

/**
 * Resultado de uma ferramenta. [message] é para o usuário; [forModel] (opcional) traz ids e detalhes para a IA.
 */
data class ToolOutcome(
    val success: Boolean,
    val message: String,
    val forModel: String = message,
    val referenced: ItemPointer? = null,
)

class AssistantDependencies(
    val tasks: TaskRepository,
    val reminders: ReminderRepository,
    val notes: NoteRepository,
    val memory: MemoryRepository,
    val scheduler: ReminderScheduler,
    val calendar: CalendarSource,
    val apps: AppLauncher,
    val capabilities: DeviceCapabilities,
)

/** Executa ferramentas já validadas. Só reporta sucesso depois que a persistência foi concluída. */
class ToolExecutor(
    private val deps: AssistantDependencies,
    private val now: () -> ZonedDateTime,
    private val planner: DailyPlanner = DailyPlanner(),
) {

    suspend fun execute(tool: AssistantTool, lastMentioned: ItemPointer?): ToolOutcome = when (tool) {
        is AssistantTool.CreateTask -> createTask(tool)
        is AssistantTool.UpdateTask -> updateTask(tool, lastMentioned)
        is AssistantTool.CompleteTask -> completeTask(tool.target, lastMentioned)
        is AssistantTool.DeleteTask -> deleteTask(tool.target, lastMentioned)
        is AssistantTool.ListTasks -> listTasks(tool)
        is AssistantTool.CreateReminder -> createReminder(tool)
        AssistantTool.ListReminders -> listReminders()
        is AssistantTool.RescheduleReminder -> rescheduleReminder(tool.target, tool.at, lastMentioned)
        is AssistantTool.CancelReminder -> cancelReminder(tool.target, lastMentioned)
        is AssistantTool.Postpone -> postpone(tool, lastMentioned)
        is AssistantTool.GetAgenda -> agenda(tool.date)
        is AssistantTool.CreateNote -> createNote(tool)
        is AssistantTool.SearchNotes -> searchNotes(tool.query)
        is AssistantTool.SaveMemory -> saveMemory(tool)
        is AssistantTool.SearchMemory -> searchMemory(tool.query)
        is AssistantTool.BuildDailyPlan -> dailyPlan(tool.date)
        is AssistantTool.OpenApp -> openApp(tool.appName)
    }

    /** Frase curta que descreve a ação, usada em pedidos de confirmação. */
    suspend fun describeForConfirmation(tool: AssistantTool, lastMentioned: ItemPointer?): String = when (tool) {
        is AssistantTool.DeleteTask -> when (val r = resolveTask(tool.target, lastMentioned)) {
            is Resolved.Found -> "excluir a tarefa \"${r.item.title}\""
            else -> "excluir a tarefa"
        }
        is AssistantTool.CancelReminder -> when (val r = resolveReminder(tool.target, lastMentioned)) {
            is Resolved.Found -> "cancelar o lembrete \"${r.item.title}\""
            else -> "cancelar o lembrete"
        }
        is AssistantTool.SaveMemory -> "guardar na memória: \"${tool.content}\""
        else -> "executar esta ação"
    }

    // ---------- Tarefas ----------

    private suspend fun createTask(t: AssistantTool.CreateTask): ToolOutcome {
        val zone = now().zone
        val instant = now().toInstant()
        val (dueAt, allDay) = when {
            t.dueDateTime != null -> t.dueDateTime.toInstant() to false
            t.dueDate != null -> t.dueDate.atStartOfDay(zone).toInstant() to true
            else -> null to false
        }
        val task = Task(
            title = t.title, description = t.description, priority = t.priority, dueAt = dueAt, dueAllDay = allDay,
            recurrence = t.recurrence, createdAt = instant, updatedAt = instant,
        )
        val id = deps.tasks.upsert(task)
        val saved = task.copy(id = id)
        val parts = mutableListOf("Tarefa criada: \"${t.title}\"")
        dueText(saved)?.let { parts += "para $it" }
        t.recurrence?.let { parts += "(${PtBrFormat.recurrence(it)})" }
        if (t.priority != br.dev.aurora.core.model.Priority.MEDIUM) parts += "— prioridade ${t.priority.label}"
        return ToolOutcome(true, parts.joinToString(" ") + ".", "Tarefa criada com id $id.", ItemPointer(ItemKind.TASK, id))
    }

    private suspend fun updateTask(t: AssistantTool.UpdateTask, last: ItemPointer?): ToolOutcome {
        val task = when (val r = resolveTask(t.target, last)) {
            is Resolved.Found -> r.item
            is Resolved.Problem -> return r.outcome
        }
        val zone = now().zone
        var updated = task.copy(updatedAt = now().toInstant())
        t.title?.let { updated = updated.copy(title = it) }
        t.priority?.let { updated = updated.copy(priority = it) }
        t.dueDateTime?.let { updated = updated.copy(dueAt = it.toInstant(), dueAllDay = false) }
        t.dueDate?.let { updated = updated.copy(dueAt = it.atStartOfDay(zone).toInstant(), dueAllDay = true) }
        deps.tasks.upsert(updated)
        return ToolOutcome(true, "Tarefa \"${updated.title}\" atualizada.", referenced = ItemPointer(ItemKind.TASK, task.id))
    }

    private suspend fun completeTask(target: ItemRef, last: ItemPointer?): ToolOutcome {
        val task = when (val r = resolveTask(target, last, pendingOnly = true)) {
            is Resolved.Found -> r.item
            is Resolved.Problem -> return r.outcome
        }
        val instant = now().toInstant()
        val rule = task.recurrence
        val due = task.dueAt
        if (rule != null && due != null) {
            val zone = now().zone
            val next = RecurrenceCalculator.nextOccurrence(rule, due.atZone(zone).toLocalDateTime(), maxOf(due, instant), zone)
            deps.tasks.upsert(task.copy(dueAt = next, updatedAt = instant))
            val nextText = PtBrFormat.day(next.atZone(zone).toLocalDate(), now().toLocalDate())
            return ToolOutcome(true, "Feito! \"${task.title}\" concluída. A próxima é $nextText.", referenced = ItemPointer(ItemKind.TASK, task.id))
        }
        deps.tasks.upsert(task.copy(status = TaskStatus.COMPLETED, completedAt = instant, updatedAt = instant))
        return ToolOutcome(true, "Feito! Marquei \"${task.title}\" como concluída.", referenced = ItemPointer(ItemKind.TASK, task.id))
    }

    private suspend fun deleteTask(target: ItemRef, last: ItemPointer?): ToolOutcome {
        val task = when (val r = resolveTask(target, last)) {
            is Resolved.Found -> r.item
            is Resolved.Problem -> return r.outcome
        }
        deps.tasks.delete(task.id)
        return ToolOutcome(true, "Tarefa \"${task.title}\" excluída.")
    }

    private suspend fun listTasks(t: AssistantTool.ListTasks): ToolOutcome {
        val zone = now().zone
        val all = deps.tasks.getAll().filter { t.includeCompleted || !it.isCompleted }
        val selected = if (t.date != null) {
            val today = now().toLocalDate()
            all.filter { task ->
                val d = AgendaBuilder.dueDate(task, zone)
                d == t.date || (t.date == today && d != null && d < today && !task.isCompleted)
            }
        } else {
            all
        }.sortedWith(compareByDescending<Task> { AgendaBuilder.priorityWeight(it.priority) }.thenBy { it.dueAt })

        val whenText = t.date?.let { " para ${PtBrFormat.day(it, now().toLocalDate())}" } ?: ""
        if (selected.isEmpty()) return ToolOutcome(true, "Você não tem tarefas pendentes$whenText.")
        val names = selected.take(MAX_LIST).map { describeTaskShort(it) }
        val extra = if (selected.size > MAX_LIST) " e mais ${selected.size - MAX_LIST}" else ""
        val msg = "Você tem ${PtBrFormat.plural(selected.size, "tarefa", "tarefas")}$whenText: ${PtBrFormat.joinPt(names)}$extra."
        val forModel = selected.take(30).joinToString("\n") { "[id ${it.id}] ${describeTaskShort(it)}" + (dueText(it)?.let { d -> ", prazo $d" } ?: "") }
        return ToolOutcome(true, msg, forModel)
    }

    // ---------- Lembretes ----------

    private suspend fun createReminder(t: AssistantTool.CreateReminder): ToolOutcome {
        val instant = now().toInstant()
        val reminder = Reminder(
            title = t.title, details = t.details, scheduledAt = t.at.toInstant(), recurrence = t.recurrence,
            createdAt = instant, updatedAt = instant,
        )
        val id = deps.reminders.upsert(reminder)
        val outcome = deps.scheduler.schedule(reminder.copy(id = id))
        val whenText = PtBrFormat.dateTime(t.at, now())
        val rec = t.recurrence?.let { " (${PtBrFormat.recurrence(it)})" } ?: ""
        val pointer = ItemPointer(ItemKind.REMINDER, id)
        return when (outcome) {
            ScheduleOutcome.FAILED, ScheduleOutcome.NOT_SCHEDULED_PAST -> ToolOutcome(
                false,
                "Salvei o lembrete \"${t.title}\", mas não consegui agendar o alarme. Confira as permissões em Ajustes.",
                "Lembrete salvo (id $id), porém o alarme não foi agendado.",
                pointer,
            )
            else -> {
                val warnings = scheduleWarnings(outcome)
                ToolOutcome(true, "Pronto! Vou te lembrar $whenText$rec: ${t.title}.$warnings", "Lembrete criado com id $id para $whenText.$warnings", pointer)
            }
        }
    }

    private suspend fun scheduleWarnings(outcome: ScheduleOutcome): String {
        val w = mutableListOf<String>()
        if (outcome == ScheduleOutcome.INEXACT) w += "Sem permissão de alarme exato, o aviso pode atrasar alguns minutos."
        if (!deps.capabilities.notificationsAllowed()) w += "As notificações estão desativadas; ative-as para receber o aviso."
        return if (w.isEmpty()) "" else " " + w.joinToString(" ")
    }

    private suspend fun listReminders(): ToolOutcome {
        val nowInstant = now().toInstant()
        val upcoming = deps.reminders.getAll().filter { it.enabled && (it.scheduledAt >= nowInstant || it.recurrence != null) }
            .sortedBy { it.scheduledAt }
        if (upcoming.isEmpty()) return ToolOutcome(true, "Você não tem lembretes agendados.")
        val items = upcoming.take(MAX_LIST).map { "${it.title} (${PtBrFormat.dateTime(it.scheduledAt.atZone(now().zone), now())})" }
        val extra = if (upcoming.size > MAX_LIST) " e mais ${upcoming.size - MAX_LIST}" else ""
        val forModel = upcoming.take(30).joinToString("\n") {
            "[id ${it.id}] ${it.title} em ${PtBrFormat.dateTime(it.scheduledAt.atZone(now().zone), now())}" +
                (it.recurrence?.let { r -> ", ${PtBrFormat.recurrence(r)}" } ?: "")
        }
        return ToolOutcome(true, "Próximos lembretes: ${PtBrFormat.joinPt(items)}$extra.", forModel)
    }

    private suspend fun rescheduleReminder(target: ItemRef, at: ZonedDateTime, last: ItemPointer?): ToolOutcome {
        val reminder = when (val r = resolveReminder(target, last)) {
            is Resolved.Found -> r.item
            is Resolved.Problem -> return r.outcome
        }
        return moveReminder(reminder, at)
    }

    private suspend fun moveReminder(reminder: Reminder, at: ZonedDateTime): ToolOutcome {
        if (!at.isAfter(now())) return ToolOutcome(false, "Esse horário já passou. Escolha um horário futuro.")
        val updated = reminder.copy(scheduledAt = at.toInstant(), enabled = true, updatedAt = now().toInstant())
        deps.reminders.upsert(updated)
        val outcome = deps.scheduler.schedule(updated)
        val pointer = ItemPointer(ItemKind.REMINDER, reminder.id)
        if (outcome == ScheduleOutcome.FAILED) {
            return ToolOutcome(false, "Atualizei o horário, mas não consegui agendar o alarme. Confira as permissões em Ajustes.", referenced = pointer)
        }
        return ToolOutcome(true, "Lembrete \"${reminder.title}\" remarcado para ${PtBrFormat.dateTime(at, now())}.${scheduleWarnings(outcome)}", referenced = pointer)
    }

    private suspend fun cancelReminder(target: ItemRef, last: ItemPointer?): ToolOutcome {
        val reminder = when (val r = resolveReminder(target, last)) {
            is Resolved.Found -> r.item
            is Resolved.Problem -> return r.outcome
        }
        deps.scheduler.cancel(reminder.id)
        deps.reminders.upsert(reminder.copy(enabled = false, updatedAt = now().toInstant()))
        return ToolOutcome(true, "Lembrete \"${reminder.title}\" cancelado.")
    }

    private suspend fun postpone(t: AssistantTool.Postpone, last: ItemPointer?): ToolOutcome {
        val pointer: ItemPointer? = when (val target = t.target) {
            ItemRef.LastMentioned -> last
            is ItemRef.ById -> null
            is ItemRef.ByTitle -> null
        }
        // Título: procura primeiro em tarefas pendentes, depois em lembretes ativos.
        val kind = pointer?.kind ?: when (t.target) {
            is ItemRef.ByTitle -> if (findTasks(t.target.query, pendingOnly = true).isNotEmpty()) ItemKind.TASK else ItemKind.REMINDER
            else -> ItemKind.TASK
        }
        if (t.target == ItemRef.LastMentioned && last == null) return NO_REFERENCE
        return when (kind) {
            ItemKind.TASK -> {
                val task = when (val r = resolveTask(t.target, last, pendingOnly = true)) {
                    is Resolved.Found -> r.item
                    is Resolved.Problem -> return r.outcome
                }
                val zone = now().zone
                val (dueAt, allDay) = when {
                    t.toDateTime != null -> t.toDateTime.toInstant() to false
                    t.toDate != null && task.dueAt != null && !task.dueAllDay ->
                        t.toDate.atTime(task.dueAt.atZone(zone).toLocalTime()).atZone(zone).toInstant() to false
                    t.toDate != null -> t.toDate.atStartOfDay(zone).toInstant() to true
                    else -> return ToolOutcome(false, "Para quando devo adiar?")
                }
                val updated = task.copy(dueAt = dueAt, dueAllDay = allDay, updatedAt = now().toInstant())
                deps.tasks.upsert(updated)
                ToolOutcome(true, "Adiei \"${task.title}\" para ${dueText(updated)}.", referenced = ItemPointer(ItemKind.TASK, task.id))
            }
            ItemKind.REMINDER -> {
                val reminder = when (val r = resolveReminder(t.target, last)) {
                    is Resolved.Found -> r.item
                    is Resolved.Problem -> return r.outcome
                }
                val zone = now().zone
                val at = t.toDateTime ?: t.toDate?.atTime(reminder.scheduledAt.atZone(zone).toLocalTime())?.atZone(zone)
                    ?: return ToolOutcome(false, "Para quando devo adiar?")
                moveReminder(reminder, at)
            }
        }
    }

    // ---------- Agenda e plano ----------

    suspend fun buildAgenda(date: LocalDate): AgendaDay {
        val zone = now().zone
        val events = if (deps.calendar.isAvailable()) {
            runCatching {
                deps.calendar.events(date.atStartOfDay(zone).toInstant(), date.plusDays(1).atStartOfDay(zone).toInstant())
            }.getOrDefault(emptyList())
        } else {
            emptyList()
        }
        return AgendaBuilder.build(date, zone, now().toInstant(), deps.tasks.getAll(), deps.reminders.getAll(), events)
    }

    private suspend fun agenda(date: LocalDate): ToolOutcome {
        val day = buildAgenda(date)
        val dayText = PtBrFormat.day(date, now().toLocalDate())
        if (day.isEmpty) return ToolOutcome(true, "Nada na agenda para $dayText.")
        val parts = mutableListOf<String>()
        if (day.events.isNotEmpty()) {
            parts += "Eventos: " + PtBrFormat.joinPt(day.events.map {
                if (it.allDay) "${it.title} (dia todo)" else "${it.title} às ${PtBrFormat.time(it.start.atZone(now().zone).toLocalTime())}"
            })
        }
        if (day.reminders.isNotEmpty()) {
            parts += "Lembretes: " + PtBrFormat.joinPt(day.reminders.map { "${it.reminder.title} às ${PtBrFormat.time(it.at.toLocalTime())}" })
        }
        if (day.tasksDue.isNotEmpty()) parts += "Tarefas: " + PtBrFormat.joinPt(day.tasksDue.map { describeTaskShort(it) })
        if (day.overdue.isNotEmpty()) parts += "Atrasadas: " + PtBrFormat.joinPt(day.overdue.map { it.title })
        val capitalized = dayText.replaceFirstChar { it.uppercase() }
        return ToolOutcome(true, "$capitalized. ${parts.joinToString(". ")}.")
    }

    private suspend fun dailyPlan(date: LocalDate): ToolOutcome {
        val day = buildAgenda(date)
        val pending = deps.tasks.getAll().filter { !it.isCompleted }
        val plan = planner.plan(day, pending, now())
        val dayText = PtBrFormat.day(date, now().toLocalDate())
        val fixed = (day.events.filter { !it.allDay }.map { PtBrFormat.time(it.start.atZone(now().zone).toLocalTime()) + " " + it.title } +
            day.reminders.map { PtBrFormat.time(it.at.toLocalTime()) + " " + it.reminder.title }).sorted()
        val sb = StringBuilder("Plano para $dayText. ")
        if (fixed.isNotEmpty()) sb.append("Compromissos fixos: ").append(PtBrFormat.joinPt(fixed)).append(". ")
        if (plan.suggestions.isEmpty()) {
            sb.append("Nada pendente; o dia está livre.")
        } else {
            sb.append(plan.suggestions.joinToString(" "))
        }
        return ToolOutcome(true, sb.toString().trim())
    }

    // ---------- Notas e memória ----------

    private suspend fun createNote(t: AssistantTool.CreateNote): ToolOutcome {
        val instant = now().toInstant()
        val title = t.title ?: t.content.split(Regex("\\s+")).take(6).joinToString(" ").let {
            if (t.content.length > it.length) "$it…" else it
        }
        val id = deps.notes.upsert(Note(title = title, content = t.content, createdAt = instant, updatedAt = instant))
        return ToolOutcome(true, "Anotado: \"${t.content.take(120)}\".", "Nota criada com id $id.")
    }

    private suspend fun searchNotes(query: String): ToolOutcome {
        val found = deps.notes.search(query, 5)
        if (found.isEmpty()) return ToolOutcome(true, "Não encontrei notas sobre \"$query\".")
        val msg = "Encontrei ${PtBrFormat.plural(found.size, "nota", "notas")}: " +
            found.joinToString("; ") { it.content.take(140) } + "."
        return ToolOutcome(true, msg, found.joinToString("\n") { "[nota ${it.id}] ${it.content.take(500)}" })
    }

    private suspend fun saveMemory(t: AssistantTool.SaveMemory): ToolOutcome {
        val instant = now().toInstant()
        deps.memory.upsert(MemoryEntry(category = t.category, content = t.content, createdAt = instant, updatedAt = instant, userApproved = true))
        return ToolOutcome(true, "Guardado na memória: \"${t.content}\". Você pode ver ou apagar em Memória.")
    }

    private suspend fun searchMemory(query: String): ToolOutcome {
        val found = if (query.isBlank()) deps.memory.getAll().filter { it.userApproved }.take(10) else deps.memory.search(query, 5)
        if (found.isEmpty()) return ToolOutcome(true, "Não tenho nada guardado sobre isso.")
        return ToolOutcome(true, "Sei que: " + found.joinToString("; ") { it.content } + ".")
    }

    private suspend fun openApp(name: String): ToolOutcome = when (deps.apps.open(name)) {
        AppLaunchResult.OPENED -> ToolOutcome(true, "Abrindo $name.")
        AppLaunchResult.NOT_FOUND -> ToolOutcome(false, "Não encontrei o app \"$name\" instalado.")
        AppLaunchResult.AMBIGUOUS -> ToolOutcome(false, "Encontrei mais de um app parecido com \"$name\". Diga o nome completo.")
    }

    // ---------- Resolução de alvos ----------

    private sealed interface Resolved<out T> {
        data class Found<T>(val item: T) : Resolved<T>
        data class Problem(val outcome: ToolOutcome) : Resolved<Nothing>
    }

    private suspend fun findTasks(query: String, pendingOnly: Boolean): List<Task> {
        val q = PtText.fold(query).trim()
        val candidates = deps.tasks.getAll().filter { !pendingOnly || !it.isCompleted }
        val exact = candidates.filter { PtText.fold(it.title).trim() == q }
        if (exact.isNotEmpty()) return exact
        val words = q.split(' ').filter { it.length > 2 }
        return candidates.filter { t ->
            val title = PtText.fold(t.title)
            title.contains(q) || (words.isNotEmpty() && words.all { title.contains(it) })
        }
    }

    private suspend fun resolveTask(ref: ItemRef, last: ItemPointer?, pendingOnly: Boolean = false): Resolved<Task> = when (ref) {
        is ItemRef.ById -> deps.tasks.get(ref.id)?.let { Resolved.Found(it) }
            ?: Resolved.Problem(ToolOutcome(false, "Não encontrei essa tarefa."))
        ItemRef.LastMentioned -> {
            val id = last?.takeIf { it.kind == ItemKind.TASK }?.id
            id?.let { deps.tasks.get(it) }?.let { Resolved.Found(it) } ?: Resolved.Problem(NO_REFERENCE)
        }
        is ItemRef.ByTitle -> {
            val found = findTasks(ref.query, pendingOnly)
            when (found.size) {
                0 -> Resolved.Problem(ToolOutcome(false, "Não encontrei nenhuma tarefa com \"${ref.query}\"."))
                1 -> Resolved.Found(found.first())
                else -> Resolved.Problem(
                    ToolOutcome(
                        false,
                        "Encontrei ${found.size} tarefas parecidas: ${PtBrFormat.joinPt(found.take(3).map { "\"${it.title}\"" })}. Qual delas?",
                        found.joinToString("\n") { "[id ${it.id}] ${it.title}" },
                    ),
                )
            }
        }
    }

    private suspend fun resolveReminder(ref: ItemRef, last: ItemPointer?): Resolved<Reminder> = when (ref) {
        is ItemRef.ById -> deps.reminders.get(ref.id)?.let { Resolved.Found(it) }
            ?: Resolved.Problem(ToolOutcome(false, "Não encontrei esse lembrete."))
        ItemRef.LastMentioned -> {
            val id = last?.takeIf { it.kind == ItemKind.REMINDER }?.id
            id?.let { deps.reminders.get(it) }?.let { Resolved.Found(it) } ?: Resolved.Problem(NO_REFERENCE)
        }
        is ItemRef.ByTitle -> {
            val q = PtText.fold(ref.query).trim()
            val active = deps.reminders.getAll().filter { it.enabled }
            val found = active.filter { PtText.fold(it.title).trim() == q }.ifEmpty { active.filter { PtText.fold(it.title).contains(q) } }
            when (found.size) {
                0 -> Resolved.Problem(ToolOutcome(false, "Não encontrei nenhum lembrete com \"${ref.query}\"."))
                1 -> Resolved.Found(found.first())
                else -> Resolved.Problem(
                    ToolOutcome(
                        false,
                        "Encontrei ${found.size} lembretes parecidos: ${PtBrFormat.joinPt(found.take(3).map { "\"${it.title}\"" })}. Qual deles?",
                        found.joinToString("\n") { "[id ${it.id}] ${it.title}" },
                    ),
                )
            }
        }
    }

    private fun describeTaskShort(t: Task): String =
        if (t.priority == br.dev.aurora.core.model.Priority.HIGH) "${t.title} (alta prioridade)" else t.title

    private fun dueText(t: Task): String? {
        val due = t.dueAt ?: return null
        val zdt = due.atZone(now().zone)
        return if (t.dueAllDay) PtBrFormat.day(zdt.toLocalDate(), now().toLocalDate()) else PtBrFormat.dateTime(zdt, now())
    }

    companion object {
        private const val MAX_LIST = 5
        val NO_REFERENCE = ToolOutcome(false, "Não sei a qual item você se refere. Diga o nome da tarefa ou do lembrete.")
    }
}
