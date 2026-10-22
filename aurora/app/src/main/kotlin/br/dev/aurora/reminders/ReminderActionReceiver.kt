package br.dev.aurora.reminders

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import br.dev.aurora.AuroraApp
import java.time.Duration
import java.time.Instant
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/** Ações dos botões da notificação: adiar 10 minutos ou concluir. */
class ReminderActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getLongExtra(ReminderReceiver.EXTRA_ID, -1)
        if (id <= 0) return
        Notifications.cancel(context, id)
        if (intent.action != ACTION_SNOOZE) return
        val pending = goAsync()
        val container = (context.applicationContext as AuroraApp).container
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                val reminder = container.reminders.get(id) ?: return@launch
                val at = Instant.now().plus(SNOOZE)
                if (reminder.recurrence == null) {
                    // Lembrete único: o novo horário é persistido (sobrevive a reinício).
                    val updated = reminder.copy(scheduledAt = at, enabled = true, lastFiredAt = null, updatedAt = Instant.now())
                    container.reminders.upsert(updated)
                    container.scheduler.schedule(updated)
                } else {
                    // Recorrente: só um aviso extra, sem mexer na série.
                    container.scheduler.scheduleAt(id, at, snooze = true)
                }
            } finally {
                pending.finish()
            }
        }
    }

    companion object {
        const val ACTION_SNOOZE = "br.dev.aurora.action.REMINDER_SNOOZE"
        const val ACTION_DONE = "br.dev.aurora.action.REMINDER_DONE"
        private val SNOOZE: Duration = Duration.ofMinutes(10)

        fun pendingIntent(context: Context, reminderId: Long, action: String): PendingIntent {
            val intent = Intent(context, ReminderActionReceiver::class.java).setAction(action)
                .putExtra(ReminderReceiver.EXTRA_ID, reminderId)
            return PendingIntent.getBroadcast(
                context, (reminderId % Int.MAX_VALUE).toInt(), intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }
    }
}
