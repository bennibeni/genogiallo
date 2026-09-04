// ---------- LOGICA DEL CASO ("chi è l'assassino?") ----------
// Nessuna dipendenza da React: pensato per essere testato in isolamento con
// uno script Node, esattamente come simulationEngine.js.
//
// A differenza di R19 (da cui R20 discende, e che dipendeva da R17/R18),
// questo modulo è completamente autonomo: "genealogyFormat.js" e
// "phenotypes.js" sono copie locali, non import da R18 — vedi la
// spiegazione data all'utente sul perché R20 è stata creata come clone
// indipendente invece di continuare a importare da R17/R18.
import { CANONICAL_SCHEMA } from "./genealogyFormat.js";
import { computeSkinTone, computeSkinToneBand } from "./phenotypes.js";

export function schemaIndex(schema) {
  return Object.fromEntries(schema.map((name, index) => [name, index]));
}

const IDX = schemaIndex(CANONICAL_SCHEMA);

// Le 10 fasce di riferimento di phenotypes.js sono troppo precise per fare da
// "valutazione qualitativa": raggrupparle in 3 fasce larghe (chiaro,
// intermedio, scuro) mantiene l'indizio utile a restringere i sospetti senza
// equivalere a rivelare il tono esatto. La suddivisione 3/4/3 riflette la
// spaziatura lineare delle 10 fasce in phenotypes.js (t equispaziato): non è
// un caso che i gruppi siano di ampiezza comparabile.
export const QUALITATIVE_SKIN_GROUPS = [
  { label: "chiaro", bandIds: [1, 2, 3] },
  { label: "intermedio", bandIds: [4, 5, 6, 7] },
  { label: "scuro", bandIds: [8, 9, 10] },
];

const BAND_ID_TO_QUALITATIVE = new Map(
  QUALITATIVE_SKIN_GROUPS.flatMap((group) =>
    group.bandIds.map((bandId) => [bandId, group.label]),
  ),
);

export function qualitativeLabelForBandId(bandId) {
  return BAND_ID_TO_QUALITATIVE.get(bandId) || null;
}

// Le proporzioni ancestrali sono salvate come array (nello stesso ordine di
// "aree", vedi Simulation.exportGenealogy), ma computeSkinTone si aspetta un
// oggetto area -> valore (vedi phenotypes.js). Piccola conversione di
// formato, isolata qui per non doverla ripetere ad ogni chiamata.
export function proportionsObject(record, aree) {
  const values = record[IDX.proporzioni];
  return Object.fromEntries(aree.map((area, i) => [area, values[i]]));
}

// Tono di pelle qualitativo di un individuo: null solo se manca la mappa dei
// toni di riferimento (vedi computeSkinTone) — non dovrebbe mai accadere per
// un caso costruito da createCase, che verifica la presenza di "toniPelle"
// prima di generare qualunque cosa.
export function qualitativeSkinToneFor(record, aree, toniPelle) {
  const hex = computeSkinTone(proportionsObject(record, aree), aree, toniPelle);
  if (!hex) return null;
  const band = computeSkinToneBand(hex);
  return { bandId: band.id, label: qualitativeLabelForBandId(band.id) };
}

export const DISEASE_LABELS = {
  lhon: "neuropatia ottica ereditaria di Leber (LHON)",
  swyer: "sindrome di Swyer",
};

// Stato della malattia mitocondriale (LHON) per QUALUNQUE individuo. A
// differenza della malattia legata al cromosoma Y, qui non esiste un caso
// "non applicabile" (il mtDNA ce l'hanno tutti, maschi e femmine): l'unico
// stato oltre a presente/assente è "non determinabile", per chi ha la linea
// materna interrotta (matrilineBroken) — il ripiego estremo di pickOther in
// popolazioni piccolissime, vedi simulationEngine.js.
export function lhonStatus(record) {
  const value = record[IDX.linea_materna_lhon];
  if (value === null) return { stato: "non_determinabile" };
  return { stato: value ? "presente" : "assente" };
}

