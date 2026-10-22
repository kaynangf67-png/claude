package br.dev.aurora.core.orchestrator

import br.dev.aurora.core.intent.LocalIntent
import br.dev.aurora.core.intent.LocalIntentParser
import br.dev.aurora.core.intent.PendingRequest
import br.dev.aurora.core.model.ConversationMessage
import br.dev.aurora.core.model.MessageRole
import br.dev.aurora.core.provider.AssistantProvider
import br.dev.aurora.core.provider.ModelCatalog
import br.dev.aurora.core.provider.ProviderError
import br.dev.aurora.core.provider.ProviderMessage
import br.dev.aurora.core.provider.ProviderRequest
import br.dev.aurora.core.provider.ProviderResult
import br.dev.aurora.core.provider.ToolInvocation
import br.dev.aurora.core.provider.ToolInvocationResult
import br.dev.aurora.core.provider.UsageLedger
import br.dev.aurora.core.repository.Connectivity
import br.dev.aurora.core.repository.ConversationRepository
import br.dev.aurora.core.text.PtBrFormat
import br.dev.aurora.core.tools.AssistantTool
import br.dev.aurora.core.tools.ToolCatalog
import br.dev.aurora.core.tools.ToolValidator
import br.dev.aurora.core.tools.Validation
import java.time.ZonedDateTime
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

data class AssistantReply(
    val text: String,
    val usedAi: Boolean = false,
    /** Aguardando resposta do usuário (esclarecimento ou confirmação). */
    val awaitingUser: Boolean = false,
    val providerError: ProviderError? = null,
    val estimatedCostUsd: Double = 0.0,
)

/** Configuração lida a cada pedido (o usuário pode mudar em Ajustes a qualquer momento). */
data class AiSettings(
    val enabled: Boolean,
    val monthlyBudgetUsd: Double,
    val assistantName: String = "Aurora",
    val historyMessages: Int = 8,
)

/**
 * Cérebro da Aurora: decide entre resolver localmente, pedir esclarecimento/confirmação ou chamar a IA.
 * Mantém o estado da conversa atual (pendências e último item citado) em memória.
 */
