package com.example.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ContentPaste
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.model.VideoItem
import com.example.model.VideoProvider
import com.example.ui.components.LargeVideoCard
import com.example.ui.components.ProviderCircleButton
import com.example.ui.theme.MetaGold
import com.example.ui.viewmodel.HomeUiState
import com.example.util.MetaTubeStrings

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun HomeScreen(
    state: HomeUiState,
    strings: MetaTubeStrings,
    onSelectTopTab: (Int) -> Unit,
    onOpenSearch: (String) -> Unit,
    onOpenVideo: (VideoItem, List<VideoItem>) -> Unit,
    onDownloadVideo: (VideoItem) -> Unit,
    onPasteAndDownloadUrl: (String) -> Unit,
    onRefreshFeed: () -> Unit
) {
    val clipboard = LocalClipboardManager.current
    val tabs = listOf(strings.tabDiscover, strings.tabYouTube, strings.tabMusic, strings.tabMore)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
    ) {
        // Top Category Tabs matching screenshot 4
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            tabs.forEachIndexed { idx, label ->
                val selected = state.selectedTopTab == idx
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .clickable { onSelectTopTab(idx) }
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                        .testTag("home_tab_$idx")
                ) {
                    Text(
                        text = label,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                        color = if (selected) MaterialTheme.colorScheme.onBackground
                        else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Box(
                        modifier = Modifier
                            .width(34.dp)
                            .height(2.5.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(if (selected) MetaGold else Color.Transparent)
                    )
                }
            }
        }

        when (state.selectedTopTab) {
            0 -> DiscoverHomeContent(
                state = state,
                strings = strings,
                onOpenSearch = onOpenSearch,
                onOpenVideo = onOpenVideo,
                onDownloadVideo = onDownloadVideo,
                onPasteUrl = {
                    val clipText = clipboard.getText()?.text.orEmpty().trim()
                    if (clipText.startsWith("http://") || clipText.startsWith("https://")) {
                        onPasteAndDownloadUrl(clipText)
                    } else {
                        onSelectTopTab(3)
                    }
                },
                onShowAllProviders = { onSelectTopTab(3) }
            )

            1 -> VideoFeedTabContent(
                videos = state.trendingVideos,
                isLoading = state.isLoadingFeed,
                onOpenVideo = onOpenVideo,
                onDownloadVideo = onDownloadVideo,
                onRefresh = onRefreshFeed
            )

            2 -> VideoFeedTabContent(
                videos = state.musicVideos,
                isLoading = state.isLoadingFeed,
                onOpenVideo = onOpenVideo,
                onDownloadVideo = onDownloadVideo,
                onRefresh = onRefreshFeed
            )

            else -> MoreProvidersHubContent(
                strings = strings,
                onProviderClick = { provider ->
                    onOpenSearch(provider.displayName)
                },
                onResolveUrl = onPasteAndDownloadUrl
            )
        }
    }
}

@Composable
private fun DiscoverHomeContent(
    state: HomeUiState,
    strings: MetaTubeStrings,
    onOpenSearch: (String) -> Unit,
    onOpenVideo: (VideoItem, List<VideoItem>) -> Unit,
    onDownloadVideo: (VideoItem) -> Unit,
    onPasteUrl: () -> Unit,
    onShowAllProviders: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        // Hero Mosaic Header + MetaTube Logo + Pill Search Bar (matching screenshot 4)
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(280.dp),
                contentAlignment = Alignment.Center
            ) {
                Image(
                    painter = painterResource(id = R.drawable.img_hero_mosaic_1795625671656),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxSize()
                        .alpha(0.45f)
                )
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                listOf(
                                    MaterialTheme.colorScheme.background.copy(alpha = 0.2f),
                                    MaterialTheme.colorScheme.background.copy(alpha = 0.72f),
                                    MaterialTheme.colorScheme.background
                                )
                            )
                        )
                )

                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .widthIn(max = 560.dp)
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp)
                ) {
                    Text(
                        text = "MetaTube",
                        style = MaterialTheme.typography.displaySmall,
                        fontSize = 36.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = MetaGold
                    )
                    Spacer(modifier = Modifier.height(22.dp))

                    // Pill Search & URL Bar
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(54.dp)
                            .clip(RoundedCornerShape(28.dp))
                            .background(MaterialTheme.colorScheme.surface)
                            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(28.dp))
                            .clickable { onOpenSearch("") }
                            .padding(start = 10.dp, end = 6.dp)
                            .testTag("home_search_bar"),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(
                            onClick = onPasteUrl,
                            modifier = Modifier.size(40.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Download,
                                contentDescription = strings.pasteLinkDownload,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Text(
                            text = strings.searchPlaceholder,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f)
                        )
                        Box(
                            modifier = Modifier
                                .size(42.dp)
                                .clip(CircleShape)
                                .background(MetaGold)
                                .clickable { onOpenSearch("") },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Search,
                                contentDescription = strings.navDownload,
                                tint = Color(0xFF141414),
                                modifier = Modifier.size(22.dp)
                            )
                        }
                    }
                }
            }
        }

        // Browse Sites / Video Providers quick strip
        item {
            Column(modifier = Modifier.padding(top = 4.dp)) {
                Text(
                    text = strings.browseSites,
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
                )
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    val quickProviders = listOf(
                        VideoProvider.YOUTUBE,
                        VideoProvider.FACEBOOK,
                        VideoProvider.WHATSAPP,
                        VideoProvider.INSTAGRAM,
                        VideoProvider.TIKTOK,
                        VideoProvider.SOUNDCLOUD,
                        VideoProvider.TWITTER_X
                    )
                    items(quickProviders) { p ->
                        ProviderCircleButton(
                            provider = p,
                            label = p.displayName,
                            onClick = { onOpenSearch(p.displayName) }
                        )
                    }
                    item {
                        ProviderCircleButton(
                            provider = null,
                            label = strings.seeAll,
                            isSeeAll = true,
                            onClick = onShowAllProviders
                        )
                    }
                }
            }
        }

        // Trending Now header
        item {
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = strings.trendingNow,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onBackground,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
            )
        }

        if (state.isLoadingFeed && state.trendingVideos.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = MetaGold)
                }
            }
        } else {
            items(state.trendingVideos, key = { it.id }) { video ->
                LargeVideoCard(
                    video = video,
                    onClick = { onOpenVideo(video, state.trendingVideos) },
                    onDownloadClick = { onDownloadVideo(video) }
                )
            }
        }
    }
}

