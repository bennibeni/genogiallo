"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAppState } from "@/lib/store";
import AncestryDetailModal from "./AncestryDetailModal";
import CaseResult from "./CaseResult";
import DeceasedReveal from "./DeceasedReveal";
import LineageOverviewModal from "./LineageOverviewModal";
import SettingsModal from "./SettingsModal";
import { SCHEMA_INDEX } from "@/lib/caseEngine";

// Il guscio che avvolge ogni rotta (vedi app/layout.js) — stesso ruolo di
// AppShell.tsx in dodici: intestazione con la navigazione persistente, più
// tutto ciò che deve poter comparire SOPRA qualunque pagina (le schede
// anagrafiche, la panoramica delle linee, il pannello impostazioni, la
// barra di conferma dell'accusa). "Indagine" e "Generazione" erano due
// viste interne di un solo componente; ora sono due rotte vere (/ e
// /generazione), quindi la navigazione tra loro è un <nav> con <Link>, non
// più due pulsanti che cambiavano uno stato locale.
export default function AppShell({ children }) {
  const pathname = usePathname();
  const state = useAppState();
  const {
    phase,
    data,
    kase,
    detailId,
    showFullDetail,
    setDetailId,
    setShowFullDetail,
    accusationLocked,
    pendingAccusationId,
    setPendingAccusationId,
    handleStartAccusation,
    handleConfirmAccusation,
    handleNewCase,
    accusedId,
    generazioneNota,
    avvisoGenerazioneVisto,
    setAvvisoGenerazioneVisto,
    showLineageOverview,
    setShowLineageOverview,
    showSettings,
    setShowSettings,
    settings,
    updateSetting,
    nomeSospetto,
  } = state;

  // Segna la rotta /generazione come "già vista" appena il giocatore ci
  // naviga davvero — prima lo faceva il click sul tab interno
  // ("setVista('generazione')"), ora è la navigazione stessa il segnale.
  useEffect(() => {
    if (pathname === "/generazione" && !avvisoGenerazioneVisto) {
      setAvvisoGenerazioneVisto(true);
    }
  }, [pathname, avvisoGenerazioneVisto, setAvvisoGenerazioneVisto]);

  // Scorciatoia segreta per il pannello impostazioni — Ctrl+Alt+S.
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setShowSettings(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setShowSettings]);

  const isActive = (href) => pathname === href;

  if (phase === "setup") {
    return (
      <main className="detective-game">
        <h2>Un rompicapo investigativo</h2>
        <p className="subtitle">Generazione della simulazione in corso…</p>
      </main>
    );
  }

  if (phase === "result") {
    return (
      <main className="detective-game">
        <h2>Un rompicapo investigativo</h2>
        <CaseResult data={data} kase={kase} accusedId={accusedId} onNewCase={handleNewCase} />
      </main>
    );
  }

  return (
    <main className="detective-game">
      <h2>Un rompicapo investigativo</h2>

      {/* Il link "Generazione" esiste solo dopo aver richiesto l'indizio
          "generazione" — prima non ha senso, non sapremmo quale generazione
          mostrare. */}
      <nav className="view-tabs">
        <Link className={isActive("/") ? "active" : ""} href="/">
          Indagine
        </Link>
        {generazioneNota && (
          <Link className={`${isActive("/generazione") ? "active" : ""}${!avvisoGenerazioneVisto ? " pulse" : ""}`} href="/generazione">
            Vedi la generazione
          </Link>
        )}
      </nav>

      <p className="case-meta">
        Simulazione generata: {data.individui.length} individui in totale
        {data.generazioniEvolute !== undefined
          ? `, distribuiti su ${data.generazioniEvolute + 1} generazioni (dai fondatori alla generazione ${data.generazioniEvolute})`
          : ""}
        .
        {data.lineeMaterneSuperstiti !== undefined && data.lineePaterneSuperstiti !== undefined && (
          <>
            {` Di tutte le linee materne e paterne originarie, oggi ne sopravvivono ${data.lineeMaterneSuperstiti} materne e ${data.lineePaterneSuperstiti} paterne.`}
            <button
              type="button"
              className="case-meta-info-button"
              onClick={() => setShowLineageOverview(true)}
              aria-label="Vedi il dettaglio delle linee sopravvissute"
              title="Vedi il dettaglio delle linee sopravvissute"
            >
              i
            </button>
          </>
        )}
      </p>

      {showLineageOverview && (
        <LineageOverviewModal data={data} onOpenDetail={state.handleOpenDetail} onClose={() => setShowLineageOverview(false)} />
      )}

      {!settings.dontShowGenerationUnlockBanner && generazioneNota && !avvisoGenerazioneVisto && (
        <div className="panel generation-announcement">
          <p>
            Nuovo: conosci la generazione dell'assassino. Puoi vedere tutta quella generazione, raggruppata per
            famiglie, nella scheda <b>&quot;Vedi la generazione&quot;</b> qui sopra.
          </p>
          <button type="button" className="secondary-button" onClick={() => setAvvisoGenerazioneVisto(true)}>
            Ho capito
          </button>
        </div>
      )}

      {children}

      {/* Un sospetto deceduto (kase.vivo[id] === false) mostra prima la
          rivelazione scherzosa, non la scheda seria — "showFullDetail"
          passa alla scheda vera se richiesta esplicitamente. Un vivo salta
          dritto alla scheda, come sempre. Vive qui, non nelle pagine,
          perché una scheda anagrafica può essere aperta da entrambe le
          rotte (Indagine e Generazione). */}
      {detailId !== null && kase.vivo[detailId] === false && !showFullDetail && (
        <DeceasedReveal
          nome={nomeSospetto(detailId)}
          sesso={data.individui[detailId][SCHEMA_INDEX.sesso]}
          onClose={() => {
            setDetailId(null);
            setShowFullDetail(false);
          }}
          onShowFull={() => setShowFullDetail(true)}
        />
      )}

      {detailId !== null && (kase.vivo[detailId] !== false || showFullDetail) && (
        <AncestryDetailModal
          individui={data.individui}
          aree={data.aree}
          colori={data.colori}
          marcatoriTotali={data.marcatori_totali}
          toniPelle={data.toniPelle}
          initialId={detailId}
          onClose={() => {
            setDetailId(null);
            setShowFullDetail(false);
          }}
          extraAction={accusationLocked ? undefined : { label: "Accusa questo sospettato", onClick: handleStartAccusation }}
          nomi={data.nomi}
        />
      )}

      {pendingAccusationId !== null && (
        <div className="accusation-bar">
          <span className="accusation-text">Accusi {nomeSospetto(pendingAccusationId)}? Se sbagli il caso si chiude.</span>
          <span className="accusation-actions">
            <button type="button" className="secondary-button" onClick={() => setPendingAccusationId(null)}>
              Annulla
            </button>
            <button type="button" className="primary-button" onClick={handleConfirmAccusation}>
              Conferma accusa
            </button>
          </span>
        </div>
      )}

      {showSettings && <SettingsModal settings={settings} onChange={updateSetting} onClose={() => setShowSettings(false)} />}
    </main>
  );
}
