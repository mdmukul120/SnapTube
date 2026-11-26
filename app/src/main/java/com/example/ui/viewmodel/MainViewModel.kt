package com.example.ui.viewmodel

import android.app.Application
import android.content.Intent
import androidx.core.content.FileProvider
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.MetaTubeApplication
import com.example.data.local.DownloadEntity
import com.example.data.local.PlaylistEntity
import com.example.data.local.PlaylistEntryEntity
import com.example.data.local.SearchHistoryEntity
import com.example.data.local.UserSettings
import com.example.model.AppLanguage
import com.example.model.DownloadStatus
import com.example.model.ResolvedMedia
import com.example.model.StreamFormat
import com.example.model.ThemeMode
import com.example.model.UpdateInfo
import com.example.model.VideoItem
import com.example.model.VideoProvider
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File
import java.util.UUID

data class FormatPickerState(
    val isVisible: Boolean = false,
    val isLoading: Boolean = false,
    val fromShareSheet: Boolean = false,
    val sourceUrl: String = "",
    val resolvedMedia: ResolvedMedia? = null,
    val errorMessage: String? = null
)

data class SearchUiState(
    val query: String = "",
    val activeFilter: String = "ALL",
    val isSearching: Boolean = false,
    val suggestions: List<String> = emptyList(),
    val results: List<VideoItem> = emptyList(),
    val errorMessage: String? = null
)

