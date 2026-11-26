package com.example.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.example.MainActivity
import com.example.MetaTubeApplication
import com.example.R
import com.example.model.DownloadStatus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class DownloadForegroundService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var observerJob: Job? = null
    @Volatile
    private var lastStartedAtMs: Long = 0L

    override fun onCreate() {
        super.onCreate()
        lastStartedAtMs = System.currentTimeMillis()
        createNotificationChannel()
        promoteToForeground(
            buildNotification("MetaTube", "Preparing multi-thread download...", 0, true)
        )

        val app = application as? MetaTubeApplication ?: return
        observerJob = scope.launch {
            app.database.dao().observeActiveDownloads().collectLatest { list ->
                val active = list.filter {
                    it.status == DownloadStatus.DOWNLOADING || it.status == DownloadStatus.QUEUED
                }
                if (active.isEmpty()) {
                    // Grace period avoids premature shutdown if Room emits before resume status write commits
                    val elapsed = System.currentTimeMillis() - lastStartedAtMs
                    if (elapsed < STARTUP_GRACE_MS) {
                        delay(STARTUP_GRACE_MS - elapsed)
                    }
                    stopForeground(STOP_FOREGROUND_REMOVE)
                    stopSelf()
                } else {
                    val primary = active.first()
                    val avgProgress = active.map { it.progressPercent }.average().toInt().coerceIn(0, 100)
                    val speedKb = primary.speedBytesPerSec / 1024
                    val text = "${active.size} active • ${primary.threadCount} threads • $speedKb KB/s"
                    val nm = getSystemService(NotificationManager::class.java)
                    nm?.notify(
                        NOTIFICATION_ID,
                        buildNotification(primary.title, text, avgProgress, avgProgress == 0)
                    )
                }
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        lastStartedAtMs = System.currentTimeMillis()
        promoteToForeground(
            buildNotification("MetaTube", "Downloading media...", 0, true)
        )
        return START_NOT_STICKY
    }

    private fun promoteToForeground(notification: Notification) {
        runCatching {
            val fgsType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            } else {
                0
            }
            ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, fgsType)
        }
    }

    override fun onDestroy() {
        observerJob?.cancel()
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.download_channel_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = getString(R.string.download_channel_desc)
            }
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(
        title: String,
        content: String,
        progress: Int,
        indeterminate: Boolean
    ): Notification {
        val openIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle(title)
            .setContentText(content)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setProgress(100, progress, indeterminate)
            .setContentIntent(openIntent)
            .build()
    }

    companion object {
        const val CHANNEL_ID = "metatube_downloads"
        const val NOTIFICATION_ID = 4201
        private const val STARTUP_GRACE_MS = 1500L
    }
}
