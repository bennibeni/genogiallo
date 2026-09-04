"use client";

import { useState } from "react";
import AncestryDetailModal from "./AncestryDetailModal";

export default function CaseResult({ data, kase, accusedId, onNewCase }) {
  const [showDetail, setShowDetail] = useState(false);
  const won = accusedId === kase.assassinoId;
  const nomeAccusato = (data.nomi && data.nomi[accusedId]) || `il sospettato #${accusedId}`;
  const nomeColpevole = (data.nomi && data.nomi[kase.assassinoId]) || `il sospettato #${kase.assassinoId}`;

  return (
    <div className="panel">
      <div className={`result-banner ${won ? "win" : "lose"}`}>
        <div className="result-title">
          {won ? "Caso risolto." : "Accusa sbagliata."}
        </div>
        <div className="result-subtitle">
          {won
            ? `${nomeAccusato} era davvero il colpevole.`
            : `${nomeAccusato} era innocente. Il colpevole era ${nomeColpevole}.`}
        </div>
      </div>

      <div className="result-actions">
        <button type="button" className="secondary-button" onClick={() => setShowDetail(true)}>
          Apri la scheda del colpevole
        </button>
        <button type="button" className="primary-button" onClick={onNewCase}>
          Nuova indagine
        </button>
      </div>

      {showDetail && (
        <AncestryDetailModal
          individui={data.individui}
          aree={data.aree}
          colori={data.colori}
          marcatoriTotali={data.marcatori_totali}
          toniPelle={data.toniPelle}
          initialId={kase.assassinoId}
          onClose={() => setShowDetail(false)}
          nomi={data.nomi}
        />
      )}
    </div>
  );
}
