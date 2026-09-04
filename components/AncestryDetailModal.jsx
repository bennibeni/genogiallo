'use client';

import React, { useState } from 'react';
import Avatar from './Avatar';

const FALLBACK_COLOR = '#5b6478';
const CANONICAL_AREA_ORDER = ['Nord', 'Centro', 'Sud'];

function orderedAreas(aree) {
  const rank = (area) => {
    const index = CANONICAL_AREA_ORDER.indexOf(area);
    return index === -1 ? CANONICAL_AREA_ORDER.length : index;
  };
  return [...aree].sort((a, b) => rank(a) - rank(b));
}

// Barra orizzontale di proporzioni, in HTML/CSS puro (non canvas): a
// differenza dei grafici nel pedigree, qui la precisione del confronto tra
// due barre (atteso vs osservato) conta più dell'eleganza, e l'HTML resta
// nitido a qualunque livello di zoom — un vantaggio reale rispetto al canvas
// quando l'obiettivo è leggere con precisione una piccola differenza.
function ProportionBar({ aree, colori, proportions, marcatoriTotali }) {
  const displayAreas = orderedAreas(aree);
  return (
    <div className="ancestry-bar-row">
      <div className="ancestry-bar">
        {displayAreas.map((area) => {
          const value = proportions[area] || 0;
          if (value <= 0) return null;
          return (
            <div
              key={area}
              className="ancestry-bar-segment"
              style={{ width: `${value * 100}%`, background: colori[area] || FALLBACK_COLOR }}
              title={`${area}: ${(value * 100).toFixed(1)}%`}
            />
          );
        })}
      </div>
      <div className="ancestry-bar-legend">
        {displayAreas
          .map((area) => ({ area, value: proportions[area] || 0 }))
          .map(({ area, value }) => (
            <span key={area} className="ancestry-legend-item">
              <span className="ancestry-dot" style={{ background: colori[area] || FALLBACK_COLOR }} />
              {area} {(value * 100).toFixed(1)}%
              {marcatoriTotali ? (
                <span className="ancestry-count"> (≈{Math.round(value * marcatoriTotali)}/{marcatoriTotali})</span>
              ) : null}
            </span>
          ))}
      </div>
    </div>
  );
}

function proportionsFromRecord(record, aree) {
  const arr = record[4] || [];
  const result = {};
  aree.forEach((area, i) => {
    result[area] = arr[i] || 0;
  });
  return result;
}

const ROLE_BADGE_COLORS = { Madre: '#4dd9c0', Padre: '#ff8a5c', Genitore: '#8b91a7' };

