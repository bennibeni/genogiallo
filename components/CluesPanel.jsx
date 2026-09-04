"use client";

import {
  ANCESTRY_LEVELS,
  CLUE_DEFINITIONS,
  DISEASE_LABELS,
  DISEASE_STATUS_LABELS,
  PRIMARY_STANDALONE_KEYS,
  STANDALONE_CLUE_KEYS,
} from "@/lib/caseEngine";

function isRevealed(activeClues, key) {
  return activeClues[key] !== null && activeClues[key] !== undefined;
}

// Un livello (genitori, nonni, ...) può trovarsi in 3 stati:
// - rivelato: se ha una sola posizione (il livello "sospetto") si mostra
//   come una card normale, esattamente come prima; se ne ha più di una
//   (genitori, nonni, bisnonni...) le raggruppa TUTTE in un'unica card, una
//   riga per posizione — invece di una card separata per ciascuna, che con
//   8 bisnonni renderebbe la griglia illeggibile.
// - richiedibile: il livello precedente è già rivelato E i sospetti
//   compatibili finora sono ancora più di uno -> mostra UN SOLO pulsante
//   "Richiedi" che sblocca tutte le posizioni del livello in un colpo.
// - non ancora raggiungibile: il livello precedente non è ancora rivelato,
//   oppure lo è ma ha già isolato un solo sospetto -> non si mostra nulla
//   (il livello semplicemente non esiste ancora nell'interfaccia).
function AncestryLevelCards({ level, previousLevelRevealed, activeClues, matchCount, onRevealLevel }) {
  const revealed = level.positions.every((key) => isRevealed(activeClues, key));

  if (revealed) {
    if (level.positions.length === 1) {
      const def = CLUE_DEFINITIONS[level.positions[0]];
      return (
        <div className="clue-card">
          <div className="clue-label">{def.label}</div>
          <div className="clue-value">{def.formatValue(activeClues[level.positions[0]])}</div>
        </div>
      );
    }
    return (
      <div className="clue-card ancestry-group-card">
        <div className="clue-label">{level.label}</div>
        <div className="ancestry-group-values">
          {level.positions.map((key) => {
            const def = CLUE_DEFINITIONS[key];
            return (
              <div className="ancestry-group-row" key={key}>
                <span className="ancestry-group-row-label">{def.shortLabel || def.label}</span>
                <span className="ancestry-group-row-value">{def.formatValue(activeClues[key])}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const richiedibile = previousLevelRevealed && matchCount > 1;
  if (!richiedibile) return null;

  return (
    <div className="clue-card locked">
      <div className="clue-label">{level.label}: non ancora richiesto</div>
      <button type="button" onClick={() => onRevealLevel(level)}>
        Richiedi
      </button>
    </div>
  );
}

// Card semplice, senza regole speciali: usata sia per "generazione" e
// "biglietto" (PRIMARY_STANDALONE_KEYS, indipendenti l'uno dall'altro da
// quando "biglietto" restituisce solo una lettera, non più il nome intero —
// vedi il commento su PRIMARY_STANDALONE_KEYS in caseEngine.js) sia,
// implicitamente, dagli altri indizi non gestiti da un componente dedicato.
function SimpleClueCard({ clueKey, activeClues, kase, onRevealClue }) {
  const def = CLUE_DEFINITIONS[clueKey];
  if (isRevealed(activeClues, clueKey)) {
    return (
      <div className="clue-card">
        <div className="clue-label">{def.label}</div>
        <div className="clue-value">{def.formatValue(kase.clues[clueKey])}</div>
        {def.hint && <div className="clue-hint">{def.hint}</div>}
      </div>
    );
  }
  return (
    <div className="clue-card locked">
      <div className="clue-locked-text">
        <div className="clue-label">{def.label}: non ancora richiesto</div>
        {def.hint && <div className="clue-hint">{def.hint}</div>}
      </div>
      <button type="button" onClick={() => onRevealClue(clueKey)}>
        Richiedi
      </button>
    </div>
  );
}

// Tutto ciò che resta di STANDALONE_CLUE_KEYS dopo aver tolto i 2 "primari"
// (generazione, biglietto): oggi sono esattamente i 3 indizi "Unione..."
// (genitori, nonni materni, nonni paterni) — l'unica categoria di indizi
// indipendenti con una regola speciale propria (sblocco tardivo, vedi
// sotto).
const UNIONE_CLUE_KEYS = STANDALONE_CLUE_KEYS.filter((key) => !PRIMARY_STANDALONE_KEYS.includes(key));

// Vero se esiste ALMENO un livello della catena anagrafica non ancora
// rivelato ma già richiedibile in questo momento (livello precedente
// rivelato E sospetti compatibili ancora più di uno) — usata per decidere
// se gli indizi "Unione..." devono restare bloccati (vedi sotto).
function isAnyLevelRequestable(activeClues, matchCount) {
  return ANCESTRY_LEVELS.some((level, index) => {
    const revealed = level.positions.every((key) => isRevealed(activeClues, key));
    if (revealed) return false;
    const previousLevelRevealed = index === 0 || ANCESTRY_LEVELS[index - 1].positions.every((k) => isRevealed(activeClues, k));
    return previousLevelRevealed && matchCount > 1;
  });
}

export default function CluesPanel({ kase, activeClues, matchCount, onRevealLevel, onRevealClue, showIndiziatiCount = true }) {
  const { sesso, lhon, swyer, tonoPelle } = kase.clues;

  // Gli indizi "Unione..." sono l'ultima risorsa: restano bloccati (nessun
  // pulsante, solo una nota) finché c'è ancora qualcos'altro di richiedibile
  // — un livello della catena anagrafica non ancora rivelato, oppure
  // generazione o biglietto non ancora richiesti. Una volta che non resta
  // altro da chiedere (o perché tutto è già stato rivelato, o perché i
  // sospetti sono già scesi a un solo compatibile), si sbloccano.
  const altroDisponibile =
    isAnyLevelRequestable(activeClues, matchCount) || PRIMARY_STANDALONE_KEYS.some((key) => !isRevealed(activeClues, key));

  return (
    <div className="panel">
      <div className="case-header">
        <h3>Referto del DNA trovato sulla scena</h3>
        {showIndiziatiCount && (
          <span className="suspect-count">
            Indiziati: <b>{matchCount}</b> / {kase.totalSuspects}
          </span>
        )}
      </div>
      {showIndiziatiCount && (
        <p className="case-header-note">Il colpevole è sempre tra gli indiziati — restringili fino a isolarlo.</p>
      )}

      <div className="clues-grid">
        <div className="clue-card">
          <div className="clue-label">Sesso</div>
          <div className="clue-value">{sesso === "F" ? "femminile (♀)" : "maschile (♂)"}</div>
        </div>

        <div className="clue-card">
          <div className="clue-label">Colorito (valutazione qualitativa)</div>
          <div className="clue-value">{tonoPelle.label}</div>
        </div>

        <div className="clue-card">
          <div className="clue-label">Malattia legata al cromosoma Y ({DISEASE_LABELS.swyer})</div>
          <div className="clue-value">{DISEASE_STATUS_LABELS[swyer.stato]}</div>
        </div>

        <div className="clue-card">
          <div className="clue-label">{DISEASE_LABELS.lhon}</div>
          <div className="clue-value">{DISEASE_STATUS_LABELS[lhon.stato]}</div>
        </div>

        {/* Ordine visivo richiesto: biglietto, generazione, poi la catena
            anagrafica nel suo ordine naturale (sospettato, genitori, nonni,
            bisnonni) — che stavolta coincide di nuovo con l'ordine logico
            reale di ANCESTRY_LEVELS in caseEngine.js, quindi il ciclo torna
            a poter essere semplice come in origine, senza bisogno di
            separare i livelli o ricalcolare "previousLevelRevealed" a
            mano. */}
        <SimpleClueCard clueKey="biglietto" activeClues={activeClues} kase={kase} onRevealClue={onRevealClue} />
        <SimpleClueCard clueKey="generazione" activeClues={activeClues} kase={kase} onRevealClue={onRevealClue} />

        {ANCESTRY_LEVELS.map((level, index) => (
          <AncestryLevelCards
            key={level.key}
            level={level}
            previousLevelRevealed={index === 0 || ANCESTRY_LEVELS[index - 1].positions.every((k) => isRevealed(activeClues, k))}
            activeClues={activeClues}
            matchCount={matchCount}
            onRevealLevel={onRevealLevel}
          />
        ))}

        {UNIONE_CLUE_KEYS.map((key) => {
          const def = CLUE_DEFINITIONS[key];
          if (isRevealed(activeClues, key)) {
            return (
              <div className="clue-card" key={key}>
                <div className="clue-label">{def.label}</div>
                <div className="clue-value">{def.formatValue(kase.clues[key])}</div>
                {def.hint && <div className="clue-hint">{def.hint}</div>}
              </div>
            );
          }
          if (altroDisponibile) {
            return (
              <div className="clue-card locked" key={key}>
                <div className="clue-label">{def.label}: non ancora disponibile</div>
                <div className="clue-hint">prima esaurisci gli altri indizi richiedibili</div>
              </div>
            );
          }
          return (
            <div className="clue-card locked" key={key}>
              <div className="clue-locked-text">
                <div className="clue-label">{def.label}: non ancora richiesto</div>
                {def.hint && <div className="clue-hint">{def.hint}</div>}
              </div>
              <button type="button" onClick={() => onRevealClue(key)}>
                Richiedi
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
