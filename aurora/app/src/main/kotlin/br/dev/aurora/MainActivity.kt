package br.dev.aurora

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import br.dev.aurora.ui.AuroraRoot
import br.dev.aurora.ui.LaunchRequest
import br.dev.aurora.ui.theme.AuroraTheme
import kotlinx.coroutines.flow.MutableStateFlow

class MainActivity : ComponentActivity() {
    private val launchRequest = MutableStateFlow<LaunchRequest?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (savedInstanceState == null) handleIntent(intent)
        setContent {
            AuroraTheme {
                AuroraRoot(launchRequest = launchRequest, onLaunchHandled = { launchRequest.value = null })
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        launchRequest.value = when (intent?.action) {
            ACTION_LISTEN, Intent.ACTION_ASSIST -> LaunchRequest.Listen
            ACTION_NEW_TASK -> LaunchRequest.NewTask
            ACTION_OPEN_REMINDERS -> LaunchRequest.Reminders
            else -> null
        }
    }

    companion object {
        const val ACTION_LISTEN = "br.dev.aurora.action.LISTEN"
        const val ACTION_NEW_TASK = "br.dev.aurora.action.NEW_TASK"
        const val ACTION_OPEN_REMINDERS = "br.dev.aurora.action.OPEN_REMINDERS"
    }
}
