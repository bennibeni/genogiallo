// ---------- IMPOSTAZIONI GLOBALI ----------
// Nessuna dipendenza da React: sono solo dati (valori di default + elenco
// per costruire l'interfaccia del pannello), la logica di stato/persistenza
// a runtime vive in DetectiveGame.jsx (che tiene le impostazioni attuali in
// uno stato React e le passa in giù a chi le usa — CluesPanel.jsx,
// SuspectBoard.jsx, GenerationView.jsx). Il pannello per modificarle si
// apre con la combinazione segreta Ctrl+Alt+S (vedi SettingsModal.jsx).
//
// Tutte a "false" di default: il giocatore normale gioca senza alcun
// aiuto extra finché non apre il pannello (Ctrl+Alt+S) e sceglie lui stesso
// cosa attivare. Da notare: la combinazione di più impostazioni "true"
// insieme può svuotare quasi del tutto la griglia sospettati fin da subito
// (verificato: con lettera+generazione auto-rivelate e i due filtri attivi
// insieme, in media restano solo ~2 sospettati su 12 mostrati) — un motivo
// in più per lasciarle spente finché non è il giocatore a deciderlo.
export const DEFAULT_SETTINGS = {
  showSuspectTooltips: false,
  showGenerationDismissButton: false,
  showIndiziatiCount: false,
  hideSuspectsNotMatchingLetter: false,
  filterGenerationIndividualsByLetter: false,
  hideSuspectsOutsideGenerationWindow: false,
  highlightIndiziatiInSuspectBoard: false,
  highlightIndiziatiInGenerationView: false,
  autoRevealLetterAndGeneration: false,
  dontShowGenerationUnlockBanner: false,
};

// Usato da SettingsModal.jsx per costruire l'elenco di interruttori senza
// doverli scrivere a mano uno per uno: l'ordine qui è l'ordine con cui
// compaiono nel pannello, lo stesso in cui sono state richieste.
export const SETTINGS_DEFINITIONS = [
  {
    key: "showSuspectTooltips",
    label: "Tooltip al passaggio del mouse sui sospettati",
  },
  {
    key: "showGenerationDismissButton",
    label: "Bottone ✕ per nascondere le schede nella pagina Generazione",
  },
  {
    key: "showIndiziatiCount",
    label: 'Mostra il numero di indiziati ("Indiziati: X / Y")',
  },
  {
    key: "hideSuspectsNotMatchingLetter",
    label: "Se nota, nascondi i sospettati SENZA la lettera del biglietto da visita nel nome",
  },
  {
    key: "filterGenerationIndividualsByLetter",
    label: "Se nota, nelle schede famiglia mostra solo gli individui CON la lettera del biglietto da visita nel nome",
  },
  {
    key: "hideSuspectsOutsideGenerationWindow",
    label: "Se nota, nascondi i sospettati fuori dalla finestra di generazioni",
  },
  {
    key: "highlightIndiziatiInSuspectBoard",
    label: "Bordo colorato nella griglia sospettati: un colore per l'assassino, un altro per gli altri indiziati",
  },
  {
    key: "highlightIndiziatiInGenerationView",
    label: "Bordo colorato nella pagina Generazione: un colore per l'assassino, un altro per gli altri indiziati",
  },
  {
    key: "autoRevealLetterAndGeneration",
    label:
      "All'apertura del gioco, richiedi subito \"Lettera leggibile sul biglietto da visita\" e \"Generazione\" (resta da richiedere solo \"Area ancestrale dominante\")",
  },
  {
    key: "dontShowGenerationUnlockBanner",
    label: 'Non mostrare il banner "Nuovo: conosci la generazione dell\'assassino..." quando si sblocca la pagina Generazione',
  },
];