// Stato della malattia legata al cromosoma Y (sindrome di Swyer) per
// QUALUNQUE individuo, sospetto o assassino che sia. Un referto del DNA
// reale distinguerebbe due motivi diversi per un risultato "assente di
// informazione": "non applicabile" (una femmina non ha mai un cromosoma Y su
// cui la mutazione potrebbe presentarsi) è un'informazione diversa da "non
// determinabile" (un fondatore maschio, per cui il modello non simula alcuna
// trasmissione alla generazione 0 — vedi simulationEngine.js). Le femmine
// hanno sempre sindrome_swyer === null, quindi il controllo sul sesso viene
// prima e basta a distinguerle da un fondatore maschio, l'unico altro caso
// in cui il campo è null.
export function ySwyerStatus(record) {
  if (record[IDX.sesso] === "F") return { stato: "non_applicabile" };
  const value = record[IDX.sindrome_swyer];
  if (value === null) return { stato: "non_determinabile" };
  return { stato: value ? "presente" : "assente" };
}

// Etichette condivise dai 2 indizi di malattia: entrambi restituiscono uno
// "stato" tra questi 4 (anche se lhonStatus() non usa mai "non_applicabile",
// dato che il mtDNA non ha un equivalente della non-applicabilità del
// cromosoma Y).
export const DISEASE_STATUS_LABELS = {
  presente: "presente",
  assente: "assente",
  non_applicabile: "non applicabile (nessun cromosoma Y)",
  non_determinabile: "non determinabile (nessuna trasmissione registrata)",
};

// Area ancestrale dominante di un individuo: la stessa identica logica di
// Simulation.dominantAreaFromProportions in simulationEngine.js (reduce con
// >=, quindi a parità sceglie l'area che compare prima in "aree"), riscritta
// qui perché lavora su un record già esportato invece che su un'istanza di
// Individual — sempre determinabile, ogni individuo ha sempre una qualche
// area dominante.
export function dominantArea(record, aree) {
  const props = proportionsObject(record, aree);
  return aree.reduce((a, b) => (props[a] >= props[b] ? a : b));
}

// Stato della linea materna e paterna (interrotta/intatta/non applicabile):
// RIMOSSI come indizi sbloccabili. In pratica, con l'accoppiamento vincolato
// a sesso opposto introdotto da pickOther, "interrotta" non si è mai
// verificata in centinaia di prove empiriche — richiede un ripiego estremo
// per popolazioni piccolissime, non un evento realistico in una partita. Lo
// stato "non applicabile" della linea materna equivale ESATTAMENTE a
// "generazione === 0" (un fondatore non ha unione genitoriale, punto): è
// un'informazione ridondante rispetto all'indizio "generazione", che dà lo
// stesso fatto con precisione totale invece che con un solo bit. Quello
// della linea paterna è messo anche peggio, dato che il suo "non
// applicabile" confonde due condizioni diverse (femmina, oppure fondatore) —
// ambiguo oltre che ridondante col sesso, già obbligatorio. Vedi la
// discussione con l'utente per l'analisi completa.

// Stato dell'unione dei genitori: "non applicabile" per un fondatore (non è
// nato da un'unione), altrimenti "fuori gruppo" se i genitori avevano aree
// dominanti diverse al momento dell'accoppiamento — vedi "outOfGroupUnion"
// in simulationEngine.js.
export function outOfGroupStatus(record) {
  const value = record[IDX.unione_fuori_gruppo];
  if (value === null) return { stato: "non_applicabile" };
  return { stato: value ? "fuori_gruppo" : "stesso_gruppo" };
}

export const OUT_OF_GROUP_STATUS_LABELS = {
  fuori_gruppo: "genitori di aree diverse",
  stesso_gruppo: "genitori della stessa area",
  non_applicabile: "non applicabile (fondatore, nessuna unione genitoriale)",
};

// Record della madre/del padre di un individuo, o null se non tracciabile
// (fondatore). Helper condiviso da tutta la risalita generazionale sotto.
function motherRecord(record, individui) {
  const madreId = record[IDX.madre_id];
  if (madreId === null || madreId === undefined) return null;
  return individui[madreId];
}
function fatherRecord(record, individui) {
  const padreId = record[IDX.padre_id];
  if (padreId === null || padreId === undefined) return null;
  return individui[padreId];
}

