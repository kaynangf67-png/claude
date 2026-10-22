package br.dev.aurora.system

import android.Manifest
import android.content.ContentUris
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.provider.CalendarContract
import androidx.core.content.ContextCompat
import br.dev.aurora.core.model.CalendarEvent
import br.dev.aurora.core.repository.AppLaunchResult
import br.dev.aurora.core.repository.AppLauncher
import br.dev.aurora.core.repository.CalendarSource
import br.dev.aurora.core.repository.Connectivity
import br.dev.aurora.core.repository.DeviceCapabilities
import br.dev.aurora.core.text.PtText
import br.dev.aurora.data.settings.SettingsStore
import br.dev.aurora.reminders.AlarmReminderScheduler
import br.dev.aurora.reminders.Notifications
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

fun Context.hasPermission(permission: String): Boolean =
    ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

/** Leitura do calendário do aparelho via CalendarContract. Só funciona com permissão e com a opção ligada. */
class AndroidCalendarSource(private val context: Context, private val settings: SettingsStore) : CalendarSource {

    override suspend fun isAvailable(): Boolean =
        settings.current().calendarEnabled && context.hasPermission(Manifest.permission.READ_CALENDAR)

    override suspend fun events(from: Instant, to: Instant): List<CalendarEvent> = withContext(Dispatchers.IO) {
        if (!context.hasPermission(Manifest.permission.READ_CALENDAR)) return@withContext emptyList()
        val uri = CalendarContract.Instances.CONTENT_URI.buildUpon().also {
            ContentUris.appendId(it, from.toEpochMilli())
            ContentUris.appendId(it, to.toEpochMilli())
        }.build()
        val projection = arrayOf(
            CalendarContract.Instances.EVENT_ID,
            CalendarContract.Instances.TITLE,
            CalendarContract.Instances.BEGIN,
            CalendarContract.Instances.END,
            CalendarContract.Instances.ALL_DAY,
            CalendarContract.Instances.EVENT_LOCATION,
        )
        val zone = ZoneId.systemDefault()
        val result = mutableListOf<CalendarEvent>()
        runCatching {
            context.contentResolver.query(uri, projection, "${CalendarContract.Instances.VISIBLE} = 1", null, "${CalendarContract.Instances.BEGIN} ASC")
                ?.use { c ->
                    while (c.moveToNext()) {
                        val allDay = c.getInt(4) == 1
                        var start = Instant.ofEpochMilli(c.getLong(2))
                        var end = Instant.ofEpochMilli(c.getLong(3))
                        if (allDay) {
                            // Eventos de dia inteiro vêm em UTC; converte para o dia local.
                            start = start.atZone(ZoneOffset.UTC).toLocalDate().atStartOfDay(zone).toInstant()
                            end = end.atZone(ZoneOffset.UTC).toLocalDate().atStartOfDay(zone).toInstant()
                        }
                        result += CalendarEvent(
                            id = c.getLong(0),
                            title = c.getString(1)?.takeIf { it.isNotBlank() } ?: "(sem título)",
                            start = start,
                            end = end,
                            allDay = allDay,
                            location = c.getString(5),
                        )
                    }
                }
        }
        result
    }
}

/** Abre apps instalados pelo nome exibido no launcher. */
class AndroidAppLauncher(private val context: Context) : AppLauncher {
    override suspend fun open(appName: String): AppLaunchResult {
        val pm = context.packageManager
        val query = PtText.fold(appName).trim()
        val apps = withContext(Dispatchers.IO) {
            pm.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0)
                .map { it.activityInfo.packageName to PtText.fold(it.loadLabel(pm).toString()).trim() }
                .filter { it.first != context.packageName }
                .distinctBy { it.first }
        }
        val exact = apps.filter { it.second == query }
        val candidates = exact.ifEmpty { apps.filter { it.second.contains(query) } }
        if (candidates.isEmpty()) return AppLaunchResult.NOT_FOUND
        if (candidates.size > 1) return AppLaunchResult.AMBIGUOUS
        val launch = pm.getLaunchIntentForPackage(candidates.single().first) ?: return AppLaunchResult.NOT_FOUND
        return withContext(Dispatchers.Main) {
            runCatching {
                context.startActivity(launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                AppLaunchResult.OPENED
            }.getOrDefault(AppLaunchResult.NOT_FOUND)
        }
    }
}

class AndroidCapabilities(private val context: Context, private val scheduler: AlarmReminderScheduler) : DeviceCapabilities {
    override suspend fun notificationsAllowed() = Notifications.canPost(context)
    override suspend fun exactAlarmsAllowed() = scheduler.canScheduleExact()
}

class AndroidConnectivity(context: Context) : Connectivity {
    private val cm = context.getSystemService(ConnectivityManager::class.java)
    override fun isOnline(): Boolean {
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }
}
