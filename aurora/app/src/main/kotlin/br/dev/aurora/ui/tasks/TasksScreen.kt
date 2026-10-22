@file:OptIn(ExperimentalMaterial3Api::class)

package br.dev.aurora.ui.tasks

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import br.dev.aurora.core.model.Priority
import br.dev.aurora.core.model.Project
import br.dev.aurora.core.model.TaskStatus
import br.dev.aurora.core.model.Task
import br.dev.aurora.core.text.PtBrFormat
import br.dev.aurora.ui.appViewModel
import br.dev.aurora.ui.components.ConfirmDialog
import br.dev.aurora.ui.components.DateButton
import br.dev.aurora.ui.components.EmptyText
import br.dev.aurora.ui.components.LoadingRow
import br.dev.aurora.ui.components.PriorityDot
import br.dev.aurora.ui.components.RecurrenceChoice
import br.dev.aurora.ui.components.RecurrenceSelector
import br.dev.aurora.ui.components.TimeButton
import br.dev.aurora.ui.theme.AuroraColors
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime

@Composable
fun TasksScreen(openNew: Boolean, showTopBar: Boolean = true) {
    val vm = appViewModel { TasksViewModel(it) }
    val tasksOrNull by vm.tasks.collectAsStateWithLifecycle()
    val tasks = tasksOrNull.orEmpty()
    val projects by vm.projects.collectAsStateWithLifecycle()
    val filter by vm.currentFilter.collectAsStateWithLifecycle()
    val message by vm.message.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    var editing by remember { mutableStateOf<TaskDraft?>(null) }
    var deleting by remember { mutableStateOf<Task?>(null) }
    var openedNew by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(openNew) {
        if (openNew && !openedNew) {
            openedNew = true
            editing = TaskDraft()
        }
    }
    LaunchedEffect(message) {
        message?.let {
            snackbar.showSnackbar(it)
            vm.consumeMessage()
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            if (showTopBar) {
                TopAppBar(title = { Text("Tarefas") }, colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background))
            }
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { editing = TaskDraft() }) { Icon(Icons.Filled.Add, "Nova tarefa") }
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 16.dp, end = 16.dp, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TaskFilter.entries.forEach { f ->
                        FilterChip(selected = filter == f, onClick = { vm.setFilter(f) }, label = { Text(f.label) })
                    }
                }
            }
            if (tasksOrNull == null) {
                item { LoadingRow() }
            } else if (tasks.isEmpty()) {
                item {
                    EmptyText(
                        when (filter) {
                            TaskFilter.PENDING -> "Nenhuma tarefa pendente. Toque em + ou diga \"cria uma tarefa…\"."
                            TaskFilter.OVERDUE -> "Nada atrasado."
                            TaskFilter.DONE -> "Nenhuma tarefa concluída ainda."
                        },
                    )
                }
            }
            items(tasks, key = { it.id }) { task ->
                TaskRow(
                    task = task,
                    overdue = vm.isOverdue(task),
                    onToggle = { if (task.isCompleted) vm.reopen(task) else vm.complete(task) },
                    onEdit = { editing = vm.draftOf(task) },
                    onPostpone = { vm.postponeToTomorrow(task) },
                    onDelete = { deleting = task },
                )
            }
        }
    }

    editing?.let { draft ->
        TaskDialog(draft, projects, onDismiss = { editing = null }, onSave = { vm.save(it); editing = null })
    }
    deleting?.let { task ->
        ConfirmDialog(
            title = "Excluir tarefa?",
            text = "\"${task.title}\" será apagada definitivamente.",
            confirmLabel = "Excluir",
            onConfirm = { vm.delete(task) },
            onDismiss = { deleting = null },
        )
    }
}