@Composable
private fun VideoFeedTabContent(
    videos: List<VideoItem>,
    isLoading: Boolean,
    onOpenVideo: (VideoItem, List<VideoItem>) -> Unit,
    onDownloadVideo: (VideoItem) -> Unit,
    onRefresh: () -> Unit
) {
    if (isLoading && videos.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = MetaGold)
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        if (videos.isEmpty()) {
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "No videos loaded yet",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = onRefresh,
                        colors = ButtonDefaults.buttonColors(containerColor = MetaGold, contentColor = Color(0xFF141414))
                    ) {
                        Text("Reload Feed")
                    }
                }
            }
        } else {
            items(videos, key = { it.id }) { video ->
                LargeVideoCard(
                    video = video,
                    onClick = { onOpenVideo(video, videos) },
                    onDownloadClick = { onDownloadVideo(video) }
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MoreProvidersHubContent(
    strings: MetaTubeStrings,
    onProviderClick: (VideoProvider) -> Unit,
    onResolveUrl: (String) -> Unit
) {
    var linkInput by remember { mutableStateOf("") }
    val clipboard = LocalClipboardManager.current

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Direct Link Downloader Card
        item {
            Surface(
                color = MaterialTheme.colorScheme.surface,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(16.dp))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = strings.pasteLinkDownload,
                        style = MaterialTheme.typography.titleMedium,
                        color = MetaGold
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedTextField(
                        value = linkInput,
                        onValueChange = { linkInput = it },
                        placeholder = { Text("https://youtube.com/watch?v=... / tiktok / fb / ig") },
                        singleLine = true,
                        trailingIcon = {
                            IconButton(onClick = {
                                linkInput = clipboard.getText()?.text.orEmpty()
                            }) {
                                Icon(Icons.Rounded.ContentPaste, contentDescription = "Paste")
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("direct_url_input")
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = {
                            if (linkInput.isNotBlank()) onResolveUrl(linkInput.trim())
                        },
                        enabled = linkInput.isNotBlank(),
                        colors = ButtonDefaults.buttonColors(containerColor = MetaGold, contentColor = Color(0xFF141414)),
                        shape = RoundedCornerShape(24.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("direct_url_download_btn")
                    ) {
                        Icon(Icons.Rounded.Download, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(strings.downloadButton, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // All Video Providers Grid
        item {
            Text(
                text = strings.supportedPlatforms,
                style = MaterialTheme.typography.titleMedium
            )
            Spacer(modifier = Modifier.height(10.dp))
            val allProviders = listOf(
                VideoProvider.YOUTUBE,
                VideoProvider.FACEBOOK,
                VideoProvider.INSTAGRAM,
                VideoProvider.TIKTOK,
                VideoProvider.SOUNDCLOUD,
                VideoProvider.TWITTER_X,
                VideoProvider.DAILYMOTION,
                VideoProvider.REDDIT,
                VideoProvider.PINTEREST,
                VideoProvider.TIDAL,
                VideoProvider.WHATSAPP
            )
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                allProviders.forEach { provider ->
                    ProviderCircleButton(
                        provider = provider,
                        label = provider.displayName,
                        onClick = { onProviderClick(provider) }
                    )
                }
            }
        }

        // Share Sheet Custom Download Feature Spotlight
        item {
            Surface(
                color = MetaGold.copy(alpha = 0.1f),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, MetaGold.copy(alpha = 0.35f), RoundedCornerShape(14.dp))
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Share,
                        contentDescription = null,
                        tint = MetaGold,
                        modifier = Modifier.size(28.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = strings.shareSheetDownloader,
                            style = MaterialTheme.typography.titleSmall,
                            color = MetaGold
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = strings.shareSheetDesc,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}
