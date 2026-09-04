// ---------- NOMI (elemento visivo, e base del "biglietto da visita") ----------
// Nessuna dipendenza da R17/R18: puramente un livello estetico/narrativo
// sopra la genealogia già normalizzata. Non fa parte del formato canonico
// (genealogyFormat.js) — è generato qui, sempre, sia per una simulazione
// fresca sia per un file importato, perché non è un fatto scientifico del
// modello ma pura ambientazione (come i toni di pelle in R17/constants.js).
import { SCHEMA_INDEX as IDX } from "./caseEngine.js";

// Pool abbondante rispetto alle dimensioni tipiche di una generazione (anche
// con la popolazione massima configurabile in NewCaseSetup, ~45 individui
// per sesso in una generazione): lascia margine prima di dover ricorrere al
// suffisso numerico di ripiego più sotto.
const NOMI_MASCHILI = [
  "Marco", "Luca", "Andrea", "Matteo", "Davide", "Simone", "Alessio", "Fabio",
  "Riccardo", "Stefano", "Paolo", "Giacomo", "Federico", "Emanuele", "Tommaso",
  "Nicola", "Enrico", "Gabriele", "Lorenzo", "Michele", "Antonio", "Roberto",
  "Giovanni", "Pietro", "Vincenzo", "Salvatore", "Angelo", "Franco", "Carlo",
  "Giuseppe", "Mauro", "Renato", "Sergio", "Bruno", "Aldo", "Dario", "Ivan",
  "Massimo", "Claudio", "Ettore",
];
const NOMI_FEMMINILI = [
  "Giulia", "Sara", "Chiara", "Elena", "Francesca", "Alice", "Martina", "Sofia",
  "Valentina", "Laura", "Silvia", "Anna", "Elisa", "Federica", "Ilaria",
  "Camilla", "Beatrice", "Giorgia", "Serena", "Roberta", "Paola", "Cristina",
  "Barbara", "Simona", "Lucia", "Rosa", "Carla", "Franca", "Marta", "Irene",
  "Vittoria", "Noemi", "Alessia", "Greta", "Eleonora", "Aurora", "Rebecca",
  "Ambra", "Ginevra", "Livia",
];

// Assegna un nome a ogni individuo, univoco all'interno della STESSA
// generazione (mai tra generazioni diverse: un nipote può chiamarsi come il
// nonno, è normale). Ogni generazione riparte da un pool "pieno" (pesca
// senza reinserimento all'interno della generazione, poi resetta per la
// successiva) — così anche il fondatore #3 e il discendente #200 possono
// benissimo chiamarsi entrambi "Marco" senza che sia un problema: non sono
// mai confondibili tra loro (la generazione stessa li distingue), lo sono
// solo con eventuali altri "Marco" della LORO generazione, cosa che qui non
// può succedere.
export function assignNames(data) {
  const { individui } = data;
  const perGenerazione = new Map(); // generazione -> { M: [...ids], F: [...ids] }

  individui.forEach((record, id) => {
    const generazione = record[IDX.generazione];
    const sesso = record[IDX.sesso];
    if (!perGenerazione.has(generazione)) perGenerazione.set(generazione, { M: [], F: [] });
    perGenerazione.get(generazione)[sesso].push(id);
  });

  const nomi = {};
  perGenerazione.forEach(({ M, F }) => {
    assegnaSenzaRipetizioni(M, NOMI_MASCHILI, nomi);
    assegnaSenzaRipetizioni(F, NOMI_FEMMINILI, nomi);
  });

  return nomi;
}

function assegnaSenzaRipetizioni(ids, poolOriginale, nomi) {
  const pool = mescola([...poolOriginale]);
  ids.forEach((id, i) => {
    if (i < pool.length) {
      nomi[id] = pool[i];
    } else {
      // Ripiego, solo se una singola generazione supera la dimensione del
      // pool (non capita con le dimensioni di popolazione previste
      // dall'interfaccia, ma non deve mai rompersi anche se capitasse):
      // riusa il pool con un numero romano progressivo, restando comunque
      // univoco all'interno della generazione.
      const giro = Math.floor(i / pool.length) + 1;
      nomi[id] = `${pool[i % pool.length]} ${toRomano(giro)}`;
    }
  });
}

function mescola(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function toRomano(n) {
  const cifre = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return cifre[n - 1] || String(n);
}