// Risale un percorso di ruoli genitoriali (es. ["madre","padre"] = "il padre
// della madre" = il nonno materno) a partire da un record, restituendo
// l'antenato raggiunto o null se il percorso si interrompe in qualunque
// punto (un fondatore lungo la strada, o comunque un genitore non
// tracciabile). Un percorso vuoto restituisce il record di partenza stesso
// — è così che "area dominante del sospetto" (livello 0, vedi
// ANCESTRY_LEVELS) e "area dominante di un antenato" (livelli successivi)
// condividono la stessa funzione invece di averne una a parte ciascuno.
export function ancestorRecord(record, individui, path) {
  let current = record;
  for (const role of path) {
    if (!current) return null;
    current = role === "madre" ? motherRecord(current, individui) : fatherRecord(current, individui);
  }
  return current;
}

export const ANCESTOR_AREA_NON_APPLICABILE_LABEL = "non applicabile (antenato non tracciabile)";

// Area ancestrale dominante di un antenato raggiunto tramite "path" (vedi
// ancestorRecord) — "non_applicabile" (valore sentinella, non una vera area)
// se l'antenato non è tracciabile. Con path=[] coincide esattamente con
// dominantArea(record, aree): è la stessa idea applicata al sospetto stesso
// invece che a un suo antenato.
export function areaOfAncestor(record, data, path) {
  const target = ancestorRecord(record, data.individui, path);
  return target ? dominantArea(target, data.aree) : "non_applicabile";
}

// Unione dei genitori DI un antenato raggiunto tramite "path" — la stessa
// idea di "unione dei nonni materni" (che è il caso path=["madre"] di questa
// funzione più generale), applicabile a qualunque livello: chiede "i
// genitori di QUELL'antenato erano della stessa area o no", non l'area
// dell'antenato stesso.
export function unionOfAncestorsParents(record, data, path) {
  const target = ancestorRecord(record, data.individui, path);
  if (!target) return { stato: "non_applicabile" };
  return outOfGroupStatus(target);
}

