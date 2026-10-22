package br.dev.aurora

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import br.dev.aurora.data.settings.UserSettings
import br.dev.aurora.ui.AuroraRoot
import br.dev.aurora.ui.LaunchRequest
import br.dev.aurora.ui.theme.AuroraTheme
import br.dev.aurora.ui.theme.isDarkTheme
import kotlinx.coroutines.flow.MutableStateFlow

class MainActivity : ComponentActivity() {
    private val launchRequest = MutableStateFlow<LaunchRequest?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (savedInstanceState == null) handleIntent(intent)
        val settings = (application as AuroraApp).container.settings.settings
        setContent {
            val s by settings.collectAsStateWithLifecycle(initialValue = UserSettings())
            val dark = isDarkTheme(s.themeMode)
            // Ícones da barra de status/navegação acompanham o tema escolhido no app, não só o do sistema.
            LaunchedEffect(dark) {
                val transparent = Color.Transparent.toArgb()
                val style = if (dark) SystemBarStyle.dark(transparent) else SystemBarStyle.light(transparent, transparent)
                enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
            }
            AuroraTheme(dark = dark) {
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
