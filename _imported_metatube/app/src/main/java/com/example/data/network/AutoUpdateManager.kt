package com.example.data.network

import com.example.BuildConfig
import com.example.model.UpdateInfo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import okhttp3.OkHttpClient
import okhttp3.Request

class AutoUpdateManager(
    private val httpClient: OkHttpClient
) {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    suspend fun checkForUpdates(): UpdateInfo = withContext(Dispatchers.IO) {
        val currentVersion = BuildConfig.VERSION_NAME
        val currentCode = BuildConfig.VERSION_CODE

        val endpoints = listOf(
            "https://upgrade.thejeu.com/v2/upgrade/latest?pkg=${BuildConfig.APPLICATION_ID}&vc=$currentCode",
            "https://api.thejeu.com/v2/upgrade/latest?pkg=${BuildConfig.APPLICATION_ID}&vc=$currentCode"
        )

        for (endpoint in endpoints) {
            val parsed = runCatching {
                val req = Request.Builder()
                    .url(endpoint)
                    .header("User-Agent", "MetaTube/$currentVersion Android")
                    .build()
                httpClient.newCall(req).execute().use { resp ->
                    if (!resp.isSuccessful) return@use null
                    val body = resp.body?.string().orEmpty()
                    if (body.isBlank() || !body.trimStart().startsWith("{")) return@use null
                    val obj = json.parseToJsonElement(body).jsonObject

                    // Support both custom upgrade schema & GitHub Releases API schema (tag_name / assets)
                    val ghTag = (obj["tag_name"] as? JsonPrimitive)?.contentOrNull
                    val remoteName = (obj["versionName"] as? JsonPrimitive)?.contentOrNull
                        ?: ghTag?.removePrefix("v")
                        ?: currentVersion
                    val remoteCode = (obj["versionCode"] as? JsonPrimitive)?.intOrNull
                        ?: parseSemVerToCode(remoteName)
                        ?: currentCode
                    val notes = (obj["releaseNotes"] as? JsonPrimitive)?.contentOrNull
                        ?: (obj["body"] as? JsonPrimitive)?.contentOrNull
                        ?: "Performance & multi-thread extractor improvements."
                    val ghAssetUrl = obj["assets"]?.jsonArray
                        ?.firstOrNull {
                            val name = (it.jsonObject["name"] as? JsonPrimitive)?.contentOrNull.orEmpty()
                            name.endsWith(".apk", ignoreCase = true)
                        }
                        ?.jsonObject?.let { (it["browser_download_url"] as? JsonPrimitive)?.contentOrNull }
                    val url = (obj["downloadUrl"] as? JsonPrimitive)?.contentOrNull
                        ?: ghAssetUrl
                        ?: (obj["html_url"] as? JsonPrimitive)?.contentOrNull
                        ?: "https://upgrade.thejeu.com"

                    UpdateInfo(
                        currentVersion = currentVersion,
                        currentVersionCode = currentCode,
                        latestVersion = remoteName,
                        latestVersionCode = remoteCode,
                        releaseNotesBn = notes,
                        releaseNotesEn = notes,
                        downloadUrl = url,
                        isUpdateAvailable = remoteCode > currentCode
                    )
                }
            }.getOrNull()
            if (parsed != null) return@withContext parsed
        }

        UpdateInfo(
            currentVersion = currentVersion,
            currentVersionCode = currentCode,
            latestVersion = currentVersion,
            latestVersionCode = currentCode,
            releaseNotesBn = "আপনি MetaTube-এর সর্বশেষ সংস্করণ (v$currentVersion) ব্যবহার করছেন। মাল্টি-থ্রেড ডাউনলোড ও সকল প্রোভাইডার সক্রিয় আছে।",
            releaseNotesEn = "You are running the latest MetaTube release (v$currentVersion) with multi-threaded downloads and all video providers active.",
            downloadUrl = "https://upgrade.thejeu.com",
            isUpdateAvailable = false
        )
    }

    private fun parseSemVerToCode(versionName: String): Int? {
        val parts = versionName.trim().removePrefix("v").split(".")
            .mapNotNull { it.filter(Char::isDigit).toIntOrNull() }
        if (parts.isEmpty()) return null
        val major = parts.getOrElse(0) { 0 }
        val minor = parts.getOrElse(1) { 0 }
        val patch = parts.getOrElse(2) { 0 }
        return major * 100 + minor * 10 + patch
    }
}
