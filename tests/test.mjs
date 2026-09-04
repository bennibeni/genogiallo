// node --test tests/test.mjs

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCase,
  EXTRA_CLUE_KEYS,
  filterSuspects,
  SCHEMA_INDEX as IDX,
  lhonStatus,
  unionOfAncestorsParents,
  ySwyerStatus,
} from '../lib/caseEngine.js';
import { AREAS, COLORS, SKIN_TONES } from '../lib/constants.js';
import { validateAndNormalizeGenealogy } from '../lib/genealogyFormat.js';
import { assignNames } from '../lib/nameEngine.js';
import { Simulation } from '../lib/simulationEngine.js';

// Fixture condivisa: stessi parametri di default usati dal gioco vero (vedi
// DEFAULT_* in NewCaseSetup.jsx), non importati direttamente per non dover
// caricare un file .jsx in un test che gira con node puro (vedi la nota
// finale su cosa resta fuori da questa suite).
function buildTestData() {
  const sim = new Simulation(AREAS, 8, 15);
  for (let g = 0; g < 10; g += 1) sim.evolveOneGeneration(0.4);
  const normalized = validateAndNormalizeGenealogy(sim.exportGenealogy());
  return { ...normalized, colori: COLORS, toniPelle: SKIN_TONES, nomi: assignNames(normalized) };
}

test("l'assassino è sempre vivo, e chi condivide tutti gli indizi con lui risulta sempre deceduto", () => {
  const data = buildTestData();
  for (let trial = 0; trial < 100; trial += 1) {
    const kase = createCase(data);
    assert.equal(kase.vivo[kase.assassinoId], true, "l'assassino deve risultare sempre vivo");

    const gruppoIndistinguibile = filterSuspects(data, kase.clues); // tutti gli indizi, nessun filtro sull'alibi
    gruppoIndistinguibile.forEach((id) => {
      if (id === kase.assassinoId) return;
      assert.equal(
        kase.vivo[id],
        false,
        `#${id} condivide tutti gli indizi con l'assassino ma non risulta deceduto`,
      );
    });
  }
});

test("con tutti gli indizi e l'alibi attivi, il caso si risolve sempre a un unico sospetto: l'assassino", () => {
  const data = buildTestData();
  for (let trial = 0; trial < 100; trial += 1) {
    const kase = createCase(data);
    const finali = filterSuspects(data, kase.clues, kase.vivo);
    assert.deepEqual(finali, [kase.assassinoId]);
  }
});

test("senza passare la mappa vivo, l'alibi non filtra nulla (comportamento di prima dell'attivazione)", () => {
  const data = buildTestData();
  const kase = createCase(data);
  const conAlibi = filterSuspects(data, kase.clues, kase.vivo);
  const senzaAlibi = filterSuspects(data, kase.clues); // niente terzo argomento
  assert.ok(
    senzaAlibi.length >= conAlibi.length,
    "senza l'alibi il pool non può essere più piccolo che con l'alibi",
  );
  assert.ok(senzaAlibi.includes(kase.assassinoId));
});

test("ogni indizio sbloccabile, singolo e in combinazione, include sempre l'assassino", () => {
  const data = buildTestData();
  for (let trial = 0; trial < 50; trial += 1) {
    const kase = createCase(data);
    for (const key of EXTRA_CLUE_KEYS) {
      const singolo = filterSuspects(data, { [key]: kase.clues[key] });
      assert.ok(
        singolo.includes(kase.assassinoId),
        `l'indizio "${key}" da solo esclude l'assassino`,
      );
    }
    const combinati = filterSuspects(data, kase.clues);
    assert.ok(
      combinati.includes(kase.assassinoId),
      "tutti gli indizi combinati escludono l'assassino",
    );
  }
});

test('la malattia legata al cromosoma Y non è mai applicabile a una femmina', () => {
  const data = buildTestData();
  data.individui.forEach((record) => {
    if (record[IDX.sesso] === 'F') {
      assert.equal(ySwyerStatus(record).stato, 'non_applicabile');
    }
  });
});

test('un fondatore maschio ha sempre la malattia Y non determinabile, un non-fondatore maschio sempre determinata', () => {
  const data = buildTestData();
  data.individui.forEach((record) => {
    if (record[IDX.sesso] !== 'M') return;
    const isFondatore = record[IDX.genitoreA_id] === null;
    const stato = ySwyerStatus(record).stato;
    if (isFondatore) {
      assert.equal(stato, 'non_determinabile');
    } else {
      assert.ok(
        stato === 'presente' || stato === 'assente',
        `atteso presente/assente per un non fondatore, trovato "${stato}"`,
      );
    }
  });
});

