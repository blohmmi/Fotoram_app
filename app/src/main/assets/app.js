// Rodinny fotoramecek - logika slideshow.
// Zadne tlacitka, zadne ovladani - jen se pusti a bezi samo.
// Seznam fotek/videi neprichazi ze sitoveho serveru (jako drive u Termuxu),
// ale primo z nativni Android casti aplikace pres rozhrani "AndroidMedia".
// Filtrovani "starsi nez mesic" uz probehlo na Android strane - sem uz
// prichazeji jen soubory, ktere maji byt vubec v uvahu.

// ---------------------------------------------------------------------------
// KONSTANTY - snadno upravitelne casy a rychlost slideshow.
// ---------------------------------------------------------------------------
const OKNO_START = "13:00";   // od tohoto casu (vcetne) se pres den zobrazuje jen omezeny vyber
const OKNO_KONEC = "18:00";   // do tohoto casu (vcetne) plati stejne pravidlo
const POCET_NEJNOVEJSICH_V_OKNE = 20; // kolik nejnovejsich polozek se v okne 13-18 zobrazuje
const INTERVAL_SEKUND = 10;   // jak dlouho se drzi jedna (bezna) fotka na obrazovce
const TRVANI_NOVE_FOTKY_MS = 60 * 1000; // jak dlouho se drzi CERSTVE prijata fotka, nez se vrati k fronte
const OBNOVA_SEZNAMU_MS = 60 * 1000; // jak casto se nacita novy seznam fotek z telefonu

// ---------------------------------------------------------------------------
// Stav aplikace
// ---------------------------------------------------------------------------
let vsechnyPolozky = [];     // posledni seznam ziskany z Androidu (vse, co WhatsApp ma, mimo stare nez mesic)
let frontaZobrazeni = [];    // fronta polozek, ktere se maji postupne prehrat (zamichana)
let novinkyKZobrazeni = [];  // prioritni fronta - cerstve prijate fotky/videa, ktere maji jit hned na radu
let jeVOkneOd = null;        // posledni znamy stav "jsme v case 13-18?" - pro detekci zmeny
let aktivniVrstva = 0;       // index vrstvy (0 nebo 1), ktera je prave videt
let casovac = null;          // handle na setTimeout mezi fotkami

let aktualniIndex = 0;       // poradi prave zobrazovane polozky v ramci aktualniho cyklu (1-based)
let aktualniCelkem = 0;      // celkovy pocet polozek v aktualnim cyklu
let aktualniJeVOkne = false; // pouzil se pri sestaveni aktualniho cyklu rezim "jen 20 nejnovejsich"?

const vrstvy = [document.getElementById("layer0"), document.getElementById("layer1")];
const pocitadloEl = document.getElementById("pocitadlo");
const popisekEl = document.getElementById("popisek");

// ---------------------------------------------------------------------------
// Pomocne funkce pro cas
// ---------------------------------------------------------------------------

// Prevede "HH:MM" na pocet minut od pulnoci.
function naMinuty(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Je prave ted (lokalni cas telefonu) v okne OKNO_START - OKNO_KONEC?
function jsmeVOkne() {
  const ted = new Date();
  const tedMinuty = ted.getHours() * 60 + ted.getMinutes();
  const start = naMinuty(OKNO_START);
  const konec = naMinuty(OKNO_KONEC);
  return tedMinuty >= start && tedMinuty <= konec;
}

// Fisher-Yates zamichani pole (nemeni puvodni pole, vraci novou kopii).
function zamichej(pole) {
  const kopie = pole.slice();
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
  }
  return kopie;
}

// Mnozina nazvu souboru z pole polozek - pouziva se pro zjisteni, jestli
// pribyly nove soubory.
function nazvySouboru(pole) {
  return new Set(pole.map((p) => p.filename));
}

// ---------------------------------------------------------------------------
// Sestaveni fronty k prehrani podle aktualnich pravidel (cas, pocet nejnovejsich)
// ---------------------------------------------------------------------------
function sestavFrontu() {
  if (vsechnyPolozky.length === 0) {
    aktualniJeVOkne = false;
    return [];
  }

  if (jsmeVOkne()) {
    aktualniJeVOkne = true;
    const serazenoOdNejnovejsich = vsechnyPolozky
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const nejnovejsich = serazenoOdNejnovejsich.slice(0, POCET_NEJNOVEJSICH_V_OKNE);
    return zamichej(nejnovejsich);
  }

  aktualniJeVOkne = false;
  return zamichej(vsechnyPolozky);
}

