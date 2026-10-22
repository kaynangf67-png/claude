package br.dev.aurora.core

import br.dev.aurora.core.model.Priority
import br.dev.aurora.core.model.Task
import br.dev.aurora.core.model.TaskStatus
import br.dev.aurora.core.orchestrator.AiSettings
import br.dev.aurora.core.orchestrator.AssistantOrchestrator
import br.dev.aurora.core.provider.AssistantProvider
import br.dev.aurora.core.provider.ProviderError
import br.dev.aurora.core.provider.ProviderRequest
import br.dev.aurora.core.provider.ProviderResult
import br.dev.aurora.core.provider.TokenUsage
import br.dev.aurora.core.provider.ToolInvocation
import br.dev.aurora.core.provider.ToolInvocationResult
import br.dev.aurora.core.repository.ScheduleOutcome
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Provedor de IA roteirizado: executa as chamadas de ferramenta indicadas e devolve um texto fixo. */
class ScriptedProvider(
    private val calls: List<ToolInvocation> = emptyList(),
    private val finalText: String = "ok",
    private val failure: ProviderError? = null,
) : AssistantProvider {
    override val displayName = "Teste"
    override val model = "claude-haiku-5-5"
    val toolResults = mutableListOf<ToolInvocationResult>()
    var lastRequest: ProviderRequest? = null

    override suspend fun respond(request: ProviderRequest, onToolCall: suspend (ToolInvocation) -> ToolInvocationResult): ProviderResult {
        lastRequest = request
        failure?.let { return ProviderResult.Failure(it) }
        calls.forEach { toolResults += onToolCall(it) }
        return ProviderResult.Success(finalText, TokenUsage(1_000_000, 100_000), model)
    }
}

class AssistantOrchestratorTest {
    private val zone = ZoneId.of("America/Sao_Paulo")
    private var clock = ZonedDateTime.of(2026, 10, 22, 10, 0, 0, 0, zone)
    private val world = TestWorld()
    private val ledger = FakeLedger()
    private val connectivity = FakeConnectivity()
    private var provider: AssistantProvider? = null
    private var aiEnabled = true

    private val orchestrator = AssistantOrchestrator(
        deps = world.deps,
        conversation = world.conversation,
        providerFactory = { provider },
        ledger = ledger,
        connectivity = connectivity,
        settings = { AiSettings(enabled = aiEnabled, monthlyBudgetUsd = 5.0) },
        now = { clock },
    )

    private suspend fun say(text: String) = orchestrator.handle(text, "c1")

    @Test fun `cria lembrete persiste agenda e confirma com horario`() = runTest {
        val reply = say("me lembra amanhã às 9h de ligar pro dentista")
        val saved = world.reminders.getAll().single()
        assertEquals("Ligar pro dentista", saved.title)
        assertEquals(ZonedDateTime.of(2026, 10, 23, 9, 0, 0, 0, zone).toInstant(), saved.scheduledAt)
        assertEquals(saved.scheduledAt, world.scheduler.scheduled[saved.id])
        assertTrue(reply.text.contains("amanhã às 09:00"), reply.text)
        assertFalse(reply.usedAi)
    }

    @Test fun `alarme inexato e notificacoes desligadas geram avisos honestos`() = runTest {
        world.scheduler.outcome = ScheduleOutcome.INEXACT
        world.capabilities.notifications = false
        val reply = say("me lembra daqui a 10 minutos de tirar o bolo")
        assertTrue(reply.text.contains("pode atrasar"), reply.text)
        assertTrue(reply.text.contains("notificações estão desativadas"), reply.text)
    }

    @Test fun `falha no agendamento nao e anunciada como sucesso`() = runTest {
        world.scheduler.outcome = ScheduleOutcome.FAILED
        val reply = say("me lembra daqui a 10 minutos de tirar o bolo")
        assertTrue(reply.text.contains("não consegui agendar"), reply.text)
        assertFalse(reply.text.startsWith("Pronto"))
    }

    @Test fun `fluxo de esclarecimento completa o lembrete`() = runTest {
        val q = say("Me lembra amanhã às nove.")
        assertTrue(q.awaitingUser)
        say("de buscar as crianças")
        val r = world.reminders.getAll().single()
        assertEquals("Buscar as crianças", r.title)
        assertEquals(LocalTime.of(9, 0), r.scheduledAt.atZone(zone).toLocalTime())
    }

