"use client";

import Avatar from "./Avatar";
import { proportionsObject, SCHEMA_INDEX as IDX } from "@/lib/caseEngine";

// Raggruppa gli individui di una generazione per genitori condivisi: chi ha
// GLI STESSI 2 genitori è fratello/sorella pieno/a, non serve altro per
// vederlo — è esattamente l'informazione che il valore grezzo di "Unione
// dei genitori" da solo non rende visibile (da qui la richiesta di
// aggiungere questa vista). I fondatori (nessun genitore) non hanno
// fratelli per definizione nel modello: ciascuno è il proprio gruppo.
// La chiave di raggruppamento (esposta come "chiave" nel risultato, usata
// sia come React key sia per tracciare quali card sono state nascoste) usa
// genitoreA/genitoreB (ordine indifferente, serve solo a riconoscere chi
// condivide la stessa coppia); padreId e madreId vengono letti
// separatamente da madre_id/padre_id — quelli sì con un ruolo preciso — per
// poter mostrare sempre "padre e madre" nello stesso ordine nell'intestazione.
function raggruppaPerGenitori(individui, ids, idx) {
  const gruppi = new Map();
  ids.forEach((id) => {
    const record = individui[id];
    const genitoreA = record[idx.genitoreA_id];
    const genitoreB = record[idx.genitoreB_id];
    const chiave = genitoreA === null ? `fondatore-${id}` : [genitoreA, genitoreB].sort((a, b) => a - b).join("-");
    if (!gruppi.has(chiave)) {
      gruppi.set(chiave, {
        chiave,
        genitoreA,
        padreId: genitoreA === null ? null : record[idx.padre_id],
        madreId: genitoreA === null ? null : record[idx.madre_id],
        figli: [],
      });
    }
    gruppi.get(chiave).figli.push(id);
  });
  return Array.from(gruppi.values());
}

