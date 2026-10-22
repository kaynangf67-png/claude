package br.dev.aurora.core.provider

import br.dev.aurora.core.model.MessageRole
import br.dev.aurora.core.tools.ToolSpec

data class ProviderMessage(val role: MessageRole, val text: String)

data class ProviderRequest(
    val systemPrompt: String,
    /** Histórico recente (sem a mensagem atual), em ordem cronológica. */
    val history: List<ProviderMessage>,
    val userMessage: String,
    val tools: List<ToolSpec>,
)

data class ToolInvocation(val name: String, val arguments: Map<String, Any?>)

data class ToolInvocationResult(val content: String, val isError: Boolean = false)

data class TokenUsage(
    val inputTokens: Long = 0,
    val outputTokens: Long = 0,
    val cacheReadTokens: Long = 0,
    val cacheWriteTokens: Long = 0,
) {
    operator fun plus(o: TokenUsage) = TokenUsage(
        inputTokens + o.inputTokens, outputTokens + o.outputTokens,
        cacheReadTokens + o.cacheReadTokens, cacheWriteTokens + o.cacheWriteTokens,
    )
}

enum class ProviderError {
    NOT_CONFIGURED,
    INVALID_KEY,
    RATE_LIMITED,
    OFFLINE,
    TIMEOUT,
    SERVER,
    BUDGET_EXCEEDED,
    REFUSED,
    BAD_REQUEST,
    UNKNOWN,
}

sealed interface ProviderResult {
    val usage: TokenUsage

    data class Success(val text: String, override val usage: TokenUsage, val model: String) : ProviderResult

    /** [detail] é para diagnóstico; nunca contém a chave nem o conteúdo da conversa. */
    data class Failure(val error: ProviderError, val detail: String? = null, override val usage: TokenUsage = TokenUsage()) : ProviderResult
}

/**
 * Provedor de IA independente de fornecedor. A implementação conduz o ciclo de chamadas de ferramenta
 * internamente e pede a execução de cada uma via [onToolCall] — quem valida e executa é o app.
 */
interface AssistantProvider {
    val displayName: String
    val model: String

    suspend fun respond(
        request: ProviderRequest,
        onToolCall: suspend (ToolInvocation) -> ToolInvocationResult,
    ): ProviderResult
}

/** Registro de gastos estimados (persistido pelo app). */
interface UsageLedger {
    suspend fun monthToDateUsd(): Double
    suspend fun record(usd: Double, usage: TokenUsage)
}
