"use client";

import Avatar from "./Avatar";
import { proportionsObject, SCHEMA_INDEX as IDX } from "@/lib/caseEngine";

// Raggruppa la popolazione ATTUALE (l'ultima generazione, non l'intero
// registro storico) per linea di appartenenza — esattamente lo stesso
// criterio di countSurvivingLineages/countSurvivingPatrilineages in
// simulationEngine.js (femmine per la linea materna, maschi non-Swyer per
// quella paterna), ma qui si vuole anche SAPERE chi sono i membri di
// ciascuna linea, non solo quante ce ne sono.
function raggruppaPerLinea(individui, ultimaGenerazione, campoLinea, filtroSesso) {
  const gruppi = new Map();
  individui.forEach((record, id) => {
    if (record[IDX.generazione] !== ultimaGenerazione) return;
    if (!filtroSesso(record)) return;
    const lineaId = record[campoLinea];
    if (lineaId === null) return;
    if (!gruppi.has(lineaId)) gruppi.set(lineaId, []);
    gruppi.get(lineaId).push(id);
  });
  return gruppi;
}

function LineageGroup({ label, membri, data, onOpenDetail }) {
  const nome = (id) => (data.nomi && data.nomi[id]) || `#${id}`;
  return (
    <div className="generation-group">
      <div className="generation-group-header">{label}</div>
      <div className="generation-group-children">
        {membri.map((id) => {
          const record = data.individui[id];
          return (
            <button
              key={id}
              type="button"
              className="suspect-tile generation-tile"
              onClick={() => onOpenDetail(id)}
              title={nome(id)}
            >
              <span className="avatar-ring">
                <Avatar
                  proportions={proportionsObject(record, data.aree)}
                  aree={data.aree}
                  toniPelle={data.toniPelle}
                  sesso={record[IDX.sesso]}
                  lhonCarrier={record[IDX.linea_materna_lhon]}
                  srySwyerCondition={record[IDX.sindrome_swyer]}
                  size={44}
                />
              </span>
              <span className="suspect-id">{nome(id)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Non è un albero genealogico disegnato (nodi/archi tra generazioni): quello
// richiederebbe un componente di disegno a sé, che R20 non ha (deliberato,
// vedi la discussione sul rinviare la vista completa dell'albero). Questa è
// una fotografia più semplice ma comunque "completa" nel senso richiesto:
// non solo il numero di linee sopravvissute, ma CHI le compone oggi, per
// ciascuna linea separatamente — più qualche numero di paragone per capire
// se quei conteggi siano "tanti" o "pochi" rispetto al punto di partenza.
export default function LineageOverviewModal({ data, onOpenDetail, onClose }) {
  const ultimaGenerazione = Math.max(...data.individui.map((r) => r[IDX.generazione]));
  const nome = (id) => (data.nomi && data.nomi[id]) || `#${id}`;

  const lineeMaterne = raggruppaPerLinea(
    data.individui,
    ultimaGenerazione,
    IDX.linea_materna_id,
    (record) => record[IDX.sesso] === "F",
  );
  const lineePaterne = raggruppaPerLinea(
    data.individui,
    ultimaGenerazione,
    IDX.linea_paterna_id,
    (record) => record[IDX.sesso] === "M" && record[IDX.sindrome_swyer] !== true,
  );

  // Caso a parte, non raggruppabile per linea paterna (non possono
  // trasmetterla, ma la portano comunque: linea_paterna_id resta valorizzato
  // per loro, ereditato normalmente dal padre — è solo che si interrompe
  // CON loro, non prima). Non hanno nemmeno una linea materna da mostrare
  // nella sezione sopra, dato che quella è filtrata sulle sole femmine.
  const maschiSwyer = [];
  data.individui.forEach((record, id) => {
    if (record[IDX.generazione] === ultimaGenerazione && record[IDX.sesso] === "M" && record[IDX.sindrome_swyer] === true) {
      maschiSwyer.push(id);
    }
  });

  // "Massimo ottenibile se tutto fosse andato bene" = il numero di linee al
  // momento della fondazione, cioè quanti fondatori di ciascun sesso
  // c'erano in generazione 0 (ognuno origine della propria linea per
  // definizione — vedi il commento su "linea_materna_id" in
  // simulationEngine.js), usato nei sottotitoli qui sotto ("N sopravvissute
  // su M possibili").
  let fondatriciFemmine = 0;
  let fondatoriMaschi = 0;
  data.individui.forEach((record) => {
    if (record[IDX.generazione] !== 0) return;
    if (record[IDX.sesso] === "F") fondatriciFemmine += 1;
    else fondatoriMaschi += 1;
  });

  return (
    <div className="lineage-overlay" onClick={onClose}>
      <div className="lineage-modal" onClick={(e) => e.stopPropagation()}>
        <button className="lineage-close" onClick={onClose} aria-label="Chiudi">✕</button>
        <h3>Chi discende ancora oggi da quali antenati</h3>
        <p className="generation-legend">
          Ogni linea materna discende, per sole figlie femmine, da un'unica antenata; ogni linea paterna discende,
          per soli figli maschi non affetti da sindrome di Swyer, da un unico antenato. Con abbastanza generazioni,
          il numero di linee può solo calare o restare uguale, mai risalire — finché non ne resta, con probabilità
          1, una sola per ciascun tipo: lo stesso fenomeno per cui il mtDNA e il cromosoma Y umani reali tracciano
          rispettivamente a un'unica "Eva mitocondriale" e un unico "Adamo cromosomico-Y".
        </p>

        <h4>
          Linee materne ({lineeMaterne.size} sopravvissute su {fondatriciFemmine} possibili)
        </h4>
        <div className="generation-groups">
          {Array.from(lineeMaterne.entries()).map(([lineaId, membri]) => (
            <LineageGroup key={`m-${lineaId}`} label={`Linea di ${nome(lineaId)}`} membri={membri} data={data} onOpenDetail={onOpenDetail} />
          ))}
        </div>

        <h4>
          Linee paterne ({lineePaterne.size} sopravvissute su {fondatoriMaschi} possibili)
        </h4>
        <div className="generation-groups">
          {Array.from(lineePaterne.entries()).map(([lineaId, membri]) => (
            <LineageGroup key={`p-${lineaId}`} label={`Linea di ${nome(lineaId)}`} membri={membri} data={data} onOpenDetail={onOpenDetail} />
          ))}
        </div>

        {maschiSwyer.length > 0 && (
          <>
            <h4>Caso a parte: sindrome di Swyer ({maschiSwyer.length})</h4>
            <p className="generation-legend">
              Portano comunque una linea paterna (ereditata normalmente dal padre), ma non possono trasmetterla:
              con loro, quella specifica diramazione si interrompe.
            </p>
            <div className="generation-groups">
              <LineageGroup label="Si interrompe con loro" membri={maschiSwyer} data={data} onOpenDetail={onOpenDetail} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
