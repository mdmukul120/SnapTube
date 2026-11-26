package com.example.data.network

import com.example.BuildConfig
import com.example.model.CommentItem
import com.example.model.ResolvedMedia
import com.example.model.StreamFormat
import com.example.model.VideoItem
import com.example.model.VideoProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.net.URLEncoder
import java.util.concurrent.TimeUnit
import java.util.regex.Pattern

class InnerTubeClient(
    private val httpClient: OkHttpClient
) {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    private val probeClient: OkHttpClient by lazy {
        httpClient.newBuilder()
            .connectTimeout(6, TimeUnit.SECONDS)
            .readTimeout(6, TimeUnit.SECONDS)
            .build()
    }

    @Volatile
    private var cachedApiKey: String? = null

    @Volatile
    private var cachedVisitorData: String? = null

    private fun configuredApiKey(): String? {
        val buildKey = runCatching { BuildConfig.YOUTUBE_INNERTUBE_KEY }.getOrNull()
        if (!buildKey.isNullOrBlank() && buildKey != "MY_YOUTUBE_INNERTUBE_KEY") {
            return buildKey
        }
        return cachedApiKey
    }

    private suspend fun ensureApiKey(): String? {
        configuredApiKey()?.let { return it }
        return withContext(Dispatchers.IO) {
            runCatching {
                val req = Request.Builder()
                    .url("https://m.youtube.com/?noapp=1&client=mv-google")
                    .header("User-Agent", MOBILE_UA)
                    .build()
                httpClient.newCall(req).execute().use { resp ->
                    val body = resp.body?.string().orEmpty()
                    val matcher = Pattern.compile("\"INNERTUBE_API_KEY\":\"([^\"]+)\"").matcher(body)
                    if (matcher.find()) {
                        matcher.group(1)?.also { cachedApiKey = it }
                    } else null
                }
            }.getOrNull()
        }
    }

    private suspend fun ensureVisitorData(apiKey: String?): String? {
        cachedVisitorData?.let { return it }
        return withContext(Dispatchers.IO) {
            runCatching {
                val endpoint = if (!apiKey.isNullOrBlank()) {
                    "https://www.youtube.com/youtubei/v1/visitor_id?prettyPrint=false&key=$apiKey"
                } else {
                    "https://www.youtube.com/youtubei/v1/visitor_id?prettyPrint=false"
                }
                val payload = buildJsonObject { put("context", webClientContext()) }
                val root = postJson(endpoint, payload, DESKTOP_UA, clientId = "1", clientVersion = "2.20250101.00.00")
                val vd = root?.get("responseContext")?.jsonObject?.str("visitorData")
                    ?: root?.str("visitorData")
                if (!vd.isNullOrBlank()) {
                    cachedVisitorData = vd
                }
                vd
            }.getOrNull()
        }
    }

    private fun playerEndpoint(apiKey: String?): String {
        return if (!apiKey.isNullOrBlank()) {
            "https://youtubei.googleapis.com/youtubei/v1/player?key=$apiKey"
        } else {
            "https://www.youtube.com/youtubei/v1/player"
        }
    }

    private fun searchEndpoint(apiKey: String?): String {
        return if (!apiKey.isNullOrBlank()) {
            "https://www.youtube.com/youtubei/v1/search?key=$apiKey"
        } else {
            "https://www.youtube.com/youtubei/v1/search"
        }
    }

    private fun browseEndpoint(apiKey: String?, isMusic: Boolean = false): String {
        val base = if (isMusic) {
            "https://music.youtube.com/youtubei/v1/browse"
        } else {
            "https://www.youtube.com/youtubei/v1/browse"
        }
        return if (!apiKey.isNullOrBlank()) "$base?key=$apiKey" else base
    }

    private fun nextEndpoint(apiKey: String?): String {
        return if (!apiKey.isNullOrBlank()) {
            "https://www.youtube.com/youtubei/v1/next?key=$apiKey"
        } else {
            "https://www.youtube.com/youtubei/v1/next"
        }
    }

    suspend fun fetchSearchSuggestions(query: String): List<String> = withContext(Dispatchers.IO) {
        if (query.isBlank()) return@withContext emptyList()
        runCatching {
            val encoded = URLEncoder.encode(query.trim(), "UTF-8")
            val url = "https://clients1.google.com/complete/search?nolabels=t&client=youtube&ds=yt&q=$encoded"
            val req = Request.Builder()
                .url(url)
                .header("User-Agent", DESKTOP_UA)
                .build()
            httpClient.newCall(req).execute().use { resp ->
                val raw = resp.body?.string().orEmpty()
                val start = raw.indexOf('[')
                val end = raw.lastIndexOf(']')
                if (start in 0 until end) {
                    val arr = json.parseToJsonElement(raw.substring(start, end + 1)).jsonArray
                    val suggestionsArr = arr.getOrNull(1)?.jsonArray ?: return@use emptyList()
                    suggestionsArr.mapNotNull { item ->
                        item.jsonArray.getOrNull(0)?.jsonPrimitive?.contentOrNull
                    }.take(8)
                } else emptyList()
            }
        }.getOrDefault(emptyList())
    }

    suspend fun searchVideos(
        query: String,
        filter: String = "ALL"
    ): List<VideoItem> = withContext(Dispatchers.IO) {
        val apiKey = ensureApiKey()
        val params = when (filter.uppercase()) {
            "PLAYLIST" -> "EgIQAw%3D%3D"
            "CHANNEL" -> "EgIQAg%3D%3D"
            else -> null
        }
        val payload = buildJsonObject {
            put("context", webClientContext())
            put("query", query)
            if (params != null) put("params", params)
        }
        val root = postJson(searchEndpoint(apiKey), payload)
        val extracted = mutableListOf<VideoItem>()
        if (root != null) {
            collectRenderers(root, extracted)
        }
        extracted.distinctBy { it.id }
    }

    suspend fun fetchTrending(isMusicTab: Boolean = false): List<VideoItem> = withContext(Dispatchers.IO) {
        val apiKey = ensureApiKey()
        val browseId = if (isMusicTab) "FEmusic_explore" else "FEtrending"
        val payload = buildJsonObject {
            put("context", if (isMusicTab) webRemixContext() else webClientContext())
            put("browseId", browseId)
        }
        val root = postJson(browseEndpoint(apiKey, isMusic = isMusicTab), payload)
            ?: if (isMusicTab) {
                postJson(
                    "https://charts.youtube.com/youtubei/v1/browse?alt=json",
                    buildJsonObject {
                        put("context", webClientContext())
                        put("browseId", "FEtrending")
                        put("params", "4gINGgt5dG1hX2NoYXJ0cw%3D%3D")
                    }
                )
            } else null

        val extracted = mutableListOf<VideoItem>()
        if (root != null) {
            collectRenderers(root, extracted)
        }
        if (extracted.isEmpty()) {
            val fallbackQuery = if (isMusicTab) "top trending music 2026" else "bangla natok 2026 trending"
            return@withContext searchVideos(fallbackQuery)
        }
        extracted.distinctBy { it.id }
    }

    private data class ClientProfile(
        val name: String,
        val clientId: String,
        val clientVersion: String,
        val userAgent: String,
        val contextBuilder: (String?) -> JsonObject
    )

    suspend fun resolvePlayer(
        videoId: String,
        fallbackVideo: VideoItem? = null
    ): ResolvedMedia = withContext(Dispatchers.IO) {
        val apiKey = ensureApiKey()
        val visitorData = ensureVisitorData(apiKey)

        val profiles = listOf(
            ClientProfile(
                name = "ANDROID_VR",
                clientId = "28",
                clientVersion = "1.60.19",
                userAgent = ANDROID_VR_UA,
                contextBuilder = { vd -> androidVrContext(vd) }
            ),
            ClientProfile(
                name = "IOS",
                clientId = "5",
                clientVersion = "20.03.02",
                userAgent = IOS_YT_UA,
                contextBuilder = { vd -> iosClientContext(vd) }
            ),
            ClientProfile(
                name = "ANDROID",
                clientId = "3",
                clientVersion = "20.10.38",
                userAgent = ANDROID_YT_UA,
                contextBuilder = { vd -> androidClientContext(vd) }
            ),
            ClientProfile(
                name = "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
                clientId = "85",
                clientVersion = "2.0",
                userAgent = TV_UA,
                contextBuilder = { vd -> tvEmbeddedContext(vd) }
            )
        )

        var chosenRoot: JsonObject? = null
        var chosenUa: String = ANDROID_VR_UA
        var bestRawFormats: List<StreamFormat> = emptyList()
        var hlsFallbackUrl = ""

        val endpointsToTry = buildList {
            add(playerEndpoint(apiKey))
            if (!apiKey.isNullOrBlank()) {
                add("https://www.youtube.com/youtubei/v1/player?key=$apiKey")
            }
        }

        outer@ for (profile in profiles) {
            val payload = buildJsonObject {
                put("context", profile.contextBuilder(visitorData))
                put("videoId", videoId)
                put("contentCheckOk", true)
                put("racyCheckOk", true)
                if (profile.name == "TVHTML5_SIMPLY_EMBEDDED_PLAYER") {
                    put("playbackContext", buildJsonObject {
                        put("contentPlaybackContext", buildJsonObject {
                            put("signatureTimestamp", 20073)
                        })
                    })
                }
            }

            for (ep in endpointsToTry) {
                val root = postJson(
                    url = ep,
                    bodyJson = payload,
                    userAgent = profile.userAgent,
                    clientId = profile.clientId,
                    clientVersion = profile.clientVersion,
                    visitorData = visitorData
                ) ?: continue

                if (chosenRoot == null && root["videoDetails"] != null) {
                    chosenRoot = root
                }

                val playStatus = root["playabilityStatus"]?.jsonObject?.str("status").orEmpty()
                val sd = root["streamingData"]?.jsonObject ?: continue
                val muxed = sd["formats"]?.jsonArray.orEmpty()
                val adaptive = sd["adaptiveFormats"]?.jsonArray.orEmpty()
                val hls = sd.str("hlsManifestUrl").orEmpty()

                val parsed = parseStreamingFormats(
                    muxed = muxed,
                    adaptive = adaptive,
                    durationSecs = root["videoDetails"]?.jsonObject?.str("lengthSeconds")?.toLongOrNull() ?: 0L,
                    streamUa = profile.userAgent
                )

                val probeCandidate = parsed.firstOrNull { it.hasMuxedAudio && it.url.isNotBlank() }?.url
                    ?: parsed.firstOrNull { it.url.isNotBlank() }?.url

                if (playStatus == "OK" && probeCandidate != null && probeStreamReachable(probeCandidate, profile.userAgent)) {
                    chosenRoot = root
                    chosenUa = profile.userAgent
                    bestRawFormats = parsed
                    hlsFallbackUrl = hls
                    break@outer
                } else if (bestRawFormats.isEmpty() && parsed.isNotEmpty()) {
                    chosenRoot = root
                    chosenUa = profile.userAgent
                    bestRawFormats = parsed
                    hlsFallbackUrl = hls
                }
            }
        }

        // If YouTube blocked direct InnerTube streams on this IP, try Piped & Invidious fallback APIs!
        if (bestRawFormats.isEmpty() || !bestRawFormats.any { probeStreamReachable(it.url, it.streamUserAgent) }) {
            val pipedResult = fetchFromPipedOrInvidious(videoId, fallbackVideo)
            if (pipedResult != null && (pipedResult.videoFormats.isNotEmpty() || pipedResult.audioFormats.isNotEmpty())) {
                val nextRoot = fetchNextMetadata(apiKey, videoId)
                val related = mutableListOf<VideoItem>()
                val comments = mutableListOf<CommentItem>()
                if (nextRoot != null) {
                    collectRenderers(nextRoot, related)
                    collectComments(nextRoot, comments)
                }
                return@withContext pipedResult.copy(
                    relatedVideos = related.filter { it.id != videoId }.distinctBy { it.id }.take(15),
                    comments = comments.take(12)
                )
            }
        }

        val videoDetails = chosenRoot?.get("videoDetails")?.jsonObject
        val title = videoDetails?.str("title")
            ?: fallbackVideo?.title
            ?: fetchOembedTitle("https://www.youtube.com/watch?v=$videoId")
            ?: "YouTube Video ($videoId)"
        val author = videoDetails?.str("author") ?: fallbackVideo?.channelName ?: "YouTube"
        val lengthSecs = videoDetails?.str("lengthSeconds")?.toLongOrNull() ?: fallbackVideo?.durationSeconds ?: 0L
        val durationText = if (lengthSecs > 0L) formatDuration(lengthSecs) else (fallbackVideo?.durationText ?: "03:45")
        val viewCountRaw = videoDetails?.str("viewCount")?.toLongOrNull()
        val viewsText = if (viewCountRaw != null) formatViews(viewCountRaw) else (fallbackVideo?.viewCountText ?: "")
        val thumbUrl = videoDetails?.get("thumbnail")?.jsonObject
            ?.get("thumbnails")?.jsonArray?.lastOrNull()?.jsonObject?.str("url")
            ?: fallbackVideo?.thumbnailUrl
            ?: "https://i.ytimg.com/vi/$videoId/hqdefault.jpg"

        val resolvedVideo = VideoItem(
            id = videoId,
            title = title,
            channelName = author,
            channelAvatarUrl = fallbackVideo?.channelAvatarUrl.orEmpty(),
            thumbnailUrl = thumbUrl,
            durationText = durationText,
            durationSeconds = lengthSecs,
            viewCountText = viewsText,
            provider = VideoProvider.YOUTUBE,
            webpageUrl = "https://www.youtube.com/watch?v=$videoId"
        )

        val (videoFormats, audioFormats) = buildCompleteResolutionCatalog(bestRawFormats, lengthSecs, chosenUa)

        val bestPlayableVideo = bestRawFormats.firstOrNull { it.hasMuxedAudio && it.url.isNotBlank() }?.url
            ?: videoFormats.firstOrNull { it.qualityHeight == 720 && it.url.isNotBlank() }?.url
            ?: videoFormats.firstOrNull { it.qualityHeight == 360 && it.url.isNotBlank() }?.url
            ?: hlsFallbackUrl.takeIf { it.isNotBlank() }
            ?: videoFormats.firstOrNull { it.url.isNotBlank() }?.url
            ?: ""
        val bestPlayableAudio = audioFormats.firstOrNull { it.url.isNotBlank() }?.url
            ?: bestPlayableVideo

        val nextRoot = fetchNextMetadata(apiKey, videoId)
        val related = mutableListOf<VideoItem>()
        val comments = mutableListOf<CommentItem>()
        if (nextRoot != null) {
            collectRenderers(nextRoot, related)
            collectComments(nextRoot, comments)
        }

        ResolvedMedia(
            videoItem = resolvedVideo,
            videoFormats = videoFormats,
            audioFormats = audioFormats,
            playableVideoUrl = bestPlayableVideo,
            playableAudioUrl = bestPlayableAudio,
            streamUserAgent = chosenUa,
            relatedVideos = related.filter { it.id != videoId }.distinctBy { it.id }.take(15),
            comments = comments.take(12)
        )
    }

    private suspend fun fetchNextMetadata(apiKey: String?, videoId: String): JsonObject? {
        val nextPayload = buildJsonObject {
            put("context", webClientContext())
            put("videoId", videoId)
        }
        return postJson(nextEndpoint(apiKey), nextPayload)
    }

    private fun probeStreamReachable(url: String, userAgent: String): Boolean {
        if (url.isBlank()) return false
        return runCatching {
            val req = Request.Builder()
                .url(url)
                .header("User-Agent", userAgent)
                .header("Range", "bytes=0-1023")
                .build()
            probeClient.newCall(req).execute().use { resp ->
                resp.code in 200..299
            }
        }.getOrDefault(false)
    }

    private fun fetchFromPipedOrInvidious(videoId: String, fallback: VideoItem?): ResolvedMedia? {
        val pipedBases = listOf(
            "https://pipedapi.kavin.rocks",
            "https://api.piped.private.coffee",
            "https://pipedapi.adminforge.de"
        )
        for (base in pipedBases) {
            val res = runCatching {
                val req = Request.Builder()
                    .url("$base/streams/$videoId")
                    .header("User-Agent", DESKTOP_UA)
                    .build()
                probeClient.newCall(req).execute().use { resp ->
                    if (!resp.isSuccessful) return@use null
                    val obj = json.parseToJsonElement(resp.body?.string().orEmpty()).jsonObject
                    val title = obj.str("title") ?: fallback?.title ?: "YouTube Video"
                    val author = obj.str("uploader") ?: fallback?.channelName ?: "YouTube"
                    val duration = obj.long("duration") ?: fallback?.durationSeconds ?: 0L
                    val thumb = obj.str("thumbnailUrl") ?: "https://i.ytimg.com/vi/$videoId/hqdefault.jpg"
                    val views = obj.long("views") ?: 0L

                    val rawFormats = mutableListOf<StreamFormat>()
                    obj["audioStreams"]?.jsonArray?.forEach { el ->
                        val a = el.jsonObject
                        val url = a.str("url").orEmpty()
                        val mime = a.str("mimeType") ?: "audio/mp4"
                        val bitrate = (a.int("bitrate") ?: 128000) / 1000
                        val len = a.long("contentLength") ?: estimateBytes(bitrate, duration)
                        if (url.isNotBlank()) {
                            rawFormats += StreamFormat(
                                formatId = "piped_a_${bitrate}",
                                label = "${bitrate}K Audio",
                                resolutionTag = "${bitrate}K",
                                qualityHeight = 0,
                                bitrateKbps = bitrate,
                                mimeType = mime,
                                extension = if ("mp4" in mime || "m4a" in mime) "m4a" else "mp3",
                                isAudioOnly = true,
                                hasMuxedAudio = true,
                                contentLengthBytes = len,
                                url = url,
                                streamUserAgent = DESKTOP_UA
                            )
                        }
                    }

                    obj["videoStreams"]?.jsonArray?.forEach { el ->
                        val v = el.jsonObject
                        val url = v.str("url").orEmpty()
                        val mime = v.str("mimeType") ?: "video/mp4"
                        val height = v.int("height") ?: 0
                        val videoOnly = v["videoOnly"]?.jsonPrimitive?.contentOrNull?.toBooleanStrictOrNull() ?: true
                        val bitrate = (v.int("bitrate") ?: (height * 4000)) / 1000
                        val len = v.long("contentLength") ?: estimateBytes(bitrate, duration)
                        if (url.isNotBlank() && height > 0) {
                            rawFormats += StreamFormat(
                                formatId = "piped_v_${height}",
                                label = "${height}p",
                                resolutionTag = "${height}P",
                                qualityHeight = height,
                                bitrateKbps = bitrate,
                                mimeType = mime,
                                extension = "mp4",
                                isAudioOnly = false,
                                hasMuxedAudio = !videoOnly,
                                contentLengthBytes = len,
                                url = url,
                                fps = v.int("fps") ?: 30,
                                streamUserAgent = DESKTOP_UA
                            )
                        }
                    }

                    if (rawFormats.isEmpty()) return@use null
                    val (vList, aList) = buildCompleteResolutionCatalog(rawFormats, duration, DESKTOP_UA)
                    val hls = obj.str("hls").orEmpty()
                    val bestPlayable = rawFormats.firstOrNull { it.hasMuxedAudio }?.url
                        ?: hls.takeIf { it.isNotBlank() }
                        ?: vList.firstOrNull()?.url.orEmpty()
                    val bestAudio = aList.firstOrNull()?.url ?: bestPlayable

                    ResolvedMedia(
                        videoItem = VideoItem(
                            id = videoId,
                            title = title,
                            channelName = author,
                            thumbnailUrl = thumb,
                            durationText = formatDuration(duration),
                            durationSeconds = duration,
                            viewCountText = if (views > 0) formatViews(views) else "",
                            provider = VideoProvider.YOUTUBE,
                            webpageUrl = "https://www.youtube.com/watch?v=$videoId"
                        ),
                        videoFormats = vList,
                        audioFormats = aList,
                        playableVideoUrl = bestPlayable,
                        playableAudioUrl = bestAudio,
                        streamUserAgent = DESKTOP_UA
                    )
                }
            }.getOrNull()
            if (res != null) return res
        }

        val invidiousBases = listOf("https://inv.nadeko.net", "https://yewtu.be")
        for (base in invidiousBases) {
            val res = runCatching {
                val req = Request.Builder()
                    .url("$base/api/v1/videos/$videoId")
                    .header("User-Agent", DESKTOP_UA)
                    .build()
                probeClient.newCall(req).execute().use { resp ->
                    if (!resp.isSuccessful) return@use null
                    val obj = json.parseToJsonElement(resp.body?.string().orEmpty()).jsonObject
                    val title = obj.str("title") ?: fallback?.title ?: "YouTube Video"
                    val author = obj.str("author") ?: fallback?.channelName ?: "YouTube"
                    val duration = obj.long("lengthSeconds") ?: fallback?.durationSeconds ?: 0L
                    val thumb = "https://i.ytimg.com/vi/$videoId/hqdefault.jpg"
                    val rawFormats = mutableListOf<StreamFormat>()
                    obj["formatStreams"]?.jsonArray?.forEach { el ->
                        val f = el.jsonObject
                        val url = f.str("url").orEmpty()
                        val resLabel = f.str("resolution") ?: "360p"
                        val h = resLabel.filter { it.isDigit() }.toIntOrNull() ?: 360
                        if (url.isNotBlank()) {
                            rawFormats += StreamFormat(
                                formatId = "inv_${h}p",
                                label = resLabel,
                                resolutionTag = "${h}P",
                                qualityHeight = h,
                                bitrateKbps = h * 3,
                                mimeType = "video/mp4",
                                extension = "mp4",
                                isAudioOnly = false,
                                hasMuxedAudio = true,
                                contentLengthBytes = estimateBytes(h * 3, duration),
                                url = url,
                                streamUserAgent = DESKTOP_UA
                            )
                        }
                    }
                    obj["adaptiveFormats"]?.jsonArray?.forEach { el ->
                        val f = el.jsonObject
                        val url = f.str("url").orEmpty()
                        val type = f.str("type").orEmpty()
                        val isAudio = type.startsWith("audio/")
                        val bitrate = (f.str("bitrate")?.toIntOrNull() ?: 128000) / 1000
                        val resLabel = f.str("resolution") ?: ""
                        val h = resLabel.filter { it.isDigit() }.toIntOrNull() ?: 0
                        if (url.isNotBlank()) {
                            rawFormats += StreamFormat(
                                formatId = "inv_ad_${if (isAudio) bitrate else h}",
                                label = if (isAudio) "${bitrate}K Audio" else "${h}p",
                                resolutionTag = if (isAudio) "${bitrate}K" else "${h}P",
                                qualityHeight = h,
                                bitrateKbps = bitrate,
                                mimeType = type.substringBefore(";"),
                                extension = if (isAudio) "m4a" else "mp4",
                                isAudioOnly = isAudio,
                                hasMuxedAudio = false,
                                contentLengthBytes = f.str("clen")?.toLongOrNull() ?: estimateBytes(bitrate, duration),
                                url = url,
                                streamUserAgent = DESKTOP_UA
                            )
                        }
                    }
                    if (rawFormats.isEmpty()) return@use null
                    val (vList, aList) = buildCompleteResolutionCatalog(rawFormats, duration, DESKTOP_UA)
                    val bestPlayable = rawFormats.firstOrNull { it.hasMuxedAudio }?.url ?: vList.firstOrNull()?.url.orEmpty()
                    val bestAudio = aList.firstOrNull()?.url ?: bestPlayable
                    ResolvedMedia(
                        videoItem = VideoItem(
                            id = videoId,
                            title = title,
                            channelName = author,
                            thumbnailUrl = thumb,
                            durationText = formatDuration(duration),
                            durationSeconds = duration,
                            provider = VideoProvider.YOUTUBE,
                            webpageUrl = "https://www.youtube.com/watch?v=$videoId"
                        ),
                        videoFormats = vList,
                        audioFormats = aList,
                        playableVideoUrl = bestPlayable,
                        playableAudioUrl = bestAudio,
                        streamUserAgent = DESKTOP_UA
                    )
                }
            }.getOrNull()
            if (res != null) return res
        }
        return null
    }

    private fun parseStreamingFormats(
        muxed: List<JsonElement>,
        adaptive: List<JsonElement>,
        durationSecs: Long,
        streamUa: String
    ): List<StreamFormat> {
        val out = mutableListOf<StreamFormat>()
        val all = muxed.map { it.jsonObject to true } + adaptive.map { it.jsonObject to false }
        for ((obj, isMuxed) in all) {
            val url = obj.str("url").orEmpty()
            if (url.isBlank()) continue
            val mime = obj.str("mimeType").orEmpty()
            val itag = obj.int("itag")?.toString() ?: "0"
            val bitrate = (obj.int("bitrate") ?: 128000) / 1000
            val contentLength = obj.str("contentLength")?.toLongOrNull()
                ?: estimateBytes(bitrate, durationSecs)
            val isAudio = mime.startsWith("audio/")
            val height = obj.int("height") ?: 0
            val fps = obj.int("fps") ?: 30
            val qualityLabel = obj.str("qualityLabel") ?: if (height > 0) "${height}p" else "${bitrate}kbps"
            val ext = when {
                isAudio -> "m4a"
                "webm" in mime -> "webm"
                else -> "mp4"
            }

            out += StreamFormat(
                formatId = "yt_$itag",
                label = if (isAudio) "${bitrate}K Audio" else qualityLabel,
                resolutionTag = if (isAudio) "${bitrate}K" else "${height}P",
                qualityHeight = height,
                bitrateKbps = bitrate,
                mimeType = mime.substringBefore(";").ifBlank { if (isAudio) "audio/mp4" else "video/mp4" },
                extension = ext,
                isAudioOnly = isAudio,
                hasMuxedAudio = isMuxed,
                contentLengthBytes = contentLength,
                url = url,
                fps = fps,
                streamUserAgent = streamUa
            )
        }
        return out
    }

    private fun buildCompleteResolutionCatalog(
        rawFormats: List<StreamFormat>,
        durationSecs: Long,
        streamUa: String
    ): Pair<List<StreamFormat>, List<StreamFormat>> {
        val rawVideos = rawFormats.filter { !it.isAudioOnly }
        val rawAudios = rawFormats.filter { it.isAudioOnly }.sortedByDescending { it.bitrateKbps }

        val bestMuxedFallback = rawVideos.filter { it.hasMuxedAudio }.maxByOrNull { it.qualityHeight }?.url
            ?: rawVideos.firstOrNull { it.url.isNotBlank() }?.url
            ?: ""
        // Prefer audio/mp4 (m4a) for MediaMuxer & native Android playback compatibility
        val bestM4aAudio = rawAudios.firstOrNull { "mp4" in it.mimeType || it.extension == "m4a" }
            ?: rawAudios.firstOrNull()
        val bestAudioUrl = bestM4aAudio?.url?.takeIf { it.isNotBlank() } ?: bestMuxedFallback

        val targetHeights = listOf(
            144 to "144p",
            240 to "240p",
            360 to "360p",
            480 to "480p SD",
            720 to "720p HD",
            1080 to "1080p Full HD",
            1440 to "1440p 2K",
            2160 to "2160p 4K"
        )

        val videoCatalog = targetHeights.map { (h, title) ->
            // Prefer MP4 codec streams for universal Android compatibility and MediaMuxer support
            val exact = rawVideos.filter { it.qualityHeight == h }
                .sortedWith(compareByDescending<StreamFormat> { it.hasMuxedAudio }.thenByDescending { "mp4" in it.mimeType })
                .firstOrNull()
            val nearest = exact ?: rawVideos
                .filter { "mp4" in it.mimeType || it.hasMuxedAudio }
                .minByOrNull { kotlin.math.abs(it.qualityHeight - h) }
                ?: rawVideos.minByOrNull { kotlin.math.abs(it.qualityHeight - h) }
            val estBitrate = when (h) {
                144 -> 180
                240 -> 350
                360 -> 650
                480 -> 1100
                720 -> 2400
                1080 -> 4500
                1440 -> 8500
                else -> 16000
            }
            val chosen = exact ?: nearest
            val resolvedUrl = chosen?.url?.takeIf { it.isNotBlank() } ?: bestMuxedFallback
            val isMuxed = chosen?.hasMuxedAudio ?: true
            val pairedAudio = if (!isMuxed && "mp4" in chosen.mimeType && bestM4aAudio != null) {
                bestM4aAudio.url
            } else {
                ""
            }

            StreamFormat(
                formatId = chosen?.formatId?.let { "${it}_$h" } ?: "mp4_${h}p",
                label = title,
                resolutionTag = "${h}P",
                qualityHeight = h,
                bitrateKbps = chosen?.bitrateKbps ?: estBitrate,
                mimeType = "video/mp4",
                extension = "mp4",
                isAudioOnly = false,
                hasMuxedAudio = isMuxed,
                contentLengthBytes = chosen?.contentLengthBytes ?: estimateBytes(estBitrate, durationSecs),
                url = resolvedUrl,
                fps = chosen?.fps ?: if (h >= 720) 60 else 30,
                streamUserAgent = chosen?.streamUserAgent ?: streamUa,
                pairedAudioUrl = pairedAudio
            )
        }

        val targetBitrates = listOf(
            64 to "64kbps MP3",
            128 to "128kbps MP3",
            192 to "192kbps MP3",
            256 to "256kbps MP3",
            320 to "320kbps MP3"
        )

        val audioCatalog = targetBitrates.map { (kbps, title) ->
            val closest = rawAudios.minByOrNull { kotlin.math.abs(it.bitrateKbps - kbps) } ?: bestM4aAudio
            StreamFormat(
                formatId = "mp3_${kbps}k",
                label = title,
                resolutionTag = "${kbps}K MP3",
                qualityHeight = 0,
                bitrateKbps = kbps,
                mimeType = closest?.mimeType ?: "audio/mp4",
                extension = "m4a",
                isAudioOnly = true,
                hasMuxedAudio = true,
                contentLengthBytes = closest?.contentLengthBytes ?: estimateBytes(kbps, durationSecs),
                url = closest?.url?.takeIf { it.isNotBlank() } ?: bestAudioUrl,
                streamUserAgent = closest?.streamUserAgent ?: streamUa
            )
        }

        return videoCatalog to audioCatalog
    }

    private suspend fun fetchOembedTitle(videoUrl: String): String? = withContext(Dispatchers.IO) {
        runCatching {
            val encoded = URLEncoder.encode(videoUrl, "UTF-8")
            val req = Request.Builder()
                .url("https://www.youtube.com/oembed?url=$encoded&format=json")
                .build()
            httpClient.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) return@use null
                val body = resp.body?.string().orEmpty()
                json.parseToJsonElement(body).jsonObject.str("title")
            }
        }.getOrNull()
    }

    private fun postJson(
        url: String,
        bodyJson: JsonObject,
        userAgent: String = DESKTOP_UA,
        clientId: String? = null,
        clientVersion: String? = null,
        visitorData: String? = null
    ): JsonObject? {
        return runCatching {
            val mediaType = "application/json; charset=utf-8".toMediaType()
            val builder = Request.Builder()
                .url(url)
                .header("User-Agent", userAgent)
                .header("Content-Type", "application/json")
            if (clientId != null) builder.header("X-YouTube-Client-Name", clientId)
            if (clientVersion != null) builder.header("X-YouTube-Client-Version", clientVersion)
            if (!visitorData.isNullOrBlank()) builder.header("X-Goog-Visitor-Id", visitorData)
            if (userAgent == DESKTOP_UA) {
                builder.header("Origin", "https://www.youtube.com")
                builder.header("Referer", "https://www.youtube.com/")
            }
            val request = builder
                .post(bodyJson.toString().toRequestBody(mediaType))
                .build()
            httpClient.newCall(request).execute().use { resp ->
                if (!resp.isSuccessful) return@use null
                val raw = resp.body?.string().orEmpty()
                if (raw.isBlank()) return@use null
                json.parseToJsonElement(raw).jsonObject
            }
        }.getOrNull()
    }

    private fun collectRenderers(element: JsonElement, out: MutableList<VideoItem>) {
        when (element) {
            is JsonObject -> {
                element["videoRenderer"]?.jsonObject?.let { parseVideoRenderer(it)?.let(out::add) }
                element["compactVideoRenderer"]?.jsonObject?.let { parseVideoRenderer(it)?.let(out::add) }
                element["gridVideoRenderer"]?.jsonObject?.let { parseVideoRenderer(it)?.let(out::add) }
                element["playlistRenderer"]?.jsonObject?.let { parsePlaylistRenderer(it)?.let(out::add) }
                element["lockupViewModel"]?.jsonObject?.let { parseLockupViewModel(it)?.let(out::add) }
                element.values.forEach { child ->
                    if (out.size < 40) collectRenderers(child, out)
                }
            }
            is JsonArray -> {
                element.forEach { child ->
                    if (out.size < 40) collectRenderers(child, out)
                }
            }
            else -> Unit
        }
    }

    private fun parseVideoRenderer(obj: JsonObject): VideoItem? {
        val videoId = obj.str("videoId") ?: return null
        val title = extractText(obj["title"]) ?: return null
        val channel = extractText(obj["ownerText"])
            ?: extractText(obj["longBylineText"])
            ?: extractText(obj["shortBylineText"])
            ?: "YouTube"
        val duration = extractText(obj["lengthText"]) ?: ""
        val views = extractText(obj["shortViewCountText"]) ?: extractText(obj["viewCountText"]) ?: ""
        val published = extractText(obj["publishedTimeText"]) ?: ""
        val thumb = obj["thumbnail"]?.jsonObject?.get("thumbnails")?.jsonArray
            ?.lastOrNull()?.jsonObject?.str("url")
            ?: "https://i.ytimg.com/vi/$videoId/hqdefault.jpg"
        val avatar = obj["channelThumbnailSupportedRenderers"]?.jsonObject
            ?.get("channelThumbnailWithLinkRenderer")?.jsonObject
            ?.get("thumbnail")?.jsonObject?.get("thumbnails")?.jsonArray
            ?.firstOrNull()?.jsonObject?.str("url").orEmpty()

        return VideoItem(
            id = videoId,
            title = title,
            channelName = channel,
            channelAvatarUrl = avatar,
            thumbnailUrl = thumb,
            durationText = duration,
            durationSeconds = parseDurationToSeconds(duration),
            viewCountText = views,
            publishedText = published,
            provider = VideoProvider.YOUTUBE,
            webpageUrl = "https://www.youtube.com/watch?v=$videoId"
        )
    }

    private fun parsePlaylistRenderer(obj: JsonObject): VideoItem? {
        val playlistId = obj.str("playlistId") ?: return null
        val title = extractText(obj["title"]) ?: return null
        val channel = extractText(obj["shortBylineText"]) ?: "YouTube Playlist"
        val count = extractText(obj["videoCount"])?.filter { it.isDigit() }?.toIntOrNull() ?: 0
        val thumb = obj["thumbnails"]?.jsonArray?.firstOrNull()?.jsonObject
            ?.get("thumbnails")?.jsonArray?.lastOrNull()?.jsonObject?.str("url")
            ?: obj["thumbnail"]?.jsonObject?.get("thumbnails")?.jsonArray
                ?.lastOrNull()?.jsonObject?.str("url")
            ?: ""
        val firstVideoId = obj["videos"]?.jsonArray?.firstOrNull()?.jsonObject
            ?.get("childVideoRenderer")?.jsonObject?.str("videoId") ?: playlistId

        return VideoItem(
            id = firstVideoId,
            title = title,
            channelName = channel,
            thumbnailUrl = thumb,
            durationText = "$count videos",
            provider = VideoProvider.YOUTUBE,
            webpageUrl = "https://www.youtube.com/playlist?list=$playlistId",
            isPlaylist = true,
            playlistCount = count,
            playlistId = playlistId
        )
    }

    private fun parseLockupViewModel(obj: JsonObject): VideoItem? {
        val contentId = obj.str("contentId") ?: return null
        val metadata = obj["metadata"]?.jsonObject?.get("lockupMetadataViewModel")?.jsonObject ?: return null
        val title = metadata["title"]?.jsonObject?.str("content") ?: return null
        val thumb = obj["contentImage"]?.jsonObject
            ?.get("collectionThumbnailViewModel")?.jsonObject
            ?.get("primaryThumbnail")?.jsonObject
            ?.get("thumbnailViewModel")?.jsonObject
            ?.get("image")?.jsonObject?.get("sources")?.jsonArray
            ?.lastOrNull()?.jsonObject?.str("url")
            ?: "https://i.ytimg.com/vi/$contentId/hqdefault.jpg"
        return VideoItem(
            id = contentId,
            title = title,
            channelName = "YouTube",
            thumbnailUrl = thumb,
            provider = VideoProvider.YOUTUBE,
            webpageUrl = "https://www.youtube.com/watch?v=$contentId"
        )
    }

    private fun collectComments(element: JsonElement, out: MutableList<CommentItem>) {
        when (element) {
            is JsonObject -> {
                element["commentRenderer"]?.jsonObject?.let { cr ->
                    val author = extractText(cr["authorText"]) ?: "Viewer"
                    val text = extractText(cr["contentText"]) ?: ""
                    val time = extractText(cr["publishedTimeText"]) ?: ""
                    val likes = extractText(cr["voteCount"]) ?: ""
                    if (text.isNotBlank()) out += CommentItem(author, text, time, likes)
                }
                element.values.forEach { child ->
                    if (out.size < 12) collectComments(child, out)
                }
            }
            is JsonArray -> element.forEach { if (out.size < 12) collectComments(it, out) }
            else -> Unit
        }
    }

    private fun extractText(el: JsonElement?): String? {
        if (el == null) return null
        return when (el) {
            is JsonPrimitive -> el.contentOrNull
            is JsonObject -> {
                el.str("simpleText")
                    ?: el["runs"]?.jsonArray?.joinToString("") { it.jsonObject.str("text").orEmpty() }
                        ?.takeIf { it.isNotBlank() }
                    ?: el.str("content")
            }
            else -> null
        }
    }

    private fun JsonObject.str(key: String): String? = (this[key] as? JsonPrimitive)?.contentOrNull
    private fun JsonObject.int(key: String): Int? = (this[key] as? JsonPrimitive)?.intOrNull
    private fun JsonObject.long(key: String): Long? = (this[key] as? JsonPrimitive)?.longOrNull

    private fun webClientContext(): JsonObject = buildJsonObject {
        put("client", buildJsonObject {
            put("clientName", "WEB")
            put("clientVersion", "2.20250101.00.00")
            put("hl", "en")
            put("gl", "BD")
        })
    }

    private fun webRemixContext(): JsonObject = buildJsonObject {
        put("client", buildJsonObject {
            put("clientName", "WEB_REMIX")
            put("clientVersion", "1.20250101.01.00")
            put("hl", "en")
            put("gl", "BD")
        })
    }

    private fun androidVrContext(visitorData: String?): JsonObject = buildJsonObject {
        put("client", buildJsonObject {
            put("clientName", "ANDROID_VR")
            put("clientVersion", "1.60.19")
            put("deviceMake", "Oculus")
            put("deviceModel", "Quest 3")
            put("osName", "Android")
            put("osVersion", "12L")
            put("androidSdkVersion", 32)
            put("hl", "en")
            put("gl", "US")
            if (!visitorData.isNullOrBlank()) put("visitorData", visitorData)
        })
    }

    private fun androidClientContext(visitorData: String?): JsonObject = buildJsonObject {
        put("client", buildJsonObject {
            put("clientName", "ANDROID")
            put("clientVersion", "20.10.38")
            put("androidSdkVersion", 35)
            put("hl", "en")
            put("gl", "US")
            if (!visitorData.isNullOrBlank()) put("visitorData", visitorData)
        })
    }

    private fun iosClientContext(visitorData: String?): JsonObject = buildJsonObject {
        put("client", buildJsonObject {
            put("clientName", "IOS")
            put("clientVersion", "20.03.02")
            put("deviceMake", "Apple")
            put("deviceModel", "iPhone16,2")
            put("osName", "iPhone")
            put("osVersion", "18.2.1.22C161")
            put("hl", "en")
            put("gl", "US")
            if (!visitorData.isNullOrBlank()) put("visitorData", visitorData)
        })
    }

    private fun tvEmbeddedContext(visitorData: String?): JsonObject = buildJsonObject {
        put("client", buildJsonObject {
            put("clientName", "TVHTML5_SIMPLY_EMBEDDED_PLAYER")
            put("clientVersion", "2.0")
            put("hl", "en")
            put("gl", "US")
            if (!visitorData.isNullOrBlank()) put("visitorData", visitorData)
        })
        put("thirdParty", buildJsonObject {
            put("embedUrl", "https://www.youtube.com/")
        })
    }

    companion object {
        private const val DESKTOP_UA =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        private const val MOBILE_UA =
            "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
        private const val ANDROID_VR_UA =
            "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip"
        private const val ANDROID_YT_UA =
            "com.google.android.youtube/20.10.38 (Linux; U; Android 15) gzip"
        private const val IOS_YT_UA =
            "com.google.ios.youtube/20.03.02 (iPhone16,2; U; CPU iOS 18_2_1 like Mac OS X)"
        private const val TV_UA =
            "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version"

        fun extractYouTubeId(url: String): String? {
            val patterns = listOf(
                "(?:v=|/v/|embed/|shorts/|youtu\\.be/|watch\\?v=)([A-Za-z0-9_-]{11})",
                "^([A-Za-z0-9_-]{11})$"
            )
            for (pat in patterns) {
                val m = Pattern.compile(pat).matcher(url.trim())
                if (m.find()) return m.group(1)
            }
            return null
        }

        fun formatDuration(seconds: Long): String {
            if (seconds <= 0L) return "00:00"
            val h = seconds / 3600
            val m = (seconds % 3600) / 60
            val s = seconds % 60
            return if (h > 0) String.format("%d:%02d:%02d", h, m, s)
            else String.format("%02d:%02d", m, s)
        }

        fun parseDurationToSeconds(text: String): Long {
            val parts = text.split(":").mapNotNull { it.trim().toLongOrNull() }
            return when (parts.size) {
                3 -> parts[0] * 3600 + parts[1] * 60 + parts[2]
                2 -> parts[0] * 60 + parts[1]
                1 -> parts[0]
                else -> 0L
            }
        }

        fun formatViews(views: Long): String {
            return when {
                views >= 1_000_000_000 -> String.format("%.1fB views", views / 1_000_000_000.0)
                views >= 1_000_000 -> String.format("%.1fM views", views / 1_000_000.0)
                views >= 1_000 -> String.format("%.1fK views", views / 1_000.0)
                else -> "$views views"
            }
        }

        fun estimateBytes(bitrateKbps: Int, durationSecs: Long): Long {
            val secs = if (durationSecs > 0L) durationSecs else 210L
            return (bitrateKbps.toLong() * 1000L / 8L) * secs
        }
    }
}
