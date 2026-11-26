package com.example

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import com.example.data.network.MultiProviderExtractor
import com.example.ui.MetaTubeApp
import com.example.ui.viewmodel.MainViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

class MainActivity : ComponentActivity() {

    private val viewModel: MainViewModel by viewModels()
    private val _sharedUrlFlow = MutableStateFlow<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        handleIncomingIntent(intent)

        setContent {
            MetaTubeApp(
                viewModel = viewModel,
                sharedUrlFlow = _sharedUrlFlow.asStateFlow(),
                onConsumeSharedUrl = { _sharedUrlFlow.value = null }
            )
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingIntent(intent)
    }

    private fun handleIncomingIntent(intent: Intent?) {
        if (intent == null) return
        when (intent.action) {
            Intent.ACTION_SEND -> {
                val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT).orEmpty()
                val url = MultiProviderExtractor.extractFirstUrl(sharedText) ?: sharedText.trim()
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    _sharedUrlFlow.value = url
                }
            }
            Intent.ACTION_VIEW -> {
                val dataUrl = intent.dataString
                if (!dataUrl.isNullOrBlank()) {
                    _sharedUrlFlow.value = dataUrl
                }
            }
        }
    }
}