// Vrati dalsi polozku k zobrazeni. Kdyz je fronta prazdna, znovu ji sestavi
// (cimz se zaroven zohledni pripadny novy seznam z Androidu).
function dalsiPolozka() {
  if (frontaZobrazeni.length === 0) {
    frontaZobrazeni = sestavFrontu();
    aktualniCelkem = frontaZobrazeni.length;
    aktualniIndex = 0;
  }
  if (frontaZobrazeni.length === 0) return null;
  aktualniIndex++;
  return frontaZobrazeni.shift();
}

// ---------------------------------------------------------------------------
// Nacitani seznamu z nativni Android casti (AndroidMedia JavascriptInterface)
// ---------------------------------------------------------------------------
async function nactiSeznamZeSeveru() {
  try {
    if (typeof AndroidMedia === "undefined" || !AndroidMedia.ziskatSeznamMedii) {
      throw new Error("Rozhrani AndroidMedia neni k dispozici");
    }
    const json = AndroidMedia.ziskatSeznamMedii();
    const novePolozky = JSON.parse(json);

    const stareNazvy = nazvySouboru(vsechnyPolozky);
    const noveMedium = novePolozky.filter((p) => !stareNazvy.has(p.filename));

    vsechnyPolozky = novePolozky;

    if (noveMedium.length > 0) {
      // Cerstve prijate fotky/videa pujdou hned na radu (viz naslednujiciKrok),
      // aniz by se rozbila/zahodila fronta, ktera prave bezi - ta pak proste
      // pokracuje presne tam, kde skoncila.
      novinkyKZobrazeni.push(...noveMedium);
    }
  } catch (chyba) {
    // Chybu jen zalogujeme - bezici slideshow se nesmi prerusit. Zkusime to
    // znovu pri dalsim pravidelnem obnoveni.
    console.error("Nepodarilo se nacist seznam fotek, zkusim to znovu za chvili:", chyba);
  }
}

// Kontrola, jestli se zmenil stav "jsme v okne 13-18" - pokud ano, fronta se
// zahodi, aby se zmena projevila hned a ne az za dlouho.
function zkontrolujZmenuOkna() {
  const ted = jsmeVOkne();
  if (jeVOkneOd !== null && ted !== jeVOkneOd) {
    frontaZobrazeni = [];
  }
  jeVOkneOd = ted;
}

async function pravidelnaAktualizace() {
  await nactiSeznamZeSeveru();
  zkontrolujZmenuOkna();
}

// ---------------------------------------------------------------------------
// Pocitadlo v pravem dolnim rohu
// ---------------------------------------------------------------------------
function aktualizujPocitadlo() {
  if (!pocitadloEl) return;
  const popisek = aktualniJeVOkne ? "nejnovější" : "celkem";
  pocitadloEl.textContent = `${aktualniIndex}/${aktualniCelkem} ${popisek}`;
}

// ---------------------------------------------------------------------------
// Vykreslovani (crossfade mezi dvema vrstvami)
// ---------------------------------------------------------------------------

// Vycisti obsah vrstvy a zastavi pripadne prehravane video (aby neblo na pozadi).
function vycistiVrstvu(vrstva) {
  const video = vrstva.querySelector("video");
  if (video) {
    video.pause();
    video.src = "";
  }
  vrstva.innerHTML = "";
}

function zobrazPopisek(polozka) {
  if (!popisekEl) return;
  if (polozka.caption) {
    popisekEl.textContent = polozka.caption;
    popisekEl.classList.add("visible");
  } else {
    popisekEl.classList.remove("visible");
  }
}

