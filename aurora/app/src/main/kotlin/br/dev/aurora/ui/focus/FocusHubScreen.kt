@file:OptIn(ExperimentalMaterial3Api::class)

package br.dev.aurora.ui.focus

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import br.dev.aurora.ui.agenda.AgendaScreen
import br.dev.aurora.ui.reminders.RemindersScreen
import br.dev.aurora.ui.tasks.TasksScreen

enum class FocusSection(val label: String) { TASKS("Tarefas"), AGENDA("Agenda"), REMINDERS("Lembretes") }

/**
 * Aba Foco: tudo o que é execução. Nesta fase reúne tarefas, agenda e lembretes; objetivos e sessões de
 * foco entram aqui na Fase 4 do plano.
 */
@Composable
fun FocusHubScreen(
    initial: FocusSection,
    openNewTask: Boolean,
    openNewReminder: Boolean,
    onAskPlan: (String) -> Unit,
) {
    var section by rememberSaveable(initial) { mutableStateOf(initial) }
    Column(Modifier.fillMaxSize()) {
        TopAppBar(title = { Text("Foco") }, colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background))
        Row(
            Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            FocusSection.entries.forEach { s ->
                FilterChip(selected = section == s, onClick = { section = s }, label = { Text(s.label) })
            }
        }
        when (section) {
            FocusSection.TASKS -> TasksScreen(openNew = openNewTask, showTopBar = false)
            FocusSection.AGENDA -> AgendaScreen(onAskPlan = onAskPlan, showTopBar = false)
            FocusSection.REMINDERS -> RemindersScreen(openNew = openNewReminder, showTopBar = false)
        }
    }
}
