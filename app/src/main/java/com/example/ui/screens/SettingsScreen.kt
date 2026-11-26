package com.example.ui.screens

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.PlaylistPlay
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.CleaningServices
import androidx.compose.material.icons.rounded.ContentPaste
import androidx.compose.material.icons.rounded.DarkMode
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.Language
import androidx.compose.material.icons.rounded.NotificationsNone
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.SystemUpdate
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.BuildConfig
import com.example.data.local.UserSettings
import com.example.model.AppLanguage
import com.example.model.ThemeMode
import com.example.ui.theme.MetaGold
import com.example.util.MetaTubeStrings
import kotlin.math.roundToInt

@Composable
fun SettingsScreen(
    settings: UserSettings,
    strings: MetaTubeStrings,
    isCheckingUpdate: Boolean,
    onSetThemeMode: (ThemeMode) -> Unit,
    onSetLanguage: (AppLanguage) -> Unit,
    onSetDownloadThreads: (Int) -> Unit,
    onSetWifiOnly: (Boolean) -> Unit,
    onSetNotifications: (Boolean) -> Unit,
    onSetAutoUpdate: (Boolean) -> Unit,
    onSetClipboardDetector: (Boolean) -> Unit,
    onClearCache: () -> Unit,
    onCheckUpdatesNow: () -> Unit,
    onOpenPlaylists: () -> Unit,
    onTestShareDownload: () -> Unit
) {
    val context = LocalContext.current
    var showDownloadSettingsDialog by remember { mutableStateOf(false) }
    var showThemeDialog by remember { mutableStateOf(false) }
    var showLanguageDialog by remember { mutableStateOf(false) }
    var showShareGuideDialog by remember { mutableStateOf(false) }
    var showAboutDialog by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
    ) {
        Text(
            text = strings.settingsTitle,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 18.dp, vertical = 14.dp)
        )

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 28.dp)
        ) {
            // Section: General (matching Screenshots 1 & 8)
            item { SettingsSectionHeader(strings.sectionGeneral) }

            item {
                SettingsRowItem(
                    icon = Icons.Rounded.Download,
                    title = strings.downloadSettings,
                    trailingText = "${settings.downloadThreads} Threads",
                    onClick = { showDownloadSettingsDialog = true },
                    testTag = "settings_download_row"
                )
            }

            item {
                SettingsToggleItem(
                    icon = Icons.Rounded.NotificationsNone,
                    title = strings.notificationSettings,
                    checked = settings.notificationsEnabled,
                    onCheckedChange = onSetNotifications
                )
            }

            item {
                val themeLabel = when (settings.themeMode) {
                    ThemeMode.DARK -> strings.themeDark
                    ThemeMode.LIGHT -> strings.themeLight
                    ThemeMode.SYSTEM -> strings.themeSystem
                }
                SettingsRowItem(
                    icon = Icons.Rounded.DarkMode,
                    title = strings.themeTitle,
                    trailingText = themeLabel,
                    onClick = { showThemeDialog = true },
                    testTag = "settings_theme_row"
                )
            }

            // Section: Download Tools
            item { SettingsSectionHeader(strings.sectionDownloadTools) }

            item {
                SettingsRowItem(
                    icon = Icons.Rounded.Share,
                    title = strings.shareSheetDownloader,
                    trailingBadge = "ACTIVE",
                    onClick = { showShareGuideDialog = true },
                    testTag = "settings_share_downloader"
                )
            }

            item {
                SettingsToggleItem(
                    icon = Icons.Rounded.ContentPaste,
                    title = strings.clipboardDetector,
                    checked = settings.clipboardDetectorEnabled,
                    onCheckedChange = onSetClipboardDetector
                )
            }

            item {
                SettingsRowItem(
                    icon = Icons.AutoMirrored.Rounded.PlaylistPlay,
                    title = strings.playlistManager,
                    onClick = onOpenPlaylists
                )
            }

            item {
                SettingsRowItem(
                    icon = Icons.Rounded.CleaningServices,
                    title = strings.clearCache,
                    onClick = onClearCache
                )
            }

            // Section: Info & Auto-Update (matching Screenshot 8)
            item { SettingsSectionHeader(strings.sectionInfo) }

            item {
                SettingsRowItem(
                    icon = Icons.Rounded.Language,
                    title = strings.appLanguage,
                    trailingText = if (settings.language == AppLanguage.BN) "বাংলা" else "English",
                    onClick = { showLanguageDialog = true },
                    testTag = "settings_language_row"
                )
            }

            item {
                SettingsToggleItem(
                    icon = Icons.Rounded.SystemUpdate,
                    title = strings.autoUpdate,
                    checked = settings.autoUpdateEnabled,
                    onCheckedChange = onSetAutoUpdate
                )
            }

            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(enabled = !isCheckingUpdate, onClick = onCheckUpdatesNow)
                        .padding(horizontal = 18.dp, vertical = 14.dp)
                        .testTag("settings_check_update_btn"),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Bolt,
                        contentDescription = null,
                        tint = MetaGold,
                        modifier = Modifier.size(22.dp)
                    )
                    Spacer(modifier = Modifier.width(18.dp))
                    Text(
                        text = strings.checkUpdatesNow,
                        style = MaterialTheme.typography.bodyLarge,
                        modifier = Modifier.weight(1f)
                    )
                    if (isCheckingUpdate) {
                        CircularProgressIndicator(
                            color = MetaGold,
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(18.dp)
                        )
                    } else {
                        Text(
                            text = "v${BuildConfig.VERSION_NAME}",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Icon(
                            imageVector = Icons.Rounded.ChevronRight,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            item {
                SettingsRowItem(
                    icon = Icons.Rounded.Share,
                    title = strings.shareApp,
                    onClick = {
                        val intent = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(
                                Intent.EXTRA_TEXT,
                                "Download videos & MP3 in HD/4K with MetaTube v${BuildConfig.VERSION_NAME}"
                            )
                        }
                        context.startActivity(Intent.createChooser(intent, strings.shareApp))
                    }
                )
            }

            item {
                SettingsRowItem(
                    icon = Icons.Rounded.Info,
                    title = strings.aboutTitle,
                    trailingText = "v${BuildConfig.VERSION_NAME}",
                    onClick = { showAboutDialog = true }
                )
            }
        }
    }

    // Dialog: Download Multi-Thread Settings
    if (showDownloadSettingsDialog) {
        var sliderVal by remember { mutableFloatStateOf(settings.downloadThreads.toFloat()) }
        AlertDialog(
            onDismissRequest = { showDownloadSettingsDialog = false },
            title = { Text(strings.downloadSettings) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        text = "${strings.multiThreadCount}: ${sliderVal.roundToInt()} Threads",
                        style = MaterialTheme.typography.titleSmall,
                        color = MetaGold
                    )
                    Slider(
                        value = sliderVal,
                        onValueChange = { sliderVal = it },
                        valueRange = 1f..16f,
                        steps = 14,
                        colors = SliderDefaults.colors(thumbColor = MetaGold, activeTrackColor = MetaGold)
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(strings.wifiOnlyDownload, style = MaterialTheme.typography.bodyMedium)
                        Switch(
                            checked = settings.wifiOnly,
                            onCheckedChange = onSetWifiOnly,
                            colors = SwitchDefaults.colors(checkedTrackColor = MetaGold)
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    onSetDownloadThreads(sliderVal.roundToInt())
                    showDownloadSettingsDialog = false
                }) {
                    Text(strings.save, color = MetaGold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDownloadSettingsDialog = false }) { Text(strings.cancel) }
            }
        )
    }

    // Dialog: Theme Mode Picker
    if (showThemeDialog) {
        AlertDialog(
            onDismissRequest = { showThemeDialog = false },
            title = { Text(strings.themeTitle) },
            text = {
                Column {
                    listOf(
                        ThemeMode.DARK to strings.themeDark,
                        ThemeMode.LIGHT to strings.themeLight,
                        ThemeMode.SYSTEM to strings.themeSystem
                    ).forEach { (mode, label) ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    onSetThemeMode(mode)
                                    showThemeDialog = false
                                }
                                .padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(
                                selected = settings.themeMode == mode,
                                onClick = {
                                    onSetThemeMode(mode)
                                    showThemeDialog = false
                                },
                                colors = RadioButtonDefaults.colors(selectedColor = MetaGold)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(label, style = MaterialTheme.typography.bodyLarge)
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showThemeDialog = false }) { Text(strings.close, color = MetaGold) }
            }
        )
    }

    // Dialog: Language Picker
    if (showLanguageDialog) {
        AlertDialog(
            onDismissRequest = { showLanguageDialog = false },
            title = { Text(strings.appLanguage) },
            text = {
                Column {
                    listOf(
                        AppLanguage.BN to "বাংলা (Bengali)",
                        AppLanguage.EN to "English"
                    ).forEach { (lang, label) ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    onSetLanguage(lang)
                                    showLanguageDialog = false
                                }
                                .padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(
                                selected = settings.language == lang,
                                onClick = {
                                    onSetLanguage(lang)
                                    showLanguageDialog = false
                                },
                                colors = RadioButtonDefaults.colors(selectedColor = MetaGold)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(label, style = MaterialTheme.typography.bodyLarge)
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showLanguageDialog = false }) { Text(strings.close, color = MetaGold) }
            }
        )
    }

    // Dialog: Share Sheet Custom Download Guide & Live Preview
    if (showShareGuideDialog) {
        AlertDialog(
            onDismissRequest = { showShareGuideDialog = false },
            title = { Text(strings.shareSheetDownloader) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        text = strings.shareSheetDesc,
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Button(
                        onClick = {
                            showShareGuideDialog = false
                            onTestShareDownload()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MetaGold, contentColor = Color(0xFF141414)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(strings.testShareDownload, fontWeight = FontWeight.Bold)
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showShareGuideDialog = false }) { Text(strings.close, color = MetaGold) }
            }
        )
    }

    // Dialog: About
    if (showAboutDialog) {
        AlertDialog(
            onDismissRequest = { showAboutDialog = false },
            title = { Text("MetaTube v${BuildConfig.VERSION_NAME}") },
            text = {
                Text(
                    "Multi-provider HD/4K Video & MP3 Downloader with Media3 Offline Player, Multi-Thread Range Engine, Playlist Manager, Share Sheet Custom Download, and Auto-Update.",
                    style = MaterialTheme.typography.bodyMedium
                )
            },
            confirmButton = {
                TextButton(onClick = { showAboutDialog = false }) { Text(strings.close, color = MetaGold) }
            }
        )
    }
}

