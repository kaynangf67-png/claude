package br.dev.aurora.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

object AuroraColors {
    val Background = Color(0xFF0B1020)
    val Surface = Color(0xFF121A2E)
    val SurfaceHigh = Color(0xFF1A2340)
    val Outline = Color(0xFF2B3557)
    val Blue = Color(0xFF8EA2FF)
    val Violet = Color(0xFFB79CFF)
    val Text = Color(0xFFE8EBF7)
    val TextMuted = Color(0xFFA4ACC8)
    val Error = Color(0xFFFF8E8E)
    val Success = Color(0xFF7FD8B0)
    val Warning = Color(0xFFFFCF86)
}

private val colors = darkColorScheme(
    primary = AuroraColors.Blue,
    onPrimary = Color(0xFF0B1020),
    primaryContainer = Color(0xFF26306A),
    onPrimaryContainer = Color(0xFFDDE2FF),
    secondary = AuroraColors.Violet,
    onSecondary = Color(0xFF1A1033),
    secondaryContainer = Color(0xFF34285E),
    onSecondaryContainer = Color(0xFFEBDFFF),
    background = AuroraColors.Background,
    onBackground = AuroraColors.Text,
    surface = AuroraColors.Surface,
    onSurface = AuroraColors.Text,
    surfaceVariant = AuroraColors.SurfaceHigh,
    onSurfaceVariant = AuroraColors.TextMuted,
    surfaceContainer = AuroraColors.Surface,
    surfaceContainerHigh = AuroraColors.SurfaceHigh,
    surfaceContainerHighest = Color(0xFF222C4D),
    surfaceContainerLow = Color(0xFF0F1628),
    outline = AuroraColors.Outline,
    outlineVariant = Color(0xFF222B48),
    error = AuroraColors.Error,
    onError = Color(0xFF2A0B0B),
)

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
fun AuroraTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = colors, typography = typography, content = content)
}
