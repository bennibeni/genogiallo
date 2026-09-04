export const AREAS = ["Nord", "Centro", "Sud"];
// export const COLORS = { Nord: '#5B8DEF', Centro: '#C97B4A', Sud: '#E85D5D' };
export const COLORS = { Nord: "#5B8DEF", Centro: "#FFFFFF", Sud: "#E85D5D" };

// Fenotipo illustrativo: tono di pelle di riferimento per ciascuna area
// fondatrice, usato per calcolare una media pesata sulle stesse proporzioni
// ancestrali già mostrate altrove (nessun marcatore dedicato — è la
// versione "rapida" scelta deliberatamente, vedi GUIDA.md per il
// compromesso rispetto a una versione con marcatori propri del fenotipo).
// Puramente didattico: non rappresenta popolazioni o etnie reali, allo
// stesso modo in cui "Nord/Centro/Sud" sono aree fittizie del simulatore.
// Ancore calibrate sulle fasce comuni degli avatar: Nord=01, Centro=05,
// Sud=10. Le combinazioni ancestrali possono così utilizzare l'intera scala.
export const SKIN_TONES = {
  Nord: "#EEAE77",
  Centro: "#A66B41",
  Sud: "#4D1801",
};