// trvaniMs: jak dlouho (u fotky) zustat na obrazovce, nez prijde dalsi krok.
// jeNovinka: true, pokud jde o cerstve prijatou fotku/video mimo beznou frontu
// (pak se misto poradi v pocitadle ukaze kratke hlaseni).
function zobrazPolozku(polozka, trvaniMs = INTERVAL_SEKUND * 1000, jeNovinka = false) {
  const novaVrstva = vrstvy[1 - aktivniVrstva];
  const staraVrstva = vrstvy[aktivniVrstva];

  vycistiVrstvu(novaVrstva);

  let element;
  if (polozka.type === "video") {
    element = document.createElement("video");
    element.src = polozka.url;
    element.autoplay = true;
    element.muted = false;
    element.playsInline = true;
    element.addEventListener("ended", naslednujiciKrok);
    element.addEventListener("error", () => setTimeout(naslednujiciKrok, 1000));
  } else {
    element = document.createElement("img");
    element.src = polozka.url;
    element.alt = "";
  }

  novaVrstva.appendChild(element);

  // Vynuti prekresleni, aby prechod opacity opravdu zacal od 0.
  void novaVrstva.offsetWidth;

  novaVrstva.classList.add("visible");
  staraVrstva.classList.remove("visible");

  aktivniVrstva = 1 - aktivniVrstva;

  zobrazPopisek(polozka);

  if (jeNovinka) {
    if (pocitadloEl) pocitadloEl.textContent = "Nová fotka";
  } else {
    aktualizujPocitadlo();
  }

  // Stara vrstva se po dokonceni prechodu vycisti (uvolni pamet, zastavi video).
  setTimeout(() => vycistiVrstvu(staraVrstva), 1000);

  if (polozka.type === "image") {
    if (casovac) clearTimeout(casovac);
    casovac = setTimeout(naslednujiciKrok, trvaniMs);
  }
  // U videa zadny casovac nenastavujeme - dalsi krok prijde az udalosti "ended".
}

// Fotku predem nactem pres new Image(), aby se na obrazovce nikdy neobjevila
// cerna/prazdna plocha - predchozi fotka zustava, dokud neni nova pripravena.
function prednactiAZobrazObrazek(polozka, trvaniMs, jeNovinka = false) {
  const predbezneNacteni = new Image();
  predbezneNacteni.onload = () => zobrazPolozku(polozka, trvaniMs, jeNovinka);
  predbezneNacteni.onerror = () => {
    console.error("Nepodarilo se nacist obrazek, preskakuji:", polozka.url);
    naslednujiciKrok();
  };
  predbezneNacteni.src = polozka.url;
}

function naslednujiciKrok() {
  // Cerstve prijate fotky/videa maji vzdy prednost pred beznou frontou -
  // zobrazi se okamzite a bezna fronta pak pokracuje tam, kde skoncila.
  if (novinkyKZobrazeni.length > 0) {
    const novinka = novinkyKZobrazeni.shift();
    if (novinka.type === "image") {
      prednactiAZobrazObrazek(novinka, TRVANI_NOVE_FOTKY_MS, true);
    } else {
      zobrazPolozku(novinka, undefined, true);
    }
    return;
  }

  const polozka = dalsiPolozka();
  if (!polozka) {
    // Zadna data k zobrazeni (WhatsApp jeste nema zadne fotky/video) -
    // zkusime to znovu za chvili, aby obrazovka nezustala natrvalo prazdna.
    if (casovac) clearTimeout(casovac);
    casovac = setTimeout(naslednujiciKrok, 5000);
    return;
  }

  if (polozka.type === "image") {
    prednactiAZobrazObrazek(polozka);
  } else {
    zobrazPolozku(polozka);
  }
}

// ---------------------------------------------------------------------------
// Start aplikace
// ---------------------------------------------------------------------------
async function start() {
  await pravidelnaAktualizace();
  // Pri prvnim startu se vse povazuje za "novinku" jen kdyby uz neco bezelo -
  // hned na zacatku chceme normalni frontu, ne rezim "cerstva fotka na 60s".
  novinkyKZobrazeni = [];
  setInterval(pravidelnaAktualizace, OBNOVA_SEZNAMU_MS);
  naslednujiciKrok();
}

// Po navratu aplikace do popredi hned obnovime data, aby se co nejdriv
// projevily nove prijate fotky.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    pravidelnaAktualizace();
  }
});

start();