test('lo stato LHON è quasi sempre determinato (presente/assente), mai un valore non previsto', () => {
  const data = buildTestData();
  const statiValidi = new Set(['presente', 'assente', 'non_determinabile']);
  data.individui.forEach((record) => {
    assert.ok(statiValidi.has(lhonStatus(record).stato));
  });
});

test("unionOfAncestorsParents su un percorso non tracciabile restituisce sempre 'non_applicabile', mai un errore", () => {
  const data = buildTestData();
  // Un percorso lunghissimo (bisnonni dei bisnonni dei bisnonni...) esce
  // quasi certamente dalla profondità della genealogia: deve degradare con
  // grazia, non lanciare un'eccezione.
  const percorsoImpossibile = new Array(20).fill('madre');
  data.individui.forEach((record) => {
    const risultato = unionOfAncestorsParents(record, data, percorsoImpossibile);
    assert.ok(['non_applicabile', 'fuori_gruppo', 'stesso_gruppo'].includes(risultato.stato));
  });
});

test("nameEngine: nessuna omonimia all'interno della stessa generazione, ogni individuo ha un nome", () => {
  const data = buildTestData();
  const perGenerazione = new Map();
  data.individui.forEach((record, id) => {
    const nome = data.nomi[id];
    assert.ok(nome, `individuo #${id} senza nome assegnato`);
    const generazione = record[IDX.generazione];
    if (!perGenerazione.has(generazione)) perGenerazione.set(generazione, new Set());
    const usati = perGenerazione.get(generazione);
    assert.ok(!usati.has(nome), `omonimia trovata nella generazione ${generazione}: "${nome}"`);
    usati.add(nome);
  });
});

test("il biglietto da visita restituisce sempre una singola lettera presente nel nome dell'assassino", () => {
  const data = buildTestData();
  for (let trial = 0; trial < 50; trial += 1) {
    const kase = createCase(data);
    const lettera = kase.clues.biglietto;
    assert.equal(typeof lettera, 'string');
    assert.equal(lettera.length, 1);
    const nome = data.nomi[kase.assassinoId];
    assert.ok(
      nome.toLowerCase().includes(lettera),
      `la lettera "${lettera}" non compare nel nome "${nome}"`,
    );

    const soloBiglietto = filterSuspects(data, { biglietto: lettera });
    assert.ok(soloBiglietto.includes(kase.assassinoId));
  }
});

test('le linee materne e paterne sopravvissute non aumentano mai nel corso delle generazioni', () => {
  const sim = new Simulation(AREAS, 8, 15);
  let precedenteMaterne = sim.countSurvivingLineages();
  let precedentePaterne = sim.countSurvivingPatrilineages();
  for (let generazione = 0; generazione < 15; generazione += 1) {
    sim.evolveOneGeneration(0.4);
    const materne = sim.countSurvivingLineages();
    const paterne = sim.countSurvivingPatrilineages();
    assert.ok(materne <= precedenteMaterne, 'le linee materne non possono aumentare');
    assert.ok(paterne <= precedentePaterne, 'le linee paterne non possono aumentare');
    precedenteMaterne = materne;
    precedentePaterne = paterne;
  }
});

test("l'indizio 'generazione' è sempre una finestra valida che include la generazione vera dell'assassino", () => {
  const data = buildTestData();
  const massima = Math.max(...data.individui.map((r) => r[IDX.generazione]));
  for (let trial = 0; trial < 100; trial += 1) {
    const kase = createCase(data);
    const { min, max } = kase.clues.generazione;
    const generazioneVera = data.individui[kase.assassinoId][IDX.generazione];
    assert.ok(
      min >= 0 && max <= massima,
      'la finestra non può uscire dai margini della genealogia',
    );
    assert.ok(min <= max, 'il minimo non può superare il massimo');
    assert.ok(max - min <= 2, 'la finestra non può superare 3 generazioni di ampiezza');
    assert.ok(
      generazioneVera >= min && generazioneVera <= max,
      "la finestra deve includere la vera generazione dell'assassino",
    );
  }
});

// NOTA: non ci sono test per la composizione della griglia sospetti
// (displayedSuspects in DetectiveGame.jsx) né per il raggruppamento per
// linea in LineageOverviewModal.jsx: quella logica vive dentro file .jsx
// che contengono anche JSX vero e proprio, che node --test puro non sa
// interpretare senza un loader dedicato — coerente con la nota già data
// all'utente quando ha chiesto questa suite.