// Indizi SBLOCCABILI su richiesta (a differenza dei 4 indizi obbligatori
// sempre attivi dall'inizio — sesso, LHON, malattia Y, tono di pelle). Ogni
// voce sa come calcolare il proprio valore per un record ("compute") e come
// verificare se un record vi corrisponde ("matches") — una struttura pensata
// apposta per essere estesa. "compute"/"matches" ricevono l'intero "data",
// non solo "aree": la maggior parte di questi indizi ha bisogno di risalire
// l'albero tramite "data.individui".
export const CLUE_DEFINITIONS = {
  areaDominante: {
    label: "Area ancestrale dominante del sospettato",
    compute: (record, data) => areaOfAncestor(record, data, []),
    matches: (record, data, value) => areaOfAncestor(record, data, []) === value,
    formatValue: (value) => value,
  },
  areaMadre: {
    label: "Area ancestrale dominante della madre",
    shortLabel: "Madre",
    compute: (record, data) => areaOfAncestor(record, data, ["madre"]),
    matches: (record, data, value) => areaOfAncestor(record, data, ["madre"]) === value,
    formatValue: (value) => (value === "non_applicabile" ? ANCESTOR_AREA_NON_APPLICABILE_LABEL : value),
  },
  areaPadre: {
    label: "Area ancestrale dominante del padre",
    shortLabel: "Padre",
    compute: (record, data) => areaOfAncestor(record, data, ["padre"]),
    matches: (record, data, value) => areaOfAncestor(record, data, ["padre"]) === value,
    formatValue: (value) => (value === "non_applicabile" ? ANCESTOR_AREA_NON_APPLICABILE_LABEL : value),
  },
  areaNonnaMaterna: {
    label: "Area ancestrale dominante della nonna materna",
    shortLabel: "Nonna materna",
    compute: (record, data) => areaOfAncestor(record, data, ["madre", "madre"]),
    matches: (record, data, value) => areaOfAncestor(record, data, ["madre", "madre"]) === value,
    formatValue: (value) => (value === "non_applicabile" ? ANCESTOR_AREA_NON_APPLICABILE_LABEL : value),
  },
  areaNonnoMaterno: {
    label: "Area ancestrale dominante del nonno materno",
    shortLabel: "Nonno materno",
    compute: (record, data) => areaOfAncestor(record, data, ["madre", "padre"]),
    matches: (record, data, value) => areaOfAncestor(record, data, ["madre", "padre"]) === value,
    formatValue: (value) => (value === "non_applicabile" ? ANCESTOR_AREA_NON_APPLICABILE_LABEL : value),
  },
  areaNonnaPaterna: {
    label: "Area ancestrale dominante della nonna paterna",
    shortLabel: "Nonna paterna",
    compute: (record, data) => areaOfAncestor(record, data, ["padre", "madre"]),
    matches: (record, data, value) => areaOfAncestor(record, data, ["padre", "madre"]) === value,
    formatValue: (value) => (value === "non_applicabile" ? ANCESTOR_AREA_NON_APPLICABILE_LABEL : value),
  },
  areaNonnoPaterno: {
    label: "Area ancestrale dominante del nonno paterno",
    shortLabel: "Nonno paterno",
    compute: (record, data) => areaOfAncestor(record, data, ["padre", "padre"]),
    matches: (record, data, value) => areaOfAncestor(record, data, ["padre", "padre"]) === value,
    formatValue: (value) => (value === "non_applicabile" ? ANCESTOR_AREA_NON_APPLICABILE_LABEL : value),
  },
  // Livello 4 della catena: gli 8 bisnonni. Non esiste un singolo termine
  // italiano che li distingua tutti (a differenza di "nonna materna" ecc.),
  // quindi l'etichetta descrive per esteso la catena di ruoli che porta a
  // ciascuno — esattamente il percorso passato ad areaOfAncestor.
  areaMadreNonnaMaterna: {
    label: "Area ancestrale dominante della madre della nonna materna",
    shortLabel: "Madre della nonna materna",
    compute: (record, data) => areaOfAncestor(record, data, ["madre", "madre", "madre"]),
    matches: (record, data, value) => areaOfAncestor(record, data, ["madre", "madre", "madre"]) === value,
    formatValue: (value) => (value === "non_applicabile" ? ANCESTOR_AREA_NON_APPLICABILE_LABEL : value),
  },
  areaPadreNonnaMaterna: {
    label: "Area ancestrale dominante del padre della nonna materna",
    shortLabel: "Padre della nonna materna",
    compute: (record, data) => areaOfAncestor(record, data, ["madre", "madre", "padre"]),
    matches: (record, data, value) => areaOfAncestor(record, data, ["madre", "madre", "padre"]) === value,
    formatValue: (value) => (value === "non_applicabile" ? ANCESTOR_AREA_NON_APPLICABILE_LABEL : value),
  },
  areaMadreNonnoMaterno: {
    label: "Area ancestrale dominante della madre del nonno materno",
    shortLabel: "Madre del nonno materno",
    compute: (record, data) => areaOfAncestor(record, data, ["madre", "padre", "madre"]),
    matches: (record, data, value) => areaOfAncestor(record, data, ["madre", "padre", "madre"]) === value,
    formatValue: (value) => (value === "non_applicabile" ? ANCESTOR_AREA_NON_APPLICABILE_LABEL : value),
  },
  areaPadreNonnoMaterno: {
    label: "Area ancestrale dominante del padre del nonno materno",
    shortLabel: "Padre del nonno materno",
    compute: (record, data) => areaOfAncestor(record, data, ["madre", "padre", "padre"]),
    matches: (record, data, value) => areaOfAncestor(record, data, ["madre", "padre", "padre"]) === value,
    formatValue: (value) => (value === "non_applicabile" ? ANCESTOR_AREA_NON_APPLICABILE_LABEL : value),
  },
  areaMadreNonnaPaterna: {
    label: "Area ancestrale dominante della madre della nonna paterna",
    shortLabel: "Madre della nonna paterna",
    compute: (record, data) => areaOfAncestor(record, data, ["padre", "madre", "madre"]),
    matches: (record, data, value) => areaOfAncestor(record, data, ["padre", "madre", "madre"]) === value,
    formatValue: (value) => (value === "non_applicabile" ? ANCESTOR_AREA_NON_APPLICABILE_LABEL : value),
  },
  areaPadreNonnaPaterna: {
    label: "Area ancestrale dominante del padre della nonna paterna",
    shortLabel: "Padre della nonna paterna",
    compute: (record, data) => areaOfAncestor(record, data, ["padre", "madre", "padre"]),
    matches: (record, data, value) => areaOfAncestor(record, data, ["padre", "madre", "padre"]) === value,
    formatValue: (value) => (value === "non_applicabile" ? ANCESTOR_AREA_NON_APPLICABILE_LABEL : value),
  },
  areaMadreNonnoPaterno: {
    label: "Area ancestrale dominante della madre del nonno paterno",
    shortLabel: "Madre del nonno paterno",
    compute: (record, data) => areaOfAncestor(record, data, ["padre", "padre", "madre"]),
    matches: (record, data, value) => areaOfAncestor(record, data, ["padre", "padre", "madre"]) === value,
    formatValue: (value) => (value === "non_applicabile" ? ANCESTOR_AREA_NON_APPLICABILE_LABEL : value),
  },
  areaPadreNonnoPaterno: {
    label: "Area ancestrale dominante del padre del nonno paterno",
    shortLabel: "Padre del nonno paterno",
    compute: (record, data) => areaOfAncestor(record, data, ["padre", "padre", "padre"]),
    matches: (record, data, value) => areaOfAncestor(record, data, ["padre", "padre", "padre"]) === value,
    formatValue: (value) => (value === "non_applicabile" ? ANCESTOR_AREA_NON_APPLICABILE_LABEL : value),
  },
  unioneFuoriGruppo: {
    label: "Unione dei genitori",
    compute: (record) => outOfGroupStatus(record).stato,
    matches: (record, data, value) => outOfGroupStatus(record).stato === value,
    formatValue: (value) => OUT_OF_GROUP_STATUS_LABELS[value],
    hint: "Restringe i sospetti a chi ha genitori con la stessa combinazione di origini dell'assassino.",
  },
  unioneNonniMaterni: {
    label: "Unione dei nonni materni",
    compute: (record, data) => unionOfAncestorsParents(record, data, ["madre"]).stato,
    matches: (record, data, value) => unionOfAncestorsParents(record, data, ["madre"]).stato === value,
    formatValue: (value) => OUT_OF_GROUP_STATUS_LABELS[value],
    hint: "Come l'unione dei genitori, ma un livello più indietro: i nonni materni (i genitori della madre).",
  },
  // Simmetrico al precedente, lato paterno — mancava, non c'era alcun motivo
  // per cui i nonni materni avessero un indizio sulla loro unione e quelli
  // paterni no. Stessa funzione generica, path=["padre"] invece di
  // ["madre"].
  unioneNonniPaterni: {
    label: "Unione dei nonni paterni",
    compute: (record, data) => unionOfAncestorsParents(record, data, ["padre"]).stato,
    matches: (record, data, value) => unionOfAncestorsParents(record, data, ["padre"]).stato === value,
    formatValue: (value) => OUT_OF_GROUP_STATUS_LABELS[value],
    hint: "Come sopra, ma sui nonni paterni (i genitori del padre).",
  },
  // Non più la generazione esatta: una finestra di massimo 3 generazioni
  // adiacenti (l'assassino, una prima e una dopo), ristretta ai margini
  // della genealogia (i fondatori non hanno una generazione "-1", l'ultima
  // generazione non ha una "+1") — dove capita naturalmente 2 invece di 3.
  // Era di gran lunga l'indizio più forte del gioco (in media ~20% di
  // sospetti residui da solo, contro il 50%+ di quasi tutti gli altri):
  // allargarlo a una fascia lo rende ancora utile ma non più un colpo
  // singolo quasi risolutivo.
  generazione: {
    label: "Generazione",
    compute: (record, data) => {
      const massima = Math.max(...data.individui.map((r) => r[IDX.generazione]));
      const g = record[IDX.generazione];
      return { min: Math.max(0, g - 1), max: Math.min(massima, g + 1) };
    },
    matches: (record, data, value) => {
      const g = record[IDX.generazione];
      return g >= value.min && g <= value.max;
    },
    formatValue: (value) => (value.min === value.max ? String(value.min) : `tra la ${value.min} e la ${value.max}`),
  },
  // A differenza di ogni altro indizio, il nome non si calcola da un campo
  // del record: vive in "data.nomi", una mappa esterna indicizzata per id
  // (vedi nameEngine.js). Per questo "compute"/"matches" qui ricevono anche
  // "id" come terzo/quarto argomento — l'unico indizio che ne ha bisogno,
  // ma non costa nulla darlo sempre a tutti (gli altri lo ignorano
  // semplicemente). Null-safe: se "data.nomi" non è stato assegnato (non
  // dovrebbe succedere nel gioco vero, dove NewCaseSetup lo popola sempre),
  // non genera un errore, restituisce solo un indizio inutilizzabile.
  // Non più il nome intero (troppo forte, vedi la discussione con l'utente
  // sull'esclusione reciproca con "generazione"): il biglietto è
  // danneggiato/parziale, se ne legge solo UNA lettera scelta a caso tra
  // quelle del nome. Un candidato "corrisponde" se il suo nome contiene
  // quella lettera (confronto case-insensitive) — non nella stessa
  // posizione, solo la sua presenza: più debole e più realistico di un
  // confronto posizionale, che non avrebbe un analogo forense plausibile.
  biglietto: {
    label: "Lettera leggibile sul biglietto da visita lasciato sulla scena",
    compute: (record, data, id) => {
      const nome = data.nomi ? data.nomi[id] : null;
      if (!nome) return null;
      const lettere = nome.replace(/[^a-zA-ZÀ-ÖØ-öø-ÿ]/g, "").split("");
      if (lettere.length === 0) return null;
      return lettere[Math.floor(Math.random() * lettere.length)].toLowerCase();
    },
    matches: (record, data, value, id) => {
      const nome = data.nomi ? data.nomi[id] : null;
      return Boolean(nome) && nome.toLowerCase().includes(value);
    },
    formatValue: (value) => (value ? `"${value}"` : "illeggibile"),
  },
};

