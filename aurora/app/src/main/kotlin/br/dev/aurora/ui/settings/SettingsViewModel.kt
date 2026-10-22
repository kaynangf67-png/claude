package br.dev.aurora.ui.settings

import android.Manifest
import android.net.Uri
import android.os.Build
import android.speech.SpeechRecognizer
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.dev.aurora.AppContainer
import br.dev.aurora.data.DataExporter
import br.dev.aurora.data.settings.UsageSummary
import br.dev.aurora.data.settings.UserSettings
import br.dev.aurora.reminders.Notifications
import br.dev.aurora.system.hasPermission
import br.dev.aurora.voice.TtsStatus
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class PermissionStatus(
    val microphone: Boolean = false,
    val notifications: Boolean = false,
    val exactAlarms: Boolean = false,
    val calendar: Boolean = false,
    val recognitionAvailable: Boolean = false,
    val onDeviceRecognition: Boolean = false,
)

data class VoiceOption(val name: String, val label: String)

class SettingsViewModel(private val c: AppContainer) : ViewModel() {
    val settings: StateFlow<UserSettings> = c.settings.settings.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), UserSettings())
    val usage: StateFlow<UsageSummary?> = c.settings.usage.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
    val hasApiKey: StateFlow<Boolean> = c.secrets.hasApiKey.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), false)
    val ttsStatus: StateFlow<TtsStatus> = c.speechOutput.status

    private val _permissions = MutableStateFlow(PermissionStatus())
    val permissions: StateFlow<PermissionStatus> = _permissions.asStateFlow()

    private val _voices = MutableStateFlow<List<VoiceOption>>(emptyList())
    val voices: StateFlow<List<VoiceOption>> = _voices.asStateFlow()

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    fun refresh() {
        val ctx = c.context
        _permissions.value = PermissionStatus(
            microphone = ctx.hasPermission(Manifest.permission.RECORD_AUDIO),
            notifications = Notifications.canPost(ctx),
            exactAlarms = c.scheduler.canScheduleExact(),
            calendar = ctx.hasPermission(Manifest.permission.READ_CALENDAR),
            recognitionAvailable = SpeechRecognizer.isRecognitionAvailable(ctx),
            onDeviceRecognition = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && SpeechRecognizer.isOnDeviceRecognitionAvailable(ctx),
        )
        _voices.value = c.speechOutput.portugueseVoices().map { v ->
            val quality = if (v.isNetworkConnectionRequired) "online" else "offline"
            VoiceOption(v.name, "${v.locale.displayName} · $quality · ${v.name.takeLast(18)}")
        }
    }

    fun update(transform: (UserSettings) -> UserSettings) {
        viewModelScope.launch {
            c.settings.update(transform)
            c.conversation.refresh()
        }
    }

    fun consumeMessage() {
        _message.value = null
    }

    fun saveApiKey(key: String) {
        val clean = key.trim()
        if (clean.length < 20) {
            _message.value = "Essa chave parece incompleta."
            return
        }
        viewModelScope.launch {
            c.secrets.saveApiKey(clean)
            _message.value = if (clean.startsWith("sk-ant-")) "Chave salva com criptografia neste aparelho." else "Chave salva. Ela não começa com \"sk-ant-\"; confira se é uma chave da Anthropic."
        }
    }

    fun removeApiKey() {
        viewModelScope.launch {
            c.secrets.clearApiKey()
            _message.value = "Chave removida. A Aurora segue funcionando com as funções locais."
        }
    }

    fun testVoice() {
        viewModelScope.launch {
            val s = c.settings.current()
            val ok = c.speechOutput.speak("Oi! Eu sou a ${s.assistantName}. É assim que eu vou falar com você.", s.speechRate, s.speechVolume, s.selectedVoice)
            if (!ok) _message.value = "Não foi possível falar: verifique se há uma voz em português instalada."
        }
    }

    fun export(uri: Uri) {
        viewModelScope.launch {
            val ok = runCatching {
                val json = DataExporter.export(c)
                withContext(Dispatchers.IO) {
                    c.context.contentResolver.openOutputStream(uri)?.use { it.write(json.toByteArray(Charsets.UTF_8)) }
                        ?: error("sem acesso ao arquivo")
                }
            }.isSuccess
            _message.value = if (ok) "Dados exportados." else "Não consegui salvar o arquivo."
        }
    }

    fun clearConversation() {
        viewModelScope.launch {
            c.clearConversation()
            _message.value = "Histórico de conversa apagado."
        }
    }

    fun clearMemory() {
        viewModelScope.launch {
            c.memory.clear()
            _message.value = "Memória apagada."
        }
    }

    fun deleteAll() {
        viewModelScope.launch {
            c.deleteAllData()
            _message.value = "Todos os dados foram apagados."
        }
    }
}
