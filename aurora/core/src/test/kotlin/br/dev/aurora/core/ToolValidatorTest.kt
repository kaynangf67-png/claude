package br.dev.aurora.core

import br.dev.aurora.core.model.Frequency
import br.dev.aurora.core.tools.AssistantTool
import br.dev.aurora.core.tools.ItemRef
import br.dev.aurora.core.tools.ToolCatalog
import br.dev.aurora.core.tools.ToolValidator
import br.dev.aurora.core.tools.Validation
import java.time.DayOfWeek
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class ToolValidatorTest {
    private val zone = ZoneId.of("America/Sao_Paulo")
    private val now = ZonedDateTime.of(2026, 10, 22, 10, 0, 0, 0, zone)
    private val v = ToolValidator { now }

    private fun invalid(name: String, args: Map<String, Any?>): String {
        val r = v.validate(name, args)
        return assertIs<Validation.Invalid>(r, "esperava inválido: $r").reason
    }

    private inline fun <reified T> valid(name: String, args: Map<String, Any?>): T =
        assertIs<T>(assertIs<Validation.Valid>(v.validate(name, args)).tool)

    @Test fun `lembrete valido usa fuso local`() {
        val r = valid<AssistantTool.CreateReminder>("create_reminder", mapOf("title" to " Médico ", "at" to "2026-10-23T09:30"))
        assertEquals("Médico", r.title)
        assertEquals(zone, r.at.zone)
        assertEquals(LocalTime.of(9, 30), r.at.toLocalTime())
    }

    @Test fun `horario no passado e rejeitado`() {
        assertTrue(invalid("create_reminder", mapOf("title" to "x", "at" to "2026-10-22T09:00")).contains("já passou"))
    }

    @Test fun `tolerancia de um minuto`() {
        valid<AssistantTool.CreateReminder>("create_reminder", mapOf("title" to "x", "at" to "2026-10-22T10:00"))
    }

    @Test fun `campos obrigatorios e tipos`() {
        invalid("create_reminder", mapOf("at" to "2026-10-23T09:30"))
        invalid("create_task", mapOf("title" to 42))
        invalid("create_task", mapOf("title" to "   "))
        invalid("create_task", mapOf("title" to "x".repeat(201)))
        invalid("create_task", mapOf("title" to "a\u0000b"))
        invalid("create_reminder", mapOf("title" to "x", "at" to "amanhã 9h"))
        invalid("create_task", mapOf("title" to "x", "priority" to "urgentíssima"))
    }

    @Test fun `alvos por id ou titulo`() {
        assertEquals(ItemRef.ById(7), valid<AssistantTool.CompleteTask>("complete_task", mapOf("task_id" to 7.0)).target)
        assertEquals(ItemRef.ByTitle("leite"), valid<AssistantTool.CompleteTask>("complete_task", mapOf("task_title" to "leite")).target)
        invalid("complete_task", emptyMap())
        invalid("complete_task", mapOf("task_id" to -1))
    }

    @Test fun `recorrencia estruturada`() {
        val t = valid<AssistantTool.CreateTask>(
            "create_task",
            mapOf("title" to "Academia", "recurrence" to mapOf("frequency" to "weekly", "days_of_week" to listOf("MO", "WE"))),
        )
        assertEquals(Frequency.WEEKLY, t.recurrence?.frequency)
        assertEquals(setOf(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY), t.recurrence?.daysOfWeek)
        invalid("create_task", mapOf("title" to "x", "recurrence" to mapOf("frequency" to "daily", "days_of_week" to listOf("MO"))))
        invalid("create_task", mapOf("title" to "x", "recurrence" to mapOf("frequency" to "hourly")))
        invalid("create_task", mapOf("title" to "x", "recurrence" to mapOf("frequency" to "daily", "interval" to 0)))
    }

    @Test fun `ferramenta desconhecida`() {
        assertTrue(invalid("exec", emptyMap()).contains("desconhecida"))
    }

    @Test fun `update sem alteracoes e invalido`() {
        invalid("update_task", mapOf("task_id" to 1))
    }

    @Test fun `todas as ferramentas do catalogo sao reconhecidas`() {
        // Garante que o catálogo enviado à IA e o validador não divergem.
        for (spec in ToolCatalog.all) {
            val r = v.validate(spec.name, emptyMap())
            if (r is Validation.Invalid) assertTrue(!r.reason.contains("desconhecida"), spec.name)
        }
    }
}
