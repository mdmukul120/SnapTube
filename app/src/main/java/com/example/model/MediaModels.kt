package com.example.model

import androidx.compose.ui.graphics.Color
import com.example.ui.theme.DailymotionBlue
import com.example.ui.theme.FacebookBlue
import com.example.ui.theme.InstagramPink
import com.example.ui.theme.MetaGold
import com.example.ui.theme.RedditOrange
import com.example.ui.theme.SoundCloudOrange
import com.example.ui.theme.TikTokCyan
import com.example.ui.theme.TwitterBlue
import com.example.ui.theme.WhatsAppGreen
import com.example.ui.theme.YouTubeRed
import kotlinx.serialization.Serializable

enum class ThemeMode {
    DARK, LIGHT, SYSTEM
}

enum class AppLanguage {
    BN, EN
}

enum class DownloadStatus {
    QUEUED, DOWNLOADING, PAUSED, COMPLETED, FAILED
}

@Serializable
enum class VideoProvider(
    val displayName: String,
    val baseUrl: String,
    val badgeColorHex: Long
) {
    YOUTUBE("YouTube", "https://m.youtube.com/", 0xFFFF0000),
    FACEBOOK("Facebook", "https://m.facebook.com/", 0xFF1877F2),
    INSTAGRAM("Instagram", "https://www.instagram.com/", 0xFFE1306C),
    TIKTOK("TikTok", "https://www.tiktok.com/", 0xFF00F2EA),
    SOUNDCLOUD("SoundCloud", "https://soundcloud.com/", 0xFFFF5500),
    TWITTER_X("X / Twitter", "https://x.com/", 0xFF1DA1F2),
    DAILYMOTION("Dailymotion", "https://www.dailymotion.com/", 0xFF0066DC),
    REDDIT("Reddit", "https://www.reddit.com/", 0xFFFF4500),
    PINTEREST("Pinterest", "https://www.pinterest.com/", 0xFFE60023),
    TIDAL("Tidal", "https://tidal.com/", 0xFF00FFFF),
    WHATSAPP("Status Saver", "https://web.whatsapp.com/", 0xFF25D366),
    DIRECT("Direct Link", "https://", 0xFFFFCB1F);

    val brandColor: Color
        get() = when (this) {
            YOUTUBE -> YouTubeRed
            FACEBOOK -> FacebookBlue
            INSTAGRAM -> InstagramPink
            TIKTOK -> TikTokCyan
            SOUNDCLOUD -> SoundCloudOrange
            TWITTER_X -> TwitterBlue
            DAILYMOTION -> DailymotionBlue
            REDDIT -> RedditOrange
            WHATSAPP -> WhatsAppGreen
            else -> MetaGold
        }

    companion object {
        fun detectFromUrl(url: String): VideoProvider {
            val lower = url.lowercase()
            return when {
                "youtube.com" in lower || "youtu.be" in lower || "music.youtube.com" in lower -> YOUTUBE
                "facebook.com" in lower || "fb.watch" in lower -> FACEBOOK
                "instagram.com" in lower -> INSTAGRAM
                "tiktok.com" in lower -> TIKTOK
                "soundcloud.com" in lower -> SOUNDCLOUD
                "twitter.com" in lower || "x.com" in lower -> TWITTER_X
                "dailymotion.com" in lower || "dai.ly" in lower -> DAILYMOTION
                "reddit.com" in lower || "v.redd.it" in lower -> REDDIT
                "pinterest.com" in lower || "pin.it" in lower -> PINTEREST
                "tidal.com" in lower -> TIDAL
                else -> DIRECT
            }
        }
    }
}

@Serializable
data class VideoItem(
    val id: String,
    val title: String,
    val channelName: String,
    val channelAvatarUrl: String = "",
    val thumbnailUrl: String,
    val durationText: String = "",
    val durationSeconds: Long = 0L,
    val viewCountText: String = "",
    val publishedText: String = "",
    val provider: VideoProvider = VideoProvider.YOUTUBE,
    val webpageUrl: String = "",
    val isPlaylist: Boolean = false,
    val playlistCount: Int = 0,
    val playlistId: String = ""
)

@Serializable
data class StreamFormat(
    val formatId: String,
    val label: String,
    val resolutionTag: String,
    val qualityHeight: Int,
    val bitrateKbps: Int,
    val mimeType: String,
    val extension: String,
    val isAudioOnly: Boolean,
    val hasMuxedAudio: Boolean,
    val contentLengthBytes: Long,
    val url: String,
    val fps: Int = 30,
    val streamUserAgent: String = DEFAULT_STREAM_UA,
    val pairedAudioUrl: String = ""
) {
    val formattedSize: String
        get() {
            if (contentLengthBytes <= 0L) return if (isAudioOnly) "~4.2 MB" else "~28 MB"
            val kb = contentLengthBytes / 1024.0
            val mb = kb / 1024.0
            val gb = mb / 1024.0
            return when {
                gb >= 1.0 -> String.format(java.util.Locale.US, "%.2f GB", gb)
                mb >= 1.0 -> String.format(java.util.Locale.US, "%.1f MB", mb)
                else -> String.format(java.util.Locale.US, "%.0f KB", kb)
            }
        }

    companion object {
        const val DEFAULT_STREAM_UA =
            "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip"
    }
}

@Serializable
data class CommentItem(
    val author: String,
    val text: String,
    val timeAgo: String,
    val likesCount: String = ""
)

data class ResolvedMedia(
    val videoItem: VideoItem,
    val videoFormats: List<StreamFormat>,
    val audioFormats: List<StreamFormat>,
    val playableVideoUrl: String,
    val playableAudioUrl: String,
    val streamUserAgent: String = StreamFormat.DEFAULT_STREAM_UA,
    val relatedVideos: List<VideoItem> = emptyList(),
    val comments: List<CommentItem> = emptyList()
)

data class UpdateInfo(
    val currentVersion: String,
    val currentVersionCode: Int,
    val latestVersion: String,
    val latestVersionCode: Int,
    val releaseNotesBn: String,
    val releaseNotesEn: String,
    val downloadUrl: String,
    val isUpdateAvailable: Boolean
)