// "generazione" e "biglietto" NON si escludono più a vicenda: da quando
// "biglietto" restituisce una sola lettera (non più il nome intero, vedi
// sopra), conoscerli entrambi non equivale quasi mai a conoscere
// l'identità esatta — verificato empiricamente: insieme isolano subito un
// solo sospetto solo nel 21% dei casi, lasciandone in media il 10.8%, non
// un "vinci subito" gratuito come accadeva col nome intero. L'esclusione
// reciproca (che esisteva qui) è stata quindi rimossa; restano entrambi
// indizi indipendenti come gli altri, dentro STANDALONE_CLUE_KEYS.
// PRIMARY_STANDALONE_KEYS distingue in CluesPanel.jsx questi 2 (semplici,
// senza regole speciali) dai 3 "Unione..." (che restano bloccati fino a
// quando non resta nient'altro di richiedibile, vedi UNIONE_CLUE_KEYS lì).
export const PRIMARY_STANDALONE_KEYS = ["generazione", "biglietto"];

// Catena di indagine anagrafica sull'ancestralità: il sospetto stesso
// (livello 0), poi i genitori (livello 1), poi i nonni (livello 2) — e
// volendo si potrebbe estendere ai bisnonni con un altro livello, senza
// toccare nient'altro. Ogni livello si rivela TUTTO INSIEME con un solo
// "Richiedi" (vedi DetectiveGame.jsx), non una posizione alla volta.
//
// Il livello i+1 diventa richiedibile solo quando ENTRAMBE queste
// condizioni valgono: il livello i è già stato rivelato per intero, e i
// sospetti compatibili con tutto ciò che è attivo finora sono ancora più di
// uno. Rispecchia una vera indagine: non si va a scavare nei registri
// anagrafici di 2 generazioni fa se il livello precedente ha già isolato un
// solo nome. Il livello 0 non ha questo vincolo (non c'è un livello -1):
// è sempre richiedibile da subito, come tutti gli altri indizi sbloccabili.
export const ANCESTRY_LEVELS = [
  {
    key: "sospetto",
    label: "Area ancestrale dominante",
    positions: ["areaDominante"],
  },
  {
    key: "genitori",
    label: "Area ancestrale dominante dei genitori",
    positions: ["areaMadre", "areaPadre"],
  },
  {
    key: "nonni",
    label: "Area ancestrale dominante dei nonni",
    positions: ["areaNonnaMaterna", "areaNonnoMaterno", "areaNonnaPaterna", "areaNonnoPaterno"],
  },
  {
    key: "bisnonni",
    label: "Area ancestrale dominante dei bisnonni",
    positions: [
      "areaMadreNonnaMaterna",
      "areaPadreNonnaMaterna",
      "areaMadreNonnoMaterno",
      "areaPadreNonnoMaterno",
      "areaMadreNonnaPaterna",
      "areaPadreNonnaPaterna",
      "areaMadreNonnoPaterno",
      "areaPadreNonnoPaterno",
    ],
  },
];

