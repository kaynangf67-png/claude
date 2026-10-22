package br.dev.aurora.core

import br.dev.aurora.core.intent.LocalIntent
import br.dev.aurora.core.intent.LocalIntentParser
import br.dev.aurora.core.intent.PendingRequest
import br.dev.aurora.core.model.Frequency
import br.dev.aurora.core.model.MemoryCategory
import br.dev.aurora.core.tools.AssistantTool
import br.dev.aurora.core.tools.ItemRef
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class LocalIntentParserTest {
    private val zone = ZoneId.of("America/Sao_Paulo")
    private val now = ZonedDateTime.of(2026, 10, 22, 10, 0, 0, 0, zone) // quinta-feira
    private val parser = LocalIntentParser()

    private inline fun <reified T : AssistantTool> tool(text: String): T {
        val intent = parser.parse(text, now)
        assertIs<LocalIntent.Tool>(intent, "'$text' → $intent")
        return assertIs<T>(intent.tool)
    }

    @Test fun `me lembra amanha as nove sem assunto pede o assunto`() {
        val intent = parser.parse("Me lembra amanhã às nove.", now)
        assertIs<LocalIntent.Clarify>(intent)
        val pending = assertIs<PendingRequest.ReminderNeedsTitle>(intent.pending)
        assertEquals(LocalTime.of(9, 0), pending.at.toLocalTime())
        assertEquals(LocalDate.of(2026, 10, 23), pending.at.toLocalDate())

        val follow = parser.continuePending(pending, "de tomar o remédio", now)
        assertIs<LocalIntent.Tool>(follow)
        val r = assertIs<AssistantTool.CreateReminder>(follow.tool)
        assertEquals("Tomar o remédio", r.title)
    }

    @Test fun `lembrete completo extrai titulo e horario`() {
        val r = tool<AssistantTool.CreateReminder>("Aurora, me lembra amanhã às 9h de ligar pro dentista")
        assertEquals("Ligar pro dentista", r.title)
        assertEquals(LocalTime.of(9, 0), r.at.toLocalTime())
        val r2 = tool<AssistantTool.CreateReminder>("me lembra de pagar a conta de luz daqui a 30 minutos")
        assertEquals("Pagar a conta de luz", r2.title)
        assertEquals(now.plusMinutes(30), r2.at)
    }

    @Test fun `lembrete sem horario pergunta quando`() {
        val intent = parser.parse("me lembra de comprar pão", now)
        assertIs<LocalIntent.Clarify>(intent)
        val pending = assertIs<PendingRequest.ReminderNeedsWhen>(intent.pending)
        assertEquals("Comprar pão", pending.title)
        val follow = parser.continuePending(pending, "às 18h", now)
        val created = assertIs<AssistantTool.CreateReminder>(assertIs<LocalIntent.Tool>(follow).tool)
        assertEquals(LocalTime.of(18, 0), created.at.toLocalTime())
    }

    @Test fun `lembrete com so data pergunta a hora`() {
        val intent = parser.parse("me lembra amanhã de manhã de levar o carro", now)
        assertIs<LocalIntent.Clarify>(intent)
        assertTrue(intent.question.contains("de manhã"), intent.question)
    }

    @Test fun `quais sao minhas tarefas de hoje`() {
        val t = tool<AssistantTool.ListTasks>("Quais são minhas tarefas de hoje?")
        assertEquals(now.toLocalDate(), t.date)
    }

    @Test fun `adia isso para sexta`() {
        val t = tool<AssistantTool.Postpone>("Adia isso para sexta-feira.")
        assertEquals(ItemRef.LastMentioned, t.target)
        assertEquals(LocalDate.of(2026, 10, 23), t.toDate)
    }

    @Test fun `adia tarefa nomeada`() {
        val t = tool<AssistantTool.Postpone>("adia a tarefa relatório para amanhã às 14h")
        assertEquals(ItemRef.ByTitle("relatório"), t.target)
        assertEquals(LocalTime.of(14, 0), t.toDateTime?.toLocalTime())
    }

    @Test fun `anota essa ideia sem conteudo pede a ideia`() {
        val intent = parser.parse("Anota essa ideia.", now)
        assertIs<LocalIntent.Clarify>(intent)
        assertEquals(PendingRequest.NoteNeedsContent, intent.pending)
        val follow = parser.continuePending(PendingRequest.NoteNeedsContent, "um app de receitas por voz", now)
        val note = assertIs<AssistantTool.CreateNote>(assertIs<LocalIntent.Tool>(follow).tool)
        assertEquals("Um app de receitas por voz", note.content)
    }

    @Test fun `anota com conteudo`() {
        val note = tool<AssistantTool.CreateNote>("anota: comprar presente da Ana")
        assertEquals("Comprar presente da Ana", note.content)
    }

    @Test fun `organiza meu dia de amanha`() {
        val t = tool<AssistantTool.BuildDailyPlan>("Organiza meu dia de amanhã.")
        assertEquals(LocalDate.of(2026, 10, 23), t.date)
    }

    @Test fun `tarefa recorrente sem titulo pergunta`() {
        val intent = parser.parse("Marca uma tarefa recorrente toda segunda-feira.", now)
        assertIs<LocalIntent.Clarify>(intent)
        assertTrue(intent.question.contains("segunda"), intent.question)
        val pending = assertIs<PendingRequest.TaskNeedsTitle>(intent.pending)
        assertEquals(setOf(DayOfWeek.MONDAY), pending.recurrence?.daysOfWeek)
        val follow = parser.continuePending(pending, "revisar orçamento", now)
        val task = assertIs<AssistantTool.CreateTask>(assertIs<LocalIntent.Tool>(follow).tool)
        assertEquals("Revisar orçamento", task.title)
        assertEquals(Frequency.WEEKLY, task.recurrence?.frequency)
        assertEquals(LocalDate.of(2026, 10, 26), task.dueDate)
    }

    @Test fun `tarefa com titulo e prazo`() {
        val t = tool<AssistantTool.CreateTask>("cria uma tarefa enviar proposta para sexta")
        assertEquals("Enviar proposta", t.title)
        assertEquals(LocalDate.of(2026, 10, 23), t.dueDate)
    }

    @Test fun `concluir tarefa`() {
        assertEquals(ItemRef.ByTitle("enviar proposta"), tool<AssistantTool.CompleteTask>("concluí a tarefa enviar proposta").target)
        assertEquals(ItemRef.LastMentioned, tool<AssistantTool.CompleteTask>("marca como feita").target)
    }

    @Test fun `memoria e preferencia`() {
        val m = tool<AssistantTool.SaveMemory>("lembra que eu prefiro café sem açúcar")
        assertEquals("Eu prefiro café sem açúcar", m.content)
        assertEquals(MemoryCategory.PREFERENCE, m.category)
    }

    @Test fun `lembra que com horario vira lembrete`() {
        tool<AssistantTool.CreateReminder>("lembra que amanhã às 10h tenho reunião")
    }

    @Test fun `excluir pede confirmacao e cancelar desiste`() {
        val del = tool<AssistantTool.DeleteTask>("apaga a tarefa comprar leite")
        assertTrue(del.requiresConfirmation)
        val confirm = PendingRequest.Confirmation(del, "excluir")
        assertIs<LocalIntent.Tool>(parser.continuePending(confirm, "sim", now))
        assertEquals(LocalIntent.Cancelled, parser.continuePending(confirm, "não", now))
        assertEquals(LocalIntent.Cancelled, parser.continuePending(PendingRequest.NoteNeedsContent, "deixa pra lá", now))
    }

    @Test fun `agenda e lembretes`() {
        assertEquals(LocalDate.of(2026, 10, 23), tool<AssistantTool.GetAgenda>("qual a minha agenda de amanhã").date)
        tool<AssistantTool.ListReminders>("quais são meus lembretes?")
    }

    @Test fun `abrir app`() {
        assertEquals("Spotify", tool<AssistantTool.OpenApp>("abre o Spotify").appName)
    }

    @Test fun `pedido desconhecido segue para a ia`() {
        assertEquals(LocalIntent.Unknown, parser.parse("qual a capital da Austrália?", now))
        assertEquals(LocalIntent.Unknown, parser.parse("me explica como funciona juros compostos", now))
    }

    @Test fun `conversa simples e local`() {
        assertIs<LocalIntent.Reply>(parser.parse("Obrigado!", now))
        assertIs<LocalIntent.Reply>(parser.parse("que horas são?", now))
    }
}
