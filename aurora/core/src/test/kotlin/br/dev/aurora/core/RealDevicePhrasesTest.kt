package br.dev.aurora.core

import br.dev.aurora.core.intent.LocalIntent
import br.dev.aurora.core.intent.LocalIntentParser
import br.dev.aurora.core.time.PtBrDateTimeParser
import br.dev.aurora.core.time.WhenResolution
import br.dev.aurora.core.tools.AssistantTool
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

/**
 * Frases ditas no primeiro teste em aparelho real (22/10/2026, 10:55), transcritas pelo reconhecedor do Android.
 * Todas falharam na versão anterior; ficam aqui para não voltarem a falhar.
 */
class RealDevicePhrasesTest {
    private val zone = ZoneId.of("America/Sao_Paulo")
    private val now = ZonedDateTime.of(2026, 10, 22, 10, 55, 0, 0, zone)
    private val parser = LocalIntentParser()

    private fun reminder(text: String): Pair<AssistantTool.CreateReminder, Boolean> {
        val intent = parser.parse(text, now)
        assertIs<LocalIntent.Tool>(intent, "'$text' → $intent")
        return assertIs<AssistantTool.CreateReminder>(intent.tool) to intent.periodAssumed
    }

    @Test fun `agende uma reuniao para as 2 30 vira lembrete as 14 30 avisando a suposicao`() {
        val (r, assumed) = reminder("agende uma reunião para as 2:30")
        assertEquals("Reunião", r.title)
        assertEquals(ZonedDateTime.of(2026, 10, 22, 14, 30, 0, 0, zone), r.at)
        assertTrue(assumed, "a resposta precisa dizer o horário escolhido")
    }

    @Test fun `marque uma agenda no lembrete para daqui 5 horas`() {
        val (r, _) = reminder("Marque uma agenda no lembrete para daqui 5 horas buscar na escola")
        assertEquals("Buscar na escola", r.title)
        assertEquals(now.plusHours(5), r.at)
    }

    @Test fun `adicione na agenda sem detalhes pergunta o que e quando`() {
        val intent = parser.parse("adicione na agenda", now)
        assertIs<LocalIntent.Reply>(intent)
        assertTrue(intent.text.contains("para quando"), intent.text)
    }

    @Test fun `outras formas de agendar`() {
        assertEquals("Reunião", reminder("agenda reunião amanhã às 15h").first.title)
        val (d, _) = reminder("marca dentista sexta às 10")
        assertEquals("Dentista", d.title)
        assertEquals(LocalDate.of(2026, 10, 23), d.at.toLocalDate())
        assertEquals("Consulta", reminder("coloque na minha agenda consulta segunda às 9h").first.title)
    }

    @Test fun `perguntas sobre a agenda continuam sendo perguntas`() {
        assertIs<AssistantTool.GetAgenda>(assertIs<LocalIntent.Tool>(parser.parse("agenda de amanhã", now)).tool)
        assertIs<AssistantTool.GetAgenda>(assertIs<LocalIntent.Tool>(parser.parse("tudo certo por aqui quero ver sua agenda de hoje", now)).tool)
    }

    @Test fun `verbos com que e gue no subjuntivo`() {
        assertIs<AssistantTool.CreateTask>(assertIs<LocalIntent.Tool>(parser.parse("marque uma tarefa pagar a luz", now)).tool)
        assertIs<AssistantTool.CompleteTask>(assertIs<LocalIntent.Tool>(parser.parse("risque a tarefa pagar a luz", now)).tool)
        assertIs<AssistantTool.DeleteTask>(assertIs<LocalIntent.Tool>(parser.parse("apague a tarefa pagar a luz", now)).tool)
    }

    @Test fun `horario com zero a esquerda continua exato`() {
        val p = PtBrDateTimeParser()
        assertIs<WhenResolution.InPast>(p.resolve(p.parse("hoje às 08:00", now), now))
        val r = assertIs<WhenResolution.Resolved>(p.resolve(p.parse("amanhã às 15:30", now), now))
        assertEquals(LocalTime.of(15, 30), r.dateTime.toLocalTime())
    }
}