class AssistantOrchestrator(
    private val deps: AssistantDependencies,
    private val conversation: ConversationRepository,
    private val providerFactory: suspend () -> AssistantProvider?,
    private val ledger: UsageLedger,
    private val connectivity: Connectivity,
    private val settings: suspend () -> AiSettings,
    private val now: () -> ZonedDateTime,
) {
    private val parser = LocalIntentParser()
    private val executor = ToolExecutor(deps, now)
    private val mutex = Mutex()

    private var pending: PendingRequest? = null
    private var lastMentioned: ItemPointer? = null

    val hasPending: Boolean get() = pending != null

    fun resetConversationState() {
        pending = null
        lastMentioned = null
    }

    suspend fun handle(input: String, conversationId: String): AssistantReply = mutex.withLock {
        val text = input.trim()
        if (text.isEmpty()) return@withLock AssistantReply("Não ouvi nada. Pode repetir?")
        val history = conversation.recent(conversationId, settings().historyMessages)
        conversation.add(ConversationMessage(conversationId = conversationId, role = MessageRole.USER, content = text, createdAt = now().toInstant()))

        val currentPending = pending
        val intent = if (currentPending != null) {
            pending = null
            parser.continuePending(currentPending, text, now())
        } else {
            parser.parse(text, now())
        }

        val reply = when (intent) {
            is LocalIntent.Tool -> runTool(intent.tool, confirmed = currentPending is PendingRequest.Confirmation)
            is LocalIntent.Clarify -> {
                pending = intent.pending
                AssistantReply(intent.question, awaitingUser = true)
            }
            is LocalIntent.Reply -> AssistantReply(intent.text)
            LocalIntent.Cancelled -> AssistantReply("Tudo bem, deixei pra lá.")
            LocalIntent.Unknown -> askAi(text, history)
        }
        conversation.add(
            ConversationMessage(conversationId = conversationId, role = MessageRole.ASSISTANT, content = reply.text, createdAt = now().toInstant()),
        )
        reply
    }

    private suspend fun runTool(tool: AssistantTool, confirmed: Boolean): AssistantReply {
        if (tool.requiresConfirmation && !confirmed) {
            val summary = executor.describeForConfirmation(tool, lastMentioned)
            pending = PendingRequest.Confirmation(tool, summary)
            return AssistantReply("Confirma $summary?", awaitingUser = true)
        }
        val outcome = executor.execute(tool, lastMentioned)
        outcome.referenced?.let { lastMentioned = it }
        return AssistantReply(outcome.message)
    }

    private suspend fun askAi(text: String, history: List<ConversationMessage>): AssistantReply {
        val cfg = settings()
        val offlineHelp = "Sem a IA eu consigo criar tarefas, lembretes e notas, mostrar sua agenda e organizar seu dia. " +
            "Tente, por exemplo: \"me lembra amanhã às 9h de pagar a conta\"."
        if (!cfg.enabled) {
            return AssistantReply("Não entendi esse pedido, e a IA está desativada em Ajustes. $offlineHelp", providerError = ProviderError.NOT_CONFIGURED)
        }
        val provider = providerFactory()
            ?: return AssistantReply("Não entendi esse pedido. Para conversas livres, configure a chave da IA em Ajustes. $offlineHelp", providerError = ProviderError.NOT_CONFIGURED)
        if (!connectivity.isOnline()) {
            return AssistantReply("Estou sem internet, então não consigo usar a IA agora. $offlineHelp", providerError = ProviderError.OFFLINE)
        }
        val spent = ledger.monthToDateUsd()
        if (spent >= cfg.monthlyBudgetUsd) {
            return AssistantReply(
                "O limite mensal de gastos com IA (US$ ${"%.2f".format(cfg.monthlyBudgetUsd)}) foi atingido. " +
                    "Você pode aumentá-lo em Ajustes. $offlineHelp",
                providerError = ProviderError.BUDGET_EXCEEDED,
            )
        }

        val validator = ToolValidator(now)
        val request = ProviderRequest(
            systemPrompt = systemPrompt(cfg.assistantName, text),
            history = history.map { ProviderMessage(it.role, it.content) },
            userMessage = text,
            tools = ToolCatalog.all,
        )
        val result = provider.respond(request) { call -> onAiToolCall(call, validator) }
        val cost = ModelCatalog.price(provider.model).cost(result.usage)
        if (cost > 0) ledger.record(cost, result.usage)

        return when (result) {
            is ProviderResult.Success -> AssistantReply(
                result.text.ifBlank { "Pronto." },
                usedAi = true,
                awaitingUser = pending != null,
                estimatedCostUsd = cost,
            )
            is ProviderResult.Failure -> AssistantReply(failureMessage(result.error) + " " + offlineHelp, usedAi = true, providerError = result.error, estimatedCostUsd = cost)
        }
    }

    private suspend fun onAiToolCall(call: ToolInvocation, validator: ToolValidator): ToolInvocationResult {
        val tool = when (val v = validator.validate(call.name, call.arguments)) {
            is Validation.Invalid -> return ToolInvocationResult("Argumentos inválidos: ${v.reason}. Nada foi executado.", isError = true)
            is Validation.Valid -> v.tool
        }
        // Gravar memória a pedido da IA também exige confirmação explícita do usuário.
        if (tool.requiresConfirmation || tool is AssistantTool.SaveMemory) {
            val summary = executor.describeForConfirmation(tool, lastMentioned)
            pending = PendingRequest.Confirmation(tool, summary)
            return ToolInvocationResult(
                "NÃO executado: aguardando confirmação do usuário para $summary. Pergunte ao usuário se ele confirma (sim/não).",
            )
        }
        val outcome = executor.execute(tool, lastMentioned)
        outcome.referenced?.let { lastMentioned = it }
        return ToolInvocationResult(outcome.forModel, isError = !outcome.success)
    }

    private suspend fun systemPrompt(name: String, userText: String): String {
        val now = now()
        val today = executor.buildAgenda(now.toLocalDate())
        val agendaSummary = buildString {
            today.events.forEach { append("- Evento: ${it.title} às ${PtBrFormat.time(it.start.atZone(now.zone).toLocalTime())}\n") }
            today.reminders.forEach { append("- Lembrete: ${it.reminder.title} às ${PtBrFormat.time(it.at.toLocalTime())}\n") }
            today.tasksDue.forEach { append("- Tarefa de hoje: ${it.title}\n") }
            today.overdue.forEach { append("- Tarefa atrasada: ${it.title}\n") }
        }.ifBlank { "(nada para hoje)\n" }
        // Só memórias relacionadas ao pedido, nunca a memória inteira.
        val memories = deps.memory.search(userText, 5).filter { it.userApproved }
        val memoryText = if (memories.isEmpty()) "(nenhuma relacionada)\n" else memories.joinToString("") { "- ${it.content}\n" }

        return listOf(
            "Você é $name, assistente pessoal de voz em um celular Android. Responda sempre em português do Brasil, " +
                "de forma breve e natural (as respostas podem ser lidas em voz alta): uma a três frases, sem markdown.",
            "",
            "Regras:",
            "- Use as ferramentas para criar, alterar ou consultar tarefas, lembretes, notas, memória e agenda.",
            "- Nunca diga que fez algo sem que a ferramenta tenha retornado sucesso.",
            "- Se faltar data, hora ou alvo, pergunte antes de agir.",
            "- Datas/horas das ferramentas são no horário local do usuário, formato AAAA-MM-DDTHH:MM.",
            "- Exclusões, cancelamentos e gravações na memória pedem confirmação do usuário; o app cuida disso.",
            "- Você não envia mensagens, não faz ligações nem compras.",
            "",
            "Agora: ${PtBrFormat.longDate(now.toLocalDate())}, ${PtBrFormat.time(now.toLocalTime())} (fuso ${now.zone.id}).",
            "Hoje no app:",
            agendaSummary.trimEnd(),
            "Memórias do usuário relacionadas ao pedido:",
            memoryText.trimEnd(),
        ).joinToString("\n")
    }

    private fun failureMessage(error: ProviderError): String = when (error) {
        ProviderError.NOT_CONFIGURED -> "A IA não está configurada."
        ProviderError.INVALID_KEY -> "A chave da IA foi recusada. Confira em Ajustes."
        ProviderError.RATE_LIMITED -> "A IA está recebendo pedidos demais agora. Tente de novo em instantes."
        ProviderError.OFFLINE -> "Não consegui conectar à IA. Verifique a internet."
        ProviderError.TIMEOUT -> "A IA demorou demais para responder."
        ProviderError.SERVER -> "O serviço de IA está com problemas no momento."
        ProviderError.BUDGET_EXCEEDED -> "O limite de gastos com IA foi atingido."
        ProviderError.REFUSED -> "A IA não pôde responder a esse pedido."
        ProviderError.BAD_REQUEST -> "A IA rejeitou o pedido (configuração de modelo inválida?)."
        ProviderError.UNKNOWN -> "Algo deu errado ao falar com a IA."
    }
}
