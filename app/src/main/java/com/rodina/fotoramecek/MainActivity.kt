package com.rodina.fotoramecek

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.view.View
import android.view.WindowManager
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var permissionLayout: View

    companion object {
        private const val KOD_ZADOSTI_O_OPRAVNENI = 100
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Obrazovka nikdy nezhasne - senior nemusi nic nastavovat v systemu.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        webView = findViewById(R.id.webView)
        permissionLayout = findViewById(R.id.permissionLayout)
        findViewById<Button>(R.id.btnPovolitPristup).setOnClickListener { pozadatOOpravneni() }

        nastavWebView()

        if (maOpravneniKUlozisti()) {
            zobrazSlideshow()
        } else {
            zobrazObrazovkuOpravneni()
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) zapniImmersivniRezim()
    }

    // Skryje stavovy i navigacni radek, aby slideshow bezela opravdu na celou
    // obrazovku bez jakychkoli listu.
    private fun zapniImmersivniRezim() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    private fun maOpravneniKUlozisti(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            ContextCompat.checkSelfPermission(
                this, android.Manifest.permission.READ_EXTERNAL_STORAGE
            ) == PackageManager.PERMISSION_GRANTED
        }
    }

    private fun pozadatOOpravneni() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                val zamer = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
                zamer.data = Uri.parse("package:$packageName")
                startActivity(zamer)
            } catch (chyba: Exception) {
                // Nektera zarizeni neumi otevrit primo obrazovku pro konkretni
                // aplikaci - otevreme aspon obecny seznam.
                startActivity(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION))
            }
        } else {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(
                    android.Manifest.permission.READ_EXTERNAL_STORAGE,
                    android.Manifest.permission.WRITE_EXTERNAL_STORAGE
                ),
                KOD_ZADOSTI_O_OPRAVNENI
            )
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == KOD_ZADOSTI_O_OPRAVNENI && maOpravneniKUlozisti()) {
            zobrazSlideshow()
        }
    }

    override fun onResume() {
        super.onResume()
        // Uzivatel se mohl vratit z Nastaveni s cerstve udelenym opravnenim -
        // zkontrolujeme to a rovnou prepneme na slideshow.
        if (maOpravneniKUlozisti() && permissionLayout.visibility == View.VISIBLE) {
            zobrazSlideshow()
        }
    }

    // Zamerne NEVOLAME webView.onPause() / pauseTimers() v zadnem lifecycle
    // callbacku. Fotoramecek musi bezet nepretrzite, dokud je aplikace na
    // popredi - nesmi se "uspat" jako bezny prohlizec.

    private fun zobrazObrazovkuOpravneni() {
        permissionLayout.visibility = View.VISIBLE
        webView.visibility = View.GONE
    }

    private fun zobrazSlideshow() {
        permissionLayout.visibility = View.GONE
        webView.visibility = View.VISIBLE
        if (webView.url == null) {
            webView.loadUrl("file:///android_asset/index.html")
        }
    }

    private fun nastavWebView() {
        val nastaveni = webView.settings
        nastaveni.javaScriptEnabled = true
        nastaveni.domStorageEnabled = true
        nastaveni.mediaPlaybackRequiresUserGesture = false
        nastaveni.cacheMode = WebSettings.LOAD_NO_CACHE

        // Umoznuje nacitat fotky/videa z WhatsApp slozek pres virtualni
        // https adresu, i kdyz samotna stranka bezi z file:///android_asset/.
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/media/", WhatsAppMediaPathHandler())
            .build()

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                return assetLoader.shouldInterceptRequest(request.url)
            }
        }

        webView.addJavascriptInterface(MediaBridge(this), "AndroidMedia")
    }
}
