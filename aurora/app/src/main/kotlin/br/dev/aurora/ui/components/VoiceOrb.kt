package br.dev.aurora.ui.components

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import br.dev.aurora.R
import br.dev.aurora.ui.theme.AuroraColors

enum class OrbMode { IDLE, LISTENING, PROCESSING, SPEAKING, UNAVAILABLE }

/**
 * Orbe de voz: anima de forma contida conforme o estado real do assistente. No modo LISTENING, o tamanho
 * acompanha o nível do microfone.
 */
@Composable
fun VoiceOrb(
    mode: OrbMode,
    level: Float,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    size: Dp = 168.dp,
    description: String,
) {
    val transition = rememberInfiniteTransition(label = "orb")
    val breathe by transition.animateFloat(
        initialValue = 0f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(if (mode == OrbMode.PROCESSING) 700 else 2600, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "breathe",
    )
    val rotation by transition.animateFloat(
        initialValue = 0f, targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(9000, easing = LinearEasing)),
        label = "rotation",
    )
    val voice by animateFloatAsState(if (mode == OrbMode.LISTENING) level else 0f, tween(120), label = "level")

    val (c1, c2) = when (mode) {
        OrbMode.UNAVAILABLE -> Color(0xFF3A4260) to Color(0xFF262D47)
        OrbMode.SPEAKING -> AuroraColors.Violet to AuroraColors.Blue
        else -> AuroraColors.Blue to AuroraColors.Violet
    }
    val pulse = when (mode) {
        OrbMode.IDLE -> 0.03f * breathe
        OrbMode.LISTENING -> 0.04f + 0.16f * voice
        OrbMode.PROCESSING -> 0.06f * breathe
        OrbMode.SPEAKING -> 0.08f * breathe
        OrbMode.UNAVAILABLE -> 0f
    }

    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .clickable(role = Role.Button, onClick = onClick)
            .semantics { contentDescription = description },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.size(size)) {
            val r = this.size.minDimension / 2f
            val core = r * (0.62f + pulse)
            // Halo
            drawCircle(
                brush = Brush.radialGradient(listOf(c1.copy(alpha = 0.28f), Color.Transparent), center, r),
                radius = r,
            )
            // Anel que gira lentamente
            val angle = Math.toRadians(rotation.toDouble())
            val ringCenter = Offset(center.x + (r * 0.04f * kotlin.math.cos(angle)).toFloat(), center.y + (r * 0.04f * kotlin.math.sin(angle)).toFloat())
            drawCircle(
                brush = Brush.sweepGradient(listOf(c1.copy(alpha = 0.7f), c2.copy(alpha = 0.15f), c1.copy(alpha = 0.7f)), ringCenter),
                radius = core + r * 0.1f,
                center = ringCenter,
                style = Stroke(width = r * 0.025f),
            )
            // Núcleo
            drawCircle(
                brush = Brush.radialGradient(
                    listOf(Color.White.copy(alpha = 0.85f), c1, c2.copy(alpha = 0.9f)),
                    center = Offset(center.x - core * 0.3f, center.y - core * 0.35f),
                    radius = core * 1.4f,
                ),
                radius = core,
            )
        }
        Icon(
            painter = painterResource(R.drawable.ic_mic),
            contentDescription = null,
            tint = Color(0xFF0B1020).copy(alpha = if (mode == OrbMode.UNAVAILABLE) 0.4f else 0.8f),
            modifier = Modifier.size(size * 0.22f),
        )
    }
}
