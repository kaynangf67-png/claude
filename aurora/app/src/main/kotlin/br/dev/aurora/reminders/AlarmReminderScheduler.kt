package br.dev.aurora.reminders

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import br.dev.aurora.core.model.Reminder
import br.dev.aurora.core.repository.ReminderScheduler
import br.dev.aurora.core.repository.ScheduleOutcome
import java.time.Instant

/**
 * Agenda lembretes no AlarmManager. Usa alarme exato quando o sistema permite; caso contrário, um alarme
 * inexato que pode atrasar (o app avisa o usuário). Os alarmes não sobrevivem a reinício nem a "forçar
 * parada"; o [RescheduleWorker] os recria.
 */
class AlarmReminderScheduler(private val context: Context) : ReminderScheduler {
    private val alarms = context.getSystemService(AlarmManager::class.java)

    fun canScheduleExact(): Boolean = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()

    override suspend fun schedule(reminder: Reminder): ScheduleOutcome = scheduleAt(reminder.id, reminder.scheduledAt, snooze = false)

    fun scheduleAt(reminderId: Long, at: Instant, snooze: Boolean): ScheduleOutcome {
        if (!at.isAfter(Instant.now())) return ScheduleOutcome.NOT_SCHEDULED_PAST
        val pi = pendingIntent(reminderId, snooze)
        return try {
            if (canScheduleExact()) {
                alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at.toEpochMilli(), pi)
                ScheduleOutcome.EXACT
            } else {
                alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at.toEpochMilli(), pi)
                ScheduleOutcome.INEXACT
            }
        } catch (_: SecurityException) {
            // Permissão de alarme exato revogada entre a checagem e a chamada.
            runCatching {
                alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at.toEpochMilli(), pi)
                ScheduleOutcome.INEXACT
            }.getOrDefault(ScheduleOutcome.FAILED)
        }
    }

    override suspend fun cancel(reminderId: Long) {
        alarms.cancel(pendingIntent(reminderId, snooze = false))
        alarms.cancel(pendingIntent(reminderId, snooze = true))
    }

    private fun pendingIntent(reminderId: Long, snooze: Boolean): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java)
            .setAction(if (snooze) ReminderReceiver.ACTION_SNOOZE_FIRE else ReminderReceiver.ACTION_FIRE)
            .putExtra(ReminderReceiver.EXTRA_ID, reminderId)
        // A ação diferencia o PendingIntent do adiamento do principal (mesmo requestCode).
        return PendingIntent.getBroadcast(
            context, (reminderId % Int.MAX_VALUE).toInt(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }
}
