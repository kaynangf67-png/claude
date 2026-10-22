@file:OptIn(ExperimentalMaterial3Api::class)

package br.dev.aurora.ui.projects

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import br.dev.aurora.core.model.GoalStatus
import br.dev.aurora.core.model.Project
import br.dev.aurora.core.text.PtBrFormat
import br.dev.aurora.ui.appViewModel
import br.dev.aurora.ui.components.ConfirmDialog
import br.dev.aurora.ui.components.EmptyText
import br.dev.aurora.ui.components.LoadingRow
import br.dev.aurora.ui.components.PriorityDot

@Composable
fun ProjectsScreen() {
    val vm = appViewModel { ProjectsViewModel(it) }
    val projects by vm.projects.collectAsStateWithLifecycle()
    val message by vm.message.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    var editing by remember { mutableStateOf<Project?>(null) }
    var creating by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf<Project?>(null) }
    var expanded by remember { mutableStateOf<Long?>(null) }

    LaunchedEffect(message) {
        message?.let {
            snackbar.showSnackbar(it)
            vm.consumeMessage()
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { TopAppBar(title = { Text("Projetos") }, colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)) },
        floatingActionButton = { FloatingActionButton(onClick = { creating = true }) { Icon(Icons.Filled.Add, "Novo projeto") } },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 16.dp, end = 16.dp, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            val list = projects
            when {
                list == null -> item { LoadingRow() }
                list.isEmpty() -> item {
                    EmptyText("Nenhum projeto ainda. Projetos reúnem tarefas e notas de um mesmo assunto. Toque em + para criar o primeiro.")
                }
                else -> items(list, key = { it.project.id }) { summary ->
                    val p = summary.project
                    val open = expanded == p.id
                    Card(
                        Modifier.fillMaxWidth().clickable { expanded = if (open) null else p.id },
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    ) {
                        Column(Modifier.padding(start = 16.dp, top = 12.dp, bottom = 12.dp, end = 4.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(p.name, style = MaterialTheme.typography.titleMedium)
                                    Text(
                                        listOf(
                                            p.status.label,
                                            PtBrFormat.plural(summary.openTasks.size, "tarefa aberta", "tarefas abertas"),
                                            PtBrFormat.plural(summary.doneCount, "concluída", "concluídas"),
                                            PtBrFormat.plural(summary.noteCount, "nota", "notas"),
                                        ).joinToString(" · "),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                                IconButton(onClick = { editing = p }) { Icon(Icons.Filled.Edit, "Editar projeto") }
                                IconButton(onClick = { deleting = p }) { Icon(Icons.Filled.Delete, "Excluir projeto") }
                            }
                            if (open) {
                                if (p.description.isNotBlank()) {
                                    Text(p.description, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 6.dp, end = 12.dp))
                                }
                                if (summary.openTasks.isEmpty()) {
                                    Text(
                                        "Sem tarefas abertas. Vincule tarefas pelo editor de tarefas (aba Foco).",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.padding(top = 8.dp),
                                    )
                                } else {
                                    summary.openTasks.forEach { t ->
                                        Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                                            PriorityDot(t.priority)
                                            Text(
                                                t.title + if (t.status != br.dev.aurora.core.model.TaskStatus.TODO) " · ${t.status.label.lowercase()}" else "",
                                                modifier = Modifier.padding(start = 8.dp),
                                                style = MaterialTheme.typography.bodyMedium,
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (creating) ProjectDialog(null, onDismiss = { creating = false }) { n, d, s -> vm.save(0, n, d, s); creating = false }
    editing?.let { p -> ProjectDialog(p, onDismiss = { editing = null }) { n, d, s -> vm.save(p.id, n, d, s); editing = null } }
    deleting?.let { p ->
        ConfirmDialog(
            "Excluir projeto?",
            "\"${p.name}\" será excluído. As tarefas e notas vinculadas continuam existindo, só ficam sem projeto.",
            "Excluir",
            { vm.delete(p) },
            { deleting = null },
        )
    }
}

@Composable
private fun ProjectDialog(project: Project?, onDismiss: () -> Unit, onSave: (String, String, GoalStatus) -> Unit) {
    var name by remember { mutableStateOf(project?.name.orEmpty()) }
    var description by remember { mutableStateOf(project?.description.orEmpty()) }
    var status by remember { mutableStateOf(project?.status ?: GoalStatus.ACTIVE) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (project == null) "Novo projeto" else "Editar projeto") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(name, { name = it }, label = { Text("Nome") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(description, { description = it }, label = { Text("Descrição (opcional)") }, modifier = Modifier.fillMaxWidth())
                if (project != null) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf(GoalStatus.ACTIVE, GoalStatus.PAUSED, GoalStatus.COMPLETED).forEach { s ->
                            FilterChip(selected = status == s, onClick = { status = s }, label = { Text(s.label) })
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = { onSave(name, description, status) }, enabled = name.isNotBlank()) { Text("Salvar") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
    )
}