@Composable
private fun SettingsSectionHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 6.dp)
    )
}

@Composable
private fun SettingsRowItem(
    icon: ImageVector,
    title: String,
    trailingText: String? = null,
    trailingBadge: String? = null,
    onClick: () -> Unit,
    testTag: String? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .let { if (testTag != null) it.testTag(testTag) else it }
            .padding(horizontal = 18.dp, vertical = 15.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(22.dp)
        )
        Spacer(modifier = Modifier.width(18.dp))
        Text(
            text = title,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.weight(1f)
        )
        if (trailingBadge != null) {
            Surface(
                color = MetaGold,
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(
                    text = trailingBadge,
                    color = Color(0xFF141414),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                )
            }
            Spacer(modifier = Modifier.width(6.dp))
        }
        if (trailingText != null) {
            Text(
                text = trailingText,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.width(4.dp))
        }
        Icon(
            imageVector = Icons.Rounded.ChevronRight,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(20.dp)
        )
    }
}

@Composable
private fun SettingsToggleItem(
    icon: ImageVector,
    title: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onCheckedChange(!checked) }
            .padding(horizontal = 18.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(22.dp)
        )
        Spacer(modifier = Modifier.width(18.dp))
        Text(
            text = title,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.weight(1f)
        )
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color(0xFF141414),
                checkedTrackColor = MetaGold
            )
        )
    }
}
