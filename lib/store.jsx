"use client";

// Tutto lo stato del gioco vive qui, non nelle singole pagine — esattamente
// come lib/store.tsx in dodici. È necessario perché "Indagine" e
// "Generazione" sono ora due rotte vere (non più due viste interne di un
// solo componente): entrambe devono vedere la STESSA partita in corso, la
// stessa scheda anagrafica eventualmente aperta, le stesse impostazioni —
// un Context condiviso, montato una volta sola nel layout radice, è il modo
// naturale di ottenerlo con l'App Router.
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createCase, EXTRA_CLUE_KEYS, filterSuspects, SCHEMA_INDEX } from "./caseEngine";
import { assignNames } from "./nameEngine";
import { buildFromFreshSimulation, DEFAULT_GENERATIONS, DEFAULT_MIGRATION_RATE, DEFAULT_NUM_MARKERS, DEFAULT_POP_PER_AREA } from "./simulationSetup";
import { DEFAULT_SETTINGS } from "./settings";

// Quanti avatar mostrare sempre nel pannello sospetti: 1 "vero" (scelto a
// caso tra i compatibili con gli indizi attivi in quel momento — non è
// detto sia l'assassino stesso, se i compatibili sono ancora più di uno) +
// 9 "rumore" dello stesso sesso + 2 di sesso opposto (vedi più sotto).
const SUSPECTS_SHOWN = 12;

