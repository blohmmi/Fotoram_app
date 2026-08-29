package com.rodina.fotoramecek

import android.content.Context
import android.net.Uri
import android.os.Environment
import android.webkit.JavascriptInterface
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Slozky, ktere WhatsApp pouziva pro prijate obrazky a videa.
 * Snadno upravitelne, kdyby WhatsApp cestu v budoucnu zmenil.
 */
private val SLEDOVANE_SLOZKY = listOf(
    "image" to "Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Images",
    "video" to "Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Video"
)

private val PRIPONY_OBRAZKU = setOf("jpg", "jpeg", "png", "webp", "gif")
private val PRIPONY_VIDEA = setOf("mp4", "3gp", "3gpp", "mkv")

/**
 * Most mezi nativnim Androidem a JavaScriptem ve WebView. Metoda oznacena
 * @JavascriptInterface je volatelna z app.js jako AndroidMedia.ziskatSeznamMedii().
 */
class MediaBridge(private val context: Context) {

    @JavascriptInterface
    fun ziskatSeznamMedii(): String {
        return nacistSeznamMedii().toString()
    }

    private fun nacistSeznamMedii(): JSONArray {
        val vysledek = JSONArray()
        val korenUloziste = Environment.getExternalStorageDirectory()
        val formatovacData = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }

        for ((typ, relativniCesta) in SLEDOVANE_SLOZKY) {
            val slozka = File(korenUloziste, relativniCesta)
            val soubory = slozka.listFiles() ?: continue
            val povolenePripony = if (typ == "image") PRIPONY_OBRAZKU else PRIPONY_VIDEA

            for (soubor in soubory) {
                if (!soubor.isFile) continue
                val pripona = soubor.name.substringAfterLast('.', "").lowercase(Locale.US)
                if (pripona !in povolenePripony) continue

                val polozka = JSONObject()
                polozka.put("filename", soubor.name)
                polozka.put("type", typ)
                polozka.put("createdAt", formatovacData.format(Date(soubor.lastModified())))
                polozka.put(
                    "url",
                    "https://appassets.androidplatform.net/media/" + Uri.encode(soubor.absolutePath, "/")
                )
                vysledek.put(polozka)
            }
        }
        return vysledek
    }
}
