package com.example.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.example.model.DownloadStatus

@Entity(tableName = "downloads")
data class DownloadEntity(
    @PrimaryKey val id: String,
    val videoId: String,
    val title: String,
    val channelName: String,
    val thumbnailUrl: String,
    val providerName: String,
    val formatLabel: String,
    val mimeType: String,
    val fileExtension: String,
    val isAudioOnly: Boolean,
    val sourceUrl: String,
    val streamUrl: String,
    val streamUserAgent: String = "",
    val pairedAudioUrl: String = "",
    val localFilePath: String,
    val totalBytes: Long,
    val downloadedBytes: Long,
    val progressPercent: Float,
    val speedBytesPerSec: Long,
    val threadCount: Int,
    val status: DownloadStatus,
    val errorMessage: String? = null,
    val durationText: String = "",
    val createdAt: Long = System.currentTimeMillis(),
    val completedAt: Long = 0L
)

@Entity(tableName = "playlists")
data class PlaylistEntity(
    @PrimaryKey val id: String,
    val name: String,
    val description: String = "",
    val coverUrl: String = "",
    val accentHex: Long = 0xFFFFCB1F,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "playlist_items")
data class PlaylistEntryEntity(
    @PrimaryKey val id: String,
    val playlistId: String,
    val videoId: String,
    val title: String,
    val channelName: String,
    val thumbnailUrl: String,
    val durationText: String,
    val providerName: String,
    val webpageUrl: String,
    val localFilePath: String? = null,
    val streamUrl: String? = null,
    val isAudioOnly: Boolean = false,
    val position: Int = 0,
    val addedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "search_history")
data class SearchHistoryEntity(
    @PrimaryKey val query: String,
    val timestamp: Long = System.currentTimeMillis()
)
