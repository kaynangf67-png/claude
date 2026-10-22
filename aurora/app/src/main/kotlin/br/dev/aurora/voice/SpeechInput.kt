package br.dev.aurora.voice

import android.Manifest
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import br.dev.aurora.system.hasPermission
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class ListenError { PERMISSION, NO_MATCH, SPEECH_TIMEOUT, NETWORK, AUDIO, BUSY, SERVER, LANGUAGE, UNAVAILABLE, OTHER }

sealed interface ListenState {
    data object Idle : ListenState
    /** Reconhecedor criado; aguardando o sistema confirmar que está ouvindo. */
    data object Starting : ListenState
    data object Listening : ListenState
    data object Processing : ListenState
    data class Failed(val error: ListenError, val message: String) : ListenState
}

/**
 * Sessão curta de reconhecimento de fala (um comando por vez). Deve ser usada na thread principal.
 * "Ouvindo" só é exibido depois de onReadyForSpeech — nunca um estado falso.
 * Não é um detector contínuo de palavra de ativação.
 */
class SpeechInput(private val context: Context) {
    private val _state = MutableStateFlow<ListenState>(ListenState.Idle)
    val state: StateFlow<ListenState> = _state.asStateFlow()

    private val _partial = MutableStateFlow("")
    val partial: StateFlow<String> = _partial.asStateFlow()

    private val _level = MutableStateFlow(0f)
    /** Nível de áudio normalizado (0..1) para animar o orbe. */
    val level: StateFlow<Float> = _level.asStateFlow()

    private var recognizer: SpeechRecognizer? = null
    private var usingOnDevice = false

    fun isAvailable(): Boolean = SpeechRecognizer.isRecognitionAvailable(context)

    fun start(preferOnDevice: Boolean, onResult: (String) -> Unit) {
        if (!context.hasPermission(Manifest.permission.RECORD_AUDIO)) {
            _state.value = ListenState.Failed(ListenError.PERMISSION, "Preciso da permissão do microfone para ouvir você.")
            return
        }
        val onDevice = preferOnDevice && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            SpeechRecognizer.isOnDeviceRecognitionAvailable(context)
        if (!onDevice && !isAvailable()) {
            _state.value = ListenState.Failed(
                ListenError.UNAVAILABLE,
                "Nenhum serviço de reconhecimento de voz foi encontrado. Instale ou ative o app Google ou outro serviço de voz.",
            )
            return
        }
        release()
        _partial.value = ""
        _state.value = ListenState.Starting
        usingOnDevice = onDevice
        val r = if (onDevice && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
        } else {
            SpeechRecognizer.createSpeechRecognizer(context)
        }
        recognizer = r
        r.setRecognitionListener(listener(preferOnDevice, onResult))
        r.startListening(recognizerIntent())
    }

    /** Para de ouvir e processa o que já foi dito. */
    fun stop() {
        recognizer?.stopListening()
    }

    /** Cancela sem processar. */
    fun cancel() {
        recognizer?.cancel()
        release()
        _state.value = ListenState.Idle
    }

    fun release() {
        recognizer?.destroy()
        recognizer = null
        _level.value = 0f
    }

    fun clearError() {
        if (_state.value is ListenState.Failed) _state.value = ListenState.Idle
    }

    private fun recognizerIntent() = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR")
        putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
    }

    private fun listener(preferOnDevice: Boolean, onResult: (String) -> Unit) = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {
            _state.value = ListenState.Listening
        }

        override fun onBeginningOfSpeech() = Unit

        override fun onRmsChanged(rmsdB: Float) {
            _level.value = ((rmsdB + 2f) / 12f).coerceIn(0f, 1f)
        }

        override fun onBufferReceived(buffer: ByteArray?) = Unit

        override fun onEndOfSpeech() {
            _state.value = ListenState.Processing
            _level.value = 0f
        }

        override fun onError(error: Int) {
            // Pacote de idioma pt-BR ausente no reconhecedor on-device: tenta o reconhecedor padrão uma vez.
            if (usingOnDevice && error in LANGUAGE_ERRORS) {
                release()
                usingOnDevice = false
                if (isAvailable()) {
                    start(preferOnDevice = false, onResult = onResult)
                    return
                }
            }
            release()
            _state.value = mapError(error)
        }

        override fun onResults(results: Bundle?) {
            val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.trim().orEmpty()
            release()
            if (text.isEmpty()) {
                _state.value = mapError(SpeechRecognizer.ERROR_NO_MATCH)
            } else {
                _state.value = ListenState.Idle
                _partial.value = text
                onResult(text)
            }
        }

        override fun onPartialResults(partialResults: Bundle?) {
            partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.let { _partial.value = it }
        }

        override fun onEvent(eventType: Int, params: Bundle?) = Unit
    }

    private fun mapError(code: Int): ListenState.Failed = when (code) {
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> ListenState.Failed(ListenError.PERMISSION, "Preciso da permissão do microfone.")
        SpeechRecognizer.ERROR_NO_MATCH -> ListenState.Failed(ListenError.NO_MATCH, "Não entendi. Pode repetir?")
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> ListenState.Failed(ListenError.SPEECH_TIMEOUT, "Não ouvi nada. Toque no microfone e fale.")
        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT, ERROR_SERVER_DISCONNECTED ->
            ListenState.Failed(ListenError.NETWORK, "O reconhecimento de voz precisa de internet neste aparelho. Verifique a conexão ou use o teclado.")
        SpeechRecognizer.ERROR_AUDIO -> ListenState.Failed(ListenError.AUDIO, "Não consegui usar o microfone. Outro app pode estar usando.")
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY, ERROR_TOO_MANY_REQUESTS -> ListenState.Failed(ListenError.BUSY, "O reconhecimento está ocupado. Tente de novo em instantes.")
        SpeechRecognizer.ERROR_SERVER -> ListenState.Failed(ListenError.SERVER, "O serviço de voz não respondeu. Tente de novo ou use o teclado.")
        in LANGUAGE_ERRORS -> ListenState.Failed(ListenError.LANGUAGE, "O português do Brasil não está disponível no reconhecimento de voz. Baixe o idioma nas configurações de voz do aparelho.")
        SpeechRecognizer.ERROR_CLIENT -> ListenState.Failed(ListenError.OTHER, "O reconhecimento foi interrompido.")
        else -> ListenState.Failed(ListenError.OTHER, "Erro no reconhecimento de voz (código $code).")
    }

    private companion object {
        // Constantes adicionadas no Android 12 (API 31); usadas como números para compilar em qualquer API.
        const val ERROR_TOO_MANY_REQUESTS = 10
        const val ERROR_SERVER_DISCONNECTED = 11
        val LANGUAGE_ERRORS = setOf(12, 13) // LANGUAGE_NOT_SUPPORTED, LANGUAGE_UNAVAILABLE
    }
}
