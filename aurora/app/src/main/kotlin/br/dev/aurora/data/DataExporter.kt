package br.dev.aurora.data

import br.dev.aurora.AppContainer
import java.time.Instant
import org.json.JSONArray
import org.json.JSONObject

/** Exporta todos os dados locais em JSON legível. A chave da IA nunca é exportada. */
object DataExporter {
    suspend fun export(c: AppContainer): String {
        val root = JSONObject()
        root.put("app", "Aurora")
        root.put("exportedAt", Instant.now().toString())
        root.put("tasks", JSONArray(c.tasks.getAll().map {
            JSONObject().put("id", it.id).put("title", it.title).put("description", it.description)
                .put("priority", it.priority.name).put("status", it.status.name)
                .put("dueAt", it.dueAt?.toString()).put("dueAllDay", it.dueAllDay)
                .put("recurrence", it.recurrence?.toRule()).put("createdAt", it.createdAt.toString())
                .put("updatedAt", it.updatedAt.toString()).put("completedAt", it.completedAt?.toString())
                .put("estimatedMinutes", it.estimatedMinutes).put("actualMinutes", it.actualMinutes)
                .put("projectId", it.projectId).put("objectiveId", it.objectiveId)
        }))
        root.put("reminders", JSONArray(c.reminders.getAll().map {
            JSONObject().put("id", it.id).put("title", it.title).put("details", it.details)
                .put("scheduledAt", it.scheduledAt.toString()).put("recurrence", it.recurrence?.toRule())
                .put("enabled", it.enabled).put("createdAt", it.createdAt.toString())
                .put("updatedAt", it.updatedAt.toString()).put("lastFiredAt", it.lastFiredAt?.toString())
        }))
        root.put("notes", JSONArray(c.db.notes().getAll().map {
            JSONObject().put("id", it.id).put("title", it.title).put("originalContent", it.originalContent)
                .put("editedContent", it.editedContent).put("type", it.type).put("processingStatus", it.processingStatus)
                .put("source", it.source).put("sourceUrl", it.sourceUrl).put("projectId", it.projectId)
                .put("createdAt", Instant.ofEpochMilli(it.createdAt).toString()).put("updatedAt", Instant.ofEpochMilli(it.updatedAt).toString())
        }))
        root.put("memory", JSONArray(c.memory.getAll().map {
            JSONObject().put("id", it.id).put("category", it.category.name).put("content", it.content)
                .put("userApproved", it.userApproved).put("createdAt", it.createdAt.toString())
        }))
        root.put("conversation", JSONArray(c.db.messages().getAll().map {
            JSONObject().put("role", it.role).put("content", it.content).put("createdAt", Instant.ofEpochMilli(it.createdAt).toString())
        }))
        val s = c.settings.current()
        root.put("settings", JSONObject()
            .put("assistantName", s.assistantName).put("speechEnabled", s.speechEnabled).put("speechRate", s.speechRate.toDouble())
            .put("speechVolume", s.speechVolume.toDouble()).put("aiEnabled", s.aiEnabled).put("modelId", s.modelId)
            .put("monthlyBudgetUsd", s.monthlyBudgetUsd).put("calendarEnabled", s.calendarEnabled)
            .put("keepConversationHistory", s.keepConversationHistory))
        return root.toString(2)
    }
}
