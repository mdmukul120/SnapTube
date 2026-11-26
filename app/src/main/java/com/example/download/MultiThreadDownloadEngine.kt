package com.example.download

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.example.data.local.DownloadEntity
import com.example.data.local.MetaTubeDao
import com.example.data.local.PreferencesRepository
import com.example.data.network.MultiProviderExtractor
import com.example.model.DownloadStatus
import com.example.model.StreamFormat
import com.example.model.VideoItem
import com.example.service.DownloadForegroundService
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

class MultiThreadDownloadEngine(
    private val context: Context,
    private val httpClient: OkHttpClient,
    private val dao: MetaTubeDao,
    private val preferencesRepository: PreferencesRepository,
    private val extractor: MultiProviderExtractor
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val activeJobs = ConcurrentHashMap<String, Job>()

    private val downloadsRoot: File by lazy {
        val base = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: context.filesDir
        File(base, "MetaTube").apply { mkdirs() }
    }

    private val tempPartsRoot: File by lazy {
        File(context.cacheDir, "mt_parts").apply { mkdirs() }
    }

    fun enqueueDownload(
        video: VideoItem,
        format: StreamFormat,
        overrideThreadCount: Int? = null
    ) {
        scope.launch {
            val prefs = preferencesRepository.settingsFlow.first()
            val threads = (overrideThreadCount ?: prefs.downloadThreads).coerceIn(1, 16)
            val safeName = sanitizeFileName("${video.title}_${format.resolutionTag}")
            val ext = format.extension.ifBlank { if (format.isAudioOnly) "m4a" else "mp4" }
            val outFile = File(downloadsRoot, "${safeName}_${System.currentTimeMillis() % 10000}.$ext")
            val id = UUID.randomUUID().toString()

            val entity = DownloadEntity(
                id = id,
                videoId = video.id,
                title = video.title,
                channelName = video.channelName,
                thumbnailUrl = video.thumbnailUrl,
                providerName = video.provider.displayName,
                formatLabel = format.label,
                mimeType = format.mimeType,
                fileExtension = ext,
                isAudioOnly = format.isAudioOnly,
                sourceUrl = video.webpageUrl,
                streamUrl = format.url,
                streamUserAgent = format.streamUserAgent,
                pairedAudioUrl = format.pairedAudioUrl,
                localFilePath = outFile.absolutePath,
                totalBytes = format.contentLengthBytes,
                downloadedBytes = 0L,
                progressPercent = 0f,
                speedBytesPerSec = 0L,
                threadCount = threads,
                status = DownloadStatus.QUEUED,
                durationText = video.durationText
            )
            dao.upsertDownload(entity)
            launchJob(entity)
        }
    }

    fun pauseDownload(id: String) {
        activeJobs.remove(id)?.cancel()
        scope.launch {
            val current = dao.getDownloadById(id) ?: return@launch
            if (current.status != DownloadStatus.COMPLETED) {
                dao.updateDownloadProgress(
                    id = id,
                    downloaded = current.downloadedBytes,
                    total = current.totalBytes,
                    progress = current.progressPercent,
                    speed = 0L,
                    status = DownloadStatus.PAUSED,
                    error = null
                )
            }
            stopServiceIfIdle()
        }
    }

    fun resumeOrRetryDownload(id: String) {
        scope.launch {
            val current = dao.getDownloadById(id) ?: return@launch
            if (current.status == DownloadStatus.COMPLETED) return@launch
            launchJob(current)
        }
    }

    fun cancelAndDelete(id: String) {
        activeJobs.remove(id)?.cancel()
        scope.launch {
            val current = dao.getDownloadById(id)
            if (current != null) {
                runCatching { File(current.localFilePath).delete() }
                cleanupParts(id)
            }
            dao.deleteDownload(id)
            stopServiceIfIdle()
        }
    }

    fun clearTempCache(): Long {
        var freed = 0L
        tempPartsRoot.listFiles()?.forEach { file ->
            val keyPrefix = file.nameWithoutExtension.substringBefore("_")
            if (!activeJobs.containsKey(keyPrefix) && !activeJobs.containsKey(file.name)) {
                freed += calculateDirectorySize(file)
                file.deleteRecursively()
            }
        }
        return freed
    }

    private fun calculateDirectorySize(file: File): Long {
        if (!file.exists()) return 0L
        if (file.isFile) return file.length()
        return file.listFiles()?.sumOf { calculateDirectorySize(it) } ?: 0L
    }

    private fun isOnWifiOrUnmetered(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return true
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) ||
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)
    }

    private fun launchJob(initialEntity: DownloadEntity) {
        activeJobs[initialEntity.id]?.cancel()

        val job = scope.launch {
            val id = initialEntity.id
            try {
                val prefs = preferencesRepository.settingsFlow.first()
                if (prefs.wifiOnly && !isOnWifiOrUnmetered()) {
                    dao.updateDownloadProgress(
                        id = id,
                        downloaded = initialEntity.downloadedBytes,
                        total = initialEntity.totalBytes,
                        progress = initialEntity.progressPercent,
                        speed = 0L,
                        status = DownloadStatus.PAUSED,
                        error = "Wi-Fi only mode is enabled. Connect to Wi-Fi or turn off Wi-Fi Only in Settings."
                    )
                    return@launch
                }

                // Persist DOWNLOADING state before starting foreground service to prevent premature self-stop
                dao.updateDownloadProgress(
                    id = id,
                    downloaded = initialEntity.downloadedBytes,
                    total = initialEntity.totalBytes,
                    progress = initialEntity.progressPercent,
                    speed = 0L,
                    status = DownloadStatus.DOWNLOADING,
                    error = null
                )
                startForegroundServiceIfEnabled(prefs.notificationsEnabled)

                var streamUrl = initialEntity.streamUrl
                var streamUa = initialEntity.streamUserAgent.ifBlank { StreamFormat.DEFAULT_STREAM_UA }
                var pairedAudioUrl = initialEntity.pairedAudioUrl

                if (streamUrl.isBlank() || streamUrl == initialEntity.sourceUrl) {
                    val resolved = resolveFreshFormat(initialEntity)
                    if (resolved != null) {
                        streamUrl = resolved.url
                        streamUa = resolved.streamUserAgent.ifBlank { StreamFormat.DEFAULT_STREAM_UA }
                        pairedAudioUrl = resolved.pairedAudioUrl
                    }
                }

                var probe = probeRemoteStream(streamUrl, streamUa)
                if (probe.statusCode == 403 || probe.statusCode == 410 || probe.statusCode == 0 || probe.isHtml) {
                    // Refresh signed stream URLs + matching client User-Agent before failing
                    val refreshed = resolveFreshFormat(initialEntity)
                    if (refreshed != null && refreshed.url.isNotBlank()) {
                        streamUrl = refreshed.url
                        streamUa = refreshed.streamUserAgent.ifBlank { StreamFormat.DEFAULT_STREAM_UA }
                        pairedAudioUrl = refreshed.pairedAudioUrl
                        probe = probeRemoteStream(streamUrl, streamUa)
                    }
                }

                if (streamUrl.isBlank()) {
                    throw IllegalStateException("No downloadable media stream available for this link")
                }
                if (probe.isHtml) {
                    throw IllegalStateException("Provider returned a webpage instead of a direct media stream")
                }

                val totalSize = if (probe.contentLength > 0L) probe.contentLength else initialEntity.totalBytes
                val outFile = File(initialEntity.localFilePath).apply { parentFile?.mkdirs() }
                val needsMux = !initialEntity.isAudioOnly && pairedAudioUrl.isNotBlank() && pairedAudioUrl != streamUrl

                if (needsMux) {
                    val videoTmp = File(tempPartsRoot, "${id}_video.mp4")
                    val audioTmp = File(tempPartsRoot, "${id}_audio.m4a")
                    try {
                        downloadStreamWithFallback(
                            id = id,
                            url = streamUrl,
                            userAgent = streamUa,
                            probe = probe,
                            expectedTotal = totalSize,
                            threadCount = initialEntity.threadCount,
                            outFile = videoTmp,
                            progressBase = 0f,
                            progressSpan = 84f
                        )
                        // Download paired audio track cleanly
                        val audioProbe = probeRemoteStream(pairedAudioUrl, streamUa)
                        if (audioProbe.isHtml) {
                            throw IllegalStateException("Audio stream expired or returned HTML")
                        }
                        downloadSingleStream(
                            id = id,
                            url = pairedAudioUrl,
                            userAgent = streamUa,
                            expectedTotal = audioProbe.contentLength.coerceAtLeast(1L),
                            outFile = audioTmp,
                            progressBase = 84f,
                            progressSpan = 12f
                        )
                        dao.updateDownloadProgress(
                            id = id,
                            downloaded = videoTmp.length() + audioTmp.length(),
                            total = (videoTmp.length() + audioTmp.length()).coerceAtLeast(1L),
                            progress = 97.5f,
                            speed = 0L,
                            status = DownloadStatus.DOWNLOADING,
                            error = null
                        )
                        val muxedOk = muxVideoAndAudio(videoTmp, audioTmp, outFile)
                        if (!muxedOk) {
                            videoTmp.copyTo(outFile, overwrite = true)
                        }
                    } finally {
                        runCatching { videoTmp.delete() }
                        runCatching { audioTmp.delete() }
                    }
                } else {
                    downloadStreamWithFallback(
                        id = id,
                        url = streamUrl,
                        userAgent = streamUa,
                        probe = probe,
                        expectedTotal = totalSize,
                        threadCount = initialEntity.threadCount,
                        outFile = outFile,
                        progressBase = 0f,
                        progressSpan = 98.5f
                    )
                }

                val finalBytes = outFile.length()
                if (finalBytes <= 0L) {
                    throw IllegalStateException("Empty media stream received")
                }

                exportToMediaStore(outFile, initialEntity)

                dao.upsertDownload(
                    initialEntity.copy(
                        streamUrl = streamUrl,
                        streamUserAgent = streamUa,
                        pairedAudioUrl = pairedAudioUrl,
                        totalBytes = finalBytes,
                        downloadedBytes = finalBytes,
                        progressPercent = 100f,
                        speedBytesPerSec = 0L,
                        status = DownloadStatus.COMPLETED,
                        errorMessage = null,
                        completedAt = System.currentTimeMillis()
                    )
                )
            } catch (ce: CancellationException) {
                throw ce
            } catch (t: Throwable) {
                val latest = dao.getDownloadById(id)
                dao.updateDownloadProgress(
                    id = id,
                    downloaded = latest?.downloadedBytes ?: 0L,
                    total = latest?.totalBytes ?: initialEntity.totalBytes,
                    progress = latest?.progressPercent ?: 0f,
                    speed = 0L,
                    status = DownloadStatus.FAILED,
                    error = t.message ?: "Download failed"
                )
            } finally {
                activeJobs.remove(id)
                stopServiceIfIdle()
            }
        }
        activeJobs[initialEntity.id] = job
    }

    private suspend fun resolveFreshFormat(entity: DownloadEntity): StreamFormat? {
        val url = entity.sourceUrl.ifBlank { "https://www.youtube.com/watch?v=${entity.videoId}" }
        val resolved = runCatching { extractor.resolveUrl(url) }.getOrNull() ?: return null
        return if (entity.isAudioOnly) {
            resolved.audioFormats.firstOrNull { it.label == entity.formatLabel && it.url.isNotBlank() }
                ?: resolved.audioFormats.firstOrNull { it.url.isNotBlank() }
        } else {
            resolved.videoFormats.firstOrNull { it.label == entity.formatLabel && it.url.isNotBlank() }
                ?: resolved.videoFormats.firstOrNull { it.url.isNotBlank() }
        }
    }

    private suspend fun downloadStreamWithFallback(
        id: String,
        url: String,
        userAgent: String,
        probe: StreamProbe,
        expectedTotal: Long,
        threadCount: Int,
        outFile: File,
        progressBase: Float = 0f,
        progressSpan: Float = 98.5f
    ) {
        if (probe.supportsRanges && probe.contentLength > 256_000L && threadCount > 1) {
            try {
                downloadMultiThreaded(
                    id = id,
                    url = url,
                    userAgent = userAgent,
                    totalBytes = probe.contentLength,
                    threadCount = threadCount,
                    outFile = outFile,
                    progressBase = progressBase,
                    progressSpan = progressSpan
                )
                return
            } catch (ce: CancellationException) {
                throw ce
            } catch (_: Throwable) {
                // Some CDNs reject parallel byte-range connections with 403/416 or return 200; fall back cleanly.
                cleanupParts(id)
            }
        }

        downloadSingleStream(
            id = id,
            url = url,
            userAgent = userAgent,
            expectedTotal = expectedTotal,
            outFile = outFile,
            progressBase = progressBase,
            progressSpan = progressSpan
        )
    }

    private data class StreamProbe(
        val contentLength: Long,
        val supportsRanges: Boolean,
        val statusCode: Int,
        val isHtml: Boolean = false
    )

    private fun isHtmlContentType(contentType: String?): Boolean {
        val ct = contentType?.lowercase().orEmpty()
        return ct.startsWith("text/html") || ct.startsWith("application/xhtml+xml")
    }

    private fun probeRemoteStream(url: String, userAgent: String): StreamProbe {
        if (url.isBlank()) return StreamProbe(-1L, false, 0)
        return runCatching {
            val req = Request.Builder()
                .url(url)
                .header("User-Agent", userAgent)
                .header("Range", "bytes=0-0")
                .build()
            httpClient.newCall(req).execute().use { resp ->
                val isHtml = isHtmlContentType(resp.header("Content-Type"))
                if (resp.code == 206) {
                    val contentRange = resp.header("Content-Range").orEmpty()
                    val total = contentRange.substringAfterLast('/').toLongOrNull() ?: -1L
                    StreamProbe(total, supportsRanges = total > 0L && !isHtml, statusCode = 206, isHtml = isHtml)
                } else {
                    val len = resp.header("Content-Length")?.toLongOrNull() ?: -1L
                    val acceptRanges = resp.header("Accept-Ranges")?.equals("bytes", true) == true
                    StreamProbe(len, supportsRanges = acceptRanges && len > 0L && !isHtml, statusCode = resp.code, isHtml = isHtml)
                }
            }
        }.getOrDefault(StreamProbe(-1L, false, 0))
    }

    private suspend fun downloadMultiThreaded(
        id: String,
        url: String,
        userAgent: String,
        totalBytes: Long,
        threadCount: Int,
        outFile: File,
        progressBase: Float = 0f,
        progressSpan: Float = 98.5f
    ) = coroutineScope {
        val partDir = File(tempPartsRoot, id).apply { mkdirs() }
        val chunkSize = totalBytes / threadCount
        val downloadedCounter = AtomicLong(0L)

        val partFiles = (0 until threadCount).map { idx ->
            val f = File(partDir, "part_$idx.tmp")
            if (f.exists()) downloadedCounter.addAndGet(f.length())
            f
        }

        val reporterJob = launch {
            var lastBytes = downloadedCounter.get()
            var lastTime = System.currentTimeMillis()
            while (isActive) {
                delay(450)
                val nowBytes = downloadedCounter.get().coerceAtMost(totalBytes)
                val nowTime = System.currentTimeMillis()
                val dt = (nowTime - lastTime).coerceAtLeast(1L)
                val speed = ((nowBytes - lastBytes).coerceAtLeast(0L) * 1000L) / dt
                lastBytes = nowBytes
                lastTime = nowTime
                val frac = (nowBytes.toDouble() / totalBytes.toDouble()).toFloat().coerceIn(0f, 1f)
                val pct = (progressBase + frac * progressSpan).coerceIn(0f, 98.5f)
                dao.updateDownloadProgress(
                    id = id,
                    downloaded = nowBytes,
                    total = totalBytes,
                    progress = pct,
                    speed = speed,
                    status = DownloadStatus.DOWNLOADING,
                    error = null
                )
            }
        }

        try {
            val chunkTasks = (0 until threadCount).map { idx ->
                async(Dispatchers.IO) {
                    val rangeStart = idx * chunkSize
                    val rangeEnd = if (idx == threadCount - 1) totalBytes - 1 else ((idx + 1) * chunkSize) - 1
                    val partFile = partFiles[idx]
                    val existing = partFile.length()
                    val resumeStart = rangeStart + existing
                    if (resumeStart > rangeEnd) return@async

                    val req = Request.Builder()
                        .url(url)
                        .header("User-Agent", userAgent)
                        .header("Range", "bytes=$resumeStart-$rangeEnd")
                        .build()
                    httpClient.newCall(req).execute().use { resp ->
                        // Must be HTTP 206 Partial Content; HTTP 200 means server ignored Range and sent full file
                        if (resp.code != 206) {
                            throw IllegalStateException("Expected HTTP 206, got HTTP ${resp.code} on thread $idx")
                        }
                        if (isHtmlContentType(resp.header("Content-Type"))) {
                            throw IllegalStateException("Received HTML instead of media bytes")
                        }
                        val body = resp.body ?: throw IllegalStateException("Empty chunk body")
                        body.byteStream().use { input ->
                            FileOutputStream(partFile, existing > 0L).use { output ->
                                val buffer = ByteArray(16 * 1024)
                                while (isActive) {
                                    val read = input.read(buffer)
                                    if (read == -1) break
                                    output.write(buffer, 0, read)
                                    downloadedCounter.addAndGet(read.toLong())
                                }
                            }
                        }
                    }
                }
            }
            chunkTasks.awaitAll()
        } finally {
            reporterJob.cancel()
        }

        FileOutputStream(outFile).use { finalOut ->
            val buf = ByteArray(32 * 1024)
            partFiles.forEach { part ->
                FileInputStream(part).use { partIn ->
                    while (true) {
                        val r = partIn.read(buf)
                        if (r == -1) break
                        finalOut.write(buf, 0, r)
                    }
                }
            }
        }
        cleanupParts(id)
    }

    private suspend fun downloadSingleStream(
        id: String,
        url: String,
        userAgent: String,
        expectedTotal: Long,
        outFile: File,
        progressBase: Float = 0f,
        progressSpan: Float = 98.5f
    ) = coroutineScope {
        val req = Request.Builder()
            .url(url)
            .header("User-Agent", userAgent)
            .build()
        httpClient.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) throw IllegalStateException("HTTP ${resp.code}")
            if (isHtmlContentType(resp.header("Content-Type"))) {
                throw IllegalStateException("Server returned HTML page instead of media file")
            }
            val body = resp.body ?: throw IllegalStateException("Empty response body")
            val contentLen = body.contentLength().takeIf { it > 0L } ?: expectedTotal.coerceAtLeast(1L)
            var downloaded = 0L
            var lastSpeedBytes = 0L
            var lastReport = System.currentTimeMillis()

            body.byteStream().use { input ->
                FileOutputStream(outFile).use { output ->
                    val buffer = ByteArray(16 * 1024)
                    while (isActive) {
                        val read = input.read(buffer)
                        if (read == -1) break
                        output.write(buffer, 0, read)
                        downloaded += read
                        val now = System.currentTimeMillis()
                        if (now - lastReport >= 450L) {
                            val speed = ((downloaded - lastSpeedBytes) * 1000L) / (now - lastReport).coerceAtLeast(1L)
                            lastSpeedBytes = downloaded
                            lastReport = now
                            val frac = (downloaded.toDouble() / contentLen.toDouble()).toFloat().coerceIn(0f, 1f)
                            val pct = (progressBase + frac * progressSpan).coerceIn(0f, 99.5f)
                            dao.updateDownloadProgress(
                                id = id,
                                downloaded = downloaded,
                                total = contentLen,
                                progress = pct,
                                speed = speed,
                                status = DownloadStatus.DOWNLOADING,
                                error = null
                            )
                        }
                    }
                }
            }
        }
    }

    private fun muxVideoAndAudio(videoFile: File, audioFile: File, outFile: File): Boolean {
        if (!videoFile.exists() || !audioFile.exists() || videoFile.length() <= 0L || audioFile.length() <= 0L) {
            return false
        }
        val videoExtractor = MediaExtractor()
        val audioExtractor = MediaExtractor()
        var muxer: MediaMuxer? = null
        return try {
            videoExtractor.setDataSource(videoFile.absolutePath)
            audioExtractor.setDataSource(audioFile.absolutePath)

            val videoTrackIdx = (0 until videoExtractor.trackCount).firstOrNull { idx ->
                videoExtractor.getTrackFormat(idx).getString(MediaFormat.KEY_MIME)?.startsWith("video/") == true
            } ?: return false

            val audioTrackIdx = (0 until audioExtractor.trackCount).firstOrNull { idx ->
                audioExtractor.getTrackFormat(idx).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
            } ?: return false

            val videoFormat = videoExtractor.getTrackFormat(videoTrackIdx)
            val audioFormat = audioExtractor.getTrackFormat(audioTrackIdx)
            videoExtractor.selectTrack(videoTrackIdx)
            audioExtractor.selectTrack(audioTrackIdx)

            val videoMime = videoFormat.getString(MediaFormat.KEY_MIME).orEmpty()
            val audioMime = audioFormat.getString(MediaFormat.KEY_MIME).orEmpty()
            val outputFormat = if ("vp8" in videoMime || "vp9" in videoMime || "opus" in audioMime) {
                MediaMuxer.OutputFormat.MUXER_OUTPUT_WEBM
            } else {
                MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4
            }

            muxer = MediaMuxer(outFile.absolutePath, outputFormat)
            val outVideoTrack = muxer.addTrack(videoFormat)
            val outAudioTrack = muxer.addTrack(audioFormat)
            muxer.start()

            // Dynamically allocate buffer >= 2 MB to accommodate 1080p/2K/4K keyframes
            val maxVideoSample = if (videoFormat.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE)) {
                videoFormat.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE)
            } else 0
            val maxAudioSample = if (audioFormat.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE)) {
                audioFormat.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE)
            } else 0
            val bufferSize = maxOf(2 * 1024 * 1024, maxVideoSample, maxAudioSample)
            val buffer = ByteBuffer.allocate(bufferSize)
            val bufferInfo = MediaCodec.BufferInfo()

            while (true) {
                val sampleSize = videoExtractor.readSampleData(buffer, 0)
                if (sampleSize < 0) break
                val pts = videoExtractor.sampleTime
                if (pts >= 0L) {
                    bufferInfo.offset = 0
                    bufferInfo.size = sampleSize
                    bufferInfo.presentationTimeUs = pts
                    bufferInfo.flags = mapSampleFlagsToCodecFlags(videoExtractor.sampleFlags)
                    muxer.writeSampleData(outVideoTrack, buffer, bufferInfo)
                }
                videoExtractor.advance()
            }

            while (true) {
                val sampleSize = audioExtractor.readSampleData(buffer, 0)
                if (sampleSize < 0) break
                val pts = audioExtractor.sampleTime
                if (pts >= 0L) {
                    bufferInfo.offset = 0
                    bufferInfo.size = sampleSize
                    bufferInfo.presentationTimeUs = pts
                    bufferInfo.flags = mapSampleFlagsToCodecFlags(audioExtractor.sampleFlags)
                    muxer.writeSampleData(outAudioTrack, buffer, bufferInfo)
                }
                audioExtractor.advance()
            }

            muxer.stop()
            true
        } catch (_: Throwable) {
            runCatching { outFile.delete() }
            false
        } finally {
            runCatching { muxer?.release() }
            runCatching { videoExtractor.release() }
            runCatching { audioExtractor.release() }
        }
    }

    private fun mapSampleFlagsToCodecFlags(sampleFlags: Int): Int {
        var codecFlags = 0
        if ((sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC) != 0) {
            codecFlags = codecFlags or MediaCodec.BUFFER_FLAG_KEY_FRAME
        }
        if ((sampleFlags and MediaExtractor.SAMPLE_FLAG_PARTIAL_FRAME) != 0) {
            codecFlags = codecFlags or MediaCodec.BUFFER_FLAG_PARTIAL_FRAME
        }
        return codecFlags
    }

    private fun exportToMediaStore(file: File, entity: DownloadEntity) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
        val resolver = context.contentResolver
        val collection = when {
            entity.isAudioOnly -> MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
            else -> MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        }
        val relPath = if (entity.isAudioOnly) {
            Environment.DIRECTORY_MUSIC + "/MetaTube"
        } else {
            Environment.DIRECTORY_MOVIES + "/MetaTube"
        }
        val resolvedMime = when (file.extension.lowercase()) {
            "m4a" -> "audio/mp4"
            "mp3" -> "audio/mpeg"
            "webm" -> if (entity.isAudioOnly) "audio/webm" else "video/webm"
            else -> entity.mimeType.ifBlank { if (entity.isAudioOnly) "audio/mp4" else "video/mp4" }
        }
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, file.name)
            put(MediaStore.MediaColumns.MIME_TYPE, resolvedMime)
            put(MediaStore.MediaColumns.RELATIVE_PATH, relPath)
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }
        val uri = runCatching { resolver.insert(collection, values) }.getOrNull() ?: return
        try {
            resolver.openOutputStream(uri)?.use { out ->
                FileInputStream(file).use { input -> input.copyTo(out) }
            } ?: throw IllegalStateException("Could not open MediaStore output stream")
            values.clear()
            values.put(MediaStore.MediaColumns.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
        } catch (_: Throwable) {
            runCatching { resolver.delete(uri, null, null) }
        }
    }

    private fun cleanupParts(id: String) {
        runCatching { File(tempPartsRoot, id).deleteRecursively() }
    }

    private fun startForegroundServiceIfEnabled(notificationsEnabled: Boolean) {
        if (!notificationsEnabled) return
        runCatching {
            val intent = Intent(context, DownloadForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }

    private fun stopServiceIfIdle() {
        if (activeJobs.isEmpty()) {
            runCatching {
                context.stopService(Intent(context, DownloadForegroundService::class.java))
            }
        }
    }

    private fun sanitizeFileName(raw: String): String {
        return raw.replace(Regex("[^a-zA-Z0-9\\u0980-\\u09FF._ -]"), "_")
            .trim()
            .take(64)
            .ifBlank { "MetaTube_Media" }
    }
}
