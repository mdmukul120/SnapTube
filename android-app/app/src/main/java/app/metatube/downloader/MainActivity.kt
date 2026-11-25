package app.metatube.downloader

import android.annotation.SuppressLint
import android.app.Activity
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.URLUtil
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import java.net.URLEncoder

class MainActivity : Activity() {

    companion object {
        private const val BASE_APP_URL = "https://meta-tube-jet.vercel.app"
    }

    private lateinit var rootContainer: FrameLayout
    private lateinit var webView: WebView
    private var customFullscreenView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        rootContainer = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#090B10"))
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        webView = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#090B10"))
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }

        rootContainer.addView(webView)
        setContentView(rootContainer)

        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.allowFileAccess = false
        settings.allowContentAccess = true
        settings.loadsImagesAutomatically = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.userAgentString = settings.userAgentString + " MetaTubeAndroid/1.0"

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.addJavascriptInterface(MetaTubeBridge(), "MetaTubeAndroid")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val uri = request?.url ?: return false
                val scheme = uri.scheme?.lowercase() ?: return false
                if (scheme == "http" || scheme == "https") {
                    return false
                }
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    true
                } catch (_: Exception) {
                    true
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    showOfflinePage()
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                if (customFullscreenView != null) {
                    callback?.onCustomViewHidden()
                    return
                }
                customFullscreenView = view
                customViewCallback = callback
                webView.visibility = View.GONE
                if (view != null) {
                    rootContainer.addView(
                        view,
                        FrameLayout.LayoutParams(
                            FrameLayout.LayoutParams.MATCH_PARENT,
                            FrameLayout.LayoutParams.MATCH_PARENT
                        )
                    )
                }
            }

            override fun onHideCustomView() {
                val view = customFullscreenView ?: return
                rootContainer.removeView(view)
                customFullscreenView = null
                customViewCallback?.onCustomViewHidden()
                customViewCallback = null
                webView.visibility = View.VISIBLE
            }
        }

        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            if (url.startsWith("http://") || url.startsWith("https://")) {
                val guessedName = URLUtil.guessFileName(url, contentDisposition, mimeType)
                enqueueSystemDownload(url, guessedName, mimeType ?: "video/mp4", userAgent)
            }
        }

        loadTargetFromIntent(intent)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        if (intent != null) {
            setIntent(intent)
            loadTargetFromIntent(intent)
        }
    }

    private fun loadTargetFromIntent(incomingIntent: Intent?) {
        if (incomingIntent?.action == Intent.ACTION_SEND && incomingIntent.type == "text/plain") {
            val sharedText = incomingIntent.getStringExtra(Intent.EXTRA_TEXT)?.trim()
            if (!sharedText.isNullOrEmpty()) {
                val encoded = URLEncoder.encode(sharedText, "UTF-8")
                webView.loadUrl("$BASE_APP_URL/?shared_text=$encoded")
                return
            }
        }
        webView.loadUrl(BASE_APP_URL)
    }

    private fun enqueueSystemDownload(
        url: String,
        rawFilename: String,
        mimeType: String,
        userAgent: String? = null
    ) {
        runOnUiThread {
            try {
                val safeName = rawFilename
                    .replace(Regex("[^a-zA-Z0-9._\\-\\u0980-\\u09FF]"), "_")
                    .take(90)
                    .ifBlank { "MetaTube_${System.currentTimeMillis()}.mp4" }

                val req = DownloadManager.Request(Uri.parse(url))
                    .setTitle(safeName)
                    .setDescription("Downloading via Meta Tube")
                    .setMimeType(mimeType)
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setAllowedOverMetered(true)
                    .setAllowedOverRoaming(true)
                    .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, safeName)

                if (!userAgent.isNullOrEmpty()) {
                    req.addRequestHeader("User-Agent", userAgent)
                }

                val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                dm.enqueue(req)

                Toast.makeText(
                    this@MainActivity,
                    "ডাউনলোড শুরু হয়েছে: $safeName",
                    Toast.LENGTH_LONG
                ).show()
            } catch (_: Exception) {
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                } catch (_: Exception) {
                    Toast.makeText(
                        this@MainActivity,
                        "ডাউনলোড শুরু করা যায়নি।",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        }
    }

    private fun showOfflinePage() {
        val html = """
            <!DOCTYPE html>
            <html lang="bn">
            <head>
              <meta charset="utf-8"/>
              <meta name="viewport" content="width=device-width,initial-scale=1"/>
              <style>
                body { background:#090B10; color:#F8FAFC; font-family:sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; text-align:center; padding:24px; box-sizing:border-box; }
                .card { background:#111522; border:1px solid #1E293B; border-radius:20px; padding:28px 22px; max-width:360px; }
                h2 { margin:0 0 10px; font-size:20px; }
                p { color:#94A3B8; font-size:14px; line-height:1.5; margin:0 0 20px; }
                button { background:linear-gradient(90deg,#FF2E63,#8B5CF6); color:#fff; border:none; border-radius:12px; padding:12px 24px; font-weight:700; font-size:14px; }
              </style>
            </head>
            <body>
              <div class="card">
                <h2>ইন্টারনেট সংযোগ নেই</h2>
                <p>Meta Tube ব্যবহার করতে আপনার ফোনের ডেটা বা Wi-Fi চালু করে আবার চেষ্টা করুন।</p>
                <button onclick="window.location.href='$BASE_APP_URL'">পুনরায় চেষ্টা করুন</button>
              </div>
            </body>
            </html>
        """.trimIndent()
        webView.loadDataWithBaseURL(BASE_APP_URL, html, "text/html", "UTF-8", null)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (customFullscreenView != null) {
            webView.webChromeClient?.onHideCustomView()
            return
        }
        if (webView.canGoBack()) {
            webView.goBack()
            return
        }
        super.onBackPressed()
    }

    inner class MetaTubeBridge {
        @JavascriptInterface
        fun downloadFile(url: String, filename: String, mimeType: String) {
            if (url.startsWith("http://") || url.startsWith("https://")) {
                enqueueSystemDownload(url, filename, mimeType)
            }
        }
    }
}
