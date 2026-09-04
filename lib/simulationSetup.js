import { AREAS, COLORS, SKIN_TONES } from "./constants";
import { Simulation } from "./simulationEngine";
import { validateAndNormalizeGenealogy } from "./genealogyFormat";

// Parametri di default pensati per una partita giocabile: una popolazione
// totale (24 * 11 generazioni ≈ 260 individui mai esistiti) abbastanza
// grande da rendere il caso interessante, ma non così grande da rendere
// la griglia dei sospetti ingestibile prima di aver attivato qualche
// indizio.
//
// Il tasso di migrazione (0.4) è stato scelto specificamente per l'indizio
// "unione dei genitori": con l'accoppiamento fortemente assortativo tipico
// di una migrazione bassa, la stragrande maggioranza delle unioni resta
// nello stesso gruppo ancestrale, rendendo quell'indizio quasi sempre
// debole (l'assassino ha quasi sempre il valore comune, che filtra
// pochissimo). Misurato empiricamente su più simulazioni: a 0.15 restano in
// media il 79% dei sospetti dopo quell'unico indizio, a 0.4 il 68% — un
// miglioramento concreto, senza indebolire gli altri indizi né gonfiare
// troppo il pool di partenza.
export const DEFAULT_POP_PER_AREA = 8;
export const DEFAULT_NUM_MARKERS = 15;
export const DEFAULT_GENERATIONS = 10;
export const DEFAULT_MIGRATION_RATE = 0.4;

export function buildFromFreshSimulation({ popPerArea, numMarkers, generations, migrationRate }) {
  const sim = new Simulation(AREAS, popPerArea, numMarkers);
  for (let g = 0; g < generations; g += 1) sim.evolveOneGeneration(migrationRate);
  // Catturati QUI, mentre l'istanza di Simulation esiste ancora:
  // exportGenealogy() restituisce solo un JSON semplice, senza più i metodi
  // della classe — dopo questo punto countSurvivingLineages/
  // countSurvivingPatrilineages non sarebbero più richiamabili. Puro dato
  // di contesto narrativo mostrato a inizio partita (vedi
  // LineageOverviewModal.jsx), non un indizio sull'assassino.
  const lineeMaterneSuperstiti = sim.countSurvivingLineages();
  const lineePaterneSuperstiti = sim.countSurvivingPatrilineages();
  const normalized = validateAndNormalizeGenealogy(sim.exportGenealogy());
  return { ...normalized, colori: COLORS, toniPelle: SKIN_TONES, lineeMaterneSuperstiti, lineePaterneSuperstiti };
}

// "colori" e "toni_pelle" non fanno parte del formato canonico validato da
// genealogyFormat.js — un file importato potrebbe non averli. In quel caso
// si ripiega sui valori di riferimento standard di questo stesso progetto,
// ma SOLO se coprono le stesse aree presenti nel file: altrimenti l'indizio
// sul tono di pelle (obbligatorio) non sarebbe calcolabile in modo
// affidabile, quindi si rifiuta il file invece di inventare una tonalità.
// Usata solo da components/NewCaseSetup.jsx (l'importazione da file resta
// conservata ma non collegata all'interfaccia, vedi lì).
export function resolvePaletteOrThrow(normalized) {
  const colori = normalized.colori && typeof normalized.colori === "object" ? normalized.colori : COLORS;
  const toniPelle = normalized.toni_pelle && typeof normalized.toni_pelle === "object" ? normalized.toni_pelle : SKIN_TONES;
  const areeSenzaTono = normalized.aree.filter((area) => !toniPelle[area]);
  if (areeSenzaTono.length > 0) {
    throw new Error(
      `il file non fornisce un tono di pelle di riferimento per: ${areeSenzaTono.join(", ")} — l'indizio sul colorito non sarebbe affidabile. Genera invece una nuova simulazione.`,
    );
  }
  return { colori, toniPelle };
}
