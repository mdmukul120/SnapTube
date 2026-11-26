package com.example

import android.app.Application
import com.example.data.local.MetaTubeDatabase
import com.example.data.local.PlaylistEntity
import com.example.data.local.PreferencesRepository
import com.example.data.network.AutoUpdateManager
import com.example.data.network.InnerTubeClient
import com.example.data.network.MultiProviderExtractor
import com.example.download.MultiThreadDownloadEngine
import com.example.player.MetaTubePlayerManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

class MetaTubeApplication : Application() {

    val httpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .build()
    }

    val database: MetaTubeDatabase by lazy {
        MetaTubeDatabase.getInstance(this)
    }

    val preferencesRepository: PreferencesRepository by lazy {
        PreferencesRepository(this)
    }

    val innerTubeClient: InnerTubeClient by lazy {
        InnerTubeClient(httpClient)
    }

    val multiProviderExtractor: MultiProviderExtractor by lazy {
        MultiProviderExtractor(httpClient, innerTubeClient)
    }

    val downloadEngine: MultiThreadDownloadEngine by lazy {
        MultiThreadDownloadEngine(
            context = this,
            httpClient = httpClient,
            dao = database.dao(),
            preferencesRepository = preferencesRepository,
            extractor = multiProviderExtractor
        )
    }

    val autoUpdateManager: AutoUpdateManager by lazy {
        AutoUpdateManager(httpClient)
    }

    val playerManager: MetaTubePlayerManager by lazy {
        MetaTubePlayerManager(
            context = this,
            httpClient = httpClient,
            dao = database.dao(),
            extractor = multiProviderExtractor
        )
    }

    override fun onCreate() {
        super.onCreate()
        // Seed one default Favorites playlist on first launch if none exist
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            val existing = database.dao().observePlaylists().first()
            if (existing.isEmpty()) {
                database.dao().upsertPlaylist(
                    PlaylistEntity(
                        id = "favorites_default",
                        name = "Favorites / পছন্দসমূহ",
                        description = "Quick-access videos and MP3 tracks"
                    )
                )
            }
        }
    }
}
