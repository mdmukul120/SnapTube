package com.example.ui

import android.Manifest
import android.content.ClipboardManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import com.example.data.network.MultiProviderExtractor
import com.example.model.AppLanguage
import com.example.ui.components.AddToPlaylistDialog
import com.example.ui.components.FloatingMiniPlayerBubble
import com.example.ui.components.FormatDownloadSheet
import com.example.ui.components.MetaTubeBottomBar
import com.example.ui.components.UpdateCheckDialog
import com.example.ui.navigation.MetaTubeRoute
import com.example.ui.screens.HomeScreen
import com.example.ui.screens.MyFilesScreen
import com.example.ui.screens.PlayerScreen
import com.example.ui.screens.SearchScreen
import com.example.ui.screens.SettingsScreen
import com.example.ui.screens.SplashScreen
import com.example.ui.theme.MetaTubeTheme
import com.example.ui.viewmodel.MainViewModel
import com.example.util.stringsFor

@Composable
fun MetaTubeApp(
    viewModel: MainViewModel,
    sharedUrlFlow: kotlinx.coroutines.flow.StateFlow<String?>,
    onConsumeSharedUrl: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val strings = remember(settings.language) { stringsFor(settings.language) }

    val homeState by viewModel.homeState.collectAsStateWithLifecycle()
    val searchState by viewModel.searchState.collectAsStateWithLifecycle()
    val searchHistory by viewModel.searchHistory.collectAsStateWithLifecycle()
    val activeDownloads by viewModel.activeDownloads.collectAsStateWithLifecycle()
    val completedDownloads by viewModel.completedDownloads.collectAsStateWithLifecycle()
    val activeBadgeCount by viewModel.activeBadgeCount.collectAsStateWithLifecycle()
    val playlists by viewModel.playlists.collectAsStateWithLifecycle()
    val allPlaylistItems by viewModel.allPlaylistItems.collectAsStateWithLifecycle()
    val formatPicker by viewModel.formatPicker.collectAsStateWithLifecycle()
    val playerState by viewModel.playerManager.uiState.collectAsStateWithLifecycle()
    val updateInfo by viewModel.updateInfo.collectAsStateWithLifecycle()
    val showUpdateDialog by viewModel.showUpdateDialog.collectAsStateWithLifecycle()
    val isCheckingUpdate by viewModel.isCheckingUpdate.collectAsStateWithLifecycle()
    val playlistPickerVideo by viewModel.playlistPickerVideo.collectAsStateWithLifecycle()
    val toastMessage by viewModel.toastMessage.collectAsStateWithLifecycle()
    val detectedClipboardUrl by viewModel.detectedClipboardUrl.collectAsStateWithLifecycle()
    val sharedUrl by sharedUrlFlow.collectAsStateWithLifecycle()

    val snackbarHostState = remember { SnackbarHostState() }
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route.orEmpty()

    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
        onResult = { }
    )

    // Detect copied media URLs on app resume when Clipboard Link Detector is enabled
    DisposableEffect(lifecycleOwner, settings.clipboardDetectorEnabled) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME && settings.clipboardDetectorEnabled) {
                runCatching {
                    val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                    val text = cm?.primaryClip?.getItemAt(0)?.coerceToText(context)?.toString().orEmpty()
                    val firstUrl = MultiProviderExtractor.extractFirstUrl(text)
                    viewModel.onClipboardCandidate(firstUrl)
                }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(detectedClipboardUrl) {
        val url = detectedClipboardUrl ?: return@LaunchedEffect
        val label = if (settings.language == AppLanguage.BN) {
            "ক্লিপবোর্ডে ভিডিও লিংক পাওয়া গেছে"
        } else {
            "Video link detected in clipboard"
        }
        val result = snackbarHostState.showSnackbar(
            message = label,
            actionLabel = strings.downloadButton,
            duration = SnackbarDuration.Short
        )
        viewModel.consumeDetectedClipboardUrl()
        if (result == SnackbarResult.ActionPerformed) {
            viewModel.openFormatPickerForUrl(url, fromShareSheet = false)
        }
    }

    LaunchedEffect(toastMessage) {
        val msg = toastMessage ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(msg)
        viewModel.consumeToast()
    }

    // Open Custom Share-to-Download Sheet immediately when a link is shared via Android Share Sheet
    LaunchedEffect(sharedUrl) {
        val url = sharedUrl
        if (!url.isNullOrBlank()) {
            viewModel.openFormatPickerForUrl(url, fromShareSheet = true)
            onConsumeSharedUrl()
        }
    }

    val showBottomBar = currentRoute.contains("Home") ||
        currentRoute.contains("Search") ||
        currentRoute.contains("MyFiles") ||
        currentRoute.contains("Settings")

    val currentBottomTab = when {
        currentRoute.contains("MyFiles") -> 1
        currentRoute.contains("Settings") -> 2
        else -> 0
    }

    MetaTubeTheme(themeMode = settings.themeMode) {
        Scaffold(
            snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
            bottomBar = {
                if (showBottomBar) {
                    MetaTubeBottomBar(
                        currentTab = currentBottomTab,
                        activeDownloadCount = activeBadgeCount,
                        strings = strings,
                        onSelectTab = { tab ->
                            val target: MetaTubeRoute = when (tab) {
                                1 -> MetaTubeRoute.MyFiles()
                                2 -> MetaTubeRoute.Settings
                                else -> MetaTubeRoute.Home
                            }
                            navController.navigate(target) {
                                popUpTo(MetaTubeRoute.Home) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        }
                    )
                }
            }
        ) { innerPadding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(bottom = innerPadding.calculateBottomPadding())
            ) {
                NavHost(
                    navController = navController,
                    startDestination = MetaTubeRoute.Splash
                ) {
                    composable<MetaTubeRoute.Splash> {
                        SplashScreen(
                            onFinished = {
                                navController.navigate(MetaTubeRoute.Home) {
                                    popUpTo(MetaTubeRoute.Splash) { inclusive = true }
                                }
                            }
                        )
                    }

                    composable<MetaTubeRoute.Home> {
                        HomeScreen(
                            state = homeState,
                            strings = strings,
                            onSelectTopTab = viewModel::selectHomeTab,
                            onOpenSearch = { initialQuery ->
                                navController.navigate(MetaTubeRoute.Search(initialQuery))
                            },
                            onOpenVideo = { video, queue ->
                                viewModel.playerManager.playVideo(video, queue)
                                navController.navigate(MetaTubeRoute.Player(video.id))
                            },
                            onDownloadVideo = viewModel::openFormatPickerForVideo,
                            onPasteAndDownloadUrl = { url ->
                                viewModel.openFormatPickerForUrl(url, fromShareSheet = false)
                            },
                            onRefreshFeed = viewModel::loadHomeFeeds
                        )
                    }

                    composable<MetaTubeRoute.Search> { entry ->
                        val route = entry.toRoute<MetaTubeRoute.Search>()
                        SearchScreen(
                            state = searchState,
                            history = searchHistory,
                            strings = strings,
                            initialQuery = route.initialQuery,
                            onBack = { navController.popBackStack() },
                            onQueryChange = viewModel::onSearchQueryChanged,
                            onSubmitSearch = { q -> viewModel.submitSearch(q) },
                            onSelectFilter = viewModel::selectSearchFilter,
                            onClearHistory = viewModel::clearSearchHistory,
                            onOpenVideo = { video, queue ->
                                viewModel.playerManager.playVideo(video, queue)
                                navController.navigate(MetaTubeRoute.Player(video.id))
                            },
                            onDownloadVideo = viewModel::openFormatPickerForVideo
                        )
                    }

                    composable<MetaTubeRoute.Player> {
                        PlayerScreen(
                            state = playerState,
                            playerManager = viewModel.playerManager,
                            strings = strings,
                            onBack = { navController.popBackStack() },
                            onDownloadClick = viewModel::openFormatPickerForVideo,
                            onAddToPlaylist = viewModel::requestAddToPlaylist,
                            onSelectRelatedVideo = { video, related ->
                                viewModel.playerManager.playVideo(video, related)
                            }
                        )
                    }

                    composable<MetaTubeRoute.MyFiles> { entry ->
                        val route = entry.toRoute<MetaTubeRoute.MyFiles>()
                        MyFilesScreen(
                            initialTab = route.initialTab,
                            activeDownloads = activeDownloads,
                            completedDownloads = completedDownloads,
                            playlists = playlists,
                            allPlaylistItems = allPlaylistItems,
                            strings = strings,
                            onPauseDownload = viewModel::pauseDownload,
                            onResumeDownload = viewModel::resumeDownload,
                            onDeleteDownload = viewModel::deleteDownload,
                            onPlayCompleted = { dl ->
                                if (viewModel.playCompletedDownload(dl)) {
                                    navController.navigate(MetaTubeRoute.Player(dl.videoId))
                                }
                            },
                            onShareCompleted = viewModel::shareCompletedFile,
                            onAddCompletedToPlaylist = viewModel::requestAddToPlaylist,
                            onCreatePlaylist = viewModel::createPlaylist,
                            onRenamePlaylist = viewModel::renamePlaylist,
                            onDeletePlaylist = viewModel::deletePlaylist,
                            onPlayPlaylist = { entries, startIndex ->
                                viewModel.playPlaylist(entries, startIndex)
                                entries.getOrNull(startIndex)?.let { first ->
                                    navController.navigate(MetaTubeRoute.Player(first.videoId))
                                }
                            },
                            onRemovePlaylistEntry = viewModel::removeFromPlaylist
                        )
                    }

                    composable<MetaTubeRoute.Settings> {
                        SettingsScreen(
                            settings = settings,
                            strings = strings,
                            isCheckingUpdate = isCheckingUpdate,
                            onSetThemeMode = viewModel::setThemeMode,
                            onSetLanguage = viewModel::setLanguage,
                            onSetDownloadThreads = viewModel::setDownloadThreads,
                            onSetWifiOnly = viewModel::setWifiOnly,
                            onSetNotifications = viewModel::setNotificationsEnabled,
                            onSetAutoUpdate = viewModel::setAutoUpdateEnabled,
                            onSetClipboardDetector = viewModel::setClipboardDetectorEnabled,
                            onClearCache = viewModel::clearCache,
                            onCheckUpdatesNow = { viewModel.checkForUpdates(silent = false) },
                            onOpenPlaylists = {
                                navController.navigate(MetaTubeRoute.MyFiles(initialTab = 1)) {
                                    popUpTo(MetaTubeRoute.Home) { saveState = false }
                                    launchSingleTop = true
                                }
                            },
                            onTestShareDownload = {
                                viewModel.openFormatPickerForUrl(
                                    "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
                                    fromShareSheet = true
                                )
                            }
                        )
                    }
                }

                // Floating Mini-Player Pill anchored bottom-start across non-player screens
                if (!currentRoute.contains("Player") && !currentRoute.contains("Splash")) {
                    FloatingMiniPlayerBubble(
                        playerState = playerState,
                        onExpandClick = {
                            val vidId = playerState.currentVideo?.id ?: return@FloatingMiniPlayerBubble
                            navController.navigate(MetaTubeRoute.Player(vidId))
                        },
                        onTogglePlay = { viewModel.playerManager.togglePlayPause() },
                        onDismiss = { viewModel.playerManager.dismissMiniBubble() },
                        modifier = Modifier.align(Alignment.BottomStart)
                    )
                }
            }
        }

        // Format Picker & Share-to-Download Sheet
        FormatDownloadSheet(
            state = formatPicker,
            defaultThreads = settings.downloadThreads,
            strings = strings,
            onDismiss = viewModel::dismissFormatPicker,
            onStartDownload = { video, format, threads ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                    settings.notificationsEnabled &&
                    ContextCompat.checkSelfPermission(
                        context,
                        Manifest.permission.POST_NOTIFICATIONS
                    ) != PackageManager.PERMISSION_GRANTED
                ) {
                    notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
                viewModel.startDownload(video, format, threads)
            },
            onAddToPlaylist = viewModel::requestAddToPlaylist
        )

        AddToPlaylistDialog(
            video = playlistPickerVideo,
            playlists = playlists,
            strings = strings,
            onDismiss = viewModel::dismissPlaylistPicker,
            onSelectPlaylist = { plId, video -> viewModel.addVideoToPlaylist(plId, video) },
            onCreatePlaylist = { name -> viewModel.createPlaylist(name, "") }
        )

        UpdateCheckDialog(
            updateInfo = updateInfo,
            isVisible = showUpdateDialog,
            language = settings.language,
            strings = strings,
            onDismiss = viewModel::dismissUpdateDialog
        )
    }
}
