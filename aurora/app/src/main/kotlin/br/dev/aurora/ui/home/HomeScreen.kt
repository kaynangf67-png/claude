@file:OptIn(ExperimentalMaterial3Api::class)

package br.dev.aurora.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import br.dev.aurora.core.text.PtBrFormat
import br.dev.aurora.ui.appViewModel
import br.dev.aurora.ui.components.EmptyText
import br.dev.aurora.ui.components.OrbMode
import br.dev.aurora.ui.components.PriorityDot
import br.dev.aurora.ui.components.SectionCard
import br.dev.aurora.ui.components.VoiceOrb
import br.dev.aurora.ui.theme.AuroraColors

@Composable
fun HomeScreen(
    onTalk: () -> Unit,
    onAsk: (String) -> Unit,
    onOpenSettings: () -> Unit,
    onOpenTasks: (newTask: Boolean) -> Unit,
    onOpenReminders: (newReminder: Boolean) -> Unit,
    onOpenAgenda: () -> Unit,
    onNewNote: () -> Unit,
) {
    val vm = appViewModel { HomeViewModel(it) }
    val s by vm.state.collectAsStateWithLifecycle()
    val greeting = when (s.now.hour) {
        in 5..11 -> "Bom dia"
        in 12..17 -> "Boa tarde"
        else -> "Boa noite"
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f), MaterialTheme.colorScheme.background))),
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(greeting, style = MaterialTheme.typography.displaySmall)
                    Text(
                        PtBrFormat.longDate(s.now.toLocalDate()).replaceFirstChar { it.uppercase() },
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                IconButton(onClick = onOpenSettings) { Icon(Icons.Filled.Settings, contentDescription = "Ajustes") }
            }

            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                VoiceOrb(mode = OrbMode.IDLE, level = 0f, onClick = onTalk, description = "Falar com ${s.assistantName}")
                Spacer(Modifier.height(8.dp))
                Text("Toque para falar com ${s.assistantName}", style = MaterialTheme.typography.titleMedium)
                Text(
                    s.aiStatus,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (s.aiReady) AuroraColors.Success else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AssistChip(onClick = { onOpenTasks(true) }, label = { Text("Nova tarefa") })
                AssistChip(onClick = { onOpenReminders(true) }, label = { Text("Novo lembrete") })
                AssistChip(onClick = onOpenAgenda, label = { Text("Agenda") })
                AssistChip(onClick = onNewNote, label = { Text("Nota") })
                AssistChip(onClick = { onAsk("organiza meu dia") }, label = { Text("Planejar o dia") })
            }

            val day = s.today
            SectionCard(title = "Hoje", trailing = { TextButton(onClick = onOpenAgenda) { Text("Ver agenda") } }) {
                if (day == null || day.isEmpty) {
                    EmptyText("Nada marcado para hoje.")
                } else {
                    val parts = buildList {
                        if (day.events.isNotEmpty()) add(PtBrFormat.plural(day.events.size, "evento", "eventos"))
                        if (day.reminders.isNotEmpty()) add(PtBrFormat.plural(day.reminders.size, "lembrete", "lembretes"))
                        if (day.tasksDue.isNotEmpty()) add(PtBrFormat.plural(day.tasksDue.size, "tarefa", "tarefas"))
                    }
                    if (parts.isNotEmpty()) Text(PtBrFormat.joinPt(parts) + ".", style = MaterialTheme.typography.bodyLarge)
                    if (day.overdue.isNotEmpty()) {
                        Text(
                            PtBrFormat.plural(day.overdue.size, "tarefa atrasada", "tarefas atrasadas"),
                            color = AuroraColors.Warning, style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                    day.events.take(3).forEach {
                        Text(
                            (if (it.allDay) "Dia todo" else PtBrFormat.time(it.start.atZone(s.now.zone).toLocalTime())) + " · " + it.title,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }

            SectionCard(title = "Próximo lembrete", trailing = { TextButton(onClick = { onOpenReminders(false) }) { Text("Todos") } }) {
                val next = s.nextReminder
                if (next == null) {
                    EmptyText("Nenhum lembrete agendado.")
                } else {
                    Text(next.reminder.title, style = MaterialTheme.typography.bodyLarge)
                    Text(PtBrFormat.dateTime(next.at, s.now), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
                }
            }

            SectionCard(title = "Tarefas pendentes", trailing = { TextButton(onClick = { onOpenTasks(false) }) { Text("Todas") } }) {
                if (s.pendingTasks.isEmpty()) {
                    EmptyText("Tudo em dia.")
                } else {
                    s.pendingTasks.forEach { task ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(checked = false, onCheckedChange = { vm.complete(task) })
                            PriorityDot(task.priority)
                            Text(task.title, modifier = Modifier.padding(start = 10.dp).weight(1f), style = MaterialTheme.typography.bodyLarge)
                        }
                    }
                }
            }
            Spacer(Modifier.height(96.dp))
        }
    }
}
