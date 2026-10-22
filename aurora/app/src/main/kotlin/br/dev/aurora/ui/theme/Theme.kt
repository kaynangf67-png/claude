package br.dev.aurora.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import br.dev.aurora.data.settings.ThemeMode

/** Cores próprias da Aurora, com uma versão para cada tema (contraste verificado para texto sobre o fundo). */
@Immutable
data class AuroraPalette(
    val background: Color,
    val surface: Color,
    val surfaceHigh: Color,
    val outline: Color,
    val blue: Color,
    val violet: Color,
    val text: Color,
    val textMuted: Color,
    val error: Color,
    val success: Color,
    val warning: Color,
    val isDark: Boolean,
)

val DarkPalette = AuroraPalette(
    background = Color(0xFF0B1020),
    surface = Color(0xFF121A2E),
    surfaceHigh = Color(0xFF1A2340),
    outline = Color(0xFF2B3557),
    blue = Color(0xFF8EA2FF),
    violet = Color(0xFFB79CFF),
    text = Color(0xFFE8EBF7),
    textMuted = Color(0xFFA4ACC8),
    error = Color(0xFFFF8E8E),
    success = Color(0xFF7FD8B0),
    warning = Color(0xFFFFCF86),
    isDark = true,
)

val LightPalette = AuroraPalette(
    background = Color(0xFFF5F6FB),
    surface = Color(0xFFFFFFFF),
    surfaceHigh = Color(0xFFECEEF7),
    outline = Color(0xFFC9CEE0),
    blue = Color(0xFF3B4CC0),
    violet = Color(0xFF6A4DC4),
    text = Color(0xFF141831),
    textMuted = Color(0xFF545C78),
    error = Color(0xFFB3261E),
    success = Color(0xFF1B7A50),
    warning = Color(0xFF8A5300),
    isDark = false,
)

private val LocalAuroraPalette = staticCompositionLocalOf { DarkPalette }

/** Acesso às cores do tema atual (claro ou escuro). */
object AuroraColors {
    val Background: Color @Composable @ReadOnlyComposable get() = LocalAuroraPalette.current.background
    val Surface: Color @Composable @ReadOnlyComposable get() = LocalAuroraPalette.current.surface
    val SurfaceHigh: Color @Composable @ReadOnlyComposable get() = LocalAuroraPalette.current.surfaceHigh
    val Outline: Color @Composable @ReadOnlyComposable get() = LocalAuroraPalette.current.outline
    val Blue: Color @Composable @ReadOnlyComposable get() = LocalAuroraPalette.current.blue
    val Violet: Color @Composable @ReadOnlyComposable get() = LocalAuroraPalette.current.violet
    val Text: Color @Composable @ReadOnlyComposable get() = LocalAuroraPalette.current.text
    val TextMuted: Color @Composable @ReadOnlyComposable get() = LocalAuroraPalette.current.textMuted
    val Error: Color @Composable @ReadOnlyComposable get() = LocalAuroraPalette.current.error
    val Success: Color @Composable @ReadOnlyComposable get() = LocalAuroraPalette.current.success
    val Warning: Color @Composable @ReadOnlyComposable get() = LocalAuroraPalette.current.warning
    val isDark: Boolean @Composable @ReadOnlyComposable get() = LocalAuroraPalette.current.isDark
}


private fun scheme(p: AuroraPalette): ColorScheme = if (p.isDark) {
    darkColorScheme(
        primary = p.blue,
        onPrimary = Color(0xFF0B1020),
        primaryContainer = Color(0xFF26306A),
        onPrimaryContainer = Color(0xFFDDE2FF),
        secondary = p.violet,
        onSecondary = Color(0xFF1A1033),
        secondaryContainer = Color(0xFF34285E),
        onSecondaryContainer = Color(0xFFEBDFFF),
        background = p.background,
        onBackground = p.text,
        surface = p.surface,
        onSurface = p.text,
        surfaceVariant = p.surfaceHigh,
        onSurfaceVariant = p.textMuted,
        surfaceContainer = p.surface,
        surfaceContainerHigh = p.surfaceHigh,
        surfaceContainerHighest = Color(0xFF222C4D),
        surfaceContainerLow = Color(0xFF0F1628),
        outline = p.outline,
        outlineVariant = Color(0xFF222B48),
        error = p.error,
        onError = Color(0xFF2A0B0B),
    )
} else {
    lightColorScheme(
        primary = p.blue,
        onPrimary = Color.White,
        primaryContainer = Color(0xFFDDE1FF),
        onPrimaryContainer = Color(0xFF101A5C),
        secondary = p.violet,
        onSecondary = Color.White,
        secondaryContainer = Color(0xFFE8DEFF),
        onSecondaryContainer = Color(0xFF24104F),
        background = p.background,
        onBackground = p.text,
        surface = p.surface,
        onSurface = p.text,
        surfaceVariant = p.surfaceHigh,
        onSurfaceVariant = p.textMuted,
        surfaceContainer = p.surface,
        surfaceContainerHigh = p.surfaceHigh,
        surfaceContainerHighest = Color(0xFFE3E6F2),
        surfaceContainerLow = Color(0xFFF0F2F9),
        outline = p.outline,
        outlineVariant = Color(0xFFDDE1EE),
        error = p.error,
        onError = Color.White,
    )
}

private val base = Typography()
private val typography = base.copy(
    displaySmall = base.displaySmall.copy(fontWeight = FontWeight.SemiBold, letterSpacing = (-0.5).sp),
    headlineSmall = base.headlineSmall.copy(fontWeight = FontWeight.SemiBold),
    titleLarge = base.titleLarge.copy(fontWeight = FontWeight.SemiBold),
    titleMedium = base.titleMedium.copy(fontWeight = FontWeight.SemiBold),
    labelLarge = base.labelLarge.copy(fontWeight = FontWeight.Medium),
    bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 24.sp),
)

@Composable
fun isDarkTheme(mode: ThemeMode): Boolean = when (mode) {
    ThemeMode.SYSTEM -> isSystemInDarkTheme()
    ThemeMode.LIGHT -> false
    ThemeMode.DARK -> true
}

@Composable
fun AuroraTheme(dark: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    val palette = if (dark) DarkPalette else LightPalette
    CompositionLocalProvider(LocalAuroraPalette provides palette) {
        MaterialTheme(colorScheme = scheme(palette), typography = typography, content = content)
    }
}