@Composable
private fun TaskRow(task: Task, overdue: Boolean, onToggle: () -> Unit, onEdit: () -> Unit, onPostpone: () -> Unit, onDelete: () -> Unit) {
    var menu by remember { mutableStateOf(false) }
    val zone = ZoneId.systemDefault()
    val now = ZonedDateTime.now(zone)
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onEdit),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Row(Modifier.padding(start = 4.dp, end = 4.dp, top = 6.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = task.isCompleted, onCheckedChange = { onToggle() })
            Column(Modifier.weight(1f).padding(horizontal = 4.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    PriorityDot(task.priority)
                    Text(
                        task.title,
                        modifier = Modifier.padding(start = 8.dp),
                        style = MaterialTheme.typography.bodyLarge,
                        textDecoration = if (task.isCompleted) TextDecoration.LineThrough else null,
                    )
                }
                val due = task.dueAt?.atZone(zone)
                val parts = buildList {
                    if (due != null) add(if (task.dueAllDay) PtBrFormat.day(due.toLocalDate(), now.toLocalDate()) else PtBrFormat.dateTime(due, now))
                    task.recurrence?.let { add(PtBrFormat.recurrence(it)) }
                    if (task.status == TaskStatus.IN_PROGRESS || task.status == TaskStatus.POSTPONED || task.status == TaskStatus.CANCELLED) {
                        add(task.status.label.lowercase())
                    }
                    task.estimatedMinutes?.let { add("~$it min") }
                    if (task.priority == Priority.HIGH) add("prioridade alta")
                }
                if (parts.isNotEmpty()) {
                    Text(
                        parts.joinToString(" · ") + if (overdue && !task.isCompleted) " · atrasada" else "",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (overdue && !task.isCompleted) AuroraColors.Warning else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            IconButton(onClick = { menu = true }) { Icon(Icons.Filled.MoreVert, "Mais opções") }
            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                if (!task.isCompleted) DropdownMenuItem(text = { Text("Adiar para amanhã") }, onClick = { menu = false; onPostpone() })
                DropdownMenuItem(text = { Text("Editar") }, onClick = { menu = false; onEdit() })
                DropdownMenuItem(
                    text = { Text("Excluir") },
                    leadingIcon = { Icon(Icons.Filled.Delete, null) },
                    onClick = { menu = false; onDelete() },
                )
            }
        }
    }
}

@Composable
private fun TaskDialog(initial: TaskDraft, projects: List<Project>, onDismiss: () -> Unit, onSave: (TaskDraft) -> Unit) {
    var d by remember { mutableStateOf(initial) }
    var recurrence by remember { mutableStateOf(RecurrenceChoice.from(initial.recurrence)) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (initial.id == 0L) "Nova tarefa" else "Editar tarefa") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(d.title, { d = d.copy(title = it) }, label = { Text("Título") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(d.description, { d = d.copy(description = it) }, label = { Text("Notas (opcional)") }, modifier = Modifier.fillMaxWidth())
                Text("Prioridade", style = MaterialTheme.typography.labelLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Priority.entries.forEach { p ->
                        FilterChip(selected = d.priority == p, onClick = { d = d.copy(priority = p) }, label = { Text(p.label.replaceFirstChar { it.uppercase() }) })
                    }
                }
                Text("Prazo", style = MaterialTheme.typography.labelLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    DateButton(d.date, "Sem data", { d = d.copy(date = it, time = if (it == null) null else d.time) })
                    if (d.date != null) TimeButton(d.time, "Dia todo", { d = d.copy(time = it) })
                }
                Text("Repetição", style = MaterialTheme.typography.labelLarge)
                RecurrenceSelector(recurrence) { recurrence = it }
                var estimate by remember { mutableStateOf(initial.estimatedMinutes?.toString().orEmpty()) }
                OutlinedTextField(
                    estimate,
                    { v -> estimate = v.filter(Char::isDigit).take(4); d = d.copy(estimatedMinutes = estimate.toIntOrNull()?.takeIf { it > 0 }) },
                    label = { Text("Duração estimada (minutos, opcional)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth(),
                )
                if (projects.isNotEmpty() || d.projectId != null) {
                    Text("Projeto", style = MaterialTheme.typography.labelLarge)
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(selected = d.projectId == null, onClick = { d = d.copy(projectId = null) }, label = { Text("Nenhum") })
                        projects.forEach { p ->
                            FilterChip(selected = d.projectId == p.id, onClick = { d = d.copy(projectId = p.id) }, label = { Text(p.name) })
                        }
                    }
                }
                if (initial.id != 0L) {
                    Text("Status", style = MaterialTheme.typography.labelLarge)
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TaskStatus.entries.forEach { st ->
                            FilterChip(selected = d.status == st, onClick = { d = d.copy(status = st) }, label = { Text(st.label) })
                        }
                    }
                }
                if (recurrence != RecurrenceChoice.NONE && d.date == null) {
                    Text("Escolha a data da primeira vez para a repetição funcionar.", style = MaterialTheme.typography.bodySmall, color = AuroraColors.Warning)
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val date = d.date ?: if (recurrence != RecurrenceChoice.NONE) LocalDate.now() else null
                onSave(d.copy(date = date, recurrence = recurrence.toRecurrence(date)))
            }) { Text("Salvar") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
    )
}
