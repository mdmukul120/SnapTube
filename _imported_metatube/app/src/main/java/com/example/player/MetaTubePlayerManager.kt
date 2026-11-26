package com.example.player

import android.content.Context
import android.net.Uri
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.source.MergingMediaSource
import com.example.data.local.MetaTubeDao
import com.example.data.network.MultiProviderExtractor
import com.example.model.ResolvedMedia
import com.example.model.StreamFormat
import com.example.model.VideoItem
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import java.io.File

data class PlayerUiState(
    val currentVideo: VideoItem? = null,
    val resolvedMedia: ResolvedMedia? = null,
    val isPlaying: Boolean = false,
    val isBuffering: Boolean = false,
    val isLoadingMetadata: Boolean = false,
    val isAudioOnlyMode: Boolean = false,
    val isOfflinePlayback: Boolean = false,
    val useWebEmbedFallback: Boolean = false,
    val isFullscreen: Boolean = false,
    val isMiniBubbleVisible: Boolean = false,
    val positionMs: Long = 0L,
    val durationMs: Long = 0L,
    val errorMessage: String? = null,
    val queue: List<VideoItem> = emptyList(),
    val queueIndex: Int = 0
)

@OptIn(UnstableApi::class)
class MetaTubePlayerManager(
    private val context: Context,
    private val httpClient: OkHttpClient,
    private val dao: MetaTubeDao,
    private val extractor: MultiProviderExtractor
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val _uiState = MutableStateFlow(PlayerUiState())
    val uiState: StateFlow<PlayerUiState> = _uiState.asStateFlow()

    @Volatile
    private var currentStreamUserAgent: String = StreamFormat.DEFAULT_STREAM_UA

    private var positionTicker: Job? = null
    private var loadJob: Job? = null
    private var triedAlternateStream = false

    private val exoHttpClient: OkHttpClient by lazy {
        httpClient.newBuilder()
            .addInterceptor { chain ->
                val ua = currentStreamUserAgent.ifBlank { StreamFormat.DEFAULT_STREAM_UA }
                val req = chain.request().newBuilder()
                    .header("User-Agent", ua)
                    .build()
                chain.proceed(req)
            }
            .build()
    }

    private val dataSourceFactory: OkHttpDataSource.Factory by lazy {
        OkHttpDataSource.Factory(exoHttpClient)
    }

    private val mediaSourceFactory: DefaultMediaSourceFactory by lazy {
        DefaultMediaSourceFactory(context).setDataSourceFactory(dataSourceFactory)
    }

    val exoPlayer: ExoPlayer by lazy {
        ExoPlayer.Builder(context)
            .setMediaSourceFactory(mediaSourceFactory)
            .build().apply {
                addListener(object : Player.Listener {
                    override fun onIsPlayingChanged(isPlaying: Boolean) {
                        _uiState.update { it.copy(isPlaying = isPlaying) }
                        if (isPlaying) startTicker() else stopTicker()
                    }

                    override fun onPlaybackStateChanged(playbackState: Int) {
                        when (playbackState) {
                            Player.STATE_BUFFERING -> _uiState.update { it.copy(isBuffering = true) }
                            Player.STATE_READY -> _uiState.update {
                                it.copy(
                                    isBuffering = false,
                                    durationMs = duration.coerceAtLeast(0L),
                                    errorMessage = null
                                )
                            }
                            Player.STATE_ENDED -> playNextInQueue()
                            else -> _uiState.update { it.copy(isBuffering = false) }
                        }
                    }

                    override fun onPlayerError(error: PlaybackException) {
                        val state = _uiState.value
                        val resolved = state.resolvedMedia
                        if (!state.isOfflinePlayback && !triedAlternateStream && resolved != null) {
                            triedAlternateStream = true
                            val altFormat = if (state.isAudioOnlyMode) {
                                resolved.audioFormats.firstOrNull { it.url.isNotBlank() && it.url != resolved.playableAudioUrl }
                            } else {
                                resolved.videoFormats.firstOrNull {
                                    it.url.isNotBlank() && it.url != resolved.playableVideoUrl && it.hasMuxedAudio
                                } ?: resolved.videoFormats.firstOrNull {
                                    it.url.isNotBlank() && it.url != resolved.playableVideoUrl
                                }
                            }
                            if (altFormat != null) {
                                currentStreamUserAgent = altFormat.streamUserAgent.ifBlank { resolved.streamUserAgent }
                                startResolvedFormatPlayback(altFormat, resolved.playableAudioUrl)
                                return
                            }
                        }

                        _uiState.update {
                            it.copy(
                                isBuffering = false,
                                errorMessage = error.localizedMessage ?: "Playback stream unavailable"
                            )
                        }
                    }
                })
            }
    }

    fun playVideo(
        video: VideoItem,
        queue: List<VideoItem> = listOf(video),
        audioOnly: Boolean = false
    ) {
        loadJob?.cancel()
        triedAlternateStream = false
        val index = queue.indexOfFirst { it.id == video.id }.coerceAtLeast(0)
        _uiState.update {
            it.copy(
                currentVideo = video,
                isLoadingMetadata = true,
                isAudioOnlyMode = audioOnly,
                useWebEmbedFallback = false,
                errorMessage = null,
                queue = queue,
                queueIndex = index,
                isMiniBubbleVisible = true
            )
        }

        loadJob = scope.launch {
            val offline = dao.getCompletedByVideoId(video.id)
            val localFile = offline?.localFilePath?.let(::File)?.takeIf { it.exists() && it.length() > 0L }

            val resolved = runCatching {
                extractor.resolveUrl(
                    video.webpageUrl.ifBlank { "https://www.youtube.com/watch?v=${video.id}" },
                    fallbackItem = video
                )
            }.getOrNull()

            if (localFile != null) {
                _uiState.update {
                    it.copy(
                        currentVideo = resolved?.videoItem ?: video,
                        resolvedMedia = resolved,
                        isOfflinePlayback = true,
                        useWebEmbedFallback = false,
                        isLoadingMetadata = false,
                        isAudioOnlyMode = offline.isAudioOnly || audioOnly
                    )
                }
                startExoPlayback(Uri.fromFile(localFile))
            } else if (resolved != null) {
                currentStreamUserAgent = resolved.streamUserAgent.ifBlank { StreamFormat.DEFAULT_STREAM_UA }
                _uiState.update {
                    it.copy(
                        currentVideo = resolved.videoItem,
                        resolvedMedia = resolved,
                        isOfflinePlayback = false,
                        isLoadingMetadata = false
                    )
                }
                if (audioOnly) {
                    val audioUrl = resolved.playableAudioUrl
                    if (audioUrl.isNotBlank()) {
                        startExoPlayback(Uri.parse(audioUrl))
                    } else {
                        _uiState.update { it.copy(errorMessage = "No direct audio stream found; ready to download") }
                    }
                } else {
                    val directUrl = resolved.playableVideoUrl
                    val matchedFmt = resolved.videoFormats.firstOrNull { it.url == directUrl }
                    if (matchedFmt != null && !matchedFmt.hasMuxedAudio && matchedFmt.pairedAudioUrl.isNotBlank()) {
                        startResolvedFormatPlayback(matchedFmt, matchedFmt.pairedAudioUrl)
                    } else if (directUrl.isNotBlank()) {
                        startExoPlayback(Uri.parse(directUrl))
                    } else {
                        val fallbackFmt = resolved.videoFormats.firstOrNull { it.url.isNotBlank() }
                        if (fallbackFmt != null) {
                            startResolvedFormatPlayback(fallbackFmt, resolved.playableAudioUrl)
                        } else {
                            _uiState.update { it.copy(errorMessage = "No direct stream found; ready to download") }
                        }
                    }
                }
            } else {
                _uiState.update {
                    it.copy(
                        isLoadingMetadata = false,
                        errorMessage = "Could not load video metadata. Tap retry or download."
                    )
                }
            }
        }
    }

    fun retryPlayback() {
        val current = _uiState.value.currentVideo ?: return
        playVideo(current, _uiState.value.queue, _uiState.value.isAudioOnlyMode)
    }

    fun playLocalFile(
        video: VideoItem,
        localFilePath: String,
        audioOnly: Boolean,
        queue: List<Pair<VideoItem, String>> = emptyList()
    ) {
        loadJob?.cancel()
        val file = File(localFilePath)
        if (!file.exists()) return
        val qItems = if (queue.isNotEmpty()) queue.map { it.first } else listOf(video)
        val idx = qItems.indexOfFirst { it.id == video.id }.coerceAtLeast(0)
        _uiState.update {
            it.copy(
                currentVideo = video,
                resolvedMedia = null,
                isOfflinePlayback = true,
                useWebEmbedFallback = false,
                isLoadingMetadata = false,
                isAudioOnlyMode = audioOnly,
                errorMessage = null,
                queue = qItems,
                queueIndex = idx,
                isMiniBubbleVisible = true
            )
        }
        startExoPlayback(Uri.fromFile(file))
    }

    fun setWebEmbedFallback(enabled: Boolean) {
        val state = _uiState.value
        if (enabled) {
            exoPlayer.pause()
            _uiState.update { it.copy(useWebEmbedFallback = true, errorMessage = null, isBuffering = false) }
        } else {
            _uiState.update { it.copy(useWebEmbedFallback = false, errorMessage = null) }
            val resolved = state.resolvedMedia
            val url = if (state.isAudioOnlyMode) resolved?.playableAudioUrl else resolved?.playableVideoUrl
            if (!url.isNullOrBlank()) {
                currentStreamUserAgent = resolved?.streamUserAgent?.ifBlank { StreamFormat.DEFAULT_STREAM_UA }
                    ?: StreamFormat.DEFAULT_STREAM_UA
                startExoPlayback(Uri.parse(url))
            }
        }
    }

    fun onWebViewRendererCrashed() {
        _uiState.update {
            it.copy(
                useWebEmbedFallback = false,
                isBuffering = false,
                errorMessage = "WebView GPU unavailable on this device; use Direct Stream or Download."
            )
        }
    }

    private fun startResolvedFormatPlayback(format: StreamFormat, fallbackAudioUrl: String) {
        val audioUrl = format.pairedAudioUrl.ifBlank { fallbackAudioUrl }
        if (!format.hasMuxedAudio && audioUrl.isNotBlank() && audioUrl != format.url && !format.url.contains(".m3u8")) {
            exoPlayer.stop()
            val vSource = mediaSourceFactory.createMediaSource(MediaItem.fromUri(Uri.parse(format.url)))
            val aSource = mediaSourceFactory.createMediaSource(MediaItem.fromUri(Uri.parse(audioUrl)))
            exoPlayer.setMediaSource(MergingMediaSource(vSource, aSource))
            exoPlayer.prepare()
            exoPlayer.playWhenReady = true
        } else {
            startExoPlayback(Uri.parse(format.url))
        }
    }

    private fun startExoPlayback(uri: Uri) {
        exoPlayer.stop()
        exoPlayer.setMediaItem(MediaItem.fromUri(uri))
        exoPlayer.prepare()
        exoPlayer.playWhenReady = true
    }

    fun togglePlayPause() {
        if (exoPlayer.isPlaying) exoPlayer.pause() else exoPlayer.play()
    }

    fun seekTo(positionMs: Long) {
        exoPlayer.seekTo(positionMs.coerceAtLeast(0L))
        _uiState.update { it.copy(positionMs = positionMs) }
    }

    fun toggleAudioOnlyMode() {
        val state = _uiState.value
        val nextAudioOnly = !state.isAudioOnlyMode
        _uiState.update {
            it.copy(
                isAudioOnlyMode = nextAudioOnly,
                useWebEmbedFallback = if (nextAudioOnly) false else it.useWebEmbedFallback
            )
        }
        val resolved = state.resolvedMedia
        if (!state.isOfflinePlayback && resolved != null) {
            currentStreamUserAgent = resolved.streamUserAgent.ifBlank { StreamFormat.DEFAULT_STREAM_UA }
            val targetUrl = if (nextAudioOnly) resolved.playableAudioUrl else resolved.playableVideoUrl
            if (targetUrl.isNotBlank()) {
                val pos = exoPlayer.currentPosition
                exoPlayer.setMediaItem(MediaItem.fromUri(Uri.parse(targetUrl)))
                exoPlayer.prepare()
                exoPlayer.seekTo(pos)
                exoPlayer.playWhenReady = true
            }
        }
    }

    fun setFullscreen(fullscreen: Boolean) {
        _uiState.update { it.copy(isFullscreen = fullscreen) }
    }

    fun dismissMiniBubble() {
        exoPlayer.pause()
        _uiState.update { it.copy(isMiniBubbleVisible = false) }
    }

    fun playNextInQueue() {
        val state = _uiState.value
        val nextIdx = state.queueIndex + 1
        if (nextIdx < state.queue.size) {
            playVideo(state.queue[nextIdx], state.queue, state.isAudioOnlyMode)
        }
    }

    fun playPreviousInQueue() {
        val state = _uiState.value
        val prevIdx = state.queueIndex - 1
        if (prevIdx >= 0) {
            playVideo(state.queue[prevIdx], state.queue, state.isAudioOnlyMode)
        }
    }

    private fun startTicker() {
        positionTicker?.cancel()
        positionTicker = scope.launch {
            while (isActive) {
                _uiState.update {
                    it.copy(
                        positionMs = exoPlayer.currentPosition.coerceAtLeast(0L),
                        durationMs = exoPlayer.duration.coerceAtLeast(it.durationMs)
                    )
                }
                delay(400)
            }
        }
    }

    private fun stopTicker() {
        positionTicker?.cancel()
    }

    fun release() {
        positionTicker?.cancel()
        loadJob?.cancel()
        exoPlayer.release()
    }
}
