package br.dev.aurora

import android.app.Application
import br.dev.aurora.reminders.Notifications
import br.dev.aurora.reminders.RescheduleWorker

class AuroraApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        Notifications.createChannels(this)
        // Alarmes somem após "forçar parada"; recria a partir do banco a cada abertura do processo.
        RescheduleWorker.enqueue(this)
    }
}
