package br.dev.aurora.core.provider

import br.dev.aurora.core.model.MessageRole
import br.dev.aurora.core.tools.ToolSpec
import com.anthropic.client.AnthropicClient
import com.anthropic.client.okhttp.AnthropicOkHttpClient
import com.anthropic.core.JsonValue
import com.anthropic.errors.AnthropicIoException
import com.anthropic.errors.AnthropicServiceException
import com.anthropic.errors.BadRequestException
import com.anthropic.errors.InternalServerException
import com.anthropic.errors.NotFoundException
import com.anthropic.errors.PermissionDeniedException
import com.anthropic.errors.RateLimitException
import com.anthropic.errors.UnauthorizedException
import com.anthropic.errors.UnprocessableEntityException
import com.anthropic.models.messages.ContentBlockParam
import com.anthropic.models.messages.Message
import com.anthropic.models.messages.MessageCreateParams
import com.anthropic.models.messages.MessageParam
import com.anthropic.models.messages.OutputConfig
import com.anthropic.models.messages.StopReason
import com.anthropic.models.messages.Tool
import com.anthropic.models.messages.ToolResultBlockParam
import java.io.InterruptedIOException
import java.net.SocketTimeoutException
import java.time.Duration
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runInterruptible

/**
 * Provedor Claude via SDK Java oficial da Anthropic (`com.anthropic:anthropic-java`).
 *
 * Custos: esforço `low` (respostas curtas de assistente pessoal), poucas rodadas de ferramenta e
 * histórico curto. O SDK já refaz até 2 tentativas em erros transitórios (408/409/429/5xx/conexão).
 */
