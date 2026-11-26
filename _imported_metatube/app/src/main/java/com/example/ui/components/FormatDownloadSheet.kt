package com.example.ui.components

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.PlaylistAdd
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.SystemUpdate
import androidx.compose.material.icons.rounded.Videocam
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.example.data.local.PlaylistEntity
import com.example.model.AppLanguage
import com.example.model.StreamFormat
import com.example.model.UpdateInfo
import com.example.model.VideoItem
import com.example.ui.theme.MetaGold
import com.example.ui.viewmodel.FormatPickerState
import com.example.util.MetaTubeStrings

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun FormatDownloadSheet(
    state: FormatPickerState,
    defaultThreads: Int,
    strings: MetaTubeStrings,
    onDismiss: () -> Unit,
    onStartDownload: (VideoItem, StreamFormat, Int) -> Unit,
    onAddToPlaylist: (VideoItem) -> Unit
) {
    if (!state.isVisible) return

    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var selectedThreads by remember(defaultThreads) { mutableIntStateOf(defaultThreads) }
    var selectedFormat by remember(state.resolvedMedia) {
        mutableStateOf(
            state.resolvedMedia?.videoFormats?.firstOrNull { it.qualityHeight == 720 }
                ?: state.resolvedMedia?.videoFormats?.firstOrNull()
                ?: state.resolvedMedia?.audioFormats?.firstOrNull()
        )
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.surface
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 18.dp)
                .padding(bottom = 28.dp)
        ) {
            if (state.fromShareSheet) {
                Surface(
                    color = MetaGold.copy(alpha = 0.16f),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 12.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Share,
                            contentDescription = null,
                            tint = MetaGold,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = strings.sharedViaPrompt,
                            color = MetaGold,
                            style = MaterialTheme.typography.labelLarge
                        )
                    }
                }
            }

            Text(
                text = strings.chooseFormatTitle,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface
            )

            Spacer(modifier = Modifier.height(12.dp))

            when {
                state.isLoading -> {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 36.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        CircularProgressIndicator(color = MetaGold)
                        Spacer(modifier = Modifier.height(14.dp))
                        Text(
                            text = strings.extractingStreams,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                state.resolvedMedia != null -> {
                    val media = state.resolvedMedia
                    val video = media.videoItem

                    // Header preview card
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                            .padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        AsyncImage(
                            model = video.thumbnailUrl,
                            contentDescription = video.title,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .width(106.dp)
                                .aspectRatio(16f / 9f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color.Black)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = video.title,
                                style = MaterialTheme.typography.titleSmall,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Surface(
                                    color = video.provider.brandColor.copy(alpha = 0.2f),
                                    shape = RoundedCornerShape(4.dp)
                                ) {
                                    Text(
                                        text = video.provider.displayName,
                                        color = video.provider.brandColor,
                                        style = MaterialTheme.typography.labelSmall,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                                if (video.durationText.isNotBlank()) {
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = video.durationText,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Multi-thread selector row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Rounded.Bolt,
                                contentDescription = null,
                                tint = MetaGold,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = strings.threadsLabel,
                                style = MaterialTheme.typography.labelLarge
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf(4, 8, 12, 16).forEach { count ->
                                val active = selectedThreads == count
                                Surface(
                                    color = if (active) MetaGold else MaterialTheme.colorScheme.surfaceVariant,
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.clickable { selectedThreads = count }
                                ) {
                                    Text(
                                        text = "${count}T",
                                        color = if (active) Color(0xFF141414) else MaterialTheme.colorScheme.onSurfaceVariant,
                                        style = MaterialTheme.typography.labelMedium,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Music / MP3 Audio Section
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Rounded.MusicNote,
                            contentDescription = null,
                            tint = MetaGold,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = strings.musicAudioSection,
                            style = MaterialTheme.typography.titleSmall,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        media.audioFormats.forEach { fmt ->
                            val isSelected = selectedFormat?.formatId == fmt.formatId
                            FormatOptionChip(
                                format = fmt,
                                isSelected = isSelected,
                                onClick = { selectedFormat = fmt }
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Video MP4 Resolutions Section
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Rounded.Videocam,
                            contentDescription = null,
                            tint = MetaGold,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = strings.videoSection,
                            style = MaterialTheme.typography.titleSmall,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        media.videoFormats.forEach { fmt ->
                            val isSelected = selectedFormat?.formatId == fmt.formatId
                            FormatOptionChip(
                                format = fmt,
                                isSelected = isSelected,
                                onClick = { selectedFormat = fmt }
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    // Action Row: Add to Playlist + Primary Download CTA
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            color = MaterialTheme.colorScheme.surfaceVariant,
                            shape = RoundedCornerShape(28.dp),
                            modifier = Modifier
                                .height(50.dp)
                                .clickable { onAddToPlaylist(video) }
                        ) {
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier.padding(horizontal = 16.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Rounded.PlaylistAdd,
                                    contentDescription = strings.addToPlaylist,
                                    tint = MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }

                        Button(
                            onClick = {
                                val fmt = selectedFormat ?: media.videoFormats.firstOrNull() ?: media.audioFormats.firstOrNull()
                                if (fmt != null) {
                                    onStartDownload(video, fmt, selectedThreads)
                                }
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MetaGold,
                                contentColor = Color(0xFF141414)
                            ),
                            shape = RoundedCornerShape(28.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(50.dp)
                                .testTag("confirm_start_download_btn")
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Download,
                                contentDescription = null,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "${strings.startDownload} (${selectedFormat?.resolutionTag ?: "720P"})",
                                style = MaterialTheme.typography.labelLarge,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
                else -> {
                    Text(
                        text = state.errorMessage ?: "Unable to resolve media link.",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(vertical = 20.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun FormatOptionChip(
    format: StreamFormat,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    val bg = if (isSelected) MetaGold.copy(alpha = 0.18f) else MaterialTheme.colorScheme.surfaceVariant
    val border = if (isSelected) MetaGold else MaterialTheme.colorScheme.outline

    Column(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(bg)
            .border(width = if (isSelected) 1.5.dp else 0.75.dp, color = border, shape = RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp)
            .testTag("format_chip_${format.formatId}"),
        horizontalAlignment = Alignment.Start
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = format.resolutionTag,
                style = MaterialTheme.typography.labelLarge,
                color = if (isSelected) MetaGold else MaterialTheme.colorScheme.onSurface
            )
            if (format.qualityHeight >= 720) {
                Spacer(modifier = Modifier.width(4.dp))
                Surface(
                    color = MetaGold,
                    shape = RoundedCornerShape(3.dp)
                ) {
                    Text(
                        text = if (format.qualityHeight >= 2160) "4K" else "HD",
                        color = Color(0xFF141414),
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                    )
                }
            }
        }
        Spacer(modifier = Modifier.height(2.dp))
        Text(
            text = format.formattedSize,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
fun AddToPlaylistDialog(
    video: VideoItem?,
    playlists: List<PlaylistEntity>,
    strings: MetaTubeStrings,
    onDismiss: () -> Unit,
    onSelectPlaylist: (String, VideoItem) -> Unit,
    onCreatePlaylist: (String) -> Unit
) {
    if (video == null) return
    var showInlineCreate by remember { mutableStateOf(false) }
    var newName by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = strings.addToPlaylist) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                playlists.forEach { pl ->
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onSelectPlaylist(pl.id, video) }
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Rounded.PlaylistAdd,
                                contentDescription = null,
                                tint = MetaGold
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = pl.name,
                                style = MaterialTheme.typography.titleSmall
                            )
                        }
                    }
                }
                if (showInlineCreate) {
                    androidx.compose.material3.OutlinedTextField(
                        value = newName,
                        onValueChange = { newName = it },
                        label = { Text(strings.playlistNameHint) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                } else {
                    TextButton(onClick = { showInlineCreate = true }) {
                        Text("+ ${strings.createPlaylist}", color = MetaGold)
                    }
                }
            }
        },
        confirmButton = {
            if (showInlineCreate) {
                TextButton(
                    onClick = {
                        if (newName.isNotBlank()) {
                            onCreatePlaylist(newName)
                            showInlineCreate = false
                            newName = ""
                        }
                    }
                ) {
                    Text(strings.save, color = MetaGold)
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(strings.cancel)
            }
        }
    )
}

@Composable
fun UpdateCheckDialog(
    updateInfo: UpdateInfo?,
    isVisible: Boolean,
    language: AppLanguage,
    strings: MetaTubeStrings,
    onDismiss: () -> Unit
) {
    if (!isVisible || updateInfo == null) return
    val context = LocalContext.current

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(
                imageVector = if (updateInfo.isUpdateAvailable) Icons.Rounded.SystemUpdate else Icons.Rounded.CheckCircle,
                contentDescription = null,
                tint = MetaGold,
                modifier = Modifier.size(34.dp)
            )
        },
        title = {
            Text(
                text = if (updateInfo.isUpdateAvailable) {
                    "MetaTube v${updateInfo.latestVersion} Available"
                } else {
                    if (language == AppLanguage.BN) "MetaTube আপ-টু-ডেট আছে" else "MetaTube is Up to Date"
                }
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Current: v${updateInfo.currentVersion} (${updateInfo.currentVersionCode}) • Latest: v${updateInfo.latestVersion}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MetaGold
                )
                Text(
                    text = if (language == AppLanguage.BN) updateInfo.releaseNotesBn else updateInfo.releaseNotesEn,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        },
        confirmButton = {
            if (updateInfo.isUpdateAvailable) {
                Button(
                    onClick = {
                        runCatching {
                            context.startActivity(
                                Intent(Intent.ACTION_VIEW, Uri.parse(updateInfo.downloadUrl))
                            )
                        }
                        onDismiss()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MetaGold, contentColor = Color(0xFF141414))
                ) {
                    Text(strings.downloadButton)
                }
            } else {
                TextButton(onClick = onDismiss) {
                    Text(strings.close, color = MetaGold)
                }
            }
        },
        dismissButton = {
            if (updateInfo.isUpdateAvailable) {
                TextButton(onClick = onDismiss) {
                    Text(strings.cancel)
                }
            }
        }
    )
}
