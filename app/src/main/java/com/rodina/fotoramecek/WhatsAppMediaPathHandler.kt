package com.rodina.fotoramecek

import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.io.File
import java.io.FileInputStream
import java.util.Locale

/**
 * Servíruje soubory z WhatsApp slozek do WebView pod virtualni adresou
 * https://appassets.androidplatform.net/media/<absolutni_cesta_k_souboru>.
 * Diky tomu funguje <img>/<video> i mimo slozku assets, bez nutnosti kopirovat
 * soubory nebo pouzivat skutecny sitovy server.
 */
class WhatsAppMediaPathHandler : WebViewAssetLoader.PathHandler {

    override fun handle(path: String): WebResourceResponse? {
        return try {
            val soubor = File(path)
            if (!soubor.exists() || !soubor.isFile) return null
            WebResourceResponse(zjistiMimeTyp(soubor.name), null, FileInputStream(soubor))
        } catch (chyba: Exception) {
            null
        }
    }

    private fun zjistiMimeTyp(nazevSouboru: String): String {
        return when (nazevSouboru.substringAfterLast('.', "").lowercase(Locale.US)) {
            "jpg", "jpeg" -> "image/jpeg"
            "png" -> "image/png"
            "webp" -> "image/webp"
            "gif" -> "image/gif"
            "mp4" -> "video/mp4"
            "3gp", "3gpp" -> "video/3gpp"
            "mkv" -> "video/x-matroska"
            else -> "application/octet-stream"
        }
    }
}
