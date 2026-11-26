package com.example.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.PlaylistAdd
import androidx.compose.material.icons.automirrored.rounded.PlaylistPlay
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Album
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.FilterList
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.SmartDisplay
import androidx.compose.material.icons.rounded.VideoLibrary
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.example.data.local.DownloadEntity
import com.example.data.local.PlaylistEntity
import com.example.data.local.PlaylistEntryEntity
import com.example.model.DownloadStatus
import com.example.model.VideoItem
import com.example.model.VideoProvider
import com.example.ui.theme.MetaEmerald
import com.example.ui.theme.MetaGold
import com.example.ui.theme.MetaRedBadge
import com.example.util.MetaTubeStrings

@Composable
fun MyFilesScreen(
    initialTab: Int,
    activeDownloads: List<DownloadEntity>,
    completedDownloads: List<DownloadEntity>,
    playlists: List<PlaylistEntity>,
    allPlaylistItems: List<PlaylistEntryEntity>,
    strings: MetaTubeStrings,
    onPauseDownload: (String) -> Unit,
    onResumeDownload: (String) -> Unit,
    onDeleteDownload: (String) -> Unit,
    onPlayCompleted: (DownloadEntity) -> Unit,
    onShareCompleted: (DownloadEntity) -> Unit,
    onAddCompletedToPlaylist: (VideoItem) -> Unit,
    onCreatePlaylist: (String, String) -> Unit,
    onRenamePlaylist: (PlaylistEntity, String) -> Unit,
    onDeletePlaylist: (String) -> Unit,
    onPlayPlaylist: (List<PlaylistEntryEntity>, Int) -> Unit,
    onRemovePlaylistEntry: (String) -> Unit
) {
    var selectedSubTab by remember(initialTab) { mutableIntStateOf(initialTab) } // 0=Downloads, 1=Playlists
    var openedPlaylistId by remember { mutableStateOf<String?>(null) }

    if (openedPlaylistId != null) {
        val playlist = playlists.firstOrNull { it.id == openedPlaylistId }
        if (playlist != null) {
            BackHandler { openedPlaylistId = null }
            PlaylistDetailView(
                playlist = playlist,
                entries = allPlaylistItems.filter { it.playlistId == playlist.id },
                strings = strings,
                onBack = { openedPlaylistId = null },
                onPlayAll = { idx ->
                    val items = allPlaylistItems.filter { it.playlistId == playlist.id }
                    onPlayPlaylist(items, idx)
                },
                onRemoveEntry = onRemovePlaylistEntry
            )
            return
        } else {
            openedPlaylistId = null
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
    ) {
        // Top Segmented Switcher: Downloads vs Playlists
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            listOf(strings.tabDownloads, strings.tabPlaylists).forEachIndexed { idx, label ->
                val active = selectedSubTab == idx
                Surface(
                    color = if (active) MetaGold else MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(22.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(42.dp)
                        .clickable { selectedSubTab = idx }
                        .testTag("myfiles_tab_$idx")
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            text = label,
                            color = if (active) Color(0xFF141414) else MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        if (selectedSubTab == 0) {
            DownloadsTabContent(
                activeDownloads = activeDownloads,
                completedDownloads = completedDownloads,
                strings = strings,
                onPause = onPauseDownload,
                onResume = onResumeDownload,
                onDelete = onDeleteDownload,
                onPlayCompleted = onPlayCompleted,
                onShareCompleted = onShareCompleted,
                onAddToPlaylist = onAddCompletedToPlaylist
            )
        } else {
            PlaylistsTabContent(
                playlists = playlists,
                allItems = allPlaylistItems,
                strings = strings,
                onOpenPlaylist = { openedPlaylistId = it.id },
                onCreatePlaylist = onCreatePlaylist,
                onRenamePlaylist = onRenamePlaylist,
                onDeletePlaylist = onDeletePlaylist
            )
        }
    }
}

@Composable
private fun DownloadsTabContent(
    activeDownloads: List<DownloadEntity>,
    completedDownloads: List<DownloadEntity>,
    strings: MetaTubeStrings,
    onPause: (String) -> Unit,
    onResume: (String) -> Unit,
    onDelete: (String) -> Unit,
    onPlayCompleted: (DownloadEntity) -> Unit,
    onShareCompleted: (DownloadEntity) -> Unit,
    onAddToPlaylist: (VideoItem) -> Unit
) {
    var filterMode by remember { mutableIntStateOf(0) } // 0=All, 1=Video, 2=MP3
    var showSearchBar by remember { mutableStateOf(false) }
    var searchFilterText by remember { mutableStateOf("") }
    var showFilterChips by remember { mutableStateOf(false) }

    val filteredCompleted = remember(completedDownloads, filterMode, searchFilterText) {
        completedDownloads.filter { item ->
            val matchesType = when (filterMode) {
                1 -> !item.isAudioOnly
                2 -> item.isAudioOnly
                else -> true
            }
            val matchesText = searchFilterText.isBlank() ||
                item.title.contains(searchFilterText, ignoreCase = true)
            matchesType && matchesText
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        // Downloading section matching Screenshot 6
        if (activeDownloads.isNotEmpty()) {
            item {
                Text(
                    text = strings.downloadingCount(activeDownloads.size),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp)
                )
            }
            items(activeDownloads, key = { it.id }) { item ->
                ActiveDownloadRow(
                    item = item,
                    strings = strings,
                    onPause = { onPause(item.id) },
                    onResume = { onResume(item.id) },
                    onDelete = { onDelete(item.id) }
                )
            }
        }

        // Downloaded Header + Filter/Search actions (Screenshot 6)
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = strings.downloadedSection,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    IconButton(onClick = { showFilterChips = !showFilterChips }) {
                        Icon(
                            imageVector = Icons.Rounded.FilterList,
                            contentDescription = "Filter",
                            tint = if (filterMode != 0) MetaGold else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    IconButton(onClick = { showSearchBar = !showSearchBar }) {
                        Icon(
                            imageVector = Icons.Rounded.Search,
                            contentDescription = "Search files",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            if (showFilterChips) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf(
                        0 to strings.filterAll,
                        1 to strings.filterVideo,
                        2 to strings.filterAudio
                    ).forEach { (idx, label) ->
                        FilterChip(
                            selected = filterMode == idx,
                            onClick = { filterMode = idx },
                            label = { Text(label) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = MetaGold.copy(alpha = 0.2f),
                                selectedLabelColor = MetaGold
                            )
                        )
                    }
                }
            }

            if (showSearchBar) {
                OutlinedTextField(
                    value = searchFilterText,
                    onValueChange = { searchFilterText = it },
                    placeholder = { Text(strings.searchPlaceholder) },
                    singleLine = true,
                    trailingIcon = {
                        if (searchFilterText.isNotEmpty()) {
                            IconButton(onClick = { searchFilterText = "" }) {
                                Icon(Icons.Rounded.Close, contentDescription = "Clear")
                            }
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp)
                )
            }
        }

        if (filteredCompleted.isEmpty() && activeDownloads.isEmpty()) {
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 32.dp, vertical = 48.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = Icons.Rounded.VideoLibrary,
                        contentDescription = null,
                        tint = MetaGold.copy(alpha = 0.7f),
                        modifier = Modifier.size(56.dp)
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                    Text(
                        text = strings.emptyDownloadsTitle,
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = strings.emptyDownloadsSubtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            items(filteredCompleted, key = { it.id }) { item ->
                CompletedDownloadRow(
                    item = item,
                    strings = strings,
                    onPlay = { onPlayCompleted(item) },
                    onShare = { onShareCompleted(item) },
                    onDelete = { onDelete(item.id) },
                    onAddToPlaylist = {
                        onAddToPlaylist(
                            VideoItem(
                                id = item.videoId,
                                title = item.title,
                                channelName = item.channelName,
                                thumbnailUrl = item.thumbnailUrl,
                                durationText = item.durationText,
                                provider = VideoProvider.entries.firstOrNull { it.displayName == item.providerName }
                                    ?: VideoProvider.YOUTUBE,
                                webpageUrl = item.sourceUrl
                            )
                        )
                    }
                )
            }
        }
    }
}

@Composable
private fun ActiveDownloadRow(
    item: DownloadEntity,
    strings: MetaTubeStrings,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onDelete: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .width(92.dp)
                .height(62.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)
        ) {
            AsyncImage(
                model = item.thumbnailUrl,
                contentDescription = item.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
            Surface(
                color = Color.Black.copy(alpha = 0.72f),
                shape = RoundedCornerShape(4.dp),
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(4.dp)
            ) {
                Text(
                    text = "${item.threadCount}T",
                    color = MetaGold,
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                )
            }
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.title,
                style = MaterialTheme.typography.titleSmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(modifier = Modifier.height(6.dp))
            LinearProgressIndicator(
                progress = { (item.progressPercent / 100f).coerceIn(0f, 1f) },
                color = if (item.status == DownloadStatus.FAILED) MetaRedBadge else MetaGold,
                trackColor = MaterialTheme.colorScheme.surfaceVariant,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(3.dp)
                    .clip(RoundedCornerShape(2.dp))
            )
            Spacer(modifier = Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                val statusText = when (item.status) {
                    DownloadStatus.DOWNLOADING -> "${strings.statusDownloading} • ${formatSpeed(item.speedBytesPerSec)}"
                    DownloadStatus.PAUSED -> strings.statusPaused
                    DownloadStatus.QUEUED -> strings.statusQueued
                    DownloadStatus.FAILED -> strings.statusFailed
                    DownloadStatus.COMPLETED -> strings.statusCompleted
                }
                Text(
                    text = statusText,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (item.status == DownloadStatus.FAILED) MetaRedBadge else MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                Text(
                    text = String.format("%.1f%%", item.progressPercent),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(modifier = Modifier.width(4.dp))

        when (item.status) {
            DownloadStatus.DOWNLOADING, DownloadStatus.QUEUED -> {
                IconButton(onClick = onPause) {
                    Icon(Icons.Rounded.Pause, contentDescription = strings.pause, tint = MetaGold)
                }
            }
            DownloadStatus.PAUSED -> {
                IconButton(onClick = onResume) {
                    Icon(Icons.Rounded.PlayArrow, contentDescription = strings.resume, tint = MetaGold)
                }
            }
            DownloadStatus.FAILED -> {
                IconButton(onClick = onResume) {
                    Icon(Icons.Rounded.Refresh, contentDescription = strings.retry, tint = MetaRedBadge)
                }
            }
            else -> Unit
        }
        IconButton(onClick = onDelete) {
            Icon(
                Icons.Rounded.Close,
                contentDescription = strings.cancel,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(18.dp)
            )
        }
    }
}

@Composable
private fun CompletedDownloadRow(
    item: DownloadEntity,
    strings: MetaTubeStrings,
    onPlay: () -> Unit,
    onShare: () -> Unit,
    onDelete: () -> Unit,
    onAddToPlaylist: () -> Unit
) {
    var menuOpen by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onPlay)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .width(92.dp)
                .height(62.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(Color.Black),
            contentAlignment = Alignment.Center
        ) {
            AsyncImage(
                model = item.thumbnailUrl,
                contentDescription = item.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
            if (item.isAudioOnly) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(Color.Black.copy(alpha = 0.65f))
                        .border(2.dp, Color.White.copy(alpha = 0.4f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Album,
                        contentDescription = "MP3",
                        tint = MetaGold,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "${item.title} (${item.formatLabel})",
                style = MaterialTheme.typography.titleSmall,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(modifier = Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = if (item.isAudioOnly) Icons.Rounded.MusicNote else Icons.Rounded.SmartDisplay,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(15.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                val sizeStr = formatBytes(item.totalBytes)
                val meta = listOf(item.durationText.ifBlank { "Offline" }, sizeStr).joinToString(" | ")
                Text(
                    text = meta,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Box {
            IconButton(onClick = { menuOpen = true }) {
                Icon(
                    imageVector = Icons.Rounded.MoreVert,
                    contentDescription = "Options",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                DropdownMenuItem(
                    text = { Text("Play Offline") },
                    leadingIcon = { Icon(Icons.Rounded.PlayArrow, null) },
                    onClick = { menuOpen = false; onPlay() }
                )
                DropdownMenuItem(
                    text = { Text(strings.addToPlaylist) },
                    leadingIcon = { Icon(Icons.AutoMirrored.Rounded.PlaylistAdd, null) },
                    onClick = { menuOpen = false; onAddToPlaylist() }
                )
                DropdownMenuItem(
                    text = { Text(strings.shareVideo) },
                    leadingIcon = { Icon(Icons.Rounded.Share, null) },
                    onClick = { menuOpen = false; onShare() }
                )
                DropdownMenuItem(
                    text = { Text(strings.delete, color = MetaRedBadge) },
                    leadingIcon = { Icon(Icons.Rounded.DeleteOutline, null, tint = MetaRedBadge) },
                    onClick = { menuOpen = false; onDelete() }
                )
            }
        }
    }
}

@Composable
private fun PlaylistsTabContent(
    playlists: List<PlaylistEntity>,
    allItems: List<PlaylistEntryEntity>,
    strings: MetaTubeStrings,
    onOpenPlaylist: (PlaylistEntity) -> Unit,
    onCreatePlaylist: (String, String) -> Unit,
    onRenamePlaylist: (PlaylistEntity, String) -> Unit,
    onDeletePlaylist: (String) -> Unit
) {
    var showCreateDialog by remember { mutableStateOf(false) }
    var renameTarget by remember { mutableStateOf<PlaylistEntity?>(null) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Button(
                onClick = { showCreateDialog = true },
                colors = ButtonDefaults.buttonColors(containerColor = MetaGold, contentColor = Color(0xFF141414)),
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .testTag("create_playlist_btn")
            ) {
                Icon(Icons.Rounded.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text(strings.createPlaylist, fontWeight = FontWeight.Bold)
            }
        }

        if (playlists.isEmpty()) {
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 40.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Rounded.PlaylistPlay,
                        contentDescription = null,
                        tint = MetaGold.copy(alpha = 0.7f),
                        modifier = Modifier.size(54.dp)
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(strings.emptyPlaylistsTitle, style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        strings.emptyPlaylistsSubtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            items(playlists, key = { it.id }) { pl ->
                val entries = allItems.filter { it.playlistId == pl.id }
                val cover = entries.firstOrNull()?.thumbnailUrl.orEmpty()
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(14.dp))
                        .clickable { onOpenPlaylist(pl) }
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant),
                            contentAlignment = Alignment.Center
                        ) {
                            if (cover.isNotBlank()) {
                                AsyncImage(
                                    model = cover,
                                    contentDescription = pl.name,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.fillMaxSize()
                                )
                            } else {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Rounded.PlaylistPlay,
                                    contentDescription = null,
                                    tint = MetaGold,
                                    modifier = Modifier.size(30.dp)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = pl.name,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = strings.tracksCount(entries.size),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        IconButton(onClick = { renameTarget = pl }) {
                            Icon(Icons.Rounded.Edit, contentDescription = "Rename", modifier = Modifier.size(18.dp))
                        }
                        if (pl.id != "favorites_default") {
                            IconButton(onClick = { onDeletePlaylist(pl.id) }) {
                                Icon(
                                    Icons.Rounded.DeleteOutline,
                                    contentDescription = strings.delete,
                                    tint = MetaRedBadge,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                        Icon(
                            imageVector = Icons.Rounded.ChevronRight,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }

    if (showCreateDialog) {
        var name by remember { mutableStateOf("") }
        var desc by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showCreateDialog = false },
            title = { Text(strings.createPlaylist) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text(strings.playlistNameHint) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = desc,
                        onValueChange = { desc = it },
                        label = { Text(strings.playlistDescHint) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    if (name.isNotBlank()) {
                        onCreatePlaylist(name, desc)
                        showCreateDialog = false
                    }
                }) {
                    Text(strings.save, color = MetaGold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showCreateDialog = false }) { Text(strings.cancel) }
            }
        )
    }

    renameTarget?.let { target ->
        var newName by remember { mutableStateOf(target.name) }
        AlertDialog(
            onDismissRequest = { renameTarget = null },
            title = { Text("Rename Playlist") },
            text = {
                OutlinedTextField(
                    value = newName,
                    onValueChange = { newName = it },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    if (newName.isNotBlank()) {
                        onRenamePlaylist(target, newName)
                        renameTarget = null
                    }
                }) { Text(strings.save, color = MetaGold) }
            },
            dismissButton = {
                TextButton(onClick = { renameTarget = null }) { Text(strings.cancel) }
            }
        )
    }
}

@Composable
private fun PlaylistDetailView(
    playlist: PlaylistEntity,
    entries: List<PlaylistEntryEntity>,
    strings: MetaTubeStrings,
    onBack: () -> Unit,
    onPlayAll: (Int) -> Unit,
    onRemoveEntry: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back")
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(playlist.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(
                    strings.tracksCount(entries.size),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (entries.isNotEmpty()) {
                Button(
                    onClick = { onPlayAll(0) },
                    colors = ButtonDefaults.buttonColors(containerColor = MetaGold, contentColor = Color(0xFF141414)),
                    shape = RoundedCornerShape(20.dp)
                ) {
                    Icon(Icons.Rounded.PlayArrow, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(strings.playAll)
                }
            }
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            itemsIndexed(entries, key = { _, e -> e.id }) { idx, entry ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(MaterialTheme.colorScheme.surface)
                        .clickable { onPlayAll(idx) }
                        .padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    AsyncImage(
                        model = entry.thumbnailUrl,
                        contentDescription = entry.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .width(86.dp)
                            .height(52.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color.Black)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(entry.title, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(
                            "${entry.channelName} • ${entry.durationText}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    IconButton(onClick = { onRemoveEntry(entry.id) }) {
                        Icon(Icons.Rounded.DeleteOutline, contentDescription = strings.delete, tint = MetaRedBadge)
                    }
                }
            }
        }
    }
}

private fun formatSpeed(bytesPerSec: Long): String {
    if (bytesPerSec <= 0L) return "0 KB/s"
    val kb = bytesPerSec / 1024.0
    val mb = kb / 1024.0
    return if (mb >= 1.0) String.format("%.1f MB/s", mb) else String.format("%.0f KB/s", kb)
}

private fun formatBytes(bytes: Long): String {
    if (bytes <= 0L) return "0 KB"
    val kb = bytes / 1024.0
    val mb = kb / 1024.0
    return if (mb >= 1.0) String.format("%.1f MB", mb) else String.format("%.1f KB", kb)
}
