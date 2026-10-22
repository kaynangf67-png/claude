@file:OptIn(ExperimentalMaterial3Api::class)

package br.dev.aurora.ui.agenda

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import br.dev.aurora.core.planning.AgendaDay
import br.dev.aurora.core.text.PtBrFormat
import br.dev.aurora.system.hasPermission
import br.dev.aurora.ui.appViewModel
import br.dev.aurora.ui.components.Banner
import br.dev.aurora.ui.components.EmptyText
import br.dev.aurora.ui.components.PriorityDot
import br.dev.aurora.ui.components.SectionCard
import br.dev.aurora.ui.theme.AuroraColors
import java.time.LocalDate
import java.time.ZoneId

@Composable
fun AgendaScreen(onAskPlan: (String) -> Unit) {
    val vm = appViewModel { AgendaViewModel(it) }
    val s by vm.state.collectAsStateWithLifecycle()
    val plan by vm.plan.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val today = LocalDate.now()
    val calendarPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        vm.enableCalendar(granted)
    }

    Column(Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("Agenda") },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
        )
        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = { vm.shift(false) }) { Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, "Anterior") }
                    Text(
                        if (s.mode == AgendaMode.DAY) PtBrFormat.longDate(s.selected).replaceFirstChar { it.uppercase() }
                        else "Semana de ${PtBrFormat.day(s.days.firstOrNull()?.date ?: s.selected, today)}",
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.weight(1f),
                    )
                    IconButton(onClick = { vm.shift(true) }) { Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, "Próximo") }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    FilterChip(selected = s.mode == AgendaMode.DAY, onClick = { vm.setMode(AgendaMode.DAY) }, label = { Text("Dia") })
                    FilterChip(selected = s.mode == AgendaMode.WEEK, onClick = { vm.setMode(AgendaMode.WEEK) }, label = { Text("Semana") })
                    if (s.selected != today) TextButton(onClick = { vm.select(today) }) { Text("Hoje") }
                }
            }
            if (!s.calendarEnabled || !context.hasPermission(Manifest.permission.READ_CALENDAR)) {
                item {
                    Banner(
                        "Mostrar também os eventos do calendário do aparelho? Só leitura; nada sai do celular.",
                        actionLabel = "Ativar",
                        color = AuroraColors.Blue,
                    ) {
                        if (context.hasPermission(Manifest.permission.READ_CALENDAR)) vm.enableCalendar(true)
                        else calendarPermission.launch(Manifest.permission.READ_CALENDAR)
                    }
                }
            }
            if (s.mode == AgendaMode.DAY) {
                val day = s.days.firstOrNull()
                if (day != null) {
                    item { DayDetails(day) }
                    item {
                        SectionCard(title = "Plano do dia") {
                            val p = plan
                            if (p == null) {
                                Text(
                                    "Monto uma sugestão de ordem para as tarefas usando os intervalos livres. Nada é alterado sem você pedir.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    FilledTonalButton(onClick = vm::buildPlan) { Text("Sugerir plano") }
                                    TextButton(onClick = { onAskPlan("organiza meu dia ${if (day.date == today) "de hoje" else PtBrFormat.day(day.date, today)}") }) {
                                        Text("Perguntar à Aurora")
                                    }
                                }
                            } else {
                                if (p.freeSlots.isNotEmpty()) {
                                    Text(
                                        "Intervalos livres: " + p.freeSlots.joinToString { "${PtBrFormat.time(it.start.toLocalTime())}–${PtBrFormat.time(it.end.toLocalTime())}" },
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.primary,
                                    )
                                }
                                p.suggestions.forEach { Text("• $it", style = MaterialTheme.typography.bodyMedium) }
                            }
                        }
                    }
                }
            } else {
                items(s.days, key = { it.date.toString() }) { day ->
                    SectionCard(
                        title = PtBrFormat.day(day.date, today).replaceFirstChar { it.uppercase() },
                        modifier = Modifier.clickable { vm.select(day.date); vm.setMode(AgendaMode.DAY) },
                    ) {
                        if (day.isEmpty) EmptyText("Livre") else DayLines(day, compact = true)
                    }
                }
            }
        }
    }
}

@Composable
private fun DayDetails(day: AgendaDay) {
    SectionCard(title = "Compromissos") {
        if (day.isEmpty) EmptyText("Nada marcado.") else DayLines(day, compact = false)
    }
}

@Composable
private fun DayLines(day: AgendaDay, compact: Boolean) {
    val zone = ZoneId.systemDefault()
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        day.events.forEach {
            TimedLine(if (it.allDay) "Dia todo" else PtBrFormat.time(it.start.atZone(zone).toLocalTime()), it.title, "Evento")
        }
        day.reminders.forEach { TimedLine(PtBrFormat.time(it.at.toLocalTime()), it.reminder.title, "Lembrete") }
        day.tasksDue.forEach { task ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                PriorityDot(task.priority)
                Text(
                    task.title + if (!task.dueAllDay && task.dueAt != null) " · ${PtBrFormat.time(task.dueAt!!.atZone(zone).toLocalTime())}" else "",
                    modifier = Modifier.padding(start = 10.dp),
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
        }
        if (!compact && day.overdue.isNotEmpty()) {
            Text("Atrasadas", style = MaterialTheme.typography.labelLarge, color = AuroraColors.Warning)
            day.overdue.forEach { Text("• ${it.title}", style = MaterialTheme.typography.bodyMedium) }
        }
    }
}

@Composable
private fun TimedLine(time: String, title: String, kind: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(time, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary, modifier = Modifier.width(72.dp))
        Column(Modifier.fillMaxWidth()) {
            Text(title, style = MaterialTheme.typography.bodyLarge)
            Text(kind, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
