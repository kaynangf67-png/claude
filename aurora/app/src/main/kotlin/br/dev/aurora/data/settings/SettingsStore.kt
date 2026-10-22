package br.dev.aurora.data.settings

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.doublePreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import br.dev.aurora.core.provider.ModelCatalog
import br.dev.aurora.core.provider.TokenUsage
import br.dev.aurora.core.provider.UsageLedger
import java.time.YearMonth
import java.time.ZoneId
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.settingsDataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")

data class UserSettings(
    val assistantName: String = "Aurora",
    val speechEnabled: Boolean = true,
    val speechRate: Float = 1.0f,
    val speechVolume: Float = 1.0f,
    val selectedVoice: String? = null,
    val wakeWordEnabled: Boolean = false,
    val preferOnDeviceRecognition: Boolean = true,
    val aiEnabled: Boolean = true,
    /** Referência à configuração do provedor: o modelo escolhido. A chave fica no [SecretStore]. */
    val modelId: String = ModelCatalog.DEFAULT_MODEL,
    val monthlyBudgetUsd: Double = 5.0,
    val calendarEnabled: Boolean = false,
    val keepConversationHistory: Boolean = true,
)

data class UsageSummary(val month: String, val usd: Double, val requests: Long, val inputTokens: Long, val outputTokens: Long)

class SettingsStore(private val context: Context) : UsageLedger {
    private val store get() = context.settingsDataStore

    private object K {
        val name = stringPreferencesKey("assistant_name")
        val speech = booleanPreferencesKey("speech_enabled")
        val rate = floatPreferencesKey("speech_rate")
        val volume = floatPreferencesKey("speech_volume")
        val voice = stringPreferencesKey("selected_voice")
        val wake = booleanPreferencesKey("wake_word_enabled")
        val onDevice = booleanPreferencesKey("prefer_on_device_recognition")
        val ai = booleanPreferencesKey("ai_enabled")
        val model = stringPreferencesKey("model_id")
        val budget = doublePreferencesKey("monthly_budget_usd")
        val calendar = booleanPreferencesKey("calendar_enabled")
        val history = booleanPreferencesKey("keep_history")
        val usageMonth = stringPreferencesKey("usage_month")
        val usageUsd = doublePreferencesKey("usage_usd")
        val usageRequests = longPreferencesKey("usage_requests")
        val usageIn = longPreferencesKey("usage_input_tokens")
        val usageOut = longPreferencesKey("usage_output_tokens")
    }

    val settings: Flow<UserSettings> = store.data.map { p ->
        val d = UserSettings()
        UserSettings(
            assistantName = p[K.name] ?: d.assistantName,
            speechEnabled = p[K.speech] ?: d.speechEnabled,
            speechRate = p[K.rate] ?: d.speechRate,
            speechVolume = p[K.volume] ?: d.speechVolume,
            selectedVoice = p[K.voice],
            wakeWordEnabled = p[K.wake] ?: d.wakeWordEnabled,
            preferOnDeviceRecognition = p[K.onDevice] ?: d.preferOnDeviceRecognition,
            aiEnabled = p[K.ai] ?: d.aiEnabled,
            modelId = p[K.model]?.takeIf { id -> ModelCatalog.options.any { it.id == id } } ?: d.modelId,
            monthlyBudgetUsd = p[K.budget] ?: d.monthlyBudgetUsd,
            calendarEnabled = p[K.calendar] ?: d.calendarEnabled,
            keepConversationHistory = p[K.history] ?: d.keepConversationHistory,
        )
    }

    suspend fun current(): UserSettings = settings.first()

    suspend fun update(transform: (UserSettings) -> UserSettings) {
        val new = transform(current())
        store.edit { p ->
            p[K.name] = new.assistantName.trim().ifEmpty { "Aurora" }.take(30)
            p[K.speech] = new.speechEnabled
            p[K.rate] = new.speechRate.coerceIn(0.5f, 2.0f)
            p[K.volume] = new.speechVolume.coerceIn(0.1f, 1.0f)
            if (new.selectedVoice == null) p.remove(K.voice) else p[K.voice] = new.selectedVoice
            p[K.wake] = new.wakeWordEnabled
            p[K.onDevice] = new.preferOnDeviceRecognition
            p[K.ai] = new.aiEnabled
            p[K.model] = new.modelId
            p[K.budget] = new.monthlyBudgetUsd.coerceIn(0.0, 1000.0)
            p[K.calendar] = new.calendarEnabled
            p[K.history] = new.keepConversationHistory
        }
    }

    // ---------- Registro de gastos (zera a cada mês) ----------

    private fun monthKey(): String = YearMonth.now(ZoneId.systemDefault()).toString()

    val usage: Flow<UsageSummary> = store.data.map { p ->
        val m = monthKey()
        if (p[K.usageMonth] == m) {
            UsageSummary(m, p[K.usageUsd] ?: 0.0, p[K.usageRequests] ?: 0, p[K.usageIn] ?: 0, p[K.usageOut] ?: 0)
        } else {
            UsageSummary(m, 0.0, 0, 0, 0)
        }
    }

    override suspend fun monthToDateUsd(): Double = usage.first().usd

    override suspend fun record(usd: Double, usage: TokenUsage) {
        val m = monthKey()
        store.edit { p ->
            val same = p[K.usageMonth] == m
            p[K.usageMonth] = m
            p[K.usageUsd] = (if (same) p[K.usageUsd] ?: 0.0 else 0.0) + usd
            p[K.usageRequests] = (if (same) p[K.usageRequests] ?: 0 else 0) + 1
            p[K.usageIn] = (if (same) p[K.usageIn] ?: 0 else 0) + usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
            p[K.usageOut] = (if (same) p[K.usageOut] ?: 0 else 0) + usage.outputTokens
        }
    }

    suspend fun clearAll() {
        store.edit { it.clear() }
    }
}