class AnthropicProvider(
    apiKey: String,
    override val model: String = ModelCatalog.DEFAULT_MODEL,
    baseUrl: String? = null,
    timeout: Duration = Duration.ofSeconds(45),
    private val maxToolRounds: Int = 5,
    private val effort: OutputConfig.Effort = OutputConfig.Effort.LOW,
    client: AnthropicClient? = null,
) : AssistantProvider {

    override val displayName: String = ModelCatalog.options.firstOrNull { it.id == model }?.label ?: model

    private val client: AnthropicClient = client ?: AnthropicOkHttpClient.builder()
        .apiKey(apiKey)
        .timeout(timeout)
        .maxRetries(2)
        .apply { if (baseUrl != null) baseUrl(baseUrl) }
        .build()

    override suspend fun respond(
        request: ProviderRequest,
        onToolCall: suspend (ToolInvocation) -> ToolInvocationResult,
    ): ProviderResult {
        var usage = TokenUsage()
        try {
            val builder = MessageCreateParams.builder()
                .model(model)
                .maxTokens(MAX_TOKENS)
                .system(request.systemPrompt)
                .outputConfig(OutputConfig.builder().effort(effort).build())
            request.tools.forEach { builder.addTool(toSdkTool(it)) }
            if (model in SERVER_FALLBACK_MODELS) {
                // Se o modelo recusar por política, a API tenta de novo num modelo alternativo na mesma chamada.
                builder.putAdditionalHeader("anthropic-beta", "server-side-fallback-2026-07-01")
                builder.putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
            }
            normalizedHistory(request.history).forEach { builder.addMessage(it) }
            builder.addUserMessage(request.userMessage)

            var lastText = ""
            repeat(maxToolRounds + 1) {
                val params = builder.build()
                val response: Message = runInterruptible(Dispatchers.IO) { this.client.messages().create(params) }
                usage += response.usage().let {
                    TokenUsage(
                        it.inputTokens(), it.outputTokens(),
                        it.cacheReadInputTokens().orElse(0L), it.cacheCreationInputTokens().orElse(0L),
                    )
                }
                val text = response.content().mapNotNull { block -> block.text().orElse(null)?.text() }
                    .joinToString("\n").trim()
                if (text.isNotEmpty()) lastText = text

                when (response.stopReason().orElse(null)) {
                    StopReason.REFUSAL -> return ProviderResult.Failure(ProviderError.REFUSED, "refusal", usage)
                    StopReason.TOOL_USE -> {
                        builder.addMessage(response)
                        val results = response.content().mapNotNull { it.toolUse().orElse(null) }.map { call ->
                            val args = runCatching { call._input().convert(Map::class.java) }.getOrNull()
                            val result = if (args == null) {
                                ToolInvocationResult("Entrada da ferramenta não é um objeto JSON válido.", isError = true)
                            } else {
                                @Suppress("UNCHECKED_CAST")
                                onToolCall(ToolInvocation(call.name(), args as Map<String, Any?>))
                            }
                            ContentBlockParam.ofToolResult(
                                ToolResultBlockParam.builder()
                                    .toolUseId(call.id())
                                    .content(result.content)
                                    .isError(result.isError)
                                    .build(),
                            )
                        }
                        builder.addUserMessageOfContentBlockParams(results)
                    }
                    StopReason.PAUSE_TURN -> builder.addMessage(response)
                    else -> return ProviderResult.Success(lastText, usage, model)
                }
            }
            return if (lastText.isNotEmpty()) {
                ProviderResult.Success(lastText, usage, model)
            } else {
                ProviderResult.Failure(ProviderError.UNKNOWN, "limite de rodadas de ferramenta", usage)
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            return ProviderResult.Failure(classify(e), e.javaClass.simpleName, usage)
        }
    }

    companion object {
        const val MAX_TOKENS = 16_000L
        private val SERVER_FALLBACK_MODELS = setOf("claude-opus-5-5", "claude-sonnet-5-5")

        fun classify(e: Throwable): ProviderError = when (e) {
            is UnauthorizedException, is PermissionDeniedException -> ProviderError.INVALID_KEY
            is RateLimitException -> ProviderError.RATE_LIMITED
            is BadRequestException, is NotFoundException, is UnprocessableEntityException -> ProviderError.BAD_REQUEST
            is InternalServerException -> ProviderError.SERVER
            is AnthropicServiceException -> if (e.statusCode() >= 500) ProviderError.SERVER else ProviderError.UNKNOWN
            is AnthropicIoException -> classify(e.cause ?: return ProviderError.OFFLINE).let {
                if (it == ProviderError.UNKNOWN) ProviderError.OFFLINE else it
            }
            is SocketTimeoutException, is InterruptedIOException -> ProviderError.TIMEOUT
            is java.io.IOException -> ProviderError.OFFLINE
            else -> ProviderError.UNKNOWN
        }

        /** A API exige começar com o usuário; mensagens consecutivas do mesmo papel são unidas. */
        internal fun normalizedHistory(history: List<ProviderMessage>): List<MessageParam> {
            val merged = mutableListOf<ProviderMessage>()
            for (m in history.dropWhile { it.role != MessageRole.USER }) {
                val last = merged.lastOrNull()
                if (last != null && last.role == m.role) {
                    merged[merged.lastIndex] = last.copy(text = last.text + "\n" + m.text)
                } else {
                    merged += m
                }
            }
            // A mensagem atual do usuário vem depois; o histórico precisa terminar no assistente.
            if (merged.lastOrNull()?.role == MessageRole.USER) merged.removeAt(merged.lastIndex)
            return merged.map {
                if (it.role == MessageRole.USER) MessageParam.ofUser(it.text) else MessageParam.ofAssistant(it.text)
            }
        }

        internal fun toSdkTool(spec: ToolSpec): Tool {
            val props = Tool.InputSchema.Properties.builder()
            spec.properties.forEach { (name, schema) -> props.putAdditionalProperty(name, JsonValue.from(schema)) }
            val schema = Tool.InputSchema.builder().properties(props.build())
            if (spec.required.isNotEmpty()) schema.required(spec.required)
            return Tool.builder().name(spec.name).description(spec.description).inputSchema(schema.build()).build()
        }
    }
}
