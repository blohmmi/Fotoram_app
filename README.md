# Rodinný fotorámeček

Android aplikace, která z telefonu udělá digitální fotorámeček: čte fotky a
videa přijatá přes WhatsApp a promítá je na celou obrazovku jako slideshow.
Žádná tlačítka, žádné ovládání — stačí telefon zapnout a nechat ho ležet.

Nahrazuje předchozí řešení postavené na Termuxu a Node.js (ten zůstává jen
pro referenci ve složce [`_puvodni-nodejs-verze/`](_puvodni-nodejs-verze/)).

Aplikace se nedistribuuje přes Google Play. Sestavuje se automaticky na
GitHubu (přes GitHub Actions) a výsledné APK se instaluje na telefon ručně.

---

## 1. Jak nahrát projekt na GitHub

Pokud ještě projekt není na GitHubu:

1. Na [github.com](https://github.com) založ nový (klidně soukromý) repozitář,
   např. `rodinny-fotoramecek`.
2. V počítači, ve složce s tímto projektem, spusť:

   ```bash
   git init
   git add .
   git commit -m "Rodinny fotoramecek - Android aplikace"
   git branch -M main
   git remote add origin https://github.com/TVOJE-JMENO/rodinny-fotoramecek.git
   git push -u origin main
   ```

Pokud už repozitář existuje a jen aktualizuješ kód, stačí:

```bash
git add .
git commit -m "Uprava aplikace"
git push
```

**Každý push do větve `main` automaticky spustí sestavení APK.**

---

## 2. Jak stáhnout hotové APK z GitHubu

1. Otevři svůj repozitář na GitHubu ve webovém prohlížeči.
2. Klikni nahoře na záložku **Actions**.
3. V seznamu běhů klikni na ten úplně poslední (nejnovější, měl by mít zelenou
   fajfku ✅ — pokud má červený křížek ❌, sestavení selhalo, klikni na něj a
   podívej se, co hlásí chybu).
4. Uvnitř běhu, dole na stránce, je sekce **Artifacts**.
5. Klikni na `rodinny-fotoramecek-apk` — stáhne se ZIP soubor.
6. Rozbal ZIP — uvnitř najdeš soubor `app-debug.apk`. To je hotová aplikace.

Sestavení trvá zhruba 2–5 minut od pushnutí kódu.

---

## 3. Jak nainstalovat APK do telefonu

1. Přenes soubor `app-debug.apk` do telefonu (e-mailem sám sobě, přes USB
   kabel, přes Google Disk/WhatsApp — jakkoliv ti vyhovuje).
2. V telefonu na soubor `app-debug.apk` klepni, aby se spustila instalace.
3. Telefon nejspíš zobrazí hlášku, že instalace z tohoto zdroje (např. z
   Souborů, Gmailu apod.) není povolená. Klepni na **Nastavení** v té hlášce
   a povol přepínač **Povolit z tohoto zdroje** (na různých telefonech se
   text mírně liší — hledej něco jako "Instalace neznámých aplikací").
4. Vrať se zpět a spusť instalaci znovu — tentokrát projde.
5. Otevři nainstalovanou aplikaci **Rodinný fotorámeček**.

Tohle je potřeba udělat jen jednou (nebo znovu, pokud bys instalovala/instaloval
novější verzi APK přes tu starou).

---

## 4. Jak udělit aplikaci přístup k fotkám

Při úplně prvním spuštění aplikace uvidíš černou obrazovku s krátkým
vysvětlením a tlačítkem **"Otevřít nastavení a povolit přístup"**.

1. Klepni na tlačítko.
2. Otevře se systémové nastavení telefonu pro tuto aplikaci.
3. Zapni přepínač, který povoluje **přístup ke správě všech souborů**
   (na telefonu bude popsaný podobně jako "Povolit správu všech souborů").
4. Vrať se zpět tlačítkem zpět v telefonu (ne zavřením aplikace).

Aplikace si všimne, že je přístup povolený, a rovnou spustí slideshow. Tuhle
obrazovku už pak nikdy neuvidíš — přístup zůstává uložený, dokud aplikaci
neodinstaluješ.

Od této chvíle stačí nechat telefon zapnutý (obrazovka díky aplikaci
nezhasíná) a fotky/videa, které komukoliv přijdou přes WhatsApp, se samy
objeví ve slideshow.

---

## 5. Jak změnit časy okna, rychlost slideshow a počet nejnovějších fotek

Vše se nastavuje v jednom souboru:
[`app/src/main/assets/app.js`](app/src/main/assets/app.js), úplně nahoře:

```js
const OKNO_START = "13:00";   // od tohoto casu se pres den zobrazuje jen omezeny vyber
const OKNO_KONEC = "18:00";   // do tohoto casu plati stejne pravidlo
const POCET_NEJNOVEJSICH_V_OKNE = 20; // kolik nejnovejsich polozek se v okne zobrazuje
const INTERVAL_SEKUND = 10;   // jak dlouho se drzi jedna (bezna) fotka na obrazovce
const TRVANI_NOVE_FOTKY_MS = 60 * 1000; // jak dlouho se drzi CERSTVE prijata fotka
const OBNOVA_SEZNAMU_MS = 60 * 1000; // jak casto se kontroluje, jestli neprisly nove fotky
```

Aktuální nastavení: mezi **13:00 a 18:00** se prochází pouze **20 nejnovějších**
fotek/videí (dokola, v náhodném pořadí); mimo toto okno se prochází úplně
všechno. Například pro okno 12:00–19:00 a 30 nejnovějších uprav na:

```js
const OKNO_START = "12:00";
const OKNO_KONEC = "19:00";
const POCET_NEJNOVEJSICH_V_OKNE = 30;
```

Uprav, ulož, a proveď kroky z bodu 1 (`git add`, `git commit`, `git push`) —
GitHub automaticky sestaví nové APK, které si podle bodu 2–3 staneš stáhnout
a nainstalovat.

### Fotky/videa starší než měsíc

Ty se do slideshow vůbec nezařazují. Nastavuje se to v
[`MediaBridge.kt`](app/src/main/java/com/rodina/fotoramecek/MediaBridge.kt)
konstantou `POCET_MESICU_ULOZENI = 1` (v měsících).

### Nová fotka přijde okamžitě na řadu

Jakmile telefon zaznamená novou fotku (kontrola běží každou minutu), slideshow
ji hned přeruší, zobrazí ji na 60 sekund (`TRVANI_NOVE_FOTKY_MS`), a pak se
vrátí přesně tam, kde předtím skončila. Nové video se taky zobrazí hned, ale
přehraje se celé (má vlastní délku).

### Popisek (komentář) k fotce

Pokud fotka z WhatsAppu má komentář/popisek, aplikace se ho pokusí přečíst a
zobrazit pod fotkou. Toto **není oficiálně zdokumentované chování WhatsAppu**
— hledá se ve skrytých EXIF datech, které WhatsApp u některých fotek do
souboru zapíše. Nemusí to tedy fungovat u úplně každé fotky nebo verze
aplikace WhatsApp; když se popisek nenajde, fotka se prostě zobrazí bez něj
(nic se nerozbije). Video popisky nepodporuje.

### Pokud bys chtěla/chtěl změnit sledované WhatsApp složky

To se nastavuje na jiném místě, protože čtení souborů dělá nativní (Kotlin)
část aplikace, ne JavaScript: v souboru
[`app/src/main/java/com/rodina/fotoramecek/MediaBridge.kt`](app/src/main/java/com/rodina/fotoramecek/MediaBridge.kt)
úplně nahoře:

```kotlin
private val SLEDOVANE_SLOZKY = listOf(
    "image" to "Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Images",
    "video" to "Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Video"
)
```

---

## Jak aplikace funguje (technický přehled)

- **Kotlin + WebView**: nativní část řeší oprávnění k úložišti, čte seznam
  souborů z WhatsApp složek (a k fotkám zkouší najít i EXIF popisek/komentář),
  a předá ho do WebView. Celá slideshow logika (přechody, časování, výběr
  20 nejnovějších/všech fotek, přednostní zobrazení nové fotky) běží v
  HTML/JS uvnitř WebView.
- **Bez serveru**: žádný Node.js, žádný HTTP server. JavaScript ve WebView
  volá nativní metodu `AndroidMedia.ziskatSeznamMedii()` (JavascriptInterface)
  a dostane zpátky JSON seznam fotek/videí.
- **Servírování souborů**: fotky a videa se do WebView pouští přes
  `WebViewAssetLoader` pod virtuální adresou
  `https://appassets.androidplatform.net/media/...`, takže fungují i mimo
  složku `assets`.
- **Oprávnění**: `MANAGE_EXTERNAL_STORAGE` (Android 11+) nebo klasické
  `READ_EXTERNAL_STORAGE`/`WRITE_EXTERNAL_STORAGE` na starších Androidech
  (8–9). Aplikace je mimo Google Play, takže toto širší oprávnění je v
  pořádku použít.
- **Obrazovka pořád svítí**: `FLAG_KEEP_SCREEN_ON` v `MainActivity`.
- **WebView neusíná**: aplikace záměrně nikdy nevolá `webView.onPause()` ani
  `pauseTimers()`, takže JavaScript (a tím pádem slideshow) běží nepřetržitě,
  dokud je aplikace na popředí.
- **minSdk 26** (Android 8.0) až **targetSdk 34**.

## Struktura projektu

```
app/src/main/assets/index.html   - kostra stranky
app/src/main/assets/app.js       - slideshow logika (casy, prechody, pocitadlo)
app/src/main/assets/style.css    - vzhled (cerne pozadi, fade prechod)
app/src/main/java/.../MainActivity.kt          - opravneni, fullscreen, WebView
app/src/main/java/.../MediaBridge.kt           - cteni WhatsApp slozek -> JSON
app/src/main/java/.../WhatsAppMediaPathHandler.kt - servirovani souboru do WebView
.github/workflows/build.yml       - automaticke sestaveni APK na GitHubu
```
