package com.example.ui.screens

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.ActivityInfo
import android.os.Build
import android.view.View
import android.view.ViewGroup
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.PlaylistAdd
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.Fullscreen
import androidx.compose.material.icons.rounded.FullscreenExit
import androidx.compose.material.icons.rounded.Headphones
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.OfflinePin
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PictureInPictureAlt
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Public
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.SkipNext
import androidx.compose.material.icons.rounded.SkipPrevious
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import com.example.data.network.InnerTubeClient
import com.example.model.VideoItem
import com.example.model.VideoProvider
import com.example.player.MetaTubePlayerManager
import com.example.player.PlayerUiState
import com.example.ui.components.LargeVideoCard
import com.example.ui.theme.MetaEmerald
import com.example.ui.theme.MetaGold
import com.example.util.MetaTubeStrings

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun PlayerScreen(
    state: PlayerUiState,
    playerManager: MetaTubePlayerManager,
    strings: MetaTubeStrings,
    onBack: () -> Unit,
    onDownloadClick: (VideoItem) -> Unit,
    onAddToPlaylist: (VideoItem) -> Unit,
    onSelectRelatedVideo: (VideoItem, List<VideoItem>) -> Unit
) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    var showControls by remember { mutableStateOf(true) }
    var showCommentsExpanded by remember { mutableStateOf(false) }
    var showMoreMenu by remember { mutableStateOf(false) }
    var showOverlayMoreMenu by remember { mutableStateOf(false) }

    val video = state.currentVideo
    val isWebFallback = state.useWebEmbedFallback &&
        video != null &&
        video.provider == VideoProvider.YOUTUBE &&
        !state.isOfflinePlayback &&
        !state.isAudioOnlyMode

    BackHandler {
        if (state.isFullscreen) {
            playerManager.setFullscreen(false)
            (context as? Activity)?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        } else {
            onBack()
        }
    }

    DisposableEffect(state.isFullscreen) {
        val activity = context as? Activity
        val window = activity?.window
        val insetsController = window?.let { WindowCompat.getInsetsController(it, it.decorView) }
        if (state.isFullscreen) {
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            insetsController?.systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            insetsController?.hide(WindowInsetsCompat.Type.systemBars())
        } else {
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            insetsController?.show(WindowInsetsCompat.Type.systemBars())
        }
        onDispose {
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            insetsController?.show(WindowInsetsCompat.Type.systemBars())
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .let { if (!state.isFullscreen) it.statusBarsPadding().navigationBarsPadding() else it }
    ) {
        // Video Surface + Custom Dark/Gold Overlay Controls (matches Screenshot 5)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .let { if (state.isFullscreen) it.fillMaxSize() else it.aspectRatio(16f / 9f) }
                .background(Color.Black)
                .then(
                    if (!isWebFallback) {
                        Modifier.clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null
                        ) { showControls = !showControls }
                    } else {
                        Modifier
                    }
                )
        ) {
            if (isWebFallback) {
                val safeVideoId = video.id
                key(safeVideoId) {
                    var webViewRef by remember { mutableStateOf<WebView?>(null) }
                    DisposableEffect(safeVideoId) {
                        onDispose {
                            webViewRef?.apply {
                                stopLoading()
                                loadUrl("about:blank")
                                destroy()
                            }
                            webViewRef = null
                        }
                    }
                    AndroidView(
                        factory = { ctx ->
                            WebView(ctx).apply {
                                layoutParams = FrameLayout.LayoutParams(
                                    ViewGroup.LayoutParams.MATCH_PARENT,
                                    ViewGroup.LayoutParams.MATCH_PARENT
                                )
                                // Use software rendering only on software-GPU emulators; keep hardware acceleration on real devices
                                val isEmulator = Build.FINGERPRINT.contains("generic", ignoreCase = true) ||
                                    Build.HARDWARE.contains("ranchu", ignoreCase = true) ||
                                    Build.HARDWARE.contains("goldfish", ignoreCase = true)
                                if (isEmulator) {
                                    setLayerType(View.LAYER_TYPE_SOFTWARE, null)
                                }
                                setBackgroundColor(android.graphics.Color.BLACK)
                                settings.apply {
                                    javaScriptEnabled = true
                                    domStorageEnabled = true
                                    mediaPlaybackRequiresUserGesture = false
                                    loadWithOverviewMode = true
                                    useWideViewPort = true
                                    mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
                                }
                                webChromeClient = WebChromeClient()
                                webViewClient = object : WebViewClient() {
                                    override fun onRenderProcessGone(
                                        view: WebView?,
                                        detail: RenderProcessGoneDetail?
                                    ): Boolean {
                                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                            view?.let { wv ->
                                                (wv.parent as? ViewGroup)?.removeView(wv)
                                                wv.destroy()
                                            }
                                            webViewRef = null
                                            playerManager.onWebViewRendererCrashed()
                                            return true
                                        }
                                        return false
                                    }
                                }
                                val embedUrl = "https://www.youtube.com/embed/$safeVideoId?autoplay=1&playsinline=1&rel=0"
                                loadUrl(embedUrl, mapOf("Referer" to "https://www.youtube.com/"))
                                webViewRef = this
                            }
                        },
                        modifier = Modifier.fillMaxSize()
                    )
                }

                // Minimal top-left back button so WebView transport controls stay fully interactive
                IconButton(
                    onClick = {
                        if (state.isFullscreen) {
                            playerManager.setFullscreen(false)
                        } else {
                            onBack()
                        }
                    },
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(6.dp)
                        .clip(CircleShape)
                        .background(Color.Black.copy(alpha = 0.55f))
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                        contentDescription = "Back",
                        tint = Color.White
                    )
                }
            } else if (!state.isAudioOnlyMode) {
                AndroidView(
                    factory = { ctx ->
                        PlayerView(ctx).apply {
                            player = playerManager.exoPlayer
                            useController = false
                            layoutParams = FrameLayout.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                            )
                        }
                    },
                    update = { pv ->
                        if (pv.player !== playerManager.exoPlayer) {
                            pv.player = playerManager.exoPlayer
                        }
                    },
                    onRelease = { pv ->
                        pv.player = null
                    },
                    modifier = Modifier.fillMaxSize()
                )
                if (video != null && (state.isLoadingMetadata || state.errorMessage != null)) {
                    AsyncImage(
                        model = video.thumbnailUrl,
                        contentDescription = video.title,
                        contentScale = ContentScale.Crop,
                        alpha = 0.5f,
                        modifier = Modifier.fillMaxSize()
                    )
                }
            } else if (video != null) {
                // Audio-Only Mode Artwork Canvas
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    AsyncImage(
                        model = video.thumbnailUrl,
                        contentDescription = video.title,
                        contentScale = ContentScale.Crop,
                        alpha = 0.35f,
                        modifier = Modifier.fillMaxSize()
                    )
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(
                            modifier = Modifier
                                .size(72.dp)
                                .clip(CircleShape)
                                .background(MetaGold.copy(alpha = 0.22f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.MusicNote,
                                contentDescription = null,
                                tint = MetaGold,
                                modifier = Modifier.size(38.dp)
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = strings.audioMode,
                            color = MetaGold,
                            style = MaterialTheme.typography.labelLarge
                        )
                    }
                }
            }

            if ((state.isBuffering || state.isLoadingMetadata) && !isWebFallback) {
                CircularProgressIndicator(
                    color = MetaGold,
                    modifier = Modifier.align(Alignment.Center)
                )
            }

            // Custom Controls Overlay (only for native ExoPlayer / Audio-only mode)
            androidx.compose.animation.AnimatedVisibility(
                visible = !isWebFallback && (showControls || state.isAudioOnlyMode),
                modifier = Modifier.fillMaxSize()
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.42f))
                ) {
                    // Top Bar: Back, Minimize to Floating Bubble, More
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 6.dp, vertical = 4.dp)
                            .align(Alignment.TopCenter),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = {
                            if (state.isFullscreen) {
                                playerManager.setFullscreen(false)
                            } else {
                                onBack()
                            }
                        }) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                                contentDescription = "Back",
                                tint = Color.White
                            )
                        }

                        Row {
                            IconButton(onClick = onBack) {
                                Icon(
                                    imageVector = Icons.Rounded.PictureInPictureAlt,
                                    contentDescription = "Minimize to Mini Bubble",
                                    tint = Color.White
                                )
                            }
                            if (video != null) {
                                Box {
                                    IconButton(onClick = { showOverlayMoreMenu = true }) {
                                        Icon(
                                            imageVector = Icons.Rounded.MoreVert,
                                            contentDescription = "More",
                                            tint = Color.White
                                        )
                                    }
                                    DropdownMenu(
                                        expanded = showOverlayMoreMenu,
                                        onDismissRequest = { showOverlayMoreMenu = false }
                                    ) {
                                        DropdownMenuItem(
                                            text = { Text(strings.downloadButton) },
                                            leadingIcon = { Icon(Icons.Rounded.Download, contentDescription = null) },
                                            onClick = {
                                                showOverlayMoreMenu = false
                                                onDownloadClick(video)
                                            }
                                        )
                                        DropdownMenuItem(
                                            text = { Text(strings.addToPlaylist) },
                                            leadingIcon = { Icon(Icons.AutoMirrored.Rounded.PlaylistAdd, contentDescription = null) },
                                            onClick = {
                                                showOverlayMoreMenu = false
                                                onAddToPlaylist(video)
                                            }
                                        )
                                        DropdownMenuItem(
                                            text = { Text(strings.copyLink) },
                                            leadingIcon = { Icon(Icons.Rounded.ContentCopy, contentDescription = null) },
                                            onClick = {
                                                showOverlayMoreMenu = false
                                                clipboard.setText(AnnotatedString(video.webpageUrl))
                                                Toast.makeText(context, strings.copyLink, Toast.LENGTH_SHORT).show()
                                            }
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // Center Transport Controls
                    Row(
                        modifier = Modifier.align(Alignment.Center),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(28.dp)
                    ) {
                        IconButton(
                            onClick = { playerManager.playPreviousInQueue() },
                            enabled = state.queueIndex > 0
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.SkipPrevious,
                                contentDescription = "Previous",
                                tint = if (state.queueIndex > 0) Color.White else Color.White.copy(alpha = 0.35f),
                                modifier = Modifier.size(34.dp)
                            )
                        }
                        IconButton(
                            onClick = {
                                if (state.errorMessage != null) {
                                    playerManager.retryPlayback()
                                } else {
                                    playerManager.togglePlayPause()
                                }
                            },
                            modifier = Modifier
                                .size(56.dp)
                                .testTag("player_play_pause_btn")
                        ) {
                            Icon(
                                imageVector = when {
                                    state.errorMessage != null -> Icons.Rounded.Refresh
                                    state.isPlaying -> Icons.Rounded.Pause
                                    else -> Icons.Rounded.PlayArrow
                                },
                                contentDescription = "Play/Pause",
                                tint = Color.White,
                                modifier = Modifier.size(44.dp)
                            )
                        }
                        IconButton(
                            onClick = { playerManager.playNextInQueue() },
                            enabled = state.queueIndex < state.queue.lastIndex
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.SkipNext,
                                contentDescription = "Next",
                                tint = if (state.queueIndex < state.queue.lastIndex) Color.White else Color.White.copy(alpha = 0.35f),
                                modifier = Modifier.size(34.dp)
                            )
                        }
                    }

                    // Bottom Scrubber & Fullscreen Toggle
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .align(Alignment.BottomCenter)
                            .padding(horizontal = 10.dp, vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = InnerTubeClient.formatDuration(state.positionMs / 1000L),
                            color = Color.White,
                            style = MaterialTheme.typography.labelSmall
                        )
                        val dur = state.durationMs.coerceAtLeast(1L)
                        Slider(
                            value = (state.positionMs.toFloat() / dur.toFloat()).coerceIn(0f, 1f),
                            onValueChange = { frac ->
                                playerManager.seekTo((frac * dur).toLong())
                            },
                            colors = SliderDefaults.colors(
                                thumbColor = MetaGold,
                                activeTrackColor = MetaGold,
                                inactiveTrackColor = Color.White.copy(alpha = 0.3f)
                            ),
                            modifier = Modifier
                                .weight(1f)
                                .padding(horizontal = 8.dp)
                        )
                        Text(
                            text = InnerTubeClient.formatDuration(state.durationMs / 1000L),
                            color = Color.White,
                            style = MaterialTheme.typography.labelSmall
                        )
                        IconButton(
                            onClick = { playerManager.setFullscreen(!state.isFullscreen) }
                        ) {
                            Icon(
                                imageVector = if (state.isFullscreen) Icons.Rounded.FullscreenExit else Icons.Rounded.Fullscreen,
                                contentDescription = "Fullscreen",
                                tint = Color.White
                            )
                        }
                    }
                }
            }
        }

        if (state.isFullscreen || video == null) return

        // Scrollable Details, Gold Download CTA, Comments & Related Videos
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 24.dp)
        ) {
            // Video Title + Channel + Offline Badge
            item {
                Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp)) {
                    Row(verticalAlignment = Alignment.Top) {
                        Box(
                            modifier = Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.surfaceVariant),
                            contentAlignment = Alignment.Center
                        ) {
                            if (video.channelAvatarUrl.isNotBlank()) {
                                AsyncImage(
                                    model = video.channelAvatarUrl,
                                    contentDescription = video.channelName,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.fillMaxSize()
                                )
                            } else {
                                Text(
                                    text = video.channelName.take(1).uppercase(),
                                    color = MetaGold,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = video.title,
                                style = MaterialTheme.typography.titleSmall,
                                color = MaterialTheme.colorScheme.onBackground,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
                            )
                            Spacer(modifier = Modifier.height(3.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = video.channelName,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                if (state.isOfflinePlayback) {
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Surface(
                                        color = MetaEmerald.copy(alpha = 0.2f),
                                        shape = RoundedCornerShape(4.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Icon(
                                                imageVector = Icons.Rounded.OfflinePin,
                                                contentDescription = null,
                                                tint = MetaEmerald,
                                                modifier = Modifier.size(12.dp)
                                            )
                                            Spacer(modifier = Modifier.width(3.dp))
                                            Text(
                                                text = strings.offlineBadge,
                                                color = MetaEmerald,
                                                style = MaterialTheme.typography.labelSmall
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (!state.isOfflinePlayback && video.provider == VideoProvider.YOUTUBE) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            FilterChip(
                                selected = !state.useWebEmbedFallback,
                                onClick = { playerManager.setWebEmbedFallback(false) },
                                label = { Text("Direct Stream", style = MaterialTheme.typography.labelSmall) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = MetaGold.copy(alpha = 0.2f),
                                    selectedLabelColor = MetaGold
                                )
                            )
                            FilterChip(
                                selected = state.useWebEmbedFallback,
                                onClick = { playerManager.setWebEmbedFallback(true) },
                                leadingIcon = {
                                    Icon(
                                        imageVector = Icons.Rounded.Public,
                                        contentDescription = null,
                                        modifier = Modifier.size(15.dp)
                                    )
                                },
                                label = { Text("YT Web Player", style = MaterialTheme.typography.labelSmall) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = MetaGold.copy(alpha = 0.2f),
                                    selectedLabelColor = MetaGold,
                                    selectedLeadingIconColor = MetaGold
                                )
                            )
                        }
                    }

                    if (state.errorMessage != null && !isWebFallback) {
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = state.errorMessage,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Prominent Gold Download Pill Button + Headphones Audio Mode + More (Screenshot 5)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Button(
                            onClick = { onDownloadClick(video) },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MetaGold,
                                contentColor = Color(0xFF141414)
                            ),
                            shape = RoundedCornerShape(26.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp)
                                .testTag("player_download_cta")
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Download,
                                contentDescription = null,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = strings.downloadButton,
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        Spacer(modifier = Modifier.width(8.dp))

                        IconButton(
                            onClick = { playerManager.toggleAudioOnlyMode() },
                            modifier = Modifier
                                .minimumInteractiveComponentSize()
                                .clip(CircleShape)
                                .background(
                                    if (state.isAudioOnlyMode) MetaGold.copy(alpha = 0.22f)
                                    else Color.Transparent
                                )
                                .testTag("player_audio_mode_btn")
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Headphones,
                                contentDescription = strings.audioMode,
                                tint = if (state.isAudioOnlyMode) MetaGold else MaterialTheme.colorScheme.onSurface
                            )
                        }

                        Box {
                            IconButton(
                                onClick = { showMoreMenu = true },
                                modifier = Modifier.minimumInteractiveComponentSize()
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.MoreVert,
                                    contentDescription = "Options",
                                    tint = MaterialTheme.colorScheme.onSurface
                                )
                            }
                            DropdownMenu(
                                expanded = showMoreMenu,
                                onDismissRequest = { showMoreMenu = false }
                            ) {
                                DropdownMenuItem(
                                    text = { Text(strings.addToPlaylist) },
                                    leadingIcon = {
                                        Icon(Icons.AutoMirrored.Rounded.PlaylistAdd, contentDescription = null)
                                    },
                                    onClick = {
                                        showMoreMenu = false
                                        onAddToPlaylist(video)
                                    }
                                )
                                DropdownMenuItem(
                                    text = { Text(strings.shareVideo) },
                                    leadingIcon = {
                                        Icon(Icons.Rounded.Share, contentDescription = null)
                                    },
                                    onClick = {
                                        showMoreMenu = false
                                        val share = Intent(Intent.ACTION_SEND).apply {
                                            type = "text/plain"
                                            putExtra(Intent.EXTRA_TEXT, video.webpageUrl.ifBlank { video.title })
                                        }
                                        context.startActivity(Intent.createChooser(share, video.title))
                                    }
                                )
                                DropdownMenuItem(
                                    text = { Text(strings.copyLink) },
                                    leadingIcon = {
                                        Icon(Icons.Rounded.ContentCopy, contentDescription = null)
                                    },
                                    onClick = {
                                        showMoreMenu = false
                                        clipboard.setText(AnnotatedString(video.webpageUrl))
                                        Toast.makeText(context, strings.copyLink, Toast.LENGTH_SHORT).show()
                                    }
                                )
                            }
                        }
                    }
                }
            }

            // Expandable Comments Card (Screenshot 5)
            item {
                val comments = state.resolvedMedia?.comments.orEmpty()
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 4.dp)
                        .clickable { showCommentsExpanded = !showCommentsExpanded }
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text(
                            text = "${strings.commentsTitle} (${comments.size})",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        val preview = comments.firstOrNull()
                        if (preview != null) {
                            val listToShow = if (showCommentsExpanded) comments else listOf(preview)
                            listToShow.forEach { c ->
                                Row(
                                    modifier = Modifier.padding(vertical = 4.dp),
                                    verticalAlignment = Alignment.Top
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(26.dp)
                                            .clip(CircleShape)
                                            .background(Color(0xFF536DFE)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = c.author.take(1).uppercase(),
                                            color = Color.White,
                                            style = MaterialTheme.typography.labelSmall
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Column {
                                        Text(
                                            text = c.author,
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                        Text(
                                            text = c.text,
                                            style = MaterialTheme.typography.bodySmall,
                                            maxLines = if (showCommentsExpanded) 6 else 2,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                }
                            }
                        } else {
                            Text(
                                text = "Tap to view comments when online",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }

            // Related Videos
            val related = state.resolvedMedia?.relatedVideos.orEmpty()
            if (related.isNotEmpty()) {
                item {
                    Text(
                        text = strings.upNextTitle,
                        style = MaterialTheme.typography.titleSmall,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)
                    )
                }
                items(related, key = { it.id }) { item ->
                    LargeVideoCard(
                        video = item,
                        onClick = { onSelectRelatedVideo(item, related) },
                        onDownloadClick = { onDownloadClick(item) }
                    )
                }
            }
        }
    }
}
