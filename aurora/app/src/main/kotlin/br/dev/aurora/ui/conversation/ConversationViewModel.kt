package br.dev.aurora.ui.conversation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.dev.aurora.AppContainer
import br.dev.aurora.core.model.ConversationMessage
import br.dev.aurora.voice.ListenState
import br.dev.aurora.voice.SpeechInput
import br.dev.aurora.voice.TtsStatus
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class ConversationViewModel(private val c: AppContainer) : ViewModel() {
    private val speech = SpeechInput(c.context)

    val messages: StateFlow<List<ConversationMessage>> =
        c.conversation.observe(AppContainer.CONVERSATION_ID).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val listenState: StateFlow<ListenState> = speech.state
    val partial: StateFlow<String> = speech.partial
    val level: StateFlow<Float> = speech.level
    val speaking: StateFlow<Boolean> = c.speechOutput.speaking
    val assistantName: StateFlow<String> =
        c.settings.settings.map { it.assistantName }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "Aurora")

    private val _processing = MutableStateFlow(false)
    val processing: StateFlow<Boolean> = _processing.asStateFlow()

    private val _notice = MutableStateFlow<String?>(null)
    /** Aviso não bloqueante (ex.: voz em português indisponível). */
    val notice: StateFlow<String?> = _notice.asStateFlow()

    private var job: Job? = null

    fun startListening() {
        c.speechOutput.stop()
        viewModelScope.launch {
            val preferOnDevice = c.settings.current().preferOnDeviceRecognition
            speech.start(preferOnDevice) { text -> send(text) }
        }
    }

    fun stopListening() = speech.stop()

    fun cancelListening() = speech.cancel()

    fun dismissError() = speech.clearError()

    fun send(text: String) {
        val clean = text.trim()
        if (clean.isEmpty() || _processing.value) return
        job = viewModelScope.launch {
            _processing.value = true
            try {
                val reply = c.orchestrator.handle(clean, AppContainer.CONVERSATION_ID)
                speak(reply.text)
            } finally {
                _processing.value = false
            }
        }
    }

    fun cancelProcessing() {
        job?.cancel()
        _processing.value = false
    }

    fun stopSpeaking() = c.speechOutput.stop()

    fun dismissNotice() {
        _notice.value = null
    }

    private suspend fun speak(text: String) {
        val s = c.settings.current()
        if (!s.speechEnabled) return
        val ok = c.speechOutput.speak(text, s.speechRate, s.speechVolume, s.selectedVoice)
        if (!ok) {
            _notice.value = when (c.speechOutput.status.value) {
                TtsStatus.MISSING_PORTUGUESE -> "Não há voz em português instalada. Instale em Configurações › Acessibilidade › Saída de texto para fala."
                TtsStatus.FAILED -> "O mecanismo de voz do aparelho não está disponível; as respostas aparecem só em texto."
                else -> null
            }
        }
    }

    override fun onCleared() {
        speech.release()
        c.speechOutput.stop()
    }
}