function GenerationSection({
  generazione,
  ids,
  data,
  nascosti,
  onNascondi,
  onOpenDetail,
  showDismissButton,
  showTooltips,
  lettera,
  filterIndividualsByLetter,
  matchIds,
  highlightMatches,
  assassinoId,
}) {
  const gruppi = raggruppaPerGenitori(data.individui, ids, IDX);
  const nome = (id) => (data.nomi && data.nomi[id]) || `#${id}`;

  // Punto 5, versione corretta: non si nasconde mai l'INTERA scheda per un
  // mix di individui con/senza la lettera. Si filtrano i singoli membri
  // della scheda, tenendo solo chi ha la lettera nel nome — esattamente
  // come fa già la griglia sospettati principale (punto 4), solo applicato
  // dentro ogni scheda famiglia invece che su una lista piatta. Una scheda
  // sparisce da sola, come conseguenza naturale, solo se NESSUNO dei suoi
  // membri ha la lettera (quindi resterebbe con zero figli da mostrare) —
  // non per una regola a parte che nasconde l'intera scheda.
  const gruppiVisibili = gruppi
    .filter((gruppo) => !nascosti.has(gruppo.chiave))
    .map((gruppo) => {
      if (!filterIndividualsByLetter || !lettera) return gruppo;
      const figliConLettera = gruppo.figli.filter((id) => nome(id).toLowerCase().includes(lettera));
      return { ...gruppo, figli: figliConLettera };
    })
    .filter((gruppo) => gruppo.figli.length > 0);

  // Padre prima, madre poi — sempre in questo ordine. Nel rarissimo caso in
  // cui uno dei due ruoli non sia tracciabile (il ripiego per popolazioni
  // piccolissime descritto in simulationEngine.js), si mostra solo quello
  // disponibile invece di rompere la frase.
  const intestazioneGruppo = (gruppo) => {
    if (gruppo.genitoreA === null) return "Fondatore";
    const genitori = [gruppo.padreId, gruppo.madreId].filter((id) => id !== null).map(nome);
    return genitori.length > 0 ? `Figli di ${genitori.join(" e ")}` : "Figli di genitori non tracciabili";
  };

  if (ids.length === 0) return null;

  return (
    <>
      <h4>
        Generazione {generazione} ({ids.length})
      </h4>
      <div className="generation-groups">
        {gruppiVisibili.map((gruppo) => (
          <div className="generation-group" key={gruppo.chiave}>
            {showDismissButton && (
              <button
                type="button"
                className="generation-group-dismiss"
                onClick={() => onNascondi(gruppo.chiave)}
                aria-label="Nascondi questa scheda"
                title="Nascondi questa scheda"
              >
                ✕
              </button>
            )}
            <div className="generation-group-header">{intestazioneGruppo(gruppo)}</div>
            <div className="generation-group-children">
              {gruppo.figli.map((id) => {
                const record = data.individui[id];
                // 2 colori distinti (vedi settings.js): l'assassino ha un
                // bordo suo, diverso da quello di un indiziato qualunque.
                let classeEvidenza = "";
                if (highlightMatches && id === assassinoId) classeEvidenza = " assassino";
                else if (highlightMatches && matchIds && matchIds.includes(id)) classeEvidenza = " indiziato";
                return (
                  <button
                    key={id}
                    type="button"
                    className={`suspect-tile generation-tile${classeEvidenza}`}
                    onClick={() => onOpenDetail(id)}
                    title={showTooltips ? nome(id) : undefined}
                  >
                    <span className="avatar-ring">
                      <Avatar
                        proportions={proportionsObject(record, data.aree)}
                        aree={data.aree}
                        toniPelle={data.toniPelle}
                        sesso={record[IDX.sesso]}
                        lhonCarrier={record[IDX.linea_materna_lhon]}
                        srySwyerCondition={record[IDX.sindrome_swyer]}
                        size={48}
                      />
                    </span>
                    <span className="suspect-id">{nome(id)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// Nota deliberata su cosa NON mostra più questa vista, dopo diversi giri di
// affinamento su richiesta: niente bordo verde/sbiadito per segnalare chi è
// ancora compatibile con gli indizi — dava già la risposta al posto del
// giocatore. Resta solo la struttura oggettiva (chi è figlio di chi), non
// una scorciatoia sulla soluzione. Mostra inoltre SOLO gli individui dello
// stesso sesso dell'assassino: l'altra metà è comunque irrilevante, dato
// che il sesso è già un indizio obbligatorio noto fin dall'inizio.
//
// L'indizio "generazione" non indica più un valore esatto ma una finestra
// di massimo 3 generazioni adiacenti (vedi CLUE_DEFINITIONS.generazione in
// caseEngine.js) — questa vista mostra quindi ogni generazione della
// finestra come sezione separata, non tutte mischiate insieme, così resta
// chiaro chi appartiene a quale.
export default function GenerationView({
  data,
  kase,
  onOpenDetail,
  onClose,
  nascosti,
  onNascondi,
  showDismissButton = true,
  showTooltips = true,
  lettera = null,
  filterIndividualsByLetter = false,
  matchIds,
  highlightMatches = false,
}) {
  const { min, max } = kase.clues.generazione;
  const sessoAssassino = kase.clues.sesso;

  const idsPerGenerazione = new Map();
  for (let g = min; g <= max; g += 1) idsPerGenerazione.set(g, []);
  data.individui.forEach((record, id) => {
    const g = record[IDX.generazione];
    if (g >= min && g <= max && record[IDX.sesso] === sessoAssassino) {
      idsPerGenerazione.get(g).push(id);
    }
  });
  const totale = Array.from(idsPerGenerazione.values()).reduce((tot, ids) => tot + ids.length, 0);

  return (
    <div className="panel generation-view">
      <div className="case-header">
        <h3>{min === max ? `Generazione ${min}` : `Generazioni ${min}–${max}`}</h3>
        <span className="suspect-count">
          {sessoAssassino === "F" ? "individui di sesso femminile" : "individui di sesso maschile"}: <b>{totale}</b>
        </span>
      </div>
      <p className="generation-legend">
        {min === max ? "Una sola generazione" : "Una finestra di generazioni adiacenti"} (mai un valore esatto:
        anche questo indizio resta un identikit, non una data di nascita), sezione per sezione, raggruppate per
        genitori condivisi (fratelli/sorelle pieni) all'interno di ciascuna. Per verificare un sospettato
        specifico: apri la sua scheda e clicca ripetutamente su "Vedi i suoi genitori →" per risalire lungo un
        ramo — due passaggi ti portano ai nonni, tre ai bisnonni — poi confronta a mano l'area di ciascun
        antenato con quella rivelata dagli indizi già richiesti. Puoi nascondere una scheda con la ✕ se hai già
        escluso quella famiglia: è solo un aiuto visivo, non cambia nulla nel gioco.
      </p>

      {Array.from(idsPerGenerazione.entries()).map(([g, ids]) => (
        <GenerationSection
          key={g}
          generazione={g}
          ids={ids}
          data={data}
          nascosti={nascosti}
          onNascondi={onNascondi}
          onOpenDetail={onOpenDetail}
          showDismissButton={showDismissButton}
          showTooltips={showTooltips}
          lettera={lettera}
          filterIndividualsByLetter={filterIndividualsByLetter}
          matchIds={matchIds}
          highlightMatches={highlightMatches}
          assassinoId={kase.assassinoId}
        />
      ))}

      <button type="button" className="secondary-button generation-back" onClick={onClose}>
        ← Torna all'indagine
      </button>
    </div>
  );
}
