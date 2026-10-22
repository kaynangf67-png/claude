package br.dev.aurora.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Create
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.FabPosition
import androidx.compose.material3.FloatingActionButton
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
import androidx.compose.ui.res.painterResource
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import br.dev.aurora.R
import br.dev.aurora.ui.conversation.ConversationScreen
import br.dev.aurora.ui.focus.FocusHubScreen
import br.dev.aurora.ui.focus.FocusSection
import br.dev.aurora.ui.home.HomeScreen
import br.dev.aurora.ui.memory.MemoryScreen
import br.dev.aurora.ui.projects.ProjectsScreen
import br.dev.aurora.ui.settings.SettingsScreen
import kotlinx.coroutines.flow.StateFlow

/** Pedido vindo de fora da UI: atalho do launcher, gesto de assistente ou notificação. */
sealed interface LaunchRequest {
    data object Listen : LaunchRequest
    data object NewTask : LaunchRequest
    data object Reminders : LaunchRequest
}

object Routes {
    const val HOME = "inicio"
    const val FOCUS = "foco?secao={secao}&nova={nova}&novo={novo}"
    const val NOTEBOOK = "caderno?nota={nota}"
    const val PROJECTS = "projetos"
    const val SETTINGS = "configuracoes"
    const val CONVERSATION = "conversa?ouvir={ouvir}&texto={texto}"

    fun focus(section: FocusSection = FocusSection.TASKS, newTask: Boolean = false, newReminder: Boolean = false) =
        "foco?secao=${section.name}&nova=$newTask&novo=$newReminder"
    fun notebook(newNote: Boolean = false) = "caderno?nota=$newNote"
    fun conversation(listen: Boolean = false, text: String = "") =
        "conversa?ouvir=$listen&texto=${android.net.Uri.encode(text)}"
}

private data class Tab(val route: String, val base: String, val label: String, val icon: ImageVector)

private val tabs = listOf(
    Tab(Routes.HOME, "inicio", "Início", Icons.Filled.Home),
    Tab(Routes.focus(), "foco", "Foco", Icons.Filled.CheckCircle),
    Tab(Routes.notebook(), "caderno", "Caderno", Icons.Filled.Create),
    Tab(Routes.PROJECTS, "projetos", "Projetos", Icons.AutoMirrored.Filled.List),
    Tab(Routes.SETTINGS, "configuracoes", "Configurações", Icons.Filled.Settings),
)

@Composable
fun AuroraRoot(launchRequest: StateFlow<LaunchRequest?>, onLaunchHandled: () -> Unit) {
    val nav = rememberNavController()
    val request by launchRequest.collectAsState()
    LaunchedEffect(request) {
        when (request) {
            LaunchRequest.Listen -> nav.navigate(Routes.conversation(listen = true)) { launchSingleTop = true }
            LaunchRequest.NewTask -> nav.navigateTab(Routes.focus(FocusSection.TASKS, newTask = true))
            LaunchRequest.Reminders -> nav.navigateTab(Routes.focus(FocusSection.REMINDERS))
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
                            label = { Text(tab.label, maxLines = 1) },
                            colors = NavigationBarItemDefaults.colors(indicatorColor = MaterialTheme.colorScheme.primaryContainer),
                        )
                    }
                }
            }
        },
        // Falar/capturar sempre à mão, no centro (os botões "+" de cada tela ficam à direita).
        floatingActionButton = {
            if (showBar) {
                FloatingActionButton(
                    onClick = { nav.navigate(Routes.conversation(listen = true)) },
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ) { Icon(painterResource(R.drawable.ic_mic), contentDescription = "Falar com a Aurora") }
            }
        },
        floatingActionButtonPosition = FabPosition.Center,
    ) { padding ->
        NavHost(nav, startDestination = Routes.HOME, modifier = Modifier.padding(padding)) {
            composable(Routes.HOME) {
                HomeScreen(
                    onTalk = { nav.navigate(Routes.conversation(listen = true)) },
                    onAsk = { text -> nav.navigate(Routes.conversation(text = text)) },
                    onOpenSettings = { nav.navigateTab(Routes.SETTINGS) },
                    onOpenTasks = { nav.navigateTab(Routes.focus(FocusSection.TASKS, newTask = it)) },
                    onOpenReminders = { nav.navigateTab(Routes.focus(FocusSection.REMINDERS, newReminder = it)) },
                    onOpenAgenda = { nav.navigateTab(Routes.focus(FocusSection.AGENDA)) },
                    onNewNote = { nav.navigateTab(Routes.notebook(newNote = true)) },
                )
            }
            composable(
                Routes.FOCUS,
                arguments = listOf(
                    navArgument("secao") { type = NavType.StringType; defaultValue = FocusSection.TASKS.name },
                    navArgument("nova") { type = NavType.BoolType; defaultValue = false },
                    navArgument("novo") { type = NavType.BoolType; defaultValue = false },
                ),
            ) {
                val section = FocusSection.entries.firstOrNull { s -> s.name == it.arguments?.getString("secao") } ?: FocusSection.TASKS
                FocusHubScreen(
                    initial = section,
                    openNewTask = it.arguments?.getBoolean("nova") == true,
                    openNewReminder = it.arguments?.getBoolean("novo") == true,
                    onAskPlan = { text -> nav.navigate(Routes.conversation(text = text)) },
                )
            }
            composable(Routes.NOTEBOOK, arguments = listOf(navArgument("nota") { type = NavType.BoolType; defaultValue = false })) {
                MemoryScreen(openNewNote = it.arguments?.getBoolean("nota") == true)
            }
            composable(Routes.PROJECTS) { ProjectsScreen() }
            composable(Routes.SETTINGS) { SettingsScreen() }
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