function mescola(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Genera una partita completa e pronta (data + kase + activeClues) in un
// solo colpo, sincrono — nessuna Promise. Usata sia per lo stato iniziale
// del provider sia da "Nuova indagine".
function generateFreshGame(settingsToApply) {
  const freshData = buildFromFreshSimulation({
    popPerArea: DEFAULT_POP_PER_AREA,
    numMarkers: DEFAULT_NUM_MARKERS,
    generations: DEFAULT_GENERATIONS,
    migrationRate: DEFAULT_MIGRATION_RATE,
  });
  const loadedData = { ...freshData, nomi: assignNames(freshData), generazioniEvolute: DEFAULT_GENERATIONS };
  const newCase = createCase(loadedData);
  const lockedExtras = Object.fromEntries(EXTRA_CLUE_KEYS.map((key) => [key, null]));
  const activeClues = {
    sesso: newCase.clues.sesso,
    lhon: newCase.clues.lhon,
    swyer: newCase.clues.swyer,
    tonoPelle: newCase.clues.tonoPelle,
    ...lockedExtras,
  };
  // Impostazione "autoRevealLetterAndGeneration": rivela subito "biglietto"
  // e "generazione", saltando il click su "Richiedi" per entrambi. Non
  // tocca la catena anagrafica: "Area ancestrale dominante" (livello 0)
  // resta comunque bloccata come sempre, dato che non dipende da questi due.
  if (settingsToApply?.autoRevealLetterAndGeneration) {
    activeClues.biglietto = newCase.clues.biglietto;
    activeClues.generazione = newCase.clues.generazione;
  }
  return { data: loadedData, kase: newCase, activeClues };
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // La generazione della partita usa Math.random() (direttamente e
  // indirettamente, tramite Simulation/createCase/assignNames): non può
  // girare durante il render, nemmeno dentro un inizializzatore di
  // useState — React lo vieta esplicitamente come funzione "impura". Va
  // fatto in un useEffect, che gira DOPO il render, non durante — al
  // prezzo di un breve istante (phase "setup") prima che la partita esista.
  const [data, setData] = useState(null);
  const [kase, setKase] = useState(null);
  const [activeClues, setActiveClues] = useState(null);

  useEffect(() => {
    const fresh = generateFreshGame(DEFAULT_SETTINGS);
    setData(fresh.data);
    setKase(fresh.kase);
    setActiveClues(fresh.activeClues);
  }, []);

  // Individuo la cui scheda anagrafica è aperta — sempre un'anteprima, non
  // ancora un'accusa. Separato da "pendingAccusationId": si può aprire la
  // scheda di un sospetto, chiuderla con "Chiudi" e non aver deciso nulla.
  const [detailId, setDetailId] = useState(null);
  // Se il sospetto cliccato risulta deceduto (vedi kase.vivo), la prima
  // cosa mostrata è la rivelazione scherzosa, non la scheda seria —
  // "showFullDetail" passa alla scheda vera se richiesto esplicitamente.
  const [showFullDetail, setShowFullDetail] = useState(false);
  const [pendingAccusationId, setPendingAccusationId] = useState(null);
  const [accusedId, setAccusedId] = useState(null);

  // Dopo un'accusa sbagliata MENTRE il caso è ancora ambiguo non si perde:
  // si torna a indagare, ma non si può accusare di nuovo finché non si
  // richiede un altro indizio. "wrongGuessMessage" resta visibile finché
  // non succede.
  const [accusationLocked, setAccusationLocked] = useState(false);
  const [wrongGuessMessage, setWrongGuessMessage] = useState(null);

  // "avvisoGenerazioneVisto" tiene traccia se il giocatore ha già notato la
  // rotta /generazione (per mostrare l'avviso e il pulsare del link una
  // volta sola) — diventa vero appena visita quella pagina almeno una
  // volta (vedi l'effetto in AppShell.jsx che osserva il pathname).
  const [avvisoGenerazioneVisto, setAvvisoGenerazioneVisto] = useState(false);
  // Modale con la panoramica completa delle linee sopravvissute — puramente
  // informativa, non ha nulla a che fare con gli indizi del caso.
  const [showLineageOverview, setShowLineageOverview] = useState(false);

  // Impostazioni globali, modificabili a runtime dal pannello segreto
  // (Ctrl+Alt+S, ascoltato in AppShell.jsx).
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const updateSetting = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));

  // Schede della pagina Generazione nascoste dal giocatore (bottone ✕):
  // vive QUI, non nella pagina, apposta per restare permanente quando si
  // naviga via e si torna su /generazione — se vivesse nello stato locale
  // della pagina, ogni volta che viene smontata (cambiando rotta) e
  // rimontata perderebbe tutto. Azzerato solo con una nuova partita.
  const [gruppiGenerazioneNascosti, setGruppiGenerazioneNascosti] = useState(() => new Set());
  const nascondiGruppoGenerazione = (chiave) => setGruppiGenerazioneNascosti((prev) => new Set(prev).add(chiave));

  const phase = accusedId !== null ? "result" : kase !== null ? "investigating" : "setup";

  const matchIds = useMemo(() => {
    if (!data || !activeClues) return [];
    // L'alibi (vedi assignAliveStatus in caseEngine.js) non si applica dal
    // primo istante: se lo facessimo, nel ~10% dei casi il gruppo
    // indistinguibile dall'assassino coinciderebbe già quasi per intero con
    // chi soddisfa i soli 4 obbligatori, e l'alibi risolverebbe il caso da
    // solo prima ancora che il giocatore richieda un indizio. Si attiva
    // silenziosamente SOLO dopo che è stato richiesto almeno un indizio
    // sbloccabile: da lì in poi resta sempre attivo.
    const almenoUnIndizioRichiesto = EXTRA_CLUE_KEYS.some(
      (key) => activeClues[key] !== null && activeClues[key] !== undefined,
    );
    return filterSuspects(data, activeClues, almenoUnIndizioRichiesto ? kase?.vivo : undefined);
  }, [data, activeClues, kase]);

  // Il pannello mostrato al giocatore: 1 "vero" (a caso tra matchIds) + 11
  // "rumore" — 9 dello stesso sesso dell'assassino, 2 di sesso opposto.
  // Ricalcolato in un useEffect, non in un useMemo: usa Math.random(), che
  // non può girare durante il render. Si ricalcola ogni volta che matchIds
  // cambia — cioè ogni volta che viene richiesto un indizio, mai altrimenti.
  const [displayedSuspects, setDisplayedSuspects] = useState([]);
  useEffect(() => {
    if (!data || matchIds.length === 0) {
      setDisplayedSuspects([]);
      return;
    }
    const veroId = matchIds[Math.floor(Math.random() * matchIds.length)];
    const sessoVero = data.individui[veroId][SCHEMA_INDEX.sesso];

    const stessoSesso = [];
    const sessoOpposto = [];
    for (let id = 0; id < data.individui.length; id += 1) {
      if (id === veroId) continue;
      if (data.individui[id][SCHEMA_INDEX.sesso] === sessoVero) stessoSesso.push(id);
      else sessoOpposto.push(id);
    }
    mescola(stessoSesso);
    mescola(sessoOpposto);

    const decoyStessoSesso = stessoSesso.slice(0, SUSPECTS_SHOWN - 3);
    const decoySessoOpposto = sessoOpposto.slice(0, 2);
    setDisplayedSuspects(mescola([veroId, ...decoyStessoSesso, ...decoySessoOpposto]));
  }, [data, matchIds]);

  // Filtro applicato SOPRA displayedSuspects, non dentro: quando la lettera
  // del biglietto (o la finestra di generazioni) è nota e la relativa
  // impostazione è attiva, nasconde dalla griglia principale chi non
  // corrisponde. Puramente un filtro (nessun Math.random), quindi va bene
  // dentro un useMemo.
  const sospettiVisibili = useMemo(() => {
    let ids = displayedSuspects;
    if (settings.hideSuspectsNotMatchingLetter && activeClues?.biglietto) {
      const lettera = activeClues.biglietto;
      ids = ids.filter((id) => (data?.nomi?.[id] || "").toLowerCase().includes(lettera));
    }
    if (settings.hideSuspectsOutsideGenerationWindow && activeClues?.generazione) {
      const { min, max } = activeClues.generazione;
      ids = ids.filter((id) => {
        const g = data.individui[id][SCHEMA_INDEX.generazione];
        return g >= min && g <= max;
      });
    }
    return ids;
  }, [displayedSuspects, settings, activeClues, data]);

  // Apre la scheda di un sospetto cliccato in griglia: azzera sempre
  // "showFullDetail" (altrimenti resterebbe "vero" da un clic precedente e
  // salterebbe la rivelazione scherzosa anche per un nuovo deceduto).
  const handleOpenDetail = (id) => {
    setDetailId(id);
    setShowFullDetail(false);
  };

  // Sblocca UN indizio indipendente (vedi STANDALONE_CLUE_KEYS in
  // caseEngine.js). Richiedere un indizio sblocca sempre di nuovo la
  // possibilità di accusare, se era stata bloccata da un tentativo
  // sbagliato precedente.
  const handleRevealClue = (key) => {
    setActiveClues((prev) => ({ ...prev, [key]: kase.clues[key] }));
    setAccusationLocked(false);
    setWrongGuessMessage(null);
  };

  // Sblocca TUTTE le posizioni di un livello della catena anagrafica in un
  // solo colpo (vedi ANCESTRY_LEVELS in caseEngine.js).
  const handleRevealLevel = (level) => {
    setActiveClues((prev) => {
      const next = { ...prev };
      level.positions.forEach((key) => {
        next[key] = kase.clues[key];
      });
      return next;
    });
    setAccusationLocked(false);
    setWrongGuessMessage(null);
  };

  // Avviato dal pulsante "Accusa questo sospettato" dentro la scheda
  // anagrafica. La barra di conferma si vede SOLO quando sbagliare
  // costerebbe davvero la partita (un solo sospetto compatibile); finché il
  // caso è ancora ambiguo, un'accusa sbagliata non ha conseguenze, quindi
  // si risolve subito senza chiedere conferma.
  const handleStartAccusation = (id) => {
    setDetailId(null);
    setShowFullDetail(false);
    if (matchIds.length === 1) {
      setPendingAccusationId(id);
      return;
    }
    handleResolveAccusation(id);
  };

  // 3 esiti possibili:
  // 1. Corretta -> vittoria, sempre.
  // 2. Sbagliata MA il caso è già del tutto determinato (un solo sospetto
  //    compatibile) -> sconfitta vera.
  // 3. Sbagliata mentre il caso è ancora ambiguo -> nessuna sconfitta,
  //    messaggio diverso a seconda che l'accusato fosse comunque plausibile
  //    o puro "rumore". Si blocca una nuova accusa finché non si richiede
  //    un altro indizio.
  const handleResolveAccusation = (id) => {
    if (id === kase.assassinoId) {
      setAccusedId(id);
      return;
    }
    if (matchIds.length === 1) {
      setAccusedId(id);
      return;
    }
    const eraPlausibile = matchIds.includes(id);
    const nome = nomeSospetto(id);
    setWrongGuessMessage(
      eraPlausibile
        ? `Bravo, hai fiuto, ma ${nome} non è la persona giusta. Richiedi un nuovo indizio.`
        : `No, ${nome} non è la persona giusta: Richiedi un nuovo indizio.`,
    );
    setAccusationLocked(true);
    setPendingAccusationId(null);
    setDetailId(null);
  };

  const handleConfirmAccusation = () => {
    handleResolveAccusation(pendingAccusationId);
  };

  const handleNewCase = () => {
    const fresh = generateFreshGame(settings);
    setData(fresh.data);
    setKase(fresh.kase);
    setActiveClues(fresh.activeClues);
    setDetailId(null);
    setShowFullDetail(false);
    setPendingAccusationId(null);
    setAccusedId(null);
    setAccusationLocked(false);
    setWrongGuessMessage(null);
    setAvvisoGenerazioneVisto(false);
    setGruppiGenerazioneNascosti(new Set());
  };

  const nomeSospetto = (id) => (data?.nomi && data.nomi[id]) || `il sospettato #${id}`;
  const generazioneNota = activeClues?.generazione !== null && activeClues?.generazione !== undefined;

  const value = {
    data,
    kase,
    activeClues,
    phase,
    matchIds,
    sospettiVisibili,
    detailId,
    showFullDetail,
    pendingAccusationId,
    accusedId,
    accusationLocked,
    wrongGuessMessage,
    avvisoGenerazioneVisto,
    setAvvisoGenerazioneVisto,
    showLineageOverview,
    setShowLineageOverview,
    settings,
    updateSetting,
    showSettings,
    setShowSettings,
    gruppiGenerazioneNascosti,
    nascondiGruppoGenerazione,
    generazioneNota,
    handleOpenDetail,
    handleRevealClue,
    handleRevealLevel,
    handleStartAccusation,
    handleResolveAccusation,
    handleConfirmAccusation,
    handleNewCase,
    setDetailId,
    setShowFullDetail,
    setPendingAccusationId,
    nomeSospetto,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppState deve essere usato dentro <AppProvider>");
  return ctx;
}