data class HomeUiState(
    val selectedTopTab: Int = 0, // 0=Discover, 1=YouTube, 2=Music, 3=More
    val isLoadingFeed: Boolean = false,
    val trendingVideos: List<VideoItem> = emptyList(),
    val musicVideos: List<VideoItem> = emptyList()
)

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as MetaTubeApplication
    private val dao = app.database.dao()
    private val prefs = app.preferencesRepository
    private val innerTube = app.innerTubeClient
    private val extractor = app.multiProviderExtractor
    private val downloadEngine = app.downloadEngine
    private val autoUpdate = app.autoUpdateManager
    val playerManager = app.playerManager

    val settings: StateFlow<UserSettings> = prefs.settingsFlow.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = UserSettings()
    )

    val activeDownloads: StateFlow<List<DownloadEntity>> = dao.observeActiveDownloads().stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    val completedDownloads: StateFlow<List<DownloadEntity>> = dao.observeCompletedDownloads().stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    val activeBadgeCount: StateFlow<Int> = combine(activeDownloads, completedDownloads) { active, _ ->
        active.count {
            it.status == DownloadStatus.DOWNLOADING ||
                it.status == DownloadStatus.QUEUED ||
                it.status == DownloadStatus.FAILED
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    val playlists: StateFlow<List<PlaylistEntity>> = dao.observePlaylists().stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    val allPlaylistItems: StateFlow<List<PlaylistEntryEntity>> = dao.observeAllPlaylistItems().stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    val searchHistory: StateFlow<List<SearchHistoryEntity>> = dao.observeSearchHistory().stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    private val _homeState = MutableStateFlow(HomeUiState())
    val homeState: StateFlow<HomeUiState> = _homeState.asStateFlow()

    private val _searchState = MutableStateFlow(SearchUiState())
    val searchState: StateFlow<SearchUiState> = _searchState.asStateFlow()

    private val _formatPicker = MutableStateFlow(FormatPickerState())
    val formatPicker: StateFlow<FormatPickerState> = _formatPicker.asStateFlow()

    private val _updateInfo = MutableStateFlow<UpdateInfo?>(null)
    val updateInfo: StateFlow<UpdateInfo?> = _updateInfo.asStateFlow()

    private val _showUpdateDialog = MutableStateFlow(false)
    val showUpdateDialog: StateFlow<Boolean> = _showUpdateDialog.asStateFlow()

    private val _isCheckingUpdate = MutableStateFlow(false)
    val isCheckingUpdate: StateFlow<Boolean> = _isCheckingUpdate.asStateFlow()

    private val _playlistPickerVideo = MutableStateFlow<VideoItem?>(null)
    val playlistPickerVideo: StateFlow<VideoItem?> = _playlistPickerVideo.asStateFlow()

    private val _toastMessage = MutableStateFlow<String?>(null)
    val toastMessage: StateFlow<String?> = _toastMessage.asStateFlow()

    private val _detectedClipboardUrl = MutableStateFlow<String?>(null)
    val detectedClipboardUrl: StateFlow<String?> = _detectedClipboardUrl.asStateFlow()

    private var lastHandledClipboardUrl: String? = null
    private var suggestionJob: Job? = null
    private var formatResolveJob: Job? = null

    init {
        loadHomeFeeds()
        viewModelScope.launch {
            val currentSettings = prefs.settingsFlow.firstOrNull()
            if (currentSettings?.autoUpdateEnabled == true) {
                val now = System.currentTimeMillis()
                if (now - currentSettings.lastUpdateCheckMs > 12 * 3600 * 1000L) {
                    checkForUpdates(silent = true)
                }
            }
        }
    }

    fun onClipboardCandidate(url: String?) {
        if (!settings.value.clipboardDetectorEnabled) return
        val clean = url?.trim().orEmpty()
        if (clean.isBlank() || clean == lastHandledClipboardUrl) return
        val provider = VideoProvider.detectFromUrl(clean)
        val isSupportedMedia = provider != VideoProvider.DIRECT ||
            listOf(".mp4", ".mp3", ".m4a", ".webm", ".m3u8").any { clean.lowercase().contains(it) }
        if (isSupportedMedia) {
            lastHandledClipboardUrl = clean
            _detectedClipboardUrl.value = clean
        }
    }

    fun consumeDetectedClipboardUrl() {
        _detectedClipboardUrl.value = null
    }

    fun selectHomeTab(index: Int) {
        _homeState.update { it.copy(selectedTopTab = index) }
        if ((index == 1 && _homeState.value.trendingVideos.isEmpty()) ||
            (index == 2 && _homeState.value.musicVideos.isEmpty())
        ) {
            loadHomeFeeds()
        }
    }

    fun loadHomeFeeds() {
        viewModelScope.launch {
            _homeState.update { it.copy(isLoadingFeed = true) }
            val trending = runCatching { innerTube.fetchTrending(isMusicTab = false) }.getOrDefault(emptyList())
            val music = runCatching { innerTube.fetchTrending(isMusicTab = true) }.getOrDefault(emptyList())
            _homeState.update {
                it.copy(
                    isLoadingFeed = false,
                    trendingVideos = trending,
                    musicVideos = music
                )
            }
        }
    }

    fun onSearchQueryChanged(query: String) {
        _searchState.update { it.copy(query = query) }
        suggestionJob?.cancel()
        if (query.isBlank()) {
            _searchState.update { it.copy(suggestions = emptyList()) }
            return
        }
        suggestionJob = viewModelScope.launch {
            delay(220)
            val list = innerTube.fetchSearchSuggestions(query)
            _searchState.update { it.copy(suggestions = list) }
        }
    }

    fun submitSearch(rawQuery: String, filter: String = _searchState.value.activeFilter) {
        val trimmed = rawQuery.trim()
        if (trimmed.isEmpty()) return

        // If user pasted a direct video URL, open the Download Format Sheet immediately!
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            openFormatPickerForUrl(trimmed, fromShareSheet = false)
            return
        }

        _searchState.update {
            it.copy(
                query = trimmed,
                activeFilter = filter,
                isSearching = true,
                suggestions = emptyList(),
                errorMessage = null
            )
        }

        viewModelScope.launch {
            dao.insertSearchHistory(SearchHistoryEntity(trimmed))
            val providerFilterQuery = when (filter.uppercase()) {
                "FACEBOOK" -> "$trimmed facebook video"
                "TIKTOK" -> "$trimmed tiktok"
                "INSTAGRAM" -> "$trimmed instagram reels"
                else -> trimmed
            }
            val apiFilter = when (filter.uppercase()) {
                "PLAYLIST" -> "PLAYLIST"
                "CHANNEL" -> "CHANNEL"
                else -> "ALL"
            }
            val results = runCatching {
                innerTube.searchVideos(providerFilterQuery, apiFilter)
            }.getOrElse { emptyList() }

            _searchState.update {
                it.copy(
                    isSearching = false,
                    results = results,
                    errorMessage = if (results.isEmpty()) "No videos found for \"$trimmed\"" else null
                )
            }
        }
    }

    fun selectSearchFilter(filter: String) {
        val q = _searchState.value.query
        _searchState.update { it.copy(activeFilter = filter) }
        if (q.isNotBlank()) submitSearch(q, filter)
    }

    fun clearSearchHistory() {
        viewModelScope.launch { dao.clearSearchHistory() }
    }

    fun openFormatPickerForVideo(video: VideoItem) {
        formatResolveJob?.cancel()
        _formatPicker.value = FormatPickerState(
            isVisible = true,
            isLoading = true,
            fromShareSheet = false,
            sourceUrl = video.webpageUrl,
            resolvedMedia = null
        )
        formatResolveJob = viewModelScope.launch {
            runCatching {
                extractor.resolveUrl(
                    video.webpageUrl.ifBlank { "https://www.youtube.com/watch?v=${video.id}" },
                    fallbackItem = video
                )
            }.onSuccess { resolved ->
                _formatPicker.update { it.copy(isLoading = false, resolvedMedia = resolved) }
            }.onFailure { err ->
                _formatPicker.update {
                    it.copy(isLoading = false, errorMessage = err.message ?: "Failed to load formats")
                }
            }
        }
    }

    fun openFormatPickerForUrl(url: String, fromShareSheet: Boolean) {
        formatResolveJob?.cancel()
        _formatPicker.value = FormatPickerState(
            isVisible = true,
            isLoading = true,
            fromShareSheet = fromShareSheet,
            sourceUrl = url,
            resolvedMedia = null
        )
        formatResolveJob = viewModelScope.launch {
            runCatching {
                extractor.resolveUrl(url)
            }.onSuccess { resolved ->
                _formatPicker.update { it.copy(isLoading = false, resolvedMedia = resolved) }
            }.onFailure { err ->
                _formatPicker.update {
                    it.copy(isLoading = false, errorMessage = err.message ?: "Failed to parse shared link")
                }
            }
        }
    }

    fun dismissFormatPicker() {
        formatResolveJob?.cancel()
        _formatPicker.update { it.copy(isVisible = false) }
    }

    fun startDownload(video: VideoItem, format: StreamFormat, threads: Int) {
        if (format.url.isBlank()) {
            val isBn = settings.value.language == AppLanguage.BN
            _toastMessage.value = if (isBn) {
                "এই লিংকের সরাসরি ডাউনলোড স্ট্রিম পাওয়া যায়নি"
            } else {
                "No direct downloadable media stream found for this link"
            }
            return
        }
        downloadEngine.enqueueDownload(video, format, threads)
        _formatPicker.update { it.copy(isVisible = false) }
        val isBn = settings.value.language == AppLanguage.BN
        _toastMessage.value = if (isBn) {
            "ডাউনলোড শুরু হয়েছে (${format.resolutionTag} • $threads থ্রেড)"
        } else {
            "Download started (${format.resolutionTag} • $threads threads)"
        }
    }

    fun pauseDownload(id: String) = downloadEngine.pauseDownload(id)
    fun resumeDownload(id: String) = downloadEngine.resumeOrRetryDownload(id)
    fun deleteDownload(id: String) = downloadEngine.cancelAndDelete(id)

    fun playCompletedDownload(download: DownloadEntity): Boolean {
        val file = File(download.localFilePath)
        if (!file.exists() || file.length() <= 0L) {
            _toastMessage.value = if (settings.value.language == AppLanguage.BN) {
                "ফাইলটি ডিভাইসে পাওয়া যায়নি (হয়তো মুছে ফেলা হয়েছে)"
            } else {
                "File not found on device (it may have been removed)"
            }
            return false
        }
        val toVideoItem: (DownloadEntity) -> VideoItem = { dl ->
            VideoItem(
                id = dl.videoId,
                title = dl.title,
                channelName = dl.channelName,
                thumbnailUrl = dl.thumbnailUrl,
                durationText = dl.durationText,
                provider = VideoProvider.entries.firstOrNull { it.displayName == dl.providerName }
                    ?: VideoProvider.YOUTUBE,
                webpageUrl = dl.sourceUrl
            )
        }
        val offlineQueue = completedDownloads.value
            .filter { File(it.localFilePath).exists() }
            .map { dl -> Triple(toVideoItem(dl), dl.localFilePath, dl.isAudioOnly) }
        return playerManager.playLocalFile(
            video = toVideoItem(download),
            localFilePath = download.localFilePath,
            audioOnly = download.isAudioOnly,
            queue = offlineQueue
        )
    }

    fun shareCompletedFile(download: DownloadEntity) {
        val file = File(download.localFilePath)
        if (!file.exists()) {
            _toastMessage.value = if (settings.value.language == AppLanguage.BN) {
                "শেয়ার করার জন্য ফাইলটি পাওয়া যায়নি"
            } else {
                "Downloaded file no longer exists"
            }
            return
        }
        runCatching {
            val uri = FileProvider.getUriForFile(
                app,
                "${app.packageName}.fileprovider",
                file
            )
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = download.mimeType
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_TEXT, download.title)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val chooser = Intent.createChooser(intent, download.title).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            app.startActivity(chooser)
        }.onFailure {
            _toastMessage.value = if (settings.value.language == AppLanguage.BN) {
                "ফাইল শেয়ার করতে সমস্যা হয়েছে"
            } else {
                "Unable to share file"
            }
        }
    }

    // Playlist Management
    fun createPlaylist(name: String, description: String) {
        if (name.isBlank()) return
        viewModelScope.launch {
            dao.upsertPlaylist(
                PlaylistEntity(
                    id = UUID.randomUUID().toString(),
                    name = name.trim(),
                    description = description.trim()
                )
            )
        }
    }

    fun renamePlaylist(playlist: PlaylistEntity, newName: String) {
        if (newName.isBlank()) return
        viewModelScope.launch {
            dao.upsertPlaylist(playlist.copy(name = newName.trim()))
        }
    }

    fun deletePlaylist(playlistId: String) {
        viewModelScope.launch {
            dao.deletePlaylistEntriesByPlaylist(playlistId)
            dao.deletePlaylist(playlistId)
        }
    }

    fun requestAddToPlaylist(video: VideoItem) {
        _playlistPickerVideo.value = video
    }

    fun dismissPlaylistPicker() {
        _playlistPickerVideo.value = null
    }

    fun addVideoToPlaylist(playlistId: String, video: VideoItem, localFilePath: String? = null) {
        viewModelScope.launch {
            dao.upsertPlaylistEntry(
                PlaylistEntryEntity(
                    id = "${playlistId}_${video.id}",
                    playlistId = playlistId,
                    videoId = video.id,
                    title = video.title,
                    channelName = video.channelName,
                    thumbnailUrl = video.thumbnailUrl,
                    durationText = video.durationText,
                    providerName = video.provider.displayName,
                    webpageUrl = video.webpageUrl,
                    localFilePath = localFilePath
                )
            )
            _playlistPickerVideo.value = null
            _toastMessage.value = if (settings.value.language == AppLanguage.BN) {
                "প্লেলিস্টে যোগ করা হয়েছে"
            } else {
                "Added to playlist"
            }
        }
    }

    fun removeFromPlaylist(entryId: String) {
        viewModelScope.launch { dao.deletePlaylistEntry(entryId) }
    }

    fun playPlaylist(entries: List<PlaylistEntryEntity>, startIndex: Int = 0) {
        if (entries.isEmpty()) return
        val items = entries.map { entry ->
            VideoItem(
                id = entry.videoId,
                title = entry.title,
                channelName = entry.channelName,
                thumbnailUrl = entry.thumbnailUrl,
                durationText = entry.durationText,
                provider = VideoProvider.entries.firstOrNull { it.displayName == entry.providerName }
                    ?: VideoProvider.YOUTUBE,
                webpageUrl = entry.webpageUrl
            )
        }
        val safeIdx = startIndex.coerceIn(0, items.lastIndex)
        val target = items[safeIdx]
        val local = entries[safeIdx].localFilePath
        if (!local.isNullOrBlank() && File(local).exists()) {
            val localQueue = entries.mapIndexedNotNull { idx, entry ->
                val path = entry.localFilePath
                if (!path.isNullOrBlank() && File(path).exists()) {
                    Triple(items[idx], path, entry.isAudioOnly)
                } else null
            }
            if (playerManager.playLocalFile(target, local, entries[safeIdx].isAudioOnly, localQueue)) {
                return
            }
        }
        playerManager.playVideo(target, queue = items)
    }

    // Settings & Auto-Update
    fun setThemeMode(mode: ThemeMode) = viewModelScope.launch { prefs.setThemeMode(mode) }
    fun setLanguage(lang: AppLanguage) = viewModelScope.launch { prefs.setLanguage(lang) }
    fun setDownloadThreads(threads: Int) = viewModelScope.launch { prefs.setDownloadThreads(threads) }
    fun setWifiOnly(enabled: Boolean) = viewModelScope.launch { prefs.setWifiOnly(enabled) }
    fun setNotificationsEnabled(enabled: Boolean) = viewModelScope.launch { prefs.setNotificationsEnabled(enabled) }
    fun setAutoUpdateEnabled(enabled: Boolean) = viewModelScope.launch { prefs.setAutoUpdateEnabled(enabled) }
    fun setClipboardDetectorEnabled(enabled: Boolean) = viewModelScope.launch { prefs.setClipboardDetectorEnabled(enabled) }

    fun clearCache() {
        val freed = downloadEngine.clearTempCache()
        val kb = freed / 1024
        _toastMessage.value = if (settings.value.language == AppLanguage.BN) {
            "ক্যাশ পরিষ্কার হয়েছে ($kb KB মুক্ত)"
        } else {
            "Cache cleared ($kb KB freed)"
        }
    }

    fun checkForUpdates(silent: Boolean = false) {
        viewModelScope.launch {
            if (!silent) _isCheckingUpdate.value = true
            val info = autoUpdate.checkForUpdates()
            prefs.setLastUpdateCheckMs(System.currentTimeMillis())
            _updateInfo.value = info
            _isCheckingUpdate.value = false
            if (!silent || info.isUpdateAvailable) {
                _showUpdateDialog.value = true
            }
        }
    }

    fun dismissUpdateDialog() {
        _showUpdateDialog.value = false
    }

    fun consumeToast() {
        _toastMessage.value = null
    }
}