// Tutte le chiavi indipendenti dalla catena: i 2 "primari" (generazione,
// biglietto) più i 3 "Unione..." — questi ultimi con la loro regola
// speciale di sblocco tardivo, gestita in CluesPanel.jsx.
export const STANDALONE_CLUE_KEYS = ["unioneFuoriGruppo", "unioneNonniMaterni", "unioneNonniPaterni", "generazione", "biglietto"];

// Tutte le chiavi sbloccabili, appiattite — usata da createCase per
// precalcolare ogni valore e da filterSuspects per applicarli tutti: non le
// interessa se una chiave fa parte di un "livello" o è indipendente, quella
// distinzione riguarda solo l'ordine in cui l'interfaccia le rivela.
export const EXTRA_CLUE_KEYS = [
  ...ANCESTRY_LEVELS.flatMap((level) => level.positions),
  ...STANDALONE_CLUE_KEYS,
];

// Sceglie l'assassino tra TUTTI gli individui mai esistiti nella genealogia
// (ogni generazione, non solo l'ultima), SENZA alcun vincolo sulla
// determinabilità di alcun campo: qualunque individuo può essere
// l'assassino. Il referto del DNA riporta sempre 4 fatti obbligatori —
// sesso, stato LHON, stato della malattia legata al cromosoma Y,
// valutazione qualitativa del colorito — più il valore di ciascuno degli
// indizi sbloccabili (vedi CLUE_DEFINITIONS), calcolato subito ma rivelato
// al giocatore solo su richiesta. "Riportare sempre il fatto" non significa
// "il fatto è sempre un presente/assente netto": per le malattie ed i due
// indizi di linea viene mostrato uno degli stati possibili,
// "non determinabile"/"non applicabile" compresi, esattamente come farebbe
// un referto di laboratorio vero quando un marcatore non è analizzabile per
// quel campione.
export function createCase(data) {
  const { individui, aree, toniPelle } = data;

  const assassinoId = Math.floor(Math.random() * individui.length);
  const record = individui[assassinoId];

  const tonoPelle = qualitativeSkinToneFor(record, aree, toniPelle);
  if (!tonoPelle) {
    throw new Error(
      "Impossibile calcolare il tono di pelle: mancano i toni di riferimento per una o più aree.",
    );
  }

  const extraClues = {};
  EXTRA_CLUE_KEYS.forEach((key) => {
    extraClues[key] = CLUE_DEFINITIONS[key].compute(record, data, assassinoId);
  });

  const clues = {
    sesso: record[IDX.sesso],
    lhon: lhonStatus(record),
    swyer: ySwyerStatus(record),
    tonoPelle,
    ...extraClues,
  };

  const vivo = assignAliveStatus(data, assassinoId, clues);

  return { assassinoId, totalSuspects: individui.length, clues, vivo };
}

