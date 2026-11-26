package com.example.data.network

import com.example.model.ResolvedMedia
import com.example.model.StreamFormat
import com.example.model.VideoItem
import com.example.model.VideoProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
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

    private fun followRedirectsToFinalUrl(url: String, userAgent: String = UA_MOBILE): String {
        return runCatching {
            val req = Request.Builder()
                .url(url)
                .header("User-Agent", userAgent)
                .build()
            httpClient.newCall(req).execute().use { resp ->
                resp.request.url.toString()
            }
        }.getOrDefault(url)
    }

    private fun resolveTikTok(url: String, fallback: VideoItem?): ResolvedMedia {
        var title = fallback?.title ?: "TikTok Video"
        var author = fallback?.channelName ?: "@tiktok"
        var thumb = fallback?.thumbnailUrl.orEmpty()
        var videoUrl = ""

        val expandedUrl = if ("vt.tiktok.com" in url.lowercase() || "vm.tiktok.com" in url.lowercase()) {
            followRedirectsToFinalUrl(url, UA_MOBILE)
        } else {
            url
        }

        // 1. Try TikTok oEmbed endpoint
        runCatching {
            val encoded = URLEncoder.encode(expandedUrl, "UTF-8")
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

        // 2. Try TikTok Aweme feed API endpoint if aweme_id is present
        val idMatch = Pattern.compile("/(?:video|photo)/(\\d+)").matcher(expandedUrl)
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
                        if (!playAddr.isNullOrBlank()) videoUrl = unescapeMediaUrl(playAddr)
                    }
                }
            }
        }

        if (videoUrl.isBlank()) {
            val og = scrapeOpenGraph(expandedUrl)
            title = og.title ?: title
            thumb = og.image ?: thumb
            videoUrl = og.videoUrl.orEmpty()
        }

        return buildProviderMedia(
            id = awemeId ?: "tt_${expandedUrl.hashCode()}",
            title = title,
            author = author,
            thumb = thumb,
            provider = VideoProvider.TIKTOK,
            webpageUrl = expandedUrl,
            directMediaUrl = videoUrl,
            streamUserAgent = UA_MOBILE
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
                            ?.let(::unescapeMediaUrl)
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
            directMediaUrl = videoUrl,
            streamUserAgent = UA_DESKTOP
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
                            ?.let(::unescapeMediaUrl)
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
            directMediaUrl = videoUrl,
            streamUserAgent = UA_DESKTOP
        )
    }

    private fun resolveReddit(url: String, fallback: VideoItem?): ResolvedMedia {
        var title = fallback?.title ?: "Reddit Video"
        var author = fallback?.channelName ?: "Reddit"
        var thumb = fallback?.thumbnailUrl.orEmpty()
        var videoUrl = ""
        var pairedAudioUrl = ""

        val expandedUrl = if ("v.redd.it" in url.lowercase() || "redd.it" in url.lowercase()) {
            followRedirectsToFinalUrl(url, UA_DESKTOP)
        } else {
            url
        }

        runCatching {
            val clean = expandedUrl.substringBefore("?").trimEnd('/') + "/.json"
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
                    val redditVideo = post?.get("secure_media")?.jsonObject
                        ?.get("reddit_video")?.jsonObject
                    val rawFallback = redditVideo?.str("fallback_url")?.let(::unescapeMediaUrl).orEmpty()
                    if (rawFallback.isNotBlank()) {
                        videoUrl = rawFallback
                        val base = rawFallback.substringBeforeLast('/')
                        val audioCandidates = listOf(
                            "$base/DASH_AUDIO_128.mp4",
                            "$base/DASH_audio.mp4",
                            "$base/audio"
                        )
                        for (candidate in audioCandidates) {
                            val ok = runCatching {
                                val headReq = Request.Builder()
                                    .url(candidate)
                                    .head()
                                    .header("User-Agent", UA_DESKTOP)
                                    .build()
                                httpClient.newCall(headReq).execute().use { it.isSuccessful }
                            }.getOrDefault(false)
                            if (ok) {
                                pairedAudioUrl = candidate
                                break
                            }
                        }
                    }
                }
            }
        }

        return buildProviderMedia(
            id = "rd_${expandedUrl.hashCode()}",
            title = title,
            author = author,
            thumb = thumb,
            provider = VideoProvider.REDDIT,
            webpageUrl = expandedUrl,
            directMediaUrl = videoUrl,
            pairedAudioUrl = pairedAudioUrl,
            streamUserAgent = UA_DESKTOP
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
            directMediaUrl = "",
            streamUserAgent = UA_DESKTOP
        )
    }

    private fun resolveOpenGraphOrDirect(
        url: String,
        provider: VideoProvider,
        fallback: VideoItem?
    ): ResolvedMedia {
        val lower = url.lowercase()
        val isDirectMedia = listOf(".mp4", ".mp3", ".m4a", ".webm", ".m3u8")
            .any { lower.contains(it) }

        if (isDirectMedia) {
            return buildProviderMedia(
                id = "direct_${url.hashCode()}",
                title = fallback?.title ?: url.substringAfterLast('/').substringBefore('?').ifBlank { "Media File" },
                author = provider.displayName,
                thumb = fallback?.thumbnailUrl.orEmpty(),
                provider = provider,
                webpageUrl = url,
                directMediaUrl = url,
                streamUserAgent = UA_DESKTOP
            )
        }

        val expandedUrl = if ("fb.watch" in lower || "pin.it" in lower) {
            followRedirectsToFinalUrl(url, UA_DESKTOP)
        } else {
            url
        }

        val og = scrapeOpenGraph(expandedUrl)
        return buildProviderMedia(
            id = "${provider.name.lowercase()}_${expandedUrl.hashCode()}",
            title = og.title ?: fallback?.title ?: "${provider.displayName} Video",
            author = fallback?.channelName ?: provider.displayName,
            thumb = og.image ?: fallback?.thumbnailUrl.orEmpty(),
            provider = provider,
            webpageUrl = expandedUrl,
            directMediaUrl = og.videoUrl.orEmpty(),
            streamUserAgent = UA_DESKTOP
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
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header("Accept-Language", "en-US,en;q=0.9")
                .build()
            httpClient.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) return@use OgMeta()
                val html = resp.body?.string().orEmpty().take(350_000)
                val videoUrl = extractMeta(html, "og:video:secure_url")
                    ?: extractMeta(html, "og:video:url")
                    ?: extractMeta(html, "og:video")
                    ?: extractJsonFieldUrl(html, "browser_native_hd_url")
                    ?: extractJsonFieldUrl(html, "playable_url_quality_hd")
                    ?: extractJsonFieldUrl(html, "browser_native_sd_url")
                    ?: extractJsonFieldUrl(html, "playable_url")
                    ?: extractJsonFieldUrl(html, "video_url")
                    ?: extractJsonFieldUrl(html, "contentUrl")
                    ?: extractVideoSrc(html)
                OgMeta(
                    title = extractMeta(html, "og:title") ?: extractMeta(html, "twitter:title"),
                    image = extractMeta(html, "og:image") ?: extractMeta(html, "twitter:image"),
                    videoUrl = videoUrl?.let(::unescapeMediaUrl)
                )
            }
        }.getOrDefault(OgMeta())
    }

    private fun extractMeta(html: String, property: String): String? {
        val p1 = Pattern.compile(
            "<meta[^>]+(?:property|name)=[\"']${Pattern.quote(property)}[\"'][^>]+content=[\"']([^\"']+)[\"']",
            Pattern.CASE_INSENSITIVE
        ).matcher(html)
        if (p1.find()) return p1.group(1)?.let(::unescapeMediaUrl)
        val p2 = Pattern.compile(
            "<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+(?:property|name)=[\"']${Pattern.quote(property)}[\"']",
            Pattern.CASE_INSENSITIVE
        ).matcher(html)
        if (p2.find()) return p2.group(1)?.let(::unescapeMediaUrl)
        return null
    }

    private fun extractJsonFieldUrl(html: String, field: String): String? {
        val matcher = Pattern.compile(
            "\"${Pattern.quote(field)}\"\\s*:\\s*\"(https?:\\\\?/\\\\?/[^\"]+)\"",
            Pattern.CASE_INSENSITIVE
        ).matcher(html)
        if (matcher.find()) {
            val candidate = matcher.group(1)?.let(::unescapeMediaUrl)
            if (!candidate.isNullOrBlank() && !candidate.endsWith(".html", ignoreCase = true)) {
                return candidate
            }
        }
        return null
    }

    private fun extractVideoSrc(html: String): String? {
        val matcher = Pattern.compile(
            "<(?:video|source)[^>]+src=[\"'](https?://[^\"']+)[\"']",
            Pattern.CASE_INSENSITIVE
        ).matcher(html)
        return if (matcher.find()) matcher.group(1)?.let(::unescapeMediaUrl) else null
    }

    private fun unescapeMediaUrl(raw: String): String {
        return raw
            .replace("\\/", "/")
            .replace("\\u0026", "&")
            .replace("\\u0025", "%")
            .replace("&amp;", "&")
            .trim()
    }

    private fun buildProviderMedia(
        id: String,
        title: String,
        author: String,
        thumb: String,
        provider: VideoProvider,
        webpageUrl: String,
        directMediaUrl: String,
        pairedAudioUrl: String = "",
        streamUserAgent: String = UA_DESKTOP
    ): ResolvedMedia {
        // Never treat an HTML webpage URL as a raw downloadable MP4/MP3 stream
        val hasDirectStream = directMediaUrl.isNotBlank() && directMediaUrl != webpageUrl ||
            listOf(".mp4", ".mp3", ".m4a", ".webm", ".m3u8").any { directMediaUrl.lowercase().contains(it) }
        val resolvedStreamUrl = if (hasDirectStream) directMediaUrl else ""
        val isAudioDirect = listOf(".mp3", ".m4a", ".ogg", ".wav").any { resolvedStreamUrl.lowercase().contains(it) }
        val videoExt = when {
            ".webm" in resolvedStreamUrl.lowercase() -> "webm"
            else -> "mp4"
        }
        val audioExt = when {
            ".mp3" in resolvedStreamUrl.lowercase() -> "mp3"
            ".m4a" in resolvedStreamUrl.lowercase() -> "m4a"
            else -> "mp4"
        }

        val videoResolutions = if (isAudioDirect) {
            emptyList()
        } else {
            listOf(360, 480, 720, 1080).map { h ->
                val label = when (h) {
                    480 -> "480p SD"
                    720 -> "720p HD"
                    1080 -> "1080p Full HD"
                    else -> "${h}p"
                }
                val kbps = h * 4
                StreamFormat(
                    formatId = "${provider.name.lowercase()}_${h}p",
                    label = label,
                    resolutionTag = "${h}P",
                    qualityHeight = h,
                    bitrateKbps = kbps,
                    mimeType = if (videoExt == "webm") "video/webm" else "video/mp4",
                    extension = videoExt,
                    isAudioOnly = false,
                    hasMuxedAudio = pairedAudioUrl.isBlank(),
                    contentLengthBytes = InnerTubeClient.estimateBytes(kbps, 120),
                    url = resolvedStreamUrl,
                    streamUserAgent = streamUserAgent,
                    pairedAudioUrl = pairedAudioUrl
                )
            }
        }

        val audioStreamUrl = pairedAudioUrl.ifBlank { resolvedStreamUrl }
        val audioProfiles = listOf(128, 192, 320).map { kbps ->
            StreamFormat(
                formatId = "${provider.name.lowercase()}_audio_${kbps}k",
                label = "${kbps}kbps Audio",
                resolutionTag = "${kbps}K ${audioExt.uppercase()}",
                qualityHeight = 0,
                bitrateKbps = kbps,
                mimeType = if (audioExt == "mp3") "audio/mpeg" else "audio/mp4",
                extension = if (pairedAudioUrl.isNotBlank()) "m4a" else audioExt,
                isAudioOnly = true,
                hasMuxedAudio = true,
                contentLengthBytes = InnerTubeClient.estimateBytes(kbps, 120),
                url = audioStreamUrl,
                streamUserAgent = streamUserAgent
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
            playableVideoUrl = resolvedStreamUrl,
            playableAudioUrl = audioStreamUrl,
            streamUserAgent = streamUserAgent
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
