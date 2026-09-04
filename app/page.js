'use client';

import CluesPanel from '@/components/CluesPanel';
import SuspectBoard from '@/components/SuspectBoard';
import { useAppState } from '@/lib/store';

export default function IndaginePage() {
  const {
    kase,
    activeClues,
    matchIds,
    sospettiVisibili,
    settings,
    handleRevealLevel,
    handleRevealClue,
    wrongGuessMessage,
    pendingAccusationId,
    handleOpenDetail,
    data,
  } = useAppState();

  return (
    <main>
      <CluesPanel
        kase={kase}
        activeClues={activeClues}
        matchCount={matchIds.length}
        onRevealLevel={handleRevealLevel}
        onRevealClue={handleRevealClue}
        showIndiziatiCount={settings.showIndiziatiCount}
      />

      {wrongGuessMessage && (
        <div className="panel wrong-guess-banner">
          <p>{wrongGuessMessage}</p>
        </div>
      )}

      <div className="panel">
        <h3>Sospettati</h3>
        <p className="board-note">
          Solo un campione casuale (ma c&apos;è almeno un indiziato vero): il colpevole non è detto
          che sia lui a meno che non sia l&apos;unico indiziato rimasto.
        </p>
        <SuspectBoard
          data={data}
          suspectIds={sospettiVisibili}
          pendingId={pendingAccusationId}
          onOpenDetail={handleOpenDetail}
          showTooltips={settings.showSuspectTooltips}
          matchIds={matchIds}
          highlightMatches={settings.highlightIndiziatiInSuspectBoard}
          assassinoId={kase.assassinoId}
        />
      </div>
      <footer className="projects-footer">
        <a href="https://links-page-bennibeni.vercel.app/">&larr; All projects</a>
      </footer>
    </main>
  );
}