// Probabilità (approssimativa, puramente di ambientazione) che un individuo
// sia ancora vivo al momento del delitto, in funzione di quante generazioni
// sono passate dalla sua nascita. Non pretende di modellare una vera curva
// di sopravvivenza demografica: serve solo a far sembrare "naturale" la
// distribuzione di vivo/deceduto sulla popolazione che NON fa parte del
// gruppo indistinguibile dall'assassino (vedi assignAliveStatus) — per loro
// non ha alcuna importanza ai fini della soluzione del caso, quindi basta
// che sia plausibile, non che sia rigorosa. Ammorbidita su richiesta: con
// il decadimento originale (0.22, minimo 0.02) circa il 70% di chi soddisfa
// solo i 4 obbligatori risultava già deceduto — troppo frequente. Con
// questi valori la popolazione complessiva passa da ~27% a ~59% di vivi in
// media (verificato empiricamente).
function aliveProbabilityForAge(generationsAgo) {
  const p = 1 - generationsAgo * 0.08;
  return Math.min(0.97, Math.max(0.08, p));
}

// Assegna lo stato "in vita al momento del delitto" (che si intende sempre
// come "dopo l'ultima generazione evoluta", vedi il commento su
// aliveProbabilityForAge) a OGNI individuo della popolazione, in 2 fasi:
//
// 1. Una base plausibile: probabilità di essere vivo che cala con l'età
//    (quante generazioni sono passate dalla nascita), con un po' di
//    casualità — serve solo a dare consistenza narrativa a chi non conta
//    ai fini del rompicapo.
// 2. Un ribaltamento FORZATO sul gruppo che conta davvero: il "gruppo
//    indistinguibile" è l'insieme di individui che condividono con
//    l'assassino OGNI singolo fatto che il gioco può rivelare (esattamente
//    filterSuspects con tutti gli indizi attivi insieme — la stessa
//    quantità che abbiamo misurato più volte parlando di ambiguità
//    residua). L'assassino viene sempre dichiarato vivo (ovvio: ha appena
//    commesso il delitto); chiunque altro in quel gruppo viene invece
//    dichiarato deceduto, cioè dotato di un alibi assoluto. Il risultato è
//    che quando il giocatore richiede l'indizio "in vita", l'assassino
//    risulta SEMPRE l'unico sospetto compatibile rimasto in quel gruppo —
//    non per fortuna statistica, ma per costruzione.
export function assignAliveStatus(data, assassinoId, clues) {
  const ultimaGenerazione = Math.max(...data.individui.map((record) => record[IDX.generazione]));
  const gruppoIndistinguibile = filterSuspects(data, clues);

  const vivo = {};
  data.individui.forEach((record, id) => {
    const generationsAgo = ultimaGenerazione - record[IDX.generazione];
    vivo[id] = Math.random() < aliveProbabilityForAge(generationsAgo);
  });

  vivo[assassinoId] = true;
  gruppoIndistinguibile.forEach((id) => {
    if (id !== assassinoId) vivo[id] = false;
  });

  return vivo;
}

