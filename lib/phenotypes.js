// Fenotipo illustrativo calcolato dalle proporzioni ancestrali già
// esistenti (nessun marcatore dedicato al fenotipo — versione "rapida"
// scelta deliberatamente). Vedi GUIDA.md per il compromesso rispetto a una
// versione con marcatori propri, che mostrerebbe anche variazione tra
// fratelli con la stessa ancestralità media.

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const value = parseInt(clean, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHex([r, g, b]) {
  const toHex = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Le dieci fasce sono comuni ai due generi. Il colore è il riferimento
// tecnico intermedio fra la resa maschile e quella femminile della stessa
// coordinata t; il file mostrato conserva invece la resa specifica.
export const SKIN_TONE_BANDS = [
  { id: 1, t: -0.350, color: '#EEAE77' },
  { id: 2, t: -0.161, color: '#DC9D6A' },
  { id: 3, t:  0.028, color: '#CA8D5C' },
  { id: 4, t:  0.217, color: '#B87C4E' },
  { id: 5, t:  0.406, color: '#A66B41' },
  { id: 6, t:  0.594, color: '#955A33' },
  { id: 7, t:  0.783, color: '#824A26' },
  { id: 8, t:  0.972, color: '#713918' },
  { id: 9, t:  1.161, color: '#5F290B' },
  { id: 10, t: 1.350, color: '#4D1801' },
];

function rgbToLab(rgb) {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
  const transform = (value) => value > 0.008856
    ? Math.cbrt(value)
    : 7.787 * value + 16 / 116;
  const fx = transform(x);
  const fy = transform(y);
  const fz = transform(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function computeSkinToneBand(skinTone) {
  if (typeof skinTone !== 'string' || !/^#[0-9a-f]{6}$/i.test(skinTone)) {
    return SKIN_TONE_BANDS[4];
  }
  const observed = rgbToLab(hexToRgb(skinTone));
  return SKIN_TONE_BANDS.reduce((nearest, band) => {
    const candidate = rgbToLab(hexToRgb(band.color));
    const distance = candidate.reduce(
      (sum, value, index) => sum + (value - observed[index]) ** 2,
      0,
    );
    return distance < nearest.distance ? { band, distance } : nearest;
  }, { band: SKIN_TONE_BANDS[0], distance: Infinity }).band;
}

// Media pesata dei toni di riferimento per area, pesata sulle proporzioni
// ancestrali dell'individuo. Se manca la mappa dei toni (un file più
// vecchio, esportato prima di questa funzionalità, non avrà "toni_pelle"),
// restituisce null: meglio non mostrare nulla che inventare un colore.
export function computeSkinTone(proportions, aree, toniPelle) {
  if (!toniPelle) return null;
  let r = 0;
  let g = 0;
  let b = 0;
  let totalWeight = 0;
  aree.forEach((area) => {
    const tone = toniPelle[area];
    const weight = proportions[area] || 0;
    if (!tone || weight <= 0) return;
    const [tr, tg, tb] = hexToRgb(tone);
    r += tr * weight;
    g += tg * weight;
    b += tb * weight;
    totalWeight += weight;
  });
  if (totalWeight <= 0) return null;
  return rgbToHex([r / totalWeight, g / totalWeight, b / totalWeight]);
}

// Distingue la classificazione anagrafica ("sesso", usata per il vincolo di
// accoppiamento e per il simbolo ♂/♀) dall'ASPETTO visibile — le due
// coincidono per quasi tutti, ma divergono per la sindrome di Swyer: un
// individuo classificato regolarmente 'M' (cariotipo 46,XY) il cui aspetto
// è comunque completamente femminile. Pensata per un futuro avatar (es.
// lunghezza dei capelli): l'avatar dovrebbe leggere QUESTA funzione, non
// "sesso" direttamente, per scegliere i tratti da mostrare.
export function phenotypicAppearance(sesso, srySwyerCondition) {
  if (srySwyerCondition === true) return 'femminile';
  return sesso === 'F' ? 'femminile' : 'maschile';
}
