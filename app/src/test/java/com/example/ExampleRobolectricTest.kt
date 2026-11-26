package com.example

import android.content.Context
import android.os.Environment
import androidx.core.content.FileProvider
import androidx.test.core.app.ApplicationProvider
import com.example.data.network.InnerTubeClient
import com.example.data.network.MultiProviderExtractor
import com.example.model.StreamFormat
import com.example.model.VideoProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ExampleRobolectricTest {

    @Test
    fun `app name matches MetaTube`() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val appName = context.getString(R.string.app_name)
        assertEquals("MetaTube", appName)
    }

    @Test
    fun `multi-provider url detection and youtube id extraction work`() {
        assertEquals(VideoProvider.YOUTUBE, VideoProvider.detectFromUrl("https://youtu.be/dQw4w9WgXcQ"))
        assertEquals(VideoProvider.YOUTUBE, VideoProvider.detectFromUrl("https://youtube.com/shorts/abcDEF12345"))
        assertEquals(VideoProvider.TIKTOK, VideoProvider.detectFromUrl("https://www.tiktok.com/@user/video/123"))
        assertEquals(VideoProvider.FACEBOOK, VideoProvider.detectFromUrl("https://fb.watch/abc123"))
        assertEquals(VideoProvider.INSTAGRAM, VideoProvider.detectFromUrl("https://www.instagram.com/reel/xyz/"))
        assertEquals("dQw4w9WgXcQ", InnerTubeClient.extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"))
        assertEquals("abcDEF12345", InnerTubeClient.extractYouTubeId("https://youtube.com/shorts/abcDEF12345"))
        assertEquals(
            "https://youtu.be/dQw4w9WgXcQ",
            MultiProviderExtractor.extractFirstUrl("Watch this video https://youtu.be/dQw4w9WgXcQ.")
        )
        assertTrue(StreamFormat.DEFAULT_STREAM_UA.isNotBlank())
    }

    @Test
    fun `file provider resolves both internal and external MetaTube download directories`() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val authority = "${context.packageName}.fileprovider"

        val internalFile = File(File(context.filesDir, "MetaTube").apply { mkdirs() }, "sample.mp4")
        internalFile.writeBytes(byteArrayOf(1, 2, 3))
        val internalUri = FileProvider.getUriForFile(context, authority, internalFile)
        assertNotNull(internalUri)

        val externalBase = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
        if (externalBase != null) {
            val externalFile = File(File(externalBase, "MetaTube").apply { mkdirs() }, "sample_ext.mp4")
            externalFile.writeBytes(byteArrayOf(4, 5, 6))
            val externalUri = FileProvider.getUriForFile(context, authority, externalFile)
            assertNotNull(externalUri)
        }
    }
}
