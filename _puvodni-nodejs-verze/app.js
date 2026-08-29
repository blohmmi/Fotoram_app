// Rodinny fotoramecek - logika slideshow.
// Zadne tlacitka, zadne ovladani - jen se pusti a bezi samo.

// ---------------------------------------------------------------------------
// KONSTANTY - snadno upravitelne casy a rychlost slideshow.
// ---------------------------------------------------------------------------
const OKNO_START = "13:00";   // od tohoto casu (vcetne) se pres den zobrazuji jen DNESNI fotky
const OKNO_KONEC = "17:00";   // do tohoto casu (vcetne) plati stejne pravidlo
const INTERVAL_SEKUND = 10;   // jak dlouho se drzi jedna fotka na obrazovce
const OBNOVA_SEZNAMU_MS = 60 * 1000; // jak casto se stahuje novy seznam fotek ze serveru

// ---------------------------------------------------------------------------
// Stav aplikace
// ---------------------------------------------------------------------------
let vsechnyPolozky = [];     // posledni seznam prijaty ze serveru (vse, co WhatsApp ma)
let frontaZobrazeni = [];    // fronta polozek, ktere se maji postupne prehrat (zamichana)
let jeVOkneOd = null;        // posledni znamy stav "jsme v case 13-17?" - pro detekci zmeny
let aktivniVrstva = 0;       // index vrstvy (0 nebo 1), ktera je prave videt
let casovac = null;          // handle na setTimeout mezi fotkami

const vrstvy = [document.getElementById("layer0"), document.getElementById("layer1")];

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

// Byl soubor vytvoren dnes (podle lokalniho data telefonu)?
function jeDnes(datumString) {
  const datumSouboru = new Date(datumString);
  const ted = new Date();
  return (
    datumSouboru.getFullYear() === ted.getFullYear() &&
    datumSouboru.getMonth() === ted.getMonth() &&
    datumSouboru.getDate() === ted.getDate()
  );
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

// ---------------------------------------------------------------------------
// Sestaveni fronty k prehrani podle aktualnich pravidel (cas, dnesni datum)
// ---------------------------------------------------------------------------
function sestavFrontu() {
  if (vsechnyPolozky.length === 0) return [];

  if (jsmeVOkne()) {
    const dnesni = vsechnyPolozky.filter((p) => jeDnes(p.createdAt));
    // Pokud v okne 13-17 nejsou zadne dnesni fotky, obrazovka nesmi zustat
    // prazdna - pouzijeme vsechny fotky jako zalozni reseni.
    if (dnesni.length > 0) return zamichej(dnesni);
    return zamichej(vsechnyPolozky);
  }

  return zamichej(vsechnyPolozky);
}

// Vrati dalsi polozku k zobrazeni. Kdyz je fronta prazdna, znovu ji sestavi
// (cimz se zaroven zohledni pripadny novy seznam ze serveru).
function dalsiPolozka() {
  if (frontaZobrazeni.length === 0) {
    frontaZobrazeni = sestavFrontu();
  }
  if (frontaZobrazeni.length === 0) return null;
  return frontaZobrazeni.shift();
}

// ---------------------------------------------------------------------------
// Nacitani seznamu ze serveru
// ---------------------------------------------------------------------------
async function nactiSeznamZeSeveru() {
  try {
    const odpoved = await fetch("/api/photos");
    if (!odpoved.ok) throw new Error("Server vratil chybu " + odpoved.status);
    vsechnyPolozky = await odpoved.json();
  } catch (chyba) {
    // Chybu jen zalogujeme - bezici slideshow se nesmi prerusit. Zkusime to
    // znovu pri dalsim pravidelnem obnoveni.
    console.error("Nepodarilo se nacist seznam fotek, zkusim to znovu za chvili:", chyba);
  }
}

// Kontrola, jestli se zmenil stav "jsme v okne 13-17" - pokud ano, fronta se
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

function zobrazPolozku(polozka) {
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
    element.addEventListener("error", () => setTimeout(naslednujiciKrok, 1000));
  }

  novaVrstva.appendChild(element);

  // Vynuti prekresleni, aby prechod opacity opravdu zacal od 0.
  void novaVrstva.offsetWidth;

  novaVrstva.classList.add("visible");
  staraVrstva.classList.remove("visible");

  aktivniVrstva = 1 - aktivniVrstva;

  // Stara vrstva se po dokonceni prechodu vycisti (uvolni pamet, zastavi video).
  setTimeout(() => vycistiVrstvu(staraVrstva), 1000);

  if (polozka.type === "image") {
    if (casovac) clearTimeout(casovac);
    casovac = setTimeout(naslednujiciKrok, INTERVAL_SEKUND * 1000);
  }
  // U videa zadny casovac nenastavujeme - dalsi krok prijde az udalosti "ended".
}

function naslednujiciKrok() {
  const polozka = dalsiPolozka();
  if (!polozka) {
    // Zadna data k zobrazeni (WhatsApp jeste nema zadne fotky/video) -
    // zkusime to znovu za chvili, aby obrazovka nezustala natrvalo prazdna.
    if (casovac) clearTimeout(casovac);
    casovac = setTimeout(naslednujiciKrok, 5000);
    return;
  }
  zobrazPolozku(polozka);
}

// ---------------------------------------------------------------------------
// Start aplikace
// ---------------------------------------------------------------------------
async function start() {
  await pravidelnaAktualizace();
  setInterval(pravidelnaAktualizace, OBNOVA_SEZNAMU_MS);
  naslednujiciKrok();
}

// Po probuzeni telefonu ze spanku / navratu do prohlizece hned obnovime data,
// aby se co nejdriv projevily nove prijate fotky.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    pravidelnaAktualizace();
  }
});

start();
