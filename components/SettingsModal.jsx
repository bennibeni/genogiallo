"use client";

import { SETTINGS_DEFINITIONS } from "@/lib/settings";

// Nessuna combinazione di tasti gestita qui dentro: l'ascolto della
// scorciatoia (Ctrl+Alt+S) vive in DetectiveGame.jsx, che decide quando
// montare questo componente — coerente con come sono già gestite le altre
// modali del gioco (DeceasedReveal, LineageOverviewModal), sempre montate
// condizionalmente dal genitore, mai responsabili di decidere da sole
// quando comparire.
export default function SettingsModal({ settings, onChange, onClose }) {
  return (
    <div className="lineage-overlay" onClick={onClose}>
      <div className="lineage-modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <button className="lineage-close" onClick={onClose} aria-label="Chiudi">✕</button>
        <h3>Impostazioni</h3>
        <p className="generation-legend">
          Aperto con Ctrl+Alt+S. Le modifiche si applicano subito, per questa sessione di gioco.
        </p>
        <div className="settings-list">
          {SETTINGS_DEFINITIONS.map((def) => (
            <label className="settings-row" key={def.key}>
              <input
                type="checkbox"
                checked={settings[def.key]}
                onChange={(e) => onChange(def.key, e.target.checked)}
              />
              {def.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
