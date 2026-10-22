package br.dev.aurora.voice

import android.content.Context
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import java.util.Locale
import java.util.UUID
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class TtsStatus { INITIALIZING, READY, MISSING_PORTUGUESE, FAILED }

/** Fala as respostas com o TextToSpeech do sistema em pt-BR. Pode ser interrompida a qualquer momento. */
class SpeechOutput(context: Context) : TextToSpeech.OnInitListener {
    private val ptBr: Locale = Locale.forLanguageTag("pt-BR")
    private val tts = TextToSpeech(context.applicationContext, this)

    private val _status = MutableStateFlow(TtsStatus.INITIALIZING)
    val status: StateFlow<TtsStatus> = _status.asStateFlow()

    private val _speaking = MutableStateFlow(false)
    val speaking: StateFlow<Boolean> = _speaking.asStateFlow()

    override fun onInit(status: Int) {
        if (status != TextToSpeech.SUCCESS) {
            _status.value = TtsStatus.FAILED
            return
        }
        val result = tts.setLanguage(ptBr)
        _status.value = if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
            TtsStatus.MISSING_PORTUGUESE
        } else {
            TtsStatus.READY
        }
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) { _speaking.value = true }
            override fun onDone(utteranceId: String?) { _speaking.value = false }
            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) { _speaking.value = false }
            override fun onError(utteranceId: String?, errorCode: Int) { _speaking.value = false }
            override fun onStop(utteranceId: String?, interrupted: Boolean) { _speaking.value = false }
        })
    }

    /** Retorna false se não for possível falar (TTS indisponível ou sem voz em português). */
    fun speak(text: String, rate: Float, volume: Float, voiceName: String?): Boolean {
        if (_status.value != TtsStatus.READY || text.isBlank()) return false
        tts.setSpeechRate(rate)
        if (voiceName != null) {
            tts.voices?.firstOrNull { it.name == voiceName }?.let { tts.voice = it }
        }
        val params = Bundle().apply { putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, volume) }
        return tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, UUID.randomUUID().toString()) == TextToSpeech.SUCCESS
    }

    fun stop() {
        tts.stop()
        _speaking.value = false
    }

    fun portugueseVoices(): List<Voice> = runCatching {
        tts.voices.orEmpty().filter { it.locale.language == "pt" }.sortedBy { it.name }
    }.getOrDefault(emptyList())

    fun shutdown() = tts.shutdown()
}
