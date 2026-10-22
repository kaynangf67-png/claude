package br.dev.aurora.core

import br.dev.aurora.core.model.MessageRole
import br.dev.aurora.core.provider.AnthropicProvider
import br.dev.aurora.core.provider.ProviderError
import br.dev.aurora.core.provider.ProviderMessage
import br.dev.aurora.core.provider.ProviderRequest
import br.dev.aurora.core.provider.ProviderResult
import br.dev.aurora.core.provider.ToolInvocation
import br.dev.aurora.core.provider.ToolInvocationResult
import br.dev.aurora.core.tools.ToolCatalog
import java.time.Duration
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue

class AnthropicProviderTest {
    private lateinit var server: MockWebServer

    @BeforeTest fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @AfterTest fun tearDown() {
        runCatching { server.shutdown() }
    }

    private fun provider(model: String = "claude-haiku-5-5") = AnthropicProvider(
        apiKey = "sk-ant-teste-nao-real",
        model = model,
        baseUrl = server.url("/").toString().trimEnd('/'),
        timeout = Duration.ofSeconds(5),
    )

    private fun json(body: String, code: Int = 200) =
        MockResponse().setResponseCode(code).setHeader("content-type", "application/json").setBody(body)

    private fun message(content: String, stop: String) = """
        {"id":"msg_1","type":"message","role":"assistant","model":"claude-haiku-5-5",
         "content":$content,"stop_reason":"$stop","stop_sequence":null,
         "usage":{"input_tokens":1000,"output_tokens":50}}
    """.trimIndent()

    private val request = ProviderRequest(
        systemPrompt = "Você é a Aurora.",
        history = listOf(
            ProviderMessage(MessageRole.ASSISTANT, "mensagem órfã do assistente"),
            ProviderMessage(MessageRole.USER, "oi"),
            ProviderMessage(MessageRole.ASSISTANT, "Oi! Como posso ajudar?"),
        ),
        userMessage = "cria a tarefa estudar",
        tools = ToolCatalog.all,
    )

    @Test fun `ciclo de ferramenta completo`() = runTest {
        server.enqueue(json(message("""[{"type":"tool_use","id":"toolu_1","name":"create_task","input":{"title":"Estudar","priority":"alta"}}]""", "tool_use")))
        server.enqueue(json(message("""[{"type":"text","text":"Criei a tarefa Estudar."}]""", "end_turn")))

        val calls = mutableListOf<ToolInvocation>()
        val result = provider().respond(request) { calls += it; ToolInvocationResult("Tarefa criada com id 3.") }

        val success = assertIs<ProviderResult.Success>(result)
        assertEquals("Criei a tarefa Estudar.", success.text)
        assertEquals(2000, success.usage.inputTokens)
        assertEquals(100, success.usage.outputTokens)
        assertEquals(ToolInvocation("create_task", mapOf("title" to "Estudar", "priority" to "alta")), calls.single())

        val first = server.takeRequest()
        assertEquals("/v1/messages", first.path)
        // O SDK 3.x envia a chave como "Authorization: Bearer"; versões anteriores usavam "x-api-key".
        val sentKey = first.getHeader("x-api-key") ?: first.getHeader("Authorization")?.removePrefix("Bearer ")
        assertEquals("sk-ant-teste-nao-real", sentKey)
        val body1 = first.body.readUtf8()
        assertTrue(body1.contains("\"effort\":\"low\""), body1)
        assertTrue(body1.contains("\"name\":\"create_reminder\""), body1)
        assertTrue(body1.contains("\"system\":\"Você é a Aurora.\""), body1)
        // Histórico começa no usuário (a mensagem órfã do assistente é descartada).
        assertFalse(body1.contains("órfã"), body1)
        // Haiku não usa fallback no servidor.
        assertFalse(body1.contains("fallbacks"), body1)

        val body2 = server.takeRequest().body.readUtf8()
        assertTrue(body2.contains("\"tool_use_id\":\"toolu_1\""), body2)
        assertTrue(body2.contains("Tarefa criada com id 3."), body2)
    }

    @Test fun `opus usa fallback no servidor`() = runTest {
        server.enqueue(json(message("""[{"type":"text","text":"ok"}]""", "end_turn")))
        provider("claude-opus-5-5").respond(request) { ToolInvocationResult("") }
        val r = server.takeRequest()
        assertTrue(r.body.readUtf8().contains("\"fallbacks\":\"default\""))
        assertTrue(r.getHeader("anthropic-beta")!!.contains("server-side-fallback-2026-07-01"))
    }

    @Test fun `chave invalida`() = runTest {
        server.enqueue(json("""{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}""", 401))
        val r = provider().respond(request) { ToolInvocationResult("") }
        assertEquals(ProviderError.INVALID_KEY, assertIs<ProviderResult.Failure>(r).error)
        assertEquals(1, server.requestCount)
    }

    @Test fun `limite de taxa refaz e depois falha`() = runTest {
        repeat(3) {
            server.enqueue(json("""{"type":"error","error":{"type":"rate_limit_error","message":"slow down"}}""", 429).setHeader("retry-after-ms", "10"))
        }
        val r = provider().respond(request) { ToolInvocationResult("") }
        assertEquals(ProviderError.RATE_LIMITED, assertIs<ProviderResult.Failure>(r).error)
        assertEquals(3, server.requestCount) // 1 + 2 novas tentativas
    }

    @Test fun `erro do servidor`() = runTest {
        repeat(3) { server.enqueue(json("""{"type":"error","error":{"type":"api_error","message":"boom"}}""", 500).setHeader("retry-after-ms", "10")) }
        val r = provider().respond(request) { ToolInvocationResult("") }
        assertEquals(ProviderError.SERVER, assertIs<ProviderResult.Failure>(r).error)
    }

    @Test fun `recusa`() = runTest {
        server.enqueue(json(message("[]", "refusal")))
        val r = provider().respond(request) { ToolInvocationResult("") }
        assertEquals(ProviderError.REFUSED, assertIs<ProviderResult.Failure>(r).error)
    }

    @Test fun `sem conexao`() = runTest {
        server.shutdown()
        val r = provider().respond(request) { ToolInvocationResult("") }
        assertEquals(ProviderError.OFFLINE, assertIs<ProviderResult.Failure>(r).error)
    }

    @Test fun `entrada de ferramenta invalida volta como erro para o modelo`() = runTest {
        server.enqueue(json(message("""[{"type":"tool_use","id":"toolu_9","name":"create_task","input":"texto solto"}]""", "tool_use")))
        server.enqueue(json(message("""[{"type":"text","text":"Desculpe."}]""", "end_turn")))
        var called = false
        val r = provider().respond(request) { called = true; ToolInvocationResult("") }
        assertIs<ProviderResult.Success>(r)
        assertFalse(called)
        server.takeRequest()
        assertTrue(server.takeRequest().body.readUtf8().contains("\"is_error\":true"))
    }

    @Test fun `limite de rodadas de ferramenta`() = runTest {
        repeat(10) {
            server.enqueue(json(message("""[{"type":"tool_use","id":"toolu_$it","name":"list_reminders","input":{}}]""", "tool_use")))
        }
        val r = provider().respond(request) { ToolInvocationResult("nada") }
        assertEquals(ProviderError.UNKNOWN, assertIs<ProviderResult.Failure>(r).error)
        assertEquals(6, server.requestCount)
    }
}
