package com.example

import com.example.data.network.AutoUpdateManager
import com.example.data.network.InnerTubeClient
import com.example.data.network.MultiProviderExtractor
import com.example.model.VideoProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ExampleUnitTest {

    @Test
    fun semverComparison_handlesPatchAndBuildSuffixesCorrectly() {
        assertTrue(AutoUpdateManager.compareSemVer("2.5.0", "2.4.10") > 0)
        assertTrue(AutoUpdateManager.compareSemVer("2.4.10", "2.4.2") > 0)
        assertEquals(0, AutoUpdateManager.compareSemVer("v2.4.1-15", "2.4.1"))
        assertTrue(AutoUpdateManager.compareSemVer("2.4.0", "2.4.1") < 0)
    }

    @Test
    fun youtubeIdExtraction_supportsWatchShortsLiveAndShortLinks() {
        assertEquals("dQw4w9WgXcQ", InnerTubeClient.extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"))
        assertEquals("abcDEF12345", InnerTubeClient.extractYouTubeId("https://youtube.com/shorts/abcDEF12345"))
        assertEquals("liveID12345", InnerTubeClient.extractYouTubeId("https://www.youtube.com/live/liveID12345?feature=share"))
        assertEquals("dQw4w9WgXcQ", InnerTubeClient.extractYouTubeId("https://youtu.be/dQw4w9WgXcQ"))
    }

    @Test
    fun durationAndUrlHelpers_workConsistently() {
        assertEquals("01:05", InnerTubeClient.formatDuration(65))
        assertEquals("1:01:05", InnerTubeClient.formatDuration(3665))
        assertEquals(3665L, InnerTubeClient.parseDurationToSeconds("1:01:05"))
        assertEquals(VideoProvider.DAILYMOTION, VideoProvider.detectFromUrl("https://dai.ly/x8abcde"))
        assertEquals(
            "https://vt.tiktok.com/ZSabc123/",
            MultiProviderExtractor.extractFirstUrl("Check this https://vt.tiktok.com/ZSabc123/, cool!")
        )
    }
}
