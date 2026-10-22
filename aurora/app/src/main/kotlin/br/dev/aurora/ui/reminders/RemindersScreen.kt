@file:OptIn(ExperimentalMaterial3Api::class)

package br.dev.aurora.ui.reminders

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import br.dev.aurora.core.model.Reminder
import br.dev.aurora.core.text.PtBrFormat
import br.dev.aurora.ui.appViewModel
import br.dev.aurora.ui.components.Banner
import br.dev.aurora.ui.components.ConfirmDialog
import br.dev.aurora.ui.components.DateButton
import br.dev.aurora.ui.components.EmptyText
import br.dev.aurora.ui.components.RecurrenceChoice
import br.dev.aurora.ui.components.RecurrenceSelector
import br.dev.aurora.ui.components.TimeButton
import br.dev.aurora.ui.theme.AuroraColors
import java.time.ZoneId
import java.time.ZonedDateTime

@Composable
fun RemindersScreen(openNew: Boolean) {
    val vm = appViewModel { RemindersViewModel(it) }
    val s by vm.state.collectAsStateWithLifecycle()
    val perms by vm.permissions.collectAsStateWithLifecycle()
    val message by vm.message.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val snackbar = remember { SnackbarHostState() }
    var editing by remember { mutableStateOf<ReminderDraft?>(null) }
    var confirmCancel by remember { mutableStateOf<Reminder?>(null) }
    var confirmDelete by remember { mutableStateOf<Reminder?>(null) }
    var openedNew by rememberSaveable { mutableStateOf(false) }

    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { vm.refreshPermissions() }
    LaunchedEffect(openNew) {
        if (openNew && !openedNew) {
            openedNew = true
            editing = ReminderDraft()
        }
    }
    LaunchedEffect(message) {
        message?.let {
            snackbar.showSnackbar(it)
            vm.consumeMessage()
        }
    }
    val notificationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { vm.refreshPermissions() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { TopAppBar(title = { Text("Lembretes") }, colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)) },
        floatingActionButton = { FloatingActionButton(onClick = { editing = ReminderDraft() }) { Icon(Icons.Filled.Add, "Novo lembrete") } },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 16.dp, end = 16.dp, bottom = 96.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (!perms.notifications) {
                item {
                    Banner("As notificações estão bloqueadas: os lembretes não vão aparecer.", actionLabel = "Permitir", color = AuroraColors.Error) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                        } else {
                            context.startActivity(
                                Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                            )
                        }
                    }
                }
            }
            if (!perms.exact && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                item {
                    Banner(
                        "Sem a permissão \"Alarmes e lembretes\", o Android pode atrasar os avisos em alguns minutos para economizar bateria.",
                        actionLabel = "Permitir",
                    ) {
                        context.startActivity(
                            Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}"))
                                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                        )
                    }
                }
            }
            item { Text("Próximos", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp)) }
            if (s.upcoming.isEmpty()) item { EmptyText("Nenhum lembrete agendado. Diga \"me lembra amanhã às 9h de…\".") }
            items(s.upcoming, key = { it.id }) { r ->
                ReminderRow(r, onEdit = { editing = vm.draftOf(r) }, onCancel = { confirmCancel = r }, onDelete = { confirmDelete = r })
            }
            if (s.past.isNotEmpty()) {
                item { Text("Concluídos e cancelados", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 16.dp)) }
                items(s.past, key = { "p" + it.id }) { r ->
                    ReminderRow(r, onEdit = { editing = vm.draftOf(r).copy(date = null, time = null) }, onCancel = null, onDelete = { confirmDelete = r })
                }
            }
        }
    }

    editing?.let { d -> ReminderDialog(d, onDismiss = { editing = null }, onSave = { vm.save(it); editing = null }) }
    confirmCancel?.let { r ->
        ConfirmDialog("Cancelar lembrete?", "\"${r.title}\" não vai mais avisar.", "Cancelar lembrete", { vm.cancel(r) }, { confirmCancel = null })
    }
    confirmDelete?.let { r ->
        ConfirmDialog("Excluir lembrete?", "\"${r.title}\" será apagado definitivamente.", "Excluir", { vm.delete(r) }, { confirmDelete = null })
    }
}

@Composable
private fun ReminderRow(r: Reminder, onEdit: () -> Unit, onCancel: (() -> Unit)?, onDelete: () -> Unit) {
    var menu by remember { mutableStateOf(false) }
    val now = ZonedDateTime.now()
    val at = r.scheduledAt.atZone(ZoneId.systemDefault())
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onEdit),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Row(Modifier.padding(start = 16.dp, top = 10.dp, bottom = 10.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(r.title, style = MaterialTheme.typography.bodyLarge)
                val status = when {
                    r.enabled -> PtBrFormat.dateTime(at, now) + (r.recurrence?.let { " · ${PtBrFormat.recurrence(it)}" } ?: "")
                    r.lastFiredAt != null -> "Avisado ${PtBrFormat.dateTime(r.lastFiredAt!!.atZone(ZoneId.systemDefault()), now)}"
                    else -> "Cancelado"
                }
                Text(status, style = MaterialTheme.typography.bodySmall, color = if (r.enabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                if (r.details.isNotBlank()) Text(r.details, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            IconButton(onClick = { menu = true }) { Icon(Icons.Filled.MoreVert, "Mais opções") }
            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                DropdownMenuItem(text = { Text(if (r.enabled) "Editar / remarcar" else "Reagendar") }, onClick = { menu = false; onEdit() })
                if (onCancel != null) DropdownMenuItem(text = { Text("Cancelar") }, onClick = { menu = false; onCancel() })
                DropdownMenuItem(text = { Text("Excluir") }, onClick = { menu = false; onDelete() })
            }
        }
    }
}

@Composable
private fun ReminderDialog(initial: ReminderDraft, onDismiss: () -> Unit, onSave: (ReminderDraft) -> Unit) {
    var d by remember { mutableStateOf(initial) }
    var recurrence by remember { mutableStateOf(RecurrenceChoice.from(initial.recurrence)) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (initial.id == 0L) "Novo lembrete" else "Editar lembrete") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(d.title, { d = d.copy(title = it) }, label = { Text("Lembrar de…") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(d.details, { d = d.copy(details = it) }, label = { Text("Detalhes (opcional)") }, modifier = Modifier.fillMaxWidth())
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    DateButton(d.date, "Data", { d = d.copy(date = it) })
                    TimeButton(d.time, "Horário", { d = d.copy(time = it) }, allowClear = false)
                }
                Text("Repetição", style = MaterialTheme.typography.labelLarge)
                RecurrenceSelector(recurrence) { recurrence = it }
            }
        },
        confirmButton = { TextButton(onClick = { onSave(d.copy(recurrence = recurrence.toRecurrence(d.date))) }) { Text("Salvar") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
    )
}
