"use client";

import { computeSkinTone, computeSkinToneBand, phenotypicAppearance } from "@/lib/phenotypes";

const FRAME_COLOR = "#262d3f";
const FALLBACK_SKIN = "#c9a37a";

export function selectAvatarAsset({ toneBand, appearance, hasGlasses }) {
  const variant = hasGlasses ? "occhiali" : "normale";
  const sex = appearance === "femminile" ? "donna" : "uomo";
  return `/avatars/${variant}_${sex}_${String(toneBand).padStart(2, "0")}.png`;
}

// Avatar stilizzato, pensato per sostituire il precedente cerchio a
// gradazione di colore: stessa informazione sul tono di pelle, più tre
// tratti aggiuntivi che raccontano a colpo d'occhio altrettante
// informazioni già presenti nei dati. Deliberatamente semplice, per scelta
// esplicita: un solo colore di capelli per tutti, nessuna variazione di
// forma del volto — le uniche variabili sono lunghezza dei capelli,
// presenza degli occhi, e tono di pelle.
//
// Il ritaglio circolare avviene con CSS (border-radius + overflow:hidden
// sul contenitore), non con <clipPath> di SVG: una prima versione usava
// clipPath con un id da useId(), ma i riferimenti url(#...) a id con
// caratteri speciali (o comunque il meccanismo clipPath in sé, a seconda
// del browser/bundler) si sono rivelati inaffidabili — il contenuto
// ritagliato spariva del tutto, lasciando solo un cerchio vuoto. Il
// ritaglio via CSS è più semplice e non ha bisogno di alcun id da
// risolvere, quindi non può fallire allo stesso modo.
//
// - Lunghezza dei capelli: segue phenotypicAppearance(), non "sesso"
//   direttamente. È per questo che un portatore della sindrome di Swyer,
//   pur classificato regolarmente 'M', ha capelli lunghi come un avatar
//   femminile.
// - Occhi assenti: chi porta la mutazione LHON (associata a perdita della
//   visione centrale) non ha occhi disegnati.
// - Tono di pelle: stesso calcolo di prima (computeSkinTone), applicato
//   alla testa invece che a un cerchio pieno.
export default function Avatar({
  proportions,
  aree,
  toniPelle,
  sesso,
  lhonCarrier,
  srySwyerCondition,
  size = 40,
}) {
  const skinTone =
    computeSkinTone(proportions, aree, toniPelle) || FALLBACK_SKIN;
  const appearance = phenotypicAppearance(sesso, srySwyerCondition);
  const toneBand = computeSkinToneBand(skinTone);
  const imageSrc = selectAvatarAsset({
    toneBand: toneBand.id,
    appearance,
    // Gli asset con occhiali rendono visivamente il tratto LHON senza
    // rappresentare in modo fuorviante una cecità totale.
    hasGlasses: lhonCarrier === true,
  });

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        border: `2px solid ${FRAME_COLOR}`,
        background: skinTone,
        flexShrink: 0,
        lineHeight: 0,
      }}
    >
      <img
        src={imageSrc}
        alt={`Avatar ${appearance}${lhonCarrier === true ? " con occhiali" : ""}`}
        width={size}
        height={size}
        onError={(event) => { event.currentTarget.style.display = "none"; }}
        style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}
