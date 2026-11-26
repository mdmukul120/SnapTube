package com.example.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import com.example.model.ThemeMode

private val MetaTubeDarkColorScheme = darkColorScheme(
    primary = MetaGold,
    onPrimary = Color(0xFF141414),
    primaryContainer = Color(0xFF3D3100),
    onPrimaryContainer = MetaGoldBright,
    secondary = MetaCrimson,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFF44160A),
    onSecondaryContainer = Color(0xFFFFB59D),
    tertiary = MetaEmerald,
    onTertiary = Color(0xFF00210E),
    background = DarkBackground,
    onBackground = DarkTextPrimary,
    surface = DarkSurface,
    onSurface = DarkTextPrimary,
    surfaceVariant = DarkSurfaceElevated,
    onSurfaceVariant = DarkTextSecondary,
    surfaceContainerLow = DarkSurface,
    surfaceContainer = DarkSurfaceElevated,
    surfaceContainerHigh = DarkSurfaceVariant,
    outline = DarkBorder,
    outlineVariant = Color(0xFF28282E),
    error = MetaRedBadge,
    onError = Color.White
)

private val MetaTubeLightColorScheme = lightColorScheme(
    primary = Color(0xFFE0A800),
    onPrimary = Color(0xFF141414),
    primaryContainer = Color(0xFFFFF0B8),
    onPrimaryContainer = Color(0xFF3A2B00),
    secondary = MetaCrimson,
    onSecondary = Color.White,
    tertiary = Color(0xFF128C43),
    background = LightBackground,
    onBackground = LightTextPrimary,
    surface = LightSurface,
    onSurface = LightTextPrimary,
    surfaceVariant = LightSurfaceElevated,
    onSurfaceVariant = LightTextSecondary,
    surfaceContainerLow = LightSurface,
    surfaceContainer = LightSurfaceElevated,
    surfaceContainerHigh = LightSurfaceVariant,
    outline = LightBorder,
    outlineVariant = Color(0xFFEAEAF0),
    error = MetaRedBadge,
    onError = Color.White
)

val MetaTubeShapes = Shapes(
    extraSmall = RoundedCornerShape(6.dp),
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(32.dp)
)

@Composable
fun MetaTubeTheme(
    themeMode: ThemeMode = ThemeMode.DARK,
    content: @Composable () -> Unit
) {
    val useDark = when (themeMode) {
        ThemeMode.DARK -> true
        ThemeMode.LIGHT -> false
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
    }

    val colorScheme = if (useDark) MetaTubeDarkColorScheme else MetaTubeLightColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window
            if (window != null) {
                WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !useDark
                WindowCompat.getInsetsController(window, view).isAppearanceLightNavigationBars = !useDark
            }
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = MetaTubeTypography,
        shapes = MetaTubeShapes,
        content = content
    )
}