    @Test fun `adia isso usa o ultimo item citado`() = runTest {
        say("cria uma tarefa enviar relatório para amanhã")
        val reply = say("Adia isso para sexta-feira.")
        val task = world.tasks.getAll().single()
        // Hoje é quinta; "amanhã" já é sexta (23/10). "sexta-feira" também é 23/10.
        assertEquals(LocalDate.of(2026, 10, 23), task.dueAt!!.atZone(zone).toLocalDate())
        assertTrue(reply.text.startsWith("Adiei"), reply.text)
    }

    @Test fun `adia lembrete mantem horario`() = runTest {
        say("me lembra amanhã às 15h de pagar o boleto")
        say("adia isso para segunda")
        val r = world.reminders.getAll().single()
        val local = r.scheduledAt.atZone(zone)
        assertEquals(LocalDate.of(2026, 10, 26), local.toLocalDate())
        assertEquals(LocalTime.of(15, 0), local.toLocalTime())
        assertEquals(r.scheduledAt, world.scheduler.scheduled[r.id])
    }

    @Test fun `adiar sem referencia pede o alvo`() = runTest {
        val reply = say("adia isso para amanhã")
        assertTrue(reply.text.contains("Não sei a qual item"), reply.text)
    }

    @Test fun `excluir exige confirmacao`() = runTest {
        say("cria uma tarefa comprar leite")
        val ask = say("apaga a tarefa comprar leite")
        assertTrue(ask.awaitingUser)
        assertTrue(ask.text.contains("Confirma excluir a tarefa \"Comprar leite\""), ask.text)
        assertEquals(1, world.tasks.getAll().size)
        say("sim")
        assertEquals(0, world.tasks.getAll().size)
    }

    @Test fun `excluir negado nao apaga`() = runTest {
        say("cria uma tarefa comprar leite")
        say("apaga a tarefa comprar leite")
        val r = say("não")
        assertEquals(1, world.tasks.getAll().size)
        assertTrue(r.text.contains("deixei pra lá"))
    }

    @Test fun `concluir tarefa recorrente avanca para a proxima`() = runTest {
        say("Marca uma tarefa recorrente toda segunda-feira.")
        say("revisar orçamento")
        val created = world.tasks.getAll().single()
        assertEquals(LocalDate.of(2026, 10, 26), created.dueAt!!.atZone(zone).toLocalDate())
        clock = ZonedDateTime.of(2026, 10, 26, 18, 0, 0, 0, zone)
        say("concluí a tarefa revisar orçamento")
        val after = world.tasks.getAll().single()
        assertEquals(TaskStatus.PENDING, after.status)
        assertEquals(LocalDate.of(2026, 11, 2), after.dueAt!!.atZone(zone).toLocalDate())
    }

    @Test fun `concluir tarefa simples`() = runTest {
        say("cria uma tarefa lavar o carro")
        say("marca como feita")
        assertEquals(TaskStatus.COMPLETED, world.tasks.getAll().single().status)
    }

    @Test fun `listar tarefas de hoje inclui atrasadas`() = runTest {
        val now = clock.toInstant()
        world.tasks.upsert(Task(title = "Pagar aluguel", priority = Priority.HIGH, dueAt = clock.minusDays(2).toInstant(), dueAllDay = true, createdAt = now, updatedAt = now))
        world.tasks.upsert(Task(title = "Ligar para o banco", dueAt = clock.toInstant(), dueAllDay = true, createdAt = now, updatedAt = now))
        world.tasks.upsert(Task(title = "Viagem", dueAt = clock.plusDays(5).toInstant(), createdAt = now, updatedAt = now))
        val reply = say("Quais são minhas tarefas de hoje?")
        assertTrue(reply.text.contains("2 tarefas"), reply.text)
        assertTrue(reply.text.contains("Pagar aluguel (alta prioridade)"), reply.text)
        assertFalse(reply.text.contains("Viagem"))
    }

    @Test fun `sem ia configurada responde honestamente e sem gastar`() = runTest {
        provider = null
        val reply = say("qual a capital da Austrália?")
        assertEquals(ProviderError.NOT_CONFIGURED, reply.providerError)
        assertTrue(reply.text.contains("configure a chave"), reply.text)
        assertEquals(0.0, ledger.spent)
    }

