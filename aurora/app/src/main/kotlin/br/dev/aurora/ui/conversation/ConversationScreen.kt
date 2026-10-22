@file:OptIn(ExperimentalMaterial3Api::class)

package br.dev.aurora.ui.conversation

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import br.dev.aurora.core.model.ConversationMessage
import br.dev.aurora.core.model.MessageRole
import br.dev.aurora.system.hasPermission
import br.dev.aurora.ui.appViewModel
import br.dev.aurora.ui.components.Banner
import br.dev.aurora.ui.components.OrbMode
import br.dev.aurora.ui.components.VoiceOrb
import br.dev.aurora.ui.theme.AuroraColors
import br.dev.aurora.voice.ListenError
import br.dev.aurora.voice.ListenState

@Composable
fun ConversationScreen(autoListen: Boolean, initialText: String, onBack: () -> Unit, onOpenSettings: () -> Unit) {
    val vm = appViewModel { ConversationViewModel(it) }
    val context = LocalContext.current
    val messages by vm.messages.collectAsStateWithLifecycle()
    val listen by vm.listenState.collectAsStateWithLifecycle()
    val partial by vm.partial.collectAsStateWithLifecycle()
    val level by vm.level.collectAsStateWithLifecycle()
    val speaking by vm.speaking.collectAsStateWithLifecycle()
    val processing by vm.processing.collectAsStateWithLifecycle()
    val notice by vm.notice.collectAsStateWithLifecycle()
    val name by vm.assistantName.collectAsStateWithLifecycle()

    var input by rememberSaveable { mutableStateOf("") }
    var permissionDenied by rememberSaveable { mutableStateOf(false) }
    var launchHandled by rememberSaveable { mutableStateOf(false) }

    val micPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        permissionDenied = !granted
        if (granted) vm.startListening()
    }
    fun listen() {
        if (context.hasPermission(Manifest.permission.RECORD_AUDIO)) {
            permissionDenied = false
            vm.startListening()
        } else {
            micPermission.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    LaunchedEffect(Unit) {
        if (launchHandled) return@LaunchedEffect
        launchHandled = true
        if (initialText.isNotBlank()) vm.send(initialText) else if (autoListen) listen()
    }

    val listState = rememberLazyListState()
    LaunchedEffect(messages.size, processing) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1)
    }

    val mode = when {
        listen is ListenState.Listening || listen is ListenState.Starting -> OrbMode.LISTENING
        listen is ListenState.Processing || processing -> OrbMode.PROCESSING
        speaking -> OrbMode.SPEAKING
        else -> OrbMode.IDLE
    }
    val status = when {
        listen is ListenState.Starting -> "Preparando o microfone…"
        listen is ListenState.Listening -> "Ouvindo…"
        listen is ListenState.Processing -> "Reconhecendo a fala…"
        processing -> "Pensando…"
        speaking -> "Falando…"
        else -> "Pronta"
    }

    Column(Modifier.fillMaxSize().imePadding()) {
        TopAppBar(
            title = {
                Column {
                    Text(name)
                    Text(status, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                }
            },
            navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Voltar") } },
            actions = { IconButton(onClick = onOpenSettings) { Icon(Icons.Filled.Settings, "Ajustes") } },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
        )

        LazyColumn(
            state = listState,
            modifier = Modifier.weight(1f).fillMaxWidth(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (messages.isEmpty()) {
                item {
                    Text(
                        "Experimente: \"me lembra amanhã às 9h de ligar pro dentista\", \"quais são minhas tarefas de hoje?\" ou \"organiza meu dia\".",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            items(messages, key = { it.id }) { MessageBubble(it) }
            if ((listen is ListenState.Listening || listen is ListenState.Processing) && partial.isNotBlank()) {
                item { MessageBubble(ConversationMessage(-1, "", MessageRole.USER, "$partial…", java.time.Instant.now()), draft = true) }
            }
        }

        Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            val failure = listen as? ListenState.Failed
            when {
                permissionDenied -> Banner(
                    "Sem a permissão do microfone, use o teclado abaixo. Você pode liberar o microfone nos ajustes do Android.",
                    actionLabel = "Abrir ajustes",
                ) {
                    context.startActivity(
                        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null))
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                    )
                }
                failure != null -> Banner(
                    failure.message,
                    actionLabel = if (failure.error == ListenError.PERMISSION) "Permitir" else "OK",
                    color = if (failure.error == ListenError.NO_MATCH || failure.error == ListenError.SPEECH_TIMEOUT) AuroraColors.Warning else AuroraColors.Error,
                ) {
                    vm.dismissError()
                    if (failure.error == ListenError.PERMISSION) listen()
                }
            }
            notice?.let { Banner(it, actionLabel = "OK") { vm.dismissNotice() } }

            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
                VoiceOrb(
                    mode = mode,
                    level = level,
                    size = 112.dp,
                    description = if (mode == OrbMode.LISTENING) "Parar de ouvir" else "Falar",
                    onClick = {
                        when (mode) {
                            OrbMode.LISTENING -> vm.stopListening()
                            OrbMode.SPEAKING -> { vm.stopSpeaking(); listen() }
                            OrbMode.PROCESSING -> Unit
                            else -> listen()
                        }
                    },
                )
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                when {
                    speaking -> FilledTonalButton(onClick = vm::stopSpeaking) { Text("Parar fala") }
                    processing -> OutlinedButton(onClick = vm::cancelProcessing) { Text("Cancelar") }
                    listen is ListenState.Listening || listen is ListenState.Starting -> OutlinedButton(onClick = vm::cancelListening) { Text("Cancelar") }
                }
            }
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Ou digite aqui…") },
                singleLine = false,
                maxLines = 4,
                shape = RoundedCornerShape(24.dp),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = { vm.send(input); input = "" }),
                trailingIcon = {
                    IconButton(onClick = { vm.send(input); input = "" }, enabled = input.isNotBlank() && !processing) {
                        Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Enviar")
                    }
                },
            )
        }
    }
}

@Composable
private fun MessageBubble(message: ConversationMessage, draft: Boolean = false) {
    val mine = message.role == MessageRole.USER
    Box(Modifier.fillMaxWidth(), contentAlignment = if (mine) Alignment.CenterEnd else Alignment.CenterStart) {
        Surface(
            shape = RoundedCornerShape(
                topStart = 18.dp, topEnd = 18.dp,
                bottomStart = if (mine) 18.dp else 4.dp, bottomEnd = if (mine) 4.dp else 18.dp,
            ),
            color = if (mine) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
            modifier = Modifier.widthIn(max = 320.dp),
        ) {
            Text(
                message.content,
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                style = MaterialTheme.typography.bodyLarge,
                color = if (draft) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}
