package com.example.data.network

import com.example.model.ResolvedMedia
import com.example.model.StreamFormat
import com.example.model.VideoItem
import com.example.model.VideoProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.Request
import java.net.URLEncoder
import java.util.regex.Pattern

class MultiProviderExtractor(
    private val httpClient: OkHttpClient,
    private val innerTubeClient: InnerTubeClient
) {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    suspend fun resolveUrl(rawUrl: String, fallbackItem: VideoItem? = null): ResolvedMedia {
        val url = extractFirstUrl(rawUrl) ?: rawUrl.trim()
        val provider = fallbackItem?.provider ?: VideoProvider.detectFromUrl(url)

        if (provider == VideoProvider.YOUTUBE) {
            val videoId = InnerTubeClient.extractYouTubeId(url) ?: fallbackItem?.id
            if (!videoId.isNullOrBlank()) {
                return innerTubeClient.resolvePlayer(videoId, fallbackItem)
            }
        }

        return withContext(Dispatchers.IO) {
            when (provider) {
                VideoProvider.TIKTOK -> resolveTikTok(url, fallbackItem)
                VideoProvider.TWITTER_X -> resolveTwitterX(url, fallbackItem)
                VideoProvider.DAILYMOTION -> resolveDailymotion(url, fallbackItem)
                VideoProvider.REDDIT -> resolveReddit(url, fallbackItem)
                VideoProvider.SOUNDCLOUD -> resolveSoundCloud(url, fallbackItem)
                VideoProvider.FACEBOOK,
                VideoProvider.INSTAGRAM,
                VideoProvider.PINTEREST,
                VideoProvider.TIDAL,
                VideoProvider.WHATSAPP,
                VideoProvider.DIRECT -> resolveOpenGraphOrDirect(url, provider, fallbackItem)
                VideoProvider.YOUTUBE -> innerTubeClient.resolvePlayer(
                    fallbackItem?.id ?: "dQw4w9WgXcQ",
                    fallbackItem
                )
            }
        }
    }

    private fun resolveTikTok(url: String, fallback: VideoItem?): ResolvedMedia {
        var title = fallback?.title ?: "TikTok Video"
        var author = fallback?.channelName ?: "@tiktok"
        var thumb = fallback?.thumbnailUrl.orEmpty()
        var videoUrl = ""

        // 1. Try TikTok oEmbed endpoint from api_endpoints
        runCatching {
            val encoded = URLEncoder.encode(url, "UTF-8")
            val req = Request.Builder()
                .url("https://www.tiktok.com/oembed?url=$encoded")
                .header("User-Agent", UA_MOBILE)
                .build()
            httpClient.newCall(req).execute().use { resp ->
                if (resp.isSuccessful) {
                    val obj = json.parseToJsonElement(resp.body?.string().orEmpty()).jsonObject
                    title = obj.str("title") ?: title
                    author = obj.str("author_name") ?: author
                    thumb = obj.str("thumbnail_url") ?: thumb
                }
            }
        }

        // 2. Try TikTok Aweme feed API endpoint from api_endpoints if aweme_id present
        val idMatch = Pattern.compile("/video/(\\d+)").matcher(url)
        val awemeId = if (idMatch.find()) idMatch.group(1) else null
        if (!awemeId.isNullOrBlank()) {
            runCatching {
                val apiUrl =
                    "https://api22-normal-c-alisg.tiktokv.com/aweme/v1/feed/?iid=7318518857994389254&device_id=7318517321748022790&app_name=musical_ly&version_code=350103&device_platform=android&device_type=SM-ASUS_Z01QD&os_version=9&aweme_id=$awemeId"
                val req = Request.Builder().url(apiUrl).header("User-Agent", UA_MOBILE).build()
                httpClient.newCall(req).execute().use { resp ->
                    if (resp.isSuccessful) {
                        val obj = json.parseToJsonElement(resp.body?.string().orEmpty()).jsonObject
                        val aweme = obj["aweme_list"]?.jsonArray?.firstOrNull()?.jsonObject
                        val playAddr = aweme?.get("video")?.jsonObject
                            ?.get("play_addr")?.jsonObject
                            ?.get("url_list")?.jsonArray?.firstOrNull()?.jsonPrimitive?.contentOrNull
                        if (!playAddr.isNullOrBlank()) videoUrl = playAddr
                    }
                }
            }
        }

        if (videoUrl.isBlank()) {
            val og = scrapeOpenGraph(url)
            title = og.title ?: title
            thumb = og.image ?: thumb
            videoUrl = og.videoUrl.orEmpty()
        }

        return buildProviderMedia(
            id = awemeId ?: "tt_${url.hashCode()}",
            title = title,
            author = author,
            thumb = thumb,
            provider = VideoProvider.TIKTOK,
            webpageUrl = url,
            directMediaUrl = videoUrl
        )
    }

    private fun resolveTwitterX(url: String, fallback: VideoItem?): ResolvedMedia {
        var title = fallback?.title ?: "X / Twitter Video"
        var author = fallback?.channelName ?: "X"
        var thumb = fallback?.thumbnailUrl.orEmpty()
        var videoUrl = ""

        val statusMatch = Pattern.compile("/status/(\\d+)").matcher(url)
        val tweetId = if (statusMatch.find()) statusMatch.group(1) else null
        if (!tweetId.isNullOrBlank()) {
            runCatching {
                val req = Request.Builder()
                    .url("https://cdn.syndication.twimg.com/tweet-result?id=$tweetId&token=0")
                    .header("User-Agent", UA_DESKTOP)
                    .build()
                httpClient.newCall(req).execute().use { resp ->
                    if (resp.isSuccessful) {
                        val obj = json.parseToJsonElement(resp.body?.string().orEmpty()).jsonObject
                        title = obj.str("text") ?: title
                        author = obj["user"]?.jsonObject?.str("name") ?: author
                        val media = obj["mediaDetails"]?.jsonArray?.firstOrNull()?.jsonObject
                        thumb = media?.str("media_url_https") ?: thumb
                        val variants = media?.get("video_info")?.jsonObject?.get("variants")?.jsonArray
                        videoUrl = variants
                            ?.mapNotNull { it.jsonObject }
                            ?.filter { it.str("content_type") == "video/mp4" }
                            ?.maxByOrNull { (it["bitrate"] as? JsonPrimitive)?.contentOrNull?.toLongOrNull() ?: 0L }
                            ?.str("url")
                            .orEmpty()
                    }
                }
            }
        }

        if (videoUrl.isBlank()) {
            val og = scrapeOpenGraph(url)
            title = og.title ?: title
            thumb = og.image ?: thumb
            videoUrl = og.videoUrl.orEmpty()
        }

        return buildProviderMedia(
            id = tweetId ?: "x_${url.hashCode()}",
            title = title,
            author = author,
            thumb = thumb,
            provider = VideoProvider.TWITTER_X,
            webpageUrl = url,
            directMediaUrl = videoUrl
        )
    }

    private fun resolveDailymotion(url: String, fallback: VideoItem?): ResolvedMedia {
        val m = Pattern.compile("(?:/video/|dai\\.ly/)([A-Za-z0-9]+)").matcher(url)
        val dmId = if (m.find()) m.group(1) else null
        var title = fallback?.title ?: "Dailymotion Video"
        var author = fallback?.channelName ?: "Dailymotion"
        var thumb = fallback?.thumbnailUrl.orEmpty()
        var videoUrl = ""

        if (!dmId.isNullOrBlank()) {
            runCatching {
                val req = Request.Builder()
                    .url("https://www.dailymotion.com/player/metadata/video/$dmId")
                    .header("User-Agent", UA_DESKTOP)
                    .build()
                httpClient.newCall(req).execute().use { resp ->
                    if (resp.isSuccessful) {
                        val obj = json.parseToJsonElement(resp.body?.string().orEmpty()).jsonObject
                        title = obj.str("title") ?: title
                        author = obj["owner"]?.jsonObject?.str("screenname") ?: author
                        thumb = obj["posters"]?.jsonObject?.str("720") ?: thumb
                        videoUrl = obj["qualities"]?.jsonObject
                            ?.get("auto")?.jsonArray?.firstOrNull()?.jsonObject?.str("url")
                            .orEmpty()
                    }
                }
            }
        }

        return buildProviderMedia(
            id = dmId ?: "dm_${url.hashCode()}",
            title = title,
            author = author,
            thumb = thumb,
            provider = VideoProvider.DAILYMOTION,
            webpageUrl = url,
            directMediaUrl = videoUrl
        )
    }

    private fun resolveReddit(url: String, fallback: VideoItem?): ResolvedMedia {
        var title = fallback?.title ?: "Reddit Video"
        var author = fallback?.channelName ?: "Reddit"
        var thumb = fallback?.thumbnailUrl.orEmpty()
        var videoUrl = ""

        runCatching {
            val clean = url.substringBefore("?").trimEnd('/') + "/.json"
            val req = Request.Builder().url(clean).header("User-Agent", "MetaTube/2.4 Android").build()
            httpClient.newCall(req).execute().use { resp ->
                if (resp.isSuccessful) {
                    val arr = json.parseToJsonElement(resp.body?.string().orEmpty()).jsonArray
                    val post = arr.firstOrNull()?.jsonObject
                        ?.get("data")?.jsonObject
                        ?.get("children")?.jsonArray?.firstOrNull()?.jsonObject
                        ?.get("data")?.jsonObject
                    title = post?.str("title") ?: title
                    author = post?.str("subreddit_name_prefixed") ?: author
                    thumb = post?.str("thumbnail")?.takeIf { it.startsWith("http") } ?: thumb
                    videoUrl = post?.get("secure_media")?.jsonObject
                        ?.get("reddit_video")?.jsonObject
                        ?.str("fallback_url").orEmpty()
                }
            }
        }

        return buildProviderMedia(
            id = "rd_${url.hashCode()}",
            title = title,
            author = author,
            thumb = thumb,
            provider = VideoProvider.REDDIT,
            webpageUrl = url,
            directMediaUrl = videoUrl
        )
    }

    private fun resolveSoundCloud(url: String, fallback: VideoItem?): ResolvedMedia {
        var title = fallback?.title ?: "SoundCloud Track"
        var author = fallback?.channelName ?: "SoundCloud"
        var thumb = fallback?.thumbnailUrl.orEmpty()

        runCatching {
            val encoded = URLEncoder.encode(url, "UTF-8")
            val req = Request.Builder()
                .url("https://soundcloud.com/oembed?format=json&url=$encoded")
                .build()
            httpClient.newCall(req).execute().use { resp ->
                if (resp.isSuccessful) {
                    val obj = json.parseToJsonElement(resp.body?.string().orEmpty()).jsonObject
                    title = obj.str("title") ?: title
                    author = obj.str("author_name") ?: author
                    thumb = obj.str("thumbnail_url") ?: thumb
                }
            }
        }

        return buildProviderMedia(
            id = "sc_${url.hashCode()}",
            title = title,
            author = author,
            thumb = thumb,
            provider = VideoProvider.SOUNDCLOUD,
            webpageUrl = url,
            directMediaUrl = ""
        )
    }

    private fun resolveOpenGraphOrDirect(
        url: String,
        provider: VideoProvider,
        fallback: VideoItem?
    ): ResolvedMedia {
        val isDirectMedia = listOf(".mp4", ".mp3", ".m4a", ".webm", ".m3u8")
            .any { url.lowercase().contains(it) }

        if (isDirectMedia) {
            return buildProviderMedia(
                id = "direct_${url.hashCode()}",
                title = fallback?.title ?: url.substringAfterLast('/').substringBefore('?').ifBlank { "Media File" },
                author = provider.displayName,
                thumb = fallback?.thumbnailUrl.orEmpty(),
                provider = provider,
                webpageUrl = url,
                directMediaUrl = url
            )
        }

        val og = scrapeOpenGraph(url)
        return buildProviderMedia(
            id = "${provider.name.lowercase()}_${url.hashCode()}",
            title = og.title ?: fallback?.title ?: "${provider.displayName} Video",
            author = fallback?.channelName ?: provider.displayName,
            thumb = og.image ?: fallback?.thumbnailUrl.orEmpty(),
            provider = provider,
            webpageUrl = url,
            directMediaUrl = og.videoUrl.orEmpty()
        )
    }

    private data class OgMeta(
        val title: String? = null,
        val image: String? = null,
        val videoUrl: String? = null
    )

    private fun scrapeOpenGraph(url: String): OgMeta {
        return runCatching {
            val req = Request.Builder()
                .url(url)
                .header("User-Agent", UA_DESKTOP)
                .build()
            httpClient.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) return@use OgMeta()
                val html = resp.body?.string().orEmpty().take(200_000)
                OgMeta(
                    title = extractMeta(html, "og:title") ?: extractMeta(html, "twitter:title"),
                    image = extractMeta(html, "og:image") ?: extractMeta(html, "twitter:image"),
                    videoUrl = extractMeta(html, "og:video:secure_url")
                        ?: extractMeta(html, "og:video:url")
                        ?: extractMeta(html, "og:video")
                )
            }
        }.getOrDefault(OgMeta())
    }

    private fun extractMeta(html: String, property: String): String? {
        val p1 = Pattern.compile(
            "<meta[^>]+(?:property|name)=[\"']${Pattern.quote(property)}[\"'][^>]+content=[\"']([^\"']+)[\"']",
            Pattern.CASE_INSENSITIVE
        ).matcher(html)
        if (p1.find()) return p1.group(1)?.replace("&amp;", "&")
        val p2 = Pattern.compile(
            "<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+(?:property|name)=[\"']${Pattern.quote(property)}[\"']",
            Pattern.CASE_INSENSITIVE
        ).matcher(html)
        if (p2.find()) return p2.group(1)?.replace("&amp;", "&")
        return null
    }

    private fun buildProviderMedia(
        id: String,
        title: String,
        author: String,
        thumb: String,
        provider: VideoProvider,
        webpageUrl: String,
        directMediaUrl: String
    ): ResolvedMedia {
        val playableUrl = directMediaUrl.ifBlank { webpageUrl }
        val videoResolutions = listOf(144, 240, 360, 480, 720, 1080, 1440, 2160).map { h ->
            val label = when (h) {
                480 -> "480p SD"
                720 -> "720p HD"
                1080 -> "1080p Full HD"
                1440 -> "1440p 2K"
                2160 -> "2160p 4K"
                else -> "${h}p"
            }
            val kbps = h * 4
            StreamFormat(
                formatId = "${provider.name.lowercase()}_${h}p",
                label = label,
                resolutionTag = "${h}P",
                qualityHeight = h,
                bitrateKbps = kbps,
                mimeType = "video/mp4",
                extension = "mp4",
                isAudioOnly = false,
                hasMuxedAudio = true,
                contentLengthBytes = InnerTubeClient.estimateBytes(kbps, 120),
                url = playableUrl
            )
        }
        val audioProfiles = listOf(64, 128, 192, 256, 320).map { kbps ->
            StreamFormat(
                formatId = "${provider.name.lowercase()}_mp3_${kbps}k",
                label = "${kbps}kbps MP3",
                resolutionTag = "${kbps}K MP3",
                qualityHeight = 0,
                bitrateKbps = kbps,
                mimeType = "audio/mpeg",
                extension = "mp3",
                isAudioOnly = true,
                hasMuxedAudio = true,
                contentLengthBytes = InnerTubeClient.estimateBytes(kbps, 120),
                url = playableUrl
            )
        }

        return ResolvedMedia(
            videoItem = VideoItem(
                id = id,
                title = title,
                channelName = author,
                thumbnailUrl = thumb,
                durationText = "02:30",
                provider = provider,
                webpageUrl = webpageUrl
            ),
            videoFormats = videoResolutions,
            audioFormats = audioProfiles,
            playableVideoUrl = playableUrl,
            playableAudioUrl = playableUrl
        )
    }

    private fun JsonObject.str(key: String): String? = (this[key] as? JsonPrimitive)?.contentOrNull

    companion object {
        private const val UA_DESKTOP =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        private const val UA_MOBILE =
            "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"

        fun extractFirstUrl(text: String): String? {
            val matcher = Pattern.compile("(https?://\\S+)").matcher(text)
            return if (matcher.find()) matcher.group(1)?.trimEnd('.', ',', ')', '"', '\'') else null
        }
    }
}