    @Test fun `offline nao chama a ia`() = runTest {
        val p = ScriptedProvider()
        provider = p
        connectivity.online = false
        val reply = say("qual a capital da Austrália?")
        assertEquals(ProviderError.OFFLINE, reply.providerError)
        assertNull(p.lastRequest)
    }

    @Test fun `orcamento estourado bloqueia a chamada`() = runTest {
        val p = ScriptedProvider()
        provider = p
        ledger.spent = 5.0
        val reply = say("qual a capital da Austrália?")
        assertEquals(ProviderError.BUDGET_EXCEEDED, reply.providerError)
        assertNull(p.lastRequest)
    }

    @Test fun `ia cria tarefa via ferramenta validada e custo e registrado`() = runTest {
        val p = ScriptedProvider(
            calls = listOf(ToolInvocation("create_task", mapOf("title" to "Estudar inglês", "priority" to "alta", "due" to "2026-10-24"))),
            finalText = "Criei a tarefa Estudar inglês para sábado.",
        )
        provider = p
        val reply = say("preciso estudar inglês no sábado, coloca isso na lista")
        assertTrue(reply.usedAi)
        val t = world.tasks.getAll().single()
        assertEquals("Estudar inglês", t.title)
        assertEquals(Priority.HIGH, t.priority)
        assertFalse(p.toolResults.single().isError)
        // 1M tokens de entrada + 100k de saída no Haiku 5.5 = 0,10 + 0,05
        assertEquals(0.15, ledger.spent, 1e-9)
        assertEquals(0.15, reply.estimatedCostUsd, 1e-9)
    }

    @Test fun `argumentos invalidos da ia nao executam nada`() = runTest {
        val p = ScriptedProvider(calls = listOf(ToolInvocation("create_reminder", mapOf("title" to "x", "at" to "2020-01-01T10:00"))))
        provider = p
        say("me ajuda com uma coisa estranha")
        assertTrue(p.toolResults.single().isError)
        assertTrue(world.reminders.getAll().isEmpty())
    }

    @Test fun `ferramenta inexistente e rejeitada`() = runTest {
        val p = ScriptedProvider(calls = listOf(ToolInvocation("run_shell", mapOf("cmd" to "rm -rf /"))))
        provider = p
        say("faz algo")
        assertTrue(p.toolResults.single().isError)
    }

    @Test fun `exclusao pedida pela ia aguarda confirmacao do usuario`() = runTest {
        say("cria uma tarefa comprar leite")
        val p = ScriptedProvider(calls = listOf(ToolInvocation("delete_task", mapOf("task_title" to "comprar leite"))), finalText = "Confirma a exclusão?")
        provider = p
        val reply = say("não preciso mais daquilo do leite")
        assertTrue(reply.awaitingUser)
        assertEquals(1, world.tasks.getAll().size)
        say("sim")
        assertEquals(0, world.tasks.getAll().size)
    }

    @Test fun `memoria proposta pela ia exige confirmacao`() = runTest {
        provider = ScriptedProvider(calls = listOf(ToolInvocation("save_memory", mapOf("content" to "Usuário mora em Recife"))))
        say("eu moro em Recife, sabia?")
        assertTrue(world.memory.items.isEmpty())
        say("sim")
        assertEquals("Usuário mora em Recife", world.memory.items.values.single().content)
    }

    @Test fun `contexto enviado a ia contem so memorias relacionadas`() = runTest {
        say("lembra que eu prefiro café sem açúcar")
        say("lembra que minha filha se chama Luiza")
        val p = ScriptedProvider()
        provider = p
        say("que tipo de café eu gosto mesmo?")
        val system = assertNotNull(p.lastRequest).systemPrompt
        assertTrue(system.contains("café sem açúcar"), system)
        assertFalse(system.contains("Luiza"), system)
    }

    @Test fun `erro do provedor vira mensagem clara`() = runTest {
        provider = ScriptedProvider(failure = ProviderError.INVALID_KEY)
        val reply = say("conta uma piada")
        assertEquals(ProviderError.INVALID_KEY, reply.providerError)
        assertTrue(reply.text.contains("chave da IA foi recusada"), reply.text)
    }

    @Test fun `historico da conversa e persistido`() = runTest {
        say("oi")
        assertEquals(2, world.conversation.items.size)
    }
}
