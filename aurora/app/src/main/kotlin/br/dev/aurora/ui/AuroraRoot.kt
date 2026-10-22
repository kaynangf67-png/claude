package br.dev.aurora.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import br.dev.aurora.ui.agenda.AgendaScreen
import br.dev.aurora.ui.conversation.ConversationScreen
import br.dev.aurora.ui.home.HomeScreen
import br.dev.aurora.ui.memory.MemoryScreen
import br.dev.aurora.ui.reminders.RemindersScreen
import br.dev.aurora.ui.settings.SettingsScreen
import br.dev.aurora.ui.tasks.TasksScreen
import kotlinx.coroutines.flow.StateFlow

/** Pedido vindo de fora da UI: atalho do launcher, gesto de assistente ou notificação. */
sealed interface LaunchRequest {
    data object Listen : LaunchRequest
    data object NewTask : LaunchRequest
    data object Reminders : LaunchRequest
}

object Routes {
    const val HOME = "inicio"
    const val AGENDA = "agenda"
    const val TASKS = "tarefas?nova={nova}"
    const val REMINDERS = "lembretes?novo={novo}"
    const val MEMORY = "memoria?nota={nota}"
    const val SETTINGS = "ajustes"
    const val CONVERSATION = "conversa?ouvir={ouvir}&texto={texto}"

    fun tasks(new: Boolean = false) = "tarefas?nova=$new"
    fun reminders(new: Boolean = false) = "lembretes?novo=$new"
    fun memory(newNote: Boolean = false) = "memoria?nota=$newNote"
    fun conversation(listen: Boolean = false, text: String = "") =
        "conversa?ouvir=$listen&texto=${android.net.Uri.encode(text)}"
}

private data class Tab(val route: String, val base: String, val label: String, val icon: ImageVector)

private val tabs = listOf(
    Tab(Routes.HOME, "inicio", "Início", Icons.Filled.Home),
    Tab(Routes.AGENDA, "agenda", "Agenda", Icons.Filled.DateRange),
    Tab(Routes.tasks(), "tarefas", "Tarefas", Icons.AutoMirrored.Filled.List),
    Tab(Routes.reminders(), "lembretes", "Lembretes", Icons.Filled.Notifications),
    Tab(Routes.memory(), "memoria", "Memória", Icons.Filled.Star),
)

@Composable
fun AuroraRoot(launchRequest: StateFlow<LaunchRequest?>, onLaunchHandled: () -> Unit) {
    val nav = rememberNavController()
    val request by launchRequest.collectAsState()
    LaunchedEffect(request) {
        when (request) {
            LaunchRequest.Listen -> nav.navigate(Routes.conversation(listen = true)) { launchSingleTop = true }
            LaunchRequest.NewTask -> nav.navigate(Routes.tasks(new = true)) { launchSingleTop = true }
            LaunchRequest.Reminders -> nav.navigate(Routes.reminders()) { launchSingleTop = true }
            null -> return@LaunchedEffect
        }
        onLaunchHandled()
    }

    val backStack by nav.currentBackStackEntryAsState()
    val currentBase = backStack?.destination?.route?.substringBefore('?')
    val showBar = tabs.any { it.base == currentBase }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            if (showBar) {
                NavigationBar(containerColor = MaterialTheme.colorScheme.surfaceContainerLow) {
                    tabs.forEach { tab ->
                        NavigationBarItem(
                            selected = currentBase == tab.base,
                            onClick = { nav.navigateTab(tab.route) },
                            icon = { Icon(tab.icon, contentDescription = null) },
                            label = { Text(tab.label) },
                            colors = NavigationBarItemDefaults.colors(indicatorColor = MaterialTheme.colorScheme.primaryContainer),
                        )
                    }
                }
            }
        },
    ) { padding ->
        NavHost(nav, startDestination = Routes.HOME, modifier = Modifier.padding(padding)) {
            composable(Routes.HOME) {
                HomeScreen(
                    onTalk = { nav.navigate(Routes.conversation(listen = true)) },
                    onAsk = { text -> nav.navigate(Routes.conversation(text = text)) },
                    onOpenSettings = { nav.navigate(Routes.SETTINGS) },
                    onOpenTasks = { nav.navigateTab(Routes.tasks(it)) },
                    onOpenReminders = { nav.navigateTab(Routes.reminders(it)) },
                    onOpenAgenda = { nav.navigateTab(Routes.AGENDA) },
                    onNewNote = { nav.navigateTab(Routes.memory(newNote = true)) },
                )
            }
            composable(Routes.AGENDA) {
                AgendaScreen(onAskPlan = { text -> nav.navigate(Routes.conversation(text = text)) })
            }
            composable(Routes.TASKS, arguments = listOf(navArgument("nova") { type = NavType.BoolType; defaultValue = false })) {
                TasksScreen(openNew = it.arguments?.getBoolean("nova") == true)
            }
            composable(Routes.REMINDERS, arguments = listOf(navArgument("novo") { type = NavType.BoolType; defaultValue = false })) {
                RemindersScreen(openNew = it.arguments?.getBoolean("novo") == true)
            }
            composable(Routes.MEMORY, arguments = listOf(navArgument("nota") { type = NavType.BoolType; defaultValue = false })) {
                MemoryScreen(openNewNote = it.arguments?.getBoolean("nota") == true)
            }
            composable(Routes.SETTINGS) { SettingsScreen(onBack = { nav.popBackStack() }) }
            composable(
                Routes.CONVERSATION,
                arguments = listOf(
                    navArgument("ouvir") { type = NavType.BoolType; defaultValue = false },
                    navArgument("texto") { type = NavType.StringType; defaultValue = "" },
                ),
            ) {
                ConversationScreen(
                    autoListen = it.arguments?.getBoolean("ouvir") == true,
                    initialText = it.arguments?.getString("texto").orEmpty(),
                    onBack = { nav.popBackStack() },
                    onOpenSettings = { nav.navigate(Routes.SETTINGS) },
                )
            }
        }
    }
}

private fun NavHostController.navigateTab(route: String) {
    navigate(route) {
        popUpTo(graph.findStartDestination().id) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}
