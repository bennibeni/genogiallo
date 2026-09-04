"use client";

import Avatar from "./Avatar";
import { proportionsObject, SCHEMA_INDEX } from "@/lib/caseEngine";

// Renderizza qualunque insieme di id gli venga passato — non sa (e non deve
// sapere) se sono sospetti realmente compatibili con gli indizi o "rumore"
// scelto a caso: quella distinzione è una decisione di DetectiveGame.jsx
// (vedi il commento su "displayedSuspects" lì), non di questo componente.
// Non c'è più un tetto al numero di avatar mostrati (a differenza delle
// versioni precedenti): con il nuovo pannello a dimensione fissa (di norma
// 10) non serve più.
//
// Cliccare un avatar NON accusa direttamente: apre la sua scheda anagrafica
// (AncestryDetailModal, riusata da R18) come anteprima investigativa —
// esattamente come cliccare un nodo del pedigree in R18. È da lì, tramite
// il pulsante "Accusa questo sospetto" (quando disponibile — vedi
// DetectiveGame.jsx per quando viene nascosto dopo un'accusa sbagliata),
// che l'accusa viene avviata; la conferma finale resta un passaggio
// separato.
export default function SuspectBoard({
  data,
  suspectIds,
  pendingId,
  onOpenDetail,
  showTooltips = true,
  matchIds,
  highlightMatches = false,
  assassinoId,
}) {
  if (suspectIds.length === 0) {
    return <p className="board-empty">Nessun sospettato da mostrare.</p>;
  }

  return (
    <div className="suspect-board">
      {suspectIds.map((id) => {
        const record = data.individui[id];
        const nome = (data.nomi && data.nomi[id]) || `#${id}`;
        // 2 colori distinti (vedi settings.js): l'assassino ha un bordo suo,
        // diverso da quello di un indiziato qualunque — non un solo
        // "evidenziato sì/no" come prima.
        let classeEvidenza = "";
        if (highlightMatches && id === assassinoId) classeEvidenza = " assassino";
        else if (highlightMatches && matchIds && matchIds.includes(id)) classeEvidenza = " indiziato";
        return (
          <button
            key={id}
            type="button"
            className={`suspect-tile${id === pendingId ? " selected" : ""}${classeEvidenza}`}
            onClick={() => onOpenDetail(id)}
            title={showTooltips ? `${nome} — generazione ${record[SCHEMA_INDEX.generazione]}` : undefined}
          >
            <span className="avatar-ring">
              <Avatar
                proportions={proportionsObject(record, data.aree)}
                aree={data.aree}
                toniPelle={data.toniPelle}
                sesso={record[SCHEMA_INDEX.sesso]}
                lhonCarrier={record[SCHEMA_INDEX.linea_materna_lhon]}
                srySwyerCondition={record[SCHEMA_INDEX.sindrome_swyer]}
                size={56}
              />
            </span>
            <span className="suspect-id">{nome}</span>
          </button>
        );
      })}
    </div>
  );
}