// Filtra i sospetti in base agli indizi ATTUALMENTE attivi. Un indizio
// assente (null/undefined) non filtra nulla. I 4 indizi obbligatori restano
// scritti esplicitamente (ciascuno ha una forma leggermente diversa: sesso è
// un valore grezzo, le 2 malattie e il tono di pelle sono oggetti con le
// loro proprie chiavi); gli indizi sbloccabili invece condividono tutti la
// stessa forma (un valore semplice più una funzione "matches" in
// CLUE_DEFINITIONS), quindi si scorrono in un unico ciclo. "vivo" (opzionale,
// la mappa calcolata da assignAliveStatus) è un caso a parte, ma non è più
// un indizio che il giocatore sblocca: l'alibi si applica SEMPRE e in
// automatico ogni volta che la mappa è disponibile, silenziosamente — è il
// meccanismo che garantisce la determinabilità univoca (vedi
// assignAliveStatus), non qualcosa da "chiedere". Prima esisteva un indizio
// "Stato in vita" esplicito con un pulsante da premere: rimosso, perché il
// suo valore mostrato era sempre e comunque "in vita" (tautologico per
// l'assassino), un'interazione vuota — l'effetto utile (eliminare chi
// risulta deceduto) ora avviene senza che il giocatore debba fare nulla.
// Quando "vivo" non viene passato (durante il calcolo del gruppo
// indistinguibile in assignAliveStatus, che gira prima che la mappa esista)
// il filtro sull'alibi viene semplicemente ignorato.
export function filterSuspects(data, activeClues, vivo) {
  const { individui, aree, toniPelle } = data;
  const matches = [];
  individui.forEach((record, id) => {
    if (activeClues.sesso) {
      if (record[IDX.sesso] !== activeClues.sesso) return;
    }
    if (activeClues.lhon) {
      if (lhonStatus(record).stato !== activeClues.lhon.stato) return;
    }
    if (activeClues.swyer) {
      if (ySwyerStatus(record).stato !== activeClues.swyer.stato) return;
    }
    if (activeClues.tonoPelle) {
      const tono = qualitativeSkinToneFor(record, aree, toniPelle);
      if (!tono || tono.label !== activeClues.tonoPelle.label) return;
    }
    if (vivo && !vivo[id]) return;
    for (const key of EXTRA_CLUE_KEYS) {
      const value = activeClues[key];
      if (value === null || value === undefined) continue;
      if (!CLUE_DEFINITIONS[key].matches(record, data, value, id)) return;
    }
    matches.push(id);
  });
  return matches;
}

export { IDX as SCHEMA_INDEX };
