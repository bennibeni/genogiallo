"use client";

// NOTA: dalla richiesta "salta il pannello iniziale, vai dritto al gioco",
// questo componente non viene più renderizzato di default — lib/store.jsx
// genera un caso in automatico all'avvio usando esattamente le stesse
// funzioni (buildFromFreshSimulation) con i parametri DEFAULT_* di
// lib/simulationSetup.js. Il file resta intatto e pronto per essere
// ricollegato in futuro come opzione "nuova partita personalizzata" —
// nulla qui è stato eliminato, solo non più montato per la partita rapida.
import { useState } from "react";
import { validateAndNormalizeGenealogy } from "@/lib/genealogyFormat";
import { assignNames } from "@/lib/nameEngine";
import {
  buildFromFreshSimulation,
  DEFAULT_GENERATIONS,
  DEFAULT_MIGRATION_RATE,
  DEFAULT_NUM_MARKERS,
  DEFAULT_POP_PER_AREA,
  resolvePaletteOrThrow,
} from "@/lib/simulationSetup";

export default function NewCaseSetup({ onCaseReady }) {
  const [popPerArea, setPopPerArea] = useState(DEFAULT_POP_PER_AREA);
  const [numMarkers, setNumMarkers] = useState(DEFAULT_NUM_MARKERS);
  const [generations, setGenerations] = useState(DEFAULT_GENERATIONS);
  const [migrationRate, setMigrationRate] = useState(DEFAULT_MIGRATION_RATE);

  const [importError, setImportError] = useState(null);
  const [importWarning, setImportWarning] = useState(null);
  const [isReadingFile, setIsReadingFile] = useState(false);

  const startFreshSimulation = () => {
    const data = buildFromFreshSimulation({ popPerArea, numMarkers, generations, migrationRate });
    onCaseReady({ ...data, nomi: assignNames(data), generazioniEvolute: generations });
  };

  const handleFileChange = (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = ""; // permette di reimportare lo stesso file due volte
    if (!file) return;

    setImportError(null);
    setImportWarning(null);
    setIsReadingFile(true);

    file
      .text()
      .then((text) => {
        const json = JSON.parse(text);
        const normalized = validateAndNormalizeGenealogy(json);
        const hadOwnPalette = Boolean(normalized.colori) && Boolean(normalized.toni_pelle);
        const { colori, toniPelle } = resolvePaletteOrThrow(normalized);
        if (!hadOwnPalette) {
          setImportWarning("il file non includeva colori/toni di pelle propri: uso i valori di riferimento standard.");
        }
        onCaseReady({ ...normalized, colori, toniPelle, nomi: assignNames(normalized) });
      })
      .catch((err) => {
        const message =
          err instanceof SyntaxError ? "il contenuto del file non è JSON valido" : err.message || "errore sconosciuto";
        setImportError(message);
      })
      .finally(() => setIsReadingFile(false));
  };

  return (
    <div className="panel">
      {/* "Importa file JSON" disabilitata su richiesta ("per ora non
          serve") — il codice sopra (handleFileChange, importError,
          importWarning, isReadingFile) resta intatto e pronto per essere
          riattivato: basta reintrodurre il blocco JSX corrispondente qui
          sotto, rimosso solo dal render, non dal file. */}
      <label className="field">
        Popolazione per area: <b>{popPerArea}</b>
        <input type="range" min="4" max="30" value={popPerArea} onChange={(e) => setPopPerArea(Number(e.target.value))} />
      </label>
      <label className="field">
        Marcatori genetici: <b>{numMarkers}</b>
        <input type="range" min="5" max="40" value={numMarkers} onChange={(e) => setNumMarkers(Number(e.target.value))} />
      </label>
      <label className="field">
        Generazioni da evolvere: <b>{generations}</b>
        <input type="range" min="2" max="30" value={generations} onChange={(e) => setGenerations(Number(e.target.value))} />
      </label>
      <label className="field">
        Tasso di migrazione: <b>{migrationRate.toFixed(2)}</b>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={migrationRate}
          onChange={(e) => setMigrationRate(Number(e.target.value))}
        />
      </label>
      <button type="button" className="primary-button" onClick={startFreshSimulation}>
        Avvia l'indagine
      </button>
    </div>
  );
}
