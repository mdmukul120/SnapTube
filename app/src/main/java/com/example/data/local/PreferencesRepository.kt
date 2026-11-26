package com.example.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.example.model.AppLanguage
import com.example.model.ThemeMode
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "metatube_prefs")

data class UserSettings(
    val themeMode: ThemeMode = ThemeMode.DARK,
    val language: AppLanguage = AppLanguage.BN,
    val downloadThreads: Int = 8,
    val wifiOnly: Boolean = false,
    val notificationsEnabled: Boolean = true,
    val autoUpdateEnabled: Boolean = true,
    val clipboardDetectorEnabled: Boolean = true,
    val lastUpdateCheckMs: Long = 0L
)

class PreferencesRepository(private val context: Context) {

    private object Keys {
        val THEME_MODE = stringPreferencesKey("theme_mode")
        val LANGUAGE = stringPreferencesKey("app_language")
        val DOWNLOAD_THREADS = intPreferencesKey("download_threads")
        val WIFI_ONLY = booleanPreferencesKey("wifi_only")
        val NOTIFICATIONS_ENABLED = booleanPreferencesKey("notifications_enabled")
        val AUTO_UPDATE_ENABLED = booleanPreferencesKey("auto_update_enabled")
        val CLIPBOARD_DETECTOR = booleanPreferencesKey("clipboard_detector")
        val LAST_UPDATE_CHECK = longPreferencesKey("last_update_check")
    }

    val settingsFlow: Flow<UserSettings> = context.dataStore.data.map { prefs ->
        UserSettings(
            themeMode = runCatching {
                ThemeMode.valueOf(prefs[Keys.THEME_MODE] ?: ThemeMode.DARK.name)
            }.getOrDefault(ThemeMode.DARK),
            language = runCatching {
                AppLanguage.valueOf(prefs[Keys.LANGUAGE] ?: AppLanguage.BN.name)
            }.getOrDefault(AppLanguage.BN),
            downloadThreads = (prefs[Keys.DOWNLOAD_THREADS] ?: 8).coerceIn(1, 16),
            wifiOnly = prefs[Keys.WIFI_ONLY] ?: false,
            notificationsEnabled = prefs[Keys.NOTIFICATIONS_ENABLED] ?: true,
            autoUpdateEnabled = prefs[Keys.AUTO_UPDATE_ENABLED] ?: true,
            clipboardDetectorEnabled = prefs[Keys.CLIPBOARD_DETECTOR] ?: true,
            lastUpdateCheckMs = prefs[Keys.LAST_UPDATE_CHECK] ?: 0L
        )
    }

    suspend fun setThemeMode(mode: ThemeMode) {
        context.dataStore.edit { it[Keys.THEME_MODE] = mode.name }
    }

    suspend fun setLanguage(language: AppLanguage) {
        context.dataStore.edit { it[Keys.LANGUAGE] = language.name }
    }

    suspend fun setDownloadThreads(threads: Int) {
        context.dataStore.edit { it[Keys.DOWNLOAD_THREADS] = threads.coerceIn(1, 16) }
    }

    suspend fun setWifiOnly(enabled: Boolean) {
        context.dataStore.edit { it[Keys.WIFI_ONLY] = enabled }
    }

    suspend fun setNotificationsEnabled(enabled: Boolean) {
        context.dataStore.edit { it[Keys.NOTIFICATIONS_ENABLED] = enabled }
    }

    suspend fun setAutoUpdateEnabled(enabled: Boolean) {
        context.dataStore.edit { it[Keys.AUTO_UPDATE_ENABLED] = enabled }
    }

    suspend fun setClipboardDetectorEnabled(enabled: Boolean) {
        context.dataStore.edit { it[Keys.CLIPBOARD_DETECTOR] = enabled }
    }

    suspend fun setLastUpdateCheckMs(timestamp: Long) {
        context.dataStore.edit { it[Keys.LAST_UPDATE_CHECK] = timestamp }
    }
}
