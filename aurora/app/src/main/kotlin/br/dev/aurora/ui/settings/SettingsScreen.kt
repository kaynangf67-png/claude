@file:OptIn(ExperimentalMaterial3Api::class)

package br.dev.aurora.ui.settings

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import br.dev.aurora.core.provider.ModelCatalog
import br.dev.aurora.ui.appViewModel
import br.dev.aurora.ui.components.ConfirmDialog
import br.dev.aurora.ui.components.SectionCard
import br.dev.aurora.ui.theme.AuroraColors
import br.dev.aurora.voice.TtsStatus
import java.time.LocalDate

@Composable
fun SettingsScreen(onBack: () -> Unit) {
    val vm = appViewModel { SettingsViewModel(it) }
    val s by vm.settings.collectAsStateWithLifecycle()
    val usage by vm.usage.collectAsStateWithLifecycle()
    val hasKey by vm.hasApiKey.collectAsStateWithLifecycle()
    val perms by vm.permissions.collectAsStateWithLifecycle()
    val voices by vm.voices.collectAsStateWithLifecycle()
    val tts by vm.ttsStatus.collectAsStateWithLifecycle()
    val message by vm.message.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val snackbar = remember { SnackbarHostState() }

    var confirm by remember { mutableStateOf<String?>(null) }
    var keyInput by rememberSaveable { mutableStateOf("") }

    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { vm.refresh() }
    LaunchedEffect(message) {
        message?.let {
            snackbar.showSnackbar(it)
            vm.consumeMessage()
        }
    }

    val exportLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        if (uri != null) vm.export(uri)
    }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { vm.refresh() }

    fun openAppSettings() = context.startActivity(
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
    )

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Ajustes") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Voltar") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            SectionCard(title = "Assistente") {
                var name by remember(s.assistantName) { mutableStateOf(s.assistantName) }
                OutlinedTextField(
                    name, { name = it.take(30) }, label = { Text("Nome") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                    trailingIcon = { if (name != s.assistantName) TextButton(onClick = { vm.update { it.copy(assistantName = name) } }) { Text("Salvar") } },
                )
                ToggleRow("Falar as respostas", s.speechEnabled) { v -> vm.update { it.copy(speechEnabled = v) } }
                var rate by remember(s.speechRate) { mutableFloatStateOf(s.speechRate) }
                var volume by remember(s.speechVolume) { mutableFloatStateOf(s.speechVolume) }
                Text("Velocidade da fala: ${"%.1f".format(rate)}x", style = MaterialTheme.typography.bodyMedium)
                Slider(
                    value = rate, onValueChange = { rate = it }, valueRange = 0.5f..2.0f, steps = 14,
                    onValueChangeFinished = { vm.update { it.copy(speechRate = rate) } },
                )
                Text("Volume da fala: ${(volume * 100).toInt()}%", style = MaterialTheme.typography.bodyMedium)
                Slider(
                    value = volume, onValueChange = { volume = it }, valueRange = 0.1f..1.0f,
                    onValueChangeFinished = { vm.update { it.copy(speechVolume = volume) } },
                )
                when (tts) {
                    TtsStatus.MISSING_PORTUGUESE -> Text("Nenhuma voz em português instalada. Instale nas configurações de \"Saída de texto para fala\" do Android.", color = AuroraColors.Warning, style = MaterialTheme.typography.bodySmall)
                    TtsStatus.FAILED -> Text("O mecanismo de voz do aparelho não está disponível.", color = AuroraColors.Error, style = MaterialTheme.typography.bodySmall)
                    else -> Unit
                }
                if (voices.isNotEmpty()) {
                    Text("Voz", style = MaterialTheme.typography.labelLarge)
                    RadioRow("Padrão do sistema", s.selectedVoice == null) { vm.update { it.copy(selectedVoice = null) } }
                    voices.take(8).forEach { v -> RadioRow(v.label, s.selectedVoice == v.name) { vm.update { it.copy(selectedVoice = v.name) } } }
                }
                OutlinedButton(onClick = vm::testVoice) { Text("Testar voz") }
            }

            SectionCard(title = "Reconhecimento de voz") {
                Text(
                    when {
                        perms.onDeviceRecognition -> "Reconhecimento no aparelho disponível."
                        perms.recognitionAvailable -> "Reconhecimento disponível pelo serviço do sistema (pode usar internet)."
                        else -> "Nenhum serviço de reconhecimento de voz encontrado. Use o teclado ou instale o app Google."
                    },
                    style = MaterialTheme.typography.bodyMedium,
                )
                ToggleRow("Preferir reconhecimento no aparelho (mais privado)", s.preferOnDeviceRecognition) { v -> vm.update { it.copy(preferOnDeviceRecognition = v) } }
            }

            SectionCard(title = "Ativação por voz (\"Ei, Aurora\")") {
                Text(
                    "Ainda não disponível. A escuta contínua exige um detector local e um serviço com notificação permanente; " +
                        "isso está em avaliação e só será ativado depois de testado em um aparelho real.",
                    style = MaterialTheme.typography.bodyMedium,
                )
                Text(
                    "Hoje você pode: tocar e segurar o ícone da Aurora e escolher \"Falar\", ou definir a Aurora como app de assistente (quando o aparelho oferecer a opção).",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedButton(onClick = {
                    runCatching { context.startActivity(Intent(Settings.ACTION_VOICE_INPUT_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                        .onFailure { runCatching { context.startActivity(Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } }
                }) { Text("Abrir ajustes de assistente do Android") }
            }

            SectionCard(title = "Inteligência artificial") {
                ToggleRow("Usar IA para pedidos que a Aurora não resolve sozinha", s.aiEnabled) { v -> vm.update { it.copy(aiEnabled = v) } }
                Text("Modelo (Anthropic Claude)", style = MaterialTheme.typography.labelLarge)
                ModelCatalog.options.forEach { option ->
                    RadioRow(
                        "${option.label} — US$ ${fmt(option.price.inputPerMTok)} / ${fmt(option.price.outputPerMTok)} por milhão de tokens (entrada/saída). ${option.description}",
                        s.modelId == option.id,
                    ) { vm.update { it.copy(modelId = option.id) } }
                }
                Text(
                    "Preços de 10/2026; confira em anthropic.com/pricing. Pedidos simples (lembretes, tarefas, notas, agenda) não usam IA.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                HorizontalDivider()
                if (hasKey) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Chave de API salva (cifrada no aparelho).", modifier = Modifier.weight(1f), color = AuroraColors.Success)
                        TextButton(onClick = { confirm = "key" }) { Text("Remover") }
                    }
                } else {
                    OutlinedTextField(
                        keyInput, { keyInput = it.trim() }, label = { Text("Chave de API da Anthropic") }, singleLine = true,
                        visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    )
                    FilledTonalButton(onClick = { vm.saveApiKey(keyInput); keyInput = "" }, enabled = keyInput.isNotBlank()) { Text("Salvar chave") }
                    Text("Crie a chave em console.anthropic.com. Ela fica só neste aparelho e nunca vai para o código.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                HorizontalDivider()
                var budget by remember(s.monthlyBudgetUsd) { mutableStateOf(fmt(s.monthlyBudgetUsd)) }
                OutlinedTextField(
                    budget, { budget = it }, label = { Text("Limite mensal (US$)") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    trailingIcon = {
                        val parsed = budget.replace(',', '.').toDoubleOrNull()
                        if (parsed != null && parsed != s.monthlyBudgetUsd) TextButton(onClick = { vm.update { it.copy(monthlyBudgetUsd = parsed) } }) { Text("Salvar") }
                    },
                )
                usage?.let { u ->
                    Text(
                        "Este mês: US$ ${"%.4f".format(u.usd)} estimados em ${u.requests} chamadas (${u.inputTokens} tokens de entrada, ${u.outputTokens} de saída).",
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                Text(
                    "Quando a IA é usada, são enviados a api.anthropic.com: seu pedido, as últimas mensagens da conversa, um resumo da agenda de hoje e só as memórias relacionadas. Nunca o áudio.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            SectionCard(title = "Privacidade e dados") {
                ToggleRow("Guardar histórico da conversa", s.keepConversationHistory) { v -> vm.update { it.copy(keepConversationHistory = v) } }
                ToggleRow("Ler eventos do calendário do aparelho", s.calendarEnabled && perms.calendar) { v ->
                    if (v && !perms.calendar) permissionLauncher.launch(Manifest.permission.READ_CALENDAR)
                    vm.update { it.copy(calendarEnabled = v) }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { exportLauncher.launch("aurora-dados-${LocalDate.now()}.json") }) { Text("Exportar dados") }
                    OutlinedButton(onClick = { confirm = "history" }) { Text("Apagar conversa") }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { confirm = "memory" }) { Text("Apagar memória") }
                    TextButton(onClick = { confirm = "all" }) { Text("Apagar tudo", color = MaterialTheme.colorScheme.error) }
                }
            }

            SectionCard(title = "Permissões") {
                PermissionRow("Microfone", perms.microphone, "Para ouvir seus comandos") {
                    if (perms.microphone) openAppSettings() else permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                }
                PermissionRow("Notificações", perms.notifications, "Para avisar os lembretes") {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !perms.notifications) permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    else context.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                }
                PermissionRow("Alarmes e lembretes", perms.exactAlarms, "Para avisar no minuto exato") {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        context.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    }
                }
                PermissionRow("Calendário", perms.calendar, "Opcional: mostrar seus eventos na agenda") {
                    if (perms.calendar) openAppSettings() else permissionLauncher.launch(Manifest.permission.READ_CALENDAR)
                }
            }

            SectionCard(title = "O que precisa de internet") {
                Text(
                    "Funciona sem internet: tarefas, lembretes, notas, memória, agenda, plano do dia, leitura em voz alta (com voz instalada) e reconhecimento no aparelho, quando disponível.\n\n" +
                        "Precisa de internet: conversas livres com a IA e, em muitos aparelhos, o reconhecimento de voz padrão do sistema.",
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }

    when (confirm) {
        "key" -> ConfirmDialog("Remover a chave?", "A IA ficará desativada até você salvar outra chave.", "Remover", vm::removeApiKey) { confirm = null }
        "history" -> ConfirmDialog("Apagar a conversa?", "Todo o histórico de mensagens será apagado.", "Apagar", vm::clearConversation) { confirm = null }
        "memory" -> ConfirmDialog("Apagar a memória?", "Fatos e preferências guardados serão apagados.", "Apagar", vm::clearMemory) { confirm = null }
        "all" -> ConfirmDialog(
            "Apagar todos os dados?",
            "Tarefas, lembretes, notas, memória, conversa, ajustes e a chave da IA serão apagados deste aparelho. Não dá para desfazer.",
            "Apagar tudo",
            vm::deleteAll,
        ) { confirm = null }
    }
}

private fun fmt(v: Double): String = if (v == Math.floor(v)) "%.0f".format(v) else "%.2f".format(v)

@Composable
private fun ToggleRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().clickable { onChange(!checked) }, verticalAlignment = Alignment.CenterVertically) {
        Text(label, modifier = Modifier.weight(1f).padding(end = 12.dp), style = MaterialTheme.typography.bodyLarge)
        Switch(checked = checked, onCheckedChange = onChange)
    }
}

@Composable
private fun RadioRow(label: String, selected: Boolean, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick), verticalAlignment = Alignment.CenterVertically) {
        RadioButton(selected = selected, onClick = onClick)
        Text(label, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun PermissionRow(label: String, granted: Boolean, purpose: String, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(label, style = MaterialTheme.typography.bodyLarge)
            Text(purpose, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        TextButton(onClick = onClick) {
            Text(if (granted) "Concedida" else "Conceder", color = if (granted) AuroraColors.Success else AuroraColors.Warning)
        }
    }
}
