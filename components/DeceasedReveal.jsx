"use client";

import { useEffect, useState } from "react";

// Frasi scelte a caso, con la giusta concordanza di genere (deceduto/a,
// certo/a) — non è un dettaglio da poco: senza, metà delle rivelazioni
// suonerebbe sgrammaticata.
function epitaffiPer(sesso) {
  const agg = sesso === "F" ? "deceduta" : "deceduto";
  return [
    (nome) => `Alibi di ferro: ${nome} è ${agg} da tempo. Nessun sospettato, qui.`,
    (nome) => `Qui giace ${nome}. Di sicuro non ha commesso il delitto: aveva altro da fare.`,
    (nome) => `${nome} riposa in pace, ben lontano dalla scena del crimine.`,
    (nome) => `Caso chiuso per ${nome} — ma non quello che stai cercando.`,
    (nome) => `Di certo ${nome} non c'entra: da queste parti, la morte è un alibi perfetto.`,
  ];
}

// Overlay scherzoso mostrato al posto della scheda anagrafica seria quando
// il sospetto cliccato risulta deceduto (vedi kase.vivo in caseEngine.js —
// sia per il ripiego naturale legato all'età, sia per l'alibi forzato che
// garantisce la determinabilità univoca del caso). Non nasconde
// l'informazione seria: "Vedi comunque la scheda" apre la normale
// AncestryDetailModal sullo stesso individuo, per chi la vuole davvero.
export default function DeceasedReveal({ nome, sesso, onClose, onShowFull }) {
  // La scelta a caso usa Math.random(): non può girare durante il render
  // (nemmeno dentro un useMemo, che conta come "durante il render" agli
  // occhi di React), quindi va in un useEffect, con un valore iniziale
  // vuoto finché non gira la prima volta — un istante impercettibile, non
  // il lampo di un intero pannello come nel caso della partita.
  const [epitaffio, setEpitaffio] = useState("");
  useEffect(() => {
    const frasi = epitaffiPer(sesso);
    setEpitaffio(frasi[Math.floor(Math.random() * frasi.length)](nome));
  }, [nome, sesso]);

  return (
    <div className="deceased-overlay" onClick={onClose}>
      <div className="deceased-card" onClick={(e) => e.stopPropagation()}>
        <button className="deceased-close" onClick={onClose} aria-label="Chiudi">✕</button>
        <div className="deceased-tombstone" aria-hidden="true">🪦</div>
        <p className="deceased-epitaph">{epitaffio}</p>
        <div className="deceased-actions">
          <button type="button" className="deceased-secondary" onClick={onClose}>
            Chiudi
          </button>
          <button type="button" className="deceased-primary" onClick={onShowFull}>
            Vedi comunque la scheda
          </button>
        </div>
      </div>
    </div>
  );
}