function IndividualCard({ id, individui, aree, colori, marcatoriTotali, onClick, clickable, roleLabel, nomi }) {
  const record = individui[id];
  if (!record) return null;
  const [generation, , , founderArea, , , , sex] = record;
  const proportions = proportionsFromRecord(record, aree);
  const displayName = (nomi && nomi[id]) || `#${id}`;

  return (
    <div
      className={`ancestry-card${clickable ? ' clickable' : ''}`}
      onClick={clickable ? onClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <div className="ancestry-card-header">
        <div className="ancestry-card-header-top">
          {roleLabel && (
            <span className="ancestry-role-badge" style={{ background: ROLE_BADGE_COLORS[roleLabel] || ROLE_BADGE_COLORS.Genitore }}>
              {roleLabel}
            </span>
          )}
          <span className="ancestry-card-id">{displayName}</span>
          {sex && <span className="ancestry-sex-badge">{sex}</span>}
        </div>
        <div className="ancestry-card-header-bottom">
          <span className="ancestry-card-gen">generazione {generation}</span>
          {founderArea && <span className="ancestry-founder-badge">Fondatore</span>}
        </div>
      </div>
      <ProportionBar aree={aree} colori={colori} proportions={proportions} marcatoriTotali={marcatoriTotali} />
      {clickable && <div className="ancestry-card-hint">Vedi i suoi genitori →</div>}
    </div>
  );
}

// "nomi" (opzionale): mappa id -> nome breve, usata al posto di "#id"
// ovunque nella scheda quando fornita (vedi R19/nameEngine.js per il primo
// chiamante che la popola). Senza "nomi" il comportamento resta identico a
// prima — è un prop puramente opzionale, non un requisito nuovo per chi già
// usa questo componente (PedigreeViewer.jsx in R18 non la passa mai).
function displayNameFor(nomi, id) {
  return (nomi && nomi[id]) || `#${id}`;
}

// Mostra un individuo e i suoi genitori diretti, non l'intero albero: al
// contrario del pedigree completo (che disegna insieme molte generazioni
// come grafo), qui si guarda un solo passaggio genitori→figlio alla volta,
// con il confronto esplicito tra la media attesa dei genitori e la
// composizione osservata del figlio. Cliccando su un genitore ci si sposta
// su di lui, potendo risalire quanto si vuole un passo alla volta.
//
// "extraAction" (opzionale) aggiunge un pulsante secondario oltre a
// "Chiudi": { label, onClick(id) }, dove "id" è l'individuo attualmente a
// fuoco (focusId, non necessariamente initialId — funziona anche dopo
// essersi spostati su un genitore). Deliberatamente generico: questo
// componente non sa nulla di "accuse" o altri concetti specifici di chi lo
// usa (vedi R19/DetectiveGame.jsx per il primo consumatore), è solo un modo
// per un chiamante di agganciare una propria azione all'individuo mostrato.
export default function AncestryDetailModal({ individui, aree, colori, marcatoriTotali, toniPelle, initialId, onClose, extraAction, nomi }) {
  const [history, setHistory] = useState([initialId]);
  const focusId = history[history.length - 1];
  const record = individui[focusId];

  if (!record) return null;

  const [
    , parentAId, parentBId, founderArea, , , , sex, lineageId, motherId, matrilineBroken,
    patrilineageId, fatherId, patrilineBroken, lhonCarrier, srySwyerCondition,
  ] = record;
  const proportions = proportionsFromRecord(record, aree);
  const hasParents = parentAId !== null && parentAId !== undefined;

  let expected = null;
  if (hasParents) {
    const propA = proportionsFromRecord(individui[parentAId], aree);
    const propB = proportionsFromRecord(individui[parentBId], aree);
    expected = {};
    aree.forEach((area) => {
      expected[area] = ((propA[area] || 0) + (propB[area] || 0)) / 2;
    });
  }

  const roleFor = (parentId) => {
    if (parentId === motherId) return 'Madre';
    if (parentId === fatherId) return 'Padre';
    return 'Genitore';
  };

  return (
    <div className="ancestry-modal-overlay" onClick={onClose}>
      <div className="ancestry-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ancestry-modal-topbar">
          {history.length > 1 && (
            <button className="ancestry-back" onClick={() => setHistory((h) => h.slice(0, -1))}>
              ← Torna a {displayNameFor(nomi, history[history.length - 2])}
            </button>
          )}
          <button className="ancestry-close" onClick={onClose} aria-label="Chiudi">✕</button>
        </div>

        <h3>Individuo {displayNameFor(nomi, focusId)}</h3>
        <p className="ancestry-subtitle">
          Generazione {record[0]} — sesso {sex}
          {founderArea ? ` — fondatore (${founderArea})` : ' — discendente'}
        </p>

        <div className="ancestry-avatar">
          <Avatar
            proportions={proportions}
            aree={aree}
            toniPelle={toniPelle}
            sesso={sex}
            lhonCarrier={lhonCarrier}
            srySwyerCondition={srySwyerCondition}
            size={64}
          />
        </div>

        {extraAction && (
          <button type="button" className="ancestry-extra-action" onClick={() => extraAction.onClick(focusId)}>
            {extraAction.label}
          </button>
        )}

        {lhonCarrier === true && (
          <p className="ancestry-note ancestry-lhon-note">
            Attraverso la linea materna (mtDNA), questo individuo porta una mutazione associata alla
            neuropatia ottica ereditaria di Leber (LHON) — una condizione reale. Può causare una
            perdita significativa della visione centrale, spesso in giovane età.
          </p>
        )}

        {!hasParents && (
          <>
            <ProportionBar aree={aree} colori={colori} proportions={proportions} marcatoriTotali={marcatoriTotali} />
            <p className="ancestry-note">
              È un fondatore: non ha genitori nella simulazione, tutti i suoi marcatori provengono
              dall'area {founderArea}. È anche origine di una propria linea materna (indipendente dal
              sesso — anche un fondatore maschio ha un proprio mtDNA, semplicemente non lo trasmette){
                sex === 'M' ? ', e di una propria linea paterna (cromosoma Y).' : '.'
              }
            </p>
          </>
        )}

        {hasParents && (
          <>
            <p className="ancestry-note ancestry-matriline-note">
              {matrilineBroken
                ? 'Linea materna interrotta: in questa unione nessuno dei due genitori era femmina, quindi non c\'è una madre designata da cui tracciarla.'
                : `Linea materna: origine ${displayNameFor(nomi, lineageId)}.`}
            </p>

            {srySwyerCondition !== null && (
              <p className="ancestry-note ancestry-patriline-note">
                {patrilineBroken
                  ? 'Linea paterna interrotta: in questa unione nessuno dei due genitori era maschio, quindi non c\'è un padre designato da cui tracciarla.'
                  : `Linea paterna: origine ${displayNameFor(nomi, patrilineageId)}.`}
              </p>
            )}

            {srySwyerCondition === true && (
              <p className="ancestry-note ancestry-swyer-note">
                Classificato regolarmente come 'M' (cariotipo 46,XY — ha ricevuto un cromosoma Y dal
                padre, linea paterna tracciabile sopra), ma con fenotipo completamente femminile —
                sindrome di Swyer, causata da una mutazione o delezione del gene SRY su quello stesso
                cromosoma Y. Senza un gene SRY funzionante, lo sviluppo procede secondo la via di
                default (femminile) invece che maschile. Tipicamente infertile nella realtà: il
                modello lo esclude esplicitamente da entrambi i ruoli genitoriali, quindi questa
                specifica linea paterna non prosegue oltre.
              </p>
            )}

            <div className="ancestry-section-title">Proporzioni ancestrali per area geografica attese dai genitori vs. osservate</div>
            <p className="ancestry-note">
              Se ogni marcatore avesse esattamente il 50% di probabilità di provenire da ciascun
              genitore, ci si aspetterebbe la media delle loro proporzioni (riga superiore). Quella
              osservata (riga inferiore) è quasi sempre un po' diversa: è l'effetto del campionamento
              casuale del crossover, marcatore per marcatore — non un errore.
            </p>
            <div className="ancestry-compare">
              <div className="ancestry-compare-label">Attese (media dei genitori)</div>
              <ProportionBar aree={aree} colori={colori} proportions={expected} marcatoriTotali={null} />
              <div className="ancestry-compare-label">Osservate (in {displayNameFor(nomi, focusId)})</div>
              <ProportionBar aree={aree} colori={colori} proportions={proportions} marcatoriTotali={marcatoriTotali} />
            </div>

            <div className="ancestry-section-title">Genitori</div>
            <p className="ancestry-note">
              Chi tra i due è la madre trasmette la propria linea materna intatta al figlio; se il
              figlio è maschio, chi è il padre gli trasmette allo stesso modo la propria linea
              paterna. Entrambi i genitori contribuiscono comunque geneticamente in modo autosomico,
              come sopra, indipendentemente da questi due ruoli.
            </p>
            <div className="ancestry-parents">
              <IndividualCard
                id={parentAId}
                individui={individui}
                aree={aree}
                colori={colori}
                marcatoriTotali={marcatoriTotali}
                clickable
                roleLabel={roleFor(parentAId)}
                onClick={() => setHistory((h) => [...h, parentAId])}
                nomi={nomi}
              />
              <IndividualCard
                id={parentBId}
                individui={individui}
                aree={aree}
                colori={colori}
                marcatoriTotali={marcatoriTotali}
                clickable
                roleLabel={roleFor(parentBId)}
                onClick={() => setHistory((h) => [...h, parentBId])}
                nomi={nomi}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

