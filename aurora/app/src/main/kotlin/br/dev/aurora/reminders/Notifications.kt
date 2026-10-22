package br.dev.aurora.reminders

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import br.dev.aurora.MainActivity
import br.dev.aurora.R
import br.dev.aurora.core.model.Reminder
import br.dev.aurora.core.text.PtBrFormat
import java.time.ZoneId
import java.time.ZonedDateTime

object Notifications {
    const val CHANNEL_REMINDERS = "lembretes"

    fun createChannels(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        val reminders = NotificationChannel(CHANNEL_REMINDERS, context.getString(R.string.channel_reminders), NotificationManager.IMPORTANCE_HIGH)
            .apply { description = context.getString(R.string.channel_reminders_desc) }
        manager.createNotificationChannel(reminders)
    }

    fun canPost(context: Context): Boolean {
        val granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        return granted && NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    /** Mostra o aviso do lembrete. Retorna false se as notificações estiverem bloqueadas. */
    fun showReminder(context: Context, reminder: Reminder, missed: Boolean = false): Boolean {
        if (!canPost(context)) return false
        val zone = ZoneId.systemDefault()
        val at = reminder.scheduledAt.atZone(zone)
        val text = when {
            missed -> "Perdido: era para ${PtBrFormat.dateTime(at, ZonedDateTime.now(zone))}."
            reminder.details.isNotBlank() -> reminder.details
            else -> "Agendado para ${PtBrFormat.time(at.toLocalTime())}"
        }
        val open = PendingIntent.getActivity(
            context, reminder.id.toInt(),
            Intent(context, MainActivity::class.java).setAction(MainActivity.ACTION_OPEN_REMINDERS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_REMINDERS)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(reminder.title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(open)
            .addAction(0, "Adiar 10 min", ReminderActionReceiver.pendingIntent(context, reminder.id, ReminderActionReceiver.ACTION_SNOOZE))
            .addAction(0, "Concluído", ReminderActionReceiver.pendingIntent(context, reminder.id, ReminderActionReceiver.ACTION_DONE))
            .build()
        return try {
            NotificationManagerCompat.from(context).notify(notificationId(reminder.id), notification)
            true
        } catch (_: SecurityException) {
            false
        }
    }

    fun cancel(context: Context, reminderId: Long) {
        NotificationManagerCompat.from(context).cancel(notificationId(reminderId))
    }

    private fun notificationId(reminderId: Long) = (reminderId % Int.MAX_VALUE).toInt()
}
