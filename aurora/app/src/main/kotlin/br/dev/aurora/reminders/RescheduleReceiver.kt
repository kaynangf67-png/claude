package br.dev.aurora.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import br.dev.aurora.AuroraApp
import br.dev.aurora.core.time.RecurrenceCalculator
import java.time.Instant
import java.time.ZoneId

/** Reinício do aparelho, atualização do app, mudança de hora/fuso ou da permissão de alarme exato. */
class RescheduleReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        RescheduleWorker.enqueue(context)
    }
}

/**
 * Recria todos os alarmes a partir do banco. Lembretes únicos que venceram enquanto o aparelho estava
 * desligado são avisados como "perdidos" em vez de silenciosamente descartados.
 */
class RescheduleWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val container = (applicationContext as AuroraApp).container
        val now = Instant.now()
        val zone = ZoneId.systemDefault()
        for (reminder in container.reminders.getAll().filter { it.enabled }) {
            val rule = reminder.recurrence
            when {
                reminder.scheduledAt.isAfter(now) -> container.scheduler.schedule(reminder)
                rule != null -> {
                    val next = RecurrenceCalculator.nextOccurrence(rule, reminder.scheduledAt.atZone(zone).toLocalDateTime(), now, zone)
                    val updated = reminder.copy(scheduledAt = next, updatedAt = now)
                    container.reminders.upsert(updated)
                    container.scheduler.schedule(updated)
                }
                else -> {
                    Notifications.showReminder(applicationContext, reminder, missed = true)
                    container.reminders.upsert(reminder.copy(enabled = false, lastFiredAt = now, updatedAt = now))
                }
            }
        }
        return Result.success()
    }

    companion object {
        private const val NAME = "aurora-reschedule"

        fun enqueue(context: Context) {
            WorkManager.getInstance(context).enqueueUniqueWork(
                NAME, ExistingWorkPolicy.REPLACE, OneTimeWorkRequestBuilder<RescheduleWorker>().build(),
            )
        }
    }
}
