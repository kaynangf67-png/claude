package br.dev.aurora.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import br.dev.aurora.AuroraApp
import br.dev.aurora.core.model.Reminder
import br.dev.aurora.core.time.RecurrenceCalculator
import java.time.Instant
import java.time.ZoneId
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/** Disparo do alarme: mostra a notificação e, se for recorrente, agenda a próxima ocorrência. */
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getLongExtra(EXTRA_ID, -1)
        if (id <= 0) return
        val pending = goAsync()
        val container = (context.applicationContext as AuroraApp).container
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                val reminder = container.reminders.get(id) ?: return@launch
                if (!reminder.enabled) return@launch
                Notifications.showReminder(context, reminder)
                if (intent.action == ACTION_SNOOZE_FIRE) return@launch
                handleFired(context, reminder)
            } finally {
                pending.finish()
            }
        }
    }

    private suspend fun handleFired(context: Context, reminder: Reminder) {
        val container = (context.applicationContext as AuroraApp).container
        val now = Instant.now()
        val rule = reminder.recurrence
        if (rule != null) {
            val zone = ZoneId.systemDefault()
            val next = RecurrenceCalculator.nextOccurrence(rule, reminder.scheduledAt.atZone(zone).toLocalDateTime(), now, zone)
            val updated = reminder.copy(scheduledAt = next, lastFiredAt = now, updatedAt = now)
            container.reminders.upsert(updated)
            container.scheduler.schedule(updated)
        } else {
            container.reminders.upsert(reminder.copy(enabled = false, lastFiredAt = now, updatedAt = now))
        }
    }

    companion object {
        const val ACTION_FIRE = "br.dev.aurora.action.REMINDER_FIRE"
        const val ACTION_SNOOZE_FIRE = "br.dev.aurora.action.REMINDER_SNOOZE_FIRE"
        const val EXTRA_ID = "reminder_id"
    }
}
