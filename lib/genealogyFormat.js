export const CANONICAL_SCHEMA = [
  "generazione",
  "genitoreA_id",
  "genitoreB_id",
  "area_fondatore",
  "proporzioni",
  "unione_fuori_gruppo",
  "area_dominante_diversa_dai_genitori",
  "sesso",
  "linea_materna_id",
  "madre_id",
  "linea_materna_interrotta",
  "linea_paterna_id",
  "padre_id",
  "linea_paterna_interrotta",
  "linea_materna_lhon",
  "sindrome_swyer",
];

const REQUIRED_FIELDS = [
  "generazione",
  "genitoreA_id",
  "genitoreB_id",
  "area_fondatore",
  "proporzioni",
];

function fail(message) {
  throw new Error(`Genealogia non valida: ${message}`);
}

function isNullableId(value) {
  return value === null || (Number.isInteger(value) && value >= 0);
}

// Valida l'export e converte ogni record nell'ordine canonico usato dai
// componenti grafici. Il file può così riordinare o aggiungere colonne senza
// rompere il visualizzatore, purché dichiari correttamente `schema`.
export function validateAndNormalizeGenealogy(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    fail("la radice del JSON deve essere un oggetto");
  }
  if (!Array.isArray(json.schema)) fail('manca il campo "schema"');
  if (!Array.isArray(json.individui)) fail('manca il campo "individui"');
  if (json.individui.length === 0) fail('il campo "individui" è vuoto');
  if (!Array.isArray(json.aree) || json.aree.length === 0) {
    fail('il campo "aree" deve contenere almeno un’area');
  }
  if (json.aree.some((area) => typeof area !== "string" || area.trim() === "")) {
    fail('il campo "aree" contiene un nome non valido');
  }
  if (new Set(json.aree).size !== json.aree.length) {
    fail('il campo "aree" contiene nomi duplicati');
  }

  const duplicates = json.schema.filter(
    (name, index) => json.schema.indexOf(name) !== index,
  );
  if (duplicates.length > 0)
    fail(
      `campi duplicati nello schema: ${[...new Set(duplicates)].join(", ")}`,
    );

  const sourceIndex = new Map(json.schema.map((name, index) => [name, index]));
  const missingFields = REQUIRED_FIELDS.filter(
    (name) => !sourceIndex.has(name),
  );
  if (missingFields.length > 0)
    fail(`campi obbligatori mancanti: ${missingFields.join(", ")}`);

  const canonicalIndex = new Map(
    CANONICAL_SCHEMA.map((name, index) => [name, index]),
  );
  const normalized = json.individui.map((source, id) => {
    if (!Array.isArray(source))
      fail(`individuo ${id}: il record non è un array`);
    if (source.length < json.schema.length) {
      fail(
        `individuo ${id}: record di ${source.length} campi, schema di ${json.schema.length}`,
      );
    }

    const record = CANONICAL_SCHEMA.map((name) => {
      const index = sourceIndex.get(name);
      return index === undefined ? null : source[index];
    });
    const generation = record[canonicalIndex.get("generazione")];
    const parentA = record[canonicalIndex.get("genitoreA_id")];
    const parentB = record[canonicalIndex.get("genitoreB_id")];
    const proportions = record[canonicalIndex.get("proporzioni")];

    if (!Number.isInteger(generation) || generation < 0) {
      fail(`individuo ${id}: generazione non valida`);
    }
    if (!isNullableId(parentA) || !isNullableId(parentB)) {
      fail(`individuo ${id}: id di un genitore non valido`);
    }
    if ((parentA === null) !== (parentB === null)) {
      fail(`individuo ${id}: deve avere due genitori oppure nessun genitore`);
    }
    if (parentA === id || parentB === id) {
      fail(`individuo ${id}: non può essere genitore di sé stesso`);
    }
    if (
      !Array.isArray(proportions) ||
      proportions.length !== json.aree.length
    ) {
      fail(
        `individuo ${id}: le proporzioni non corrispondono alle ${json.aree.length} aree`,
      );
    }
    if (
      proportions.some(
        (value) => !Number.isFinite(value) || value < 0 || value > 1,
      )
    ) {
      fail(`individuo ${id}: proporzione ancestrale non valida`);
    }
    const total = proportions.reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 1) > 0.001) {
      fail(
        `individuo ${id}: le proporzioni sommano a ${total.toFixed(4)} anziché 1`,
      );
    }
    return record;
  });

  for (let id = 0; id < normalized.length; id += 1) {
    const generation = normalized[id][0];
    for (const parentId of [normalized[id][1], normalized[id][2]]) {
      if (parentId === null) continue;
      if (parentId >= normalized.length)
        fail(`individuo ${id}: genitore ${parentId} inesistente`);
      if (normalized[parentId][0] >= generation) {
        fail(
          `individuo ${id}: il genitore ${parentId} non appartiene a una generazione precedente`,
        );
      }
    }
  }

  return { ...json, schema: CANONICAL_SCHEMA, individui: normalized };
}
