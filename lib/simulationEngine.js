// ---------- LOGICA DELLA SIMULAZIONE ----------
// Nessuna dipendenza da React: può essere testata e riusata indipendentemente
// dall'interfaccia (es. in uno script Node per verificare la convergenza).

export class Individual {
  constructor(numMarkers, initialOrigin = null) {
    this.genome = initialOrigin
      ? new Array(numMarkers).fill(initialOrigin)
      : [];
    // Identità genealogica: valorizzata da Simulation subito dopo la
    // creazione (id, generation, parentIds, founderArea, sex, lineageId,
    // motherId, matrilineBroken), non qui nel costruttore, per tenere
    // separati "di che genoma è fatto" da "che posto occupa nell'albero
    // genealogico". Si veda registerIndividual per i dettagli di ciascuno.
    this.id = null;
    this.generation = null;
    this.parentIds = null; // null per i fondatori, [idA, idB] per i figli
    this.founderArea = null; // valorizzata solo per i fondatori
    this.sex = null; // 'F' o 'M' — vincola l'accoppiamento (vedi pickOther)
    this.lineageId = null; // id della linea materna (mtDNA-like) a cui appartiene
    this.motherId = null; // quale dei due genitori (se presente) è la madre
    this.matrilineBroken = null; // true se l'unione non aveva una madre
    // Esempio di condizione realmente legata al mtDNA (non un'invenzione
    // come sarebbe stato il colore della pelle): la neuropatia ottica
    // ereditaria di Leber (LHON) è causata da mutazioni mitocondriali reali,
    // trasmesse per via materna esattamente come lineageId. true/false per
    // i fondatori (assegnata a caso), ereditata intatta insieme alla linea
    // materna per i discendenti, null quando la linea è interrotta (non si
    // sa nulla del mtDNA in quel caso, non "sana per default").
    this.lhonCarrier = null;
    this.patrilineageId = null; // id della linea paterna (Y-like); null per chi non ha mai ricevuto un cromosoma Y (di norma le femmine, con l'eccezione della sindrome di Swyer, vedi sotto)
    this.fatherId = null; // quale dei due genitori (se presente) è il padre
    this.patrilineBroken = null; // true solo per un individuo geneticamente XY senza padre tracciabile; null (non si applica) a chi non ha mai ricevuto un cromosoma Y
    // Esempio di divergenza reale tra cariotipo e fenotipo: una mutazione o
    // delezione del gene SRY (sul cromosoma Y) impedisce lo sviluppo
    // testicolare, e lo sviluppo procede secondo la via di default
    // (femminile) — sindrome di Swyer (disgenesia gonadica 46,XY completa).
    // true/false solo per chi ha ricevuto un cromosoma Y in questa
    // trasmissione (vedi reproduce), null per chi non lo ha mai ricevuto.
    this.srySwyerCondition = null;
  }

  getAncestryProportions() {
    const counts = {};
    for (const marker of this.genome) {
      counts[marker] = (counts[marker] || 0) + 1;
    }
    const total = this.genome.length || 1;
    const result = {};
    for (const [area, count] of Object.entries(counts)) {
      result[area] = count / total;
    }
    return result;
  }
}

export class Simulation {
  constructor(areas, populationSizePerArea, numMarkers) {
    this.areas = areas;
    // Blinda i due parametri: con 0 individui per area la popolazione totale
    // sarebbe vuota (nessun ciclo evolutivo possibile), e con 0 marcatori ogni
    // genoma sarebbe un array vuoto (nessuna informazione di ancestralità).
    // L'interfaccia impone già minimi sicuri, ma la classe non deve fare
    // affidamento solo su questo per restare corretta.
    this.numMarkers = Math.max(1, Math.floor(numMarkers) || 0);
    const safePopulationSizePerArea = Math.max(1, Math.floor(populationSizePerArea) || 0);

    this.generation = 0;
    this.nextId = 0;

    // Probabilità che una FONDATRICE (o fondatore, ininfluente ai fini
    // della trasmissione ma personalmente vero) porti nel proprio mtDNA una
    // mutazione causa di LHON. Molto più alta della prevalenza reale
    // (~1 su 30.000-50.000 nascite): con poche centinaia di fondatori una
    // probabilità realistica non si vedrebbe mai. È una scelta di
    // dimostrabilità didattica, non un dato epidemiologico.
    this.lhonCarrierProbability = 0.08;

    // Probabilità che, ad OGNI SINGOLA trasmissione del cromosoma Y da
    // padre a figlio, insorga una mutazione/delezione del gene SRY —
    // diversamente da lhonCarrierProbability, questa non è la probabilità
    // di "nascere portatore" di un tratto ereditato: è la probabilità che
    // l'evento capiti fresco in QUESTA specifica trasmissione (la maggior
    // parte dei casi reali di sindrome di Swyer sono infatti de novo, non
    // ereditati — chi ne è affetto è tipicamente infertile, quindi non
    // potrebbe comunque trasmetterla a sua volta). Anche questa probabilità
    // è molto più alta della prevalenza reale (~1 su 80.000 nascite XY),
    // per essere osservabile in una popolazione piccola.
    this.srySwyerProbability = 0.05;
    // Registro genealogico completo: id -> { generation, parentIds, founderArea }.
    // A differenza di "population" (che ad ogni generazione viene sostituito
    // interamente dai figli), il registro non dimentica mai nessuno: è quello
    // che permette di ricostruire l'albero genealogico di un individuo anche
    // molte generazioni dopo che i suoi antenati sono scomparsi da "population".
    this.registry = new Map();

    this.population = [];
    for (const area of areas) {
      for (let i = 0; i < safePopulationSizePerArea; i++) {
        const ind = new Individual(this.numMarkers, area);
        this.registerIndividual(ind, 0, null, area);
        this.population.push(ind);
      }
    }
  }

  // "sex" vincola davvero la scelta del partner: pickOther richiede sesso
  // opposto (si veda pickOther per i dettagli e i ripieghi per i casi
  // limite). All'inizio il sesso era stato introdotto come puro dato
  // informativo, ignorato dagli accoppiamenti — una scelta che aveva senso
  // finché serviva solo a determinare a posteriori chi fosse "la madre" ai
  // fini della linea materna. Una volta che quell'informazione ha iniziato
  // a comparire nel linguaggio del modello (parlare di "madre"/"padre" per
  // una coppia scelta ignorando il sesso produceva descrizioni fuorvianti,
  // come "i suoi genitori erano entrambi maschi" per una coppia che non
  // aveva senso chiamare "genitori" in quel modo), vincolare l'accoppiamento
  // è diventato necessario per coerenza, non solo un dettaglio di realismo.
  registerIndividual(ind, generation, parentIds, founderArea, meta = {}) {
    ind.id = this.nextId++;
    ind.generation = generation;
    ind.parentIds = parentIds;
    ind.founderArea = founderArea;
    // Per i fondatori il sesso si genera qui; per i figli arriva già deciso
    // da reproduce(), che ne ha bisogno PRIMA di chiamare questo metodo per
    // sapere se assegnare la linea paterna (solo ai figli maschi).
    ind.sex = meta.sex ?? (Math.random() < 0.5 ? 'F' : 'M');

    if (parentIds === null) {
      // Fondatore: origine di una propria linea materna, indipendentemente
      // dal proprio sesso — un fondatore maschio possiede comunque un mtDNA
      // proprio, semplicemente non lo trasmetterà mai a nessuno (solo le
      // femmine trasmettono la linea materna, vedi reproduce).
      ind.lineageId = ind.id;
      ind.motherId = null;
      ind.matrilineBroken = null; // "interrotta" non si applica: non ha genitori affatto

      // Il cromosoma Y, al contrario, lo possiedono SOLO i maschi: una
      // fondatrice femmina non ha mai una linea paterna da avere — non è un
      // caso di interruzione, è un cromosoma che le femmine non possiedono
      // affatto, non solo "non trasmettono".
      ind.patrilineageId = ind.sex === 'M' ? ind.id : null;
      ind.fatherId = null;
      ind.patrilineBroken = null; // non ha genitori affatto, il concetto non si applica
      // Nessuna mutazione de novo modellata alla generazione 0: qui il sesso
      // è assegnato direttamente, non c'è una "trasmissione" durante la
      // quale la mutazione possa insorgere (vedi reproduce).
      ind.srySwyerCondition = null;

      ind.lhonCarrier = Math.random() < this.lhonCarrierProbability;
    } else {
      ind.lineageId = meta.lineageId ?? null;
      ind.motherId = meta.motherId ?? null;
      ind.matrilineBroken = meta.matrilineBroken ?? false;

      ind.patrilineageId = meta.patrilineageId ?? null;
      ind.fatherId = meta.fatherId ?? null;
      ind.patrilineBroken = meta.patrilineBroken ?? null;
      ind.srySwyerCondition = meta.srySwyerCondition ?? null;

      ind.lhonCarrier = meta.lhonCarrier ?? null;
    }

    // Il genoma è già completo a questo punto (sia per i fondatori che per i
    // figli, costruito prima di chiamare registerIndividual), quindi le
    // proporzioni calcolate qui sono definitive e non cambieranno più.
    const proportions = ind.getAncestryProportions();
    this.registry.set(ind.id, {
      generation,
      parentIds,
      founderArea,
      proportions,
      // Entrambi restano null per i fondatori (non hanno un'unione che li ha
      // generati, quindi il concetto non si applica): non "false", perché
      // "false" implicherebbe che l'unione sia avvenuta ma fosse nello stesso
      // gruppo — per un fondatore non è mai avvenuta alcuna unione.
      outOfGroupUnion: meta.outOfGroupUnion ?? null,
      dominantShift: meta.dominantShift ?? null,
      sex: ind.sex,
      lineageId: ind.lineageId,
      motherId: ind.motherId,
      matrilineBroken: ind.matrilineBroken,
      patrilineageId: ind.patrilineageId,
      fatherId: ind.fatherId,
      patrilineBroken: ind.patrilineBroken,
      lhonCarrier: ind.lhonCarrier,
      srySwyerCondition: ind.srySwyerCondition,
    });
  }

  dominantAreaFromProportions(props) {
    const keys = Object.keys(props);
    if (keys.length === 0) return this.areas[0]; // difesa: non dovrebbe mai accadere
    return keys.reduce((a, b) => (props[a] >= props[b] ? a : b));
  }

  getDominantArea(ind) {
    return this.dominantAreaFromProportions(ind.getAncestryProportions());
  }

  // "meta.outOfGroupUnion": true se i due genitori avevano aree dominanti
  // diverse al momento dell'accoppiamento (si veda evolveOneGeneration per
  // come viene determinato). "meta.parentDominantAreas": le due aree
  // dominanti dei genitori, usate per calcolare se il figlio ha un'area
  // dominante diversa da ENTRAMBE (deriva/scostamento casuale del
  // rimescolamento, indipendente da "outOfGroupUnion").
  reproduce(parent1, parent2, meta = {}) {
    const child = new Individual(this.numMarkers);
    for (let i = 0; i < this.numMarkers; i++) {
      child.genome.push(Math.random() < 0.5 ? parent1.genome[i] : parent2.genome[i]);
    }

    let dominantShift = null;
    if (meta.parentDominantAreas) {
      const childDominant = this.getDominantArea(child);
      dominantShift = childDominant !== meta.parentDominantAreas[0] && childDominant !== meta.parentDominantAreas[1];
    }

    // Il sesso del figlio va deciso QUI, prima di sapere se assegnargli una
    // linea paterna (solo ai maschi) — a differenza della linea materna, che
    // non dipende affatto dal sesso di chi la riceve.
    const childSex = Math.random() < 0.5 ? 'F' : 'M';

    // Linea materna: a differenza dei marcatori autosomici sopra (che si
    // rimescolano marcatore per marcatore, 50/50), questa si trasmette
    // INTATTA da un solo genitore — quello femmina — oppure non si
    // trasmette affatto. Ora che pickOther vincola gli accoppiamenti a
    // sesso opposto, uno dei due è quasi sempre femmina: l'unico modo in
    // cui NESSUNO dei due lo è, è il ripiego estremo di pickOther per
    // popolazioni piccolissime senza alcun individuo di sesso opposto
    // disponibile — un caso raro, non la norma. Una linea interrotta resta
    // interrotta per sempre a valle: una femmina la cui propria linea era
    // già interrotta (lineageId === null) non ha nulla da trasmettere, non
    // "ripristina" la linea solo perché in questa coppia c'è di nuovo una
    // madre designata.
    const motherCandidate = parent1.sex === 'F' ? parent1 : parent2.sex === 'F' ? parent2 : null;
    const motherIndividual = motherCandidate && motherCandidate.lineageId !== null ? motherCandidate : null;
    let motherId = null;
    let lineageId = null;
    let matrilineBroken = false;
    let lhonCarrier = null;

    if (motherIndividual) {
      motherId = motherIndividual.id;
      lineageId = motherIndividual.lineageId;
      // Esattamente come lineageId: nessuna via di mezzo, si eredita per
      // intero (true o false) insieme al resto del mtDNA della madre.
      lhonCarrier = motherIndividual.lhonCarrier;
    } else {
      matrilineBroken = true;
    }

    // Linea paterna (cromosoma Y): stessa idea, ribaltata, con una
    // differenza in più rispetto a quella materna — qui conta anche il
    // sesso del FIGLIO, non solo dei genitori. Chi nasce femmina dal lancio
    // di moneta iniziale non riceve mai una linea paterna (patrilineBroken
    // resta null, "non si applica": è un cromosoma che di norma le femmine
    // non possiedono). L'unica eccezione reale è la sindrome di Swyer più
    // sotto: un individuo che stava per essere maschio, e lo resta a tutti
    // gli effetti anagrafici (sesso='M', cariotipo 46,XY) anche se il
    // fenotipo risultante è completamente femminile — vedi la sindrome di
    // Swyer più sotto. patrilineageId resta comunque tracciabile: ha
    // davvero ricevuto quel cromosoma Y.
    const fatherCandidate = parent1.sex === 'M' ? parent1 : parent2.sex === 'M' ? parent2 : null;
    const fatherId = fatherCandidate ? fatherCandidate.id : null;
    let patrilineageId = null;
    let patrilineBroken = null;
    let srySwyerCondition = null;

    if (childSex === 'M') {
      const paternalLine = fatherCandidate && fatherCandidate.patrilineageId !== null ? fatherCandidate : null;
      if (paternalLine) {
        patrilineageId = paternalLine.patrilineageId;
        patrilineBroken = false;
      } else {
        patrilineBroken = true;
      }

      // Sindrome di Swyer: la possibilità che il gene SRY sia mutato non
      // dipende dal fatto che si riesca a tracciare la provenienza esatta
      // del cromosoma Y (patrilineageId) — possedere un cromosoma Y (e
      // quindi un gene SRY su cui la mutazione può capitare) è un fatto
      // biologico indipendente da quanto lontano risale il nostro
      // registro. L'identità della linea (patrilineageId/patrilineBroken,
      // già calcolati sopra) NON cambia: è sempre lo stesso cromosoma Y,
      // solo con un gene alterato. "sesso" NON viene capovolto — resta 'M',
      // riflettendo il cariotipo (46,XY): la sindrome di Swyer è una
      // divergenza tra cariotipo e FENOTIPO, non un cambio di
      // classificazione cromosomica (coerente con come viene descritta
      // clinicamente: un individuo "geneticamente maschio" con fenotipo
      // femminile). La conseguenza sulla fertilità — che nella realtà
      // deriva da gonadi non funzionanti, non dalla classificazione — è
      // modellata esplicitamente in evolveOneGeneration, escludendo chi
      // porta questa condizione da entrambi i ruoli genitoriali.
      if (Math.random() < this.srySwyerProbability) {
        srySwyerCondition = true;
      } else {
        srySwyerCondition = false;
      }
    }

    this.registerIndividual(child, this.generation + 1, [parent1.id, parent2.id], null, {
      outOfGroupUnion: meta.outOfGroupUnion ?? null,
      dominantShift,
      sex: childSex,
      motherId,
      lineageId,
      matrilineBroken,
      lhonCarrier,
      fatherId,
      patrilineageId,
      patrilineBroken,
      srySwyerCondition,
    });
    return child;
  }

  // Sceglie un partner di sesso OPPOSTO a "exclude" (mai lo stesso sesso: è
  // il vincolo richiesto esplicitamente, ora che il sesso ha un significato
  // reale — la trasmissione della linea materna — e non solo decorativo).
  // Prova prima in "pool" (il gruppo per area dominante, o l'intera
  // popolazione in caso di migrazione); se lì non c'è nessun candidato di
  // sesso opposto, ripiega su "fallbackPool" (l'intera popolazione). Il
  // vincolo di sesso da solo esclude già l'autofecondazione (un individuo
  // non può mai essere di sesso opposto a se stesso), quindi non serve più
  // un controllo `candidate === exclude` a parte.
  //
  // Un ultimo ripiego, per popolazioni piccolissime con una distribuzione
  // di sesso sfortunata: se in TUTTA la popolazione non esiste nessun
  // individuo di sesso opposto (evento estremamente raro, possibile solo
  // con pochissimi individui), si accetta un partner qualsiasi pur di non
  // far rimpicciolire o crashare la simulazione — un'unione dello stesso
  // sesso in quel caso non ha senso biologico, ma è l'alternativa meno
  // peggiore. È anche l'unico modo in cui la linea materna può ancora
  // risultare interrotta ora che il sesso vincola gli accoppiamenti.
  pickOther(pool, exclude, fallbackPool) {
    const oppositeSex = exclude.sex === 'F' ? 'M' : 'F';

    let candidates = pool.filter((ind) => ind.sex === oppositeSex);
    if (candidates.length === 0) {
      candidates = fallbackPool.filter((ind) => ind.sex === oppositeSex);
    }
    if (candidates.length === 0) {
      candidates = fallbackPool.filter((ind) => ind !== exclude);
    }
    if (candidates.length === 0) return exclude; // popolazione di un solo individuo: davvero nessuna alternativa

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  evolveOneGeneration(migrationRate) {
    if (this.population.length === 0) return; // nulla da far evolvere

    // Chi ha la sindrome di Swyer è tipicamente infertile nella realtà
    // (gonadi non funzionanti): lo escludiamo esplicitamente da ENTRAMBI i
    // ruoli genitoriali, invece di lasciare che sia una conseguenza
    // indiretta di qualcos'altro (come accadeva quando "sesso" veniva
    // capovolto per questi individui — non più, vedi reproduce). Nel caso
    // limite estremo — praticamente impossibile con probabilità realistiche
    // — in cui l'intera popolazione risultasse infertile, si ripiega
    // sull'intera popolazione pur di non bloccare la simulazione.
    let fertilePopulation = this.population.filter((ind) => ind.srySwyerCondition !== true);
    if (fertilePopulation.length === 0) fertilePopulation = this.population;

    // Raggruppa la popolazione FERTILE per area dominante una volta per
    // generazione (invece di ricalcolarla ad ogni singolo accoppiamento,
    // era O(n^2) chiamate a getAncestryProportions per generazione). Non
    // serve calcolarla per chi è infertile: non comparirà mai né come p1
    // né come p2, dato che entrambi vengono scelti solo da fertilePopulation.
    const groups = {};
    this.areas.forEach((a) => (groups[a] = []));
    const dominantOf = new Map();
    for (const ind of fertilePopulation) {
      const dom = this.getDominantArea(ind);
      dominantOf.set(ind, dom);
      groups[dom].push(ind);
    }

    const nextGeneration = [];
    for (let i = 0; i < this.population.length; i++) {
      const p1 = fertilePopulation[Math.floor(Math.random() * fertilePopulation.length)];
      let p2;
      if (Math.random() < migrationRate) {
        p2 = this.pickOther(fertilePopulation, p1, fertilePopulation);
      } else {
        p2 = this.pickOther(groups[dominantOf.get(p1)], p1, fertilePopulation);
      }

      // "Unione fuori gruppo" riflette il RISULTATO (le aree dominanti dei
      // due genitori sono effettivamente diverse), non il ramo scelto sopra:
      // il ramo di migrazione può comunque ripescare per puro caso un
      // partner dello stesso gruppo, e viceversa il ramo assortativo può
      // finire fuori gruppo quando pickOther ripiega sull'intera popolazione
      // perché il gruppo di p1 non aveva altri membri (vedi pickOther).
      // p2 è sempre un membro di "fertilePopulation" (sottoinsieme di
      // "population"), quindi è sempre già presente in dominantOf
      // indipendentemente da quale ramo l'ha scelto.
      const p1Dominant = dominantOf.get(p1);
      const p2Dominant = dominantOf.get(p2);
      const outOfGroupUnion = p1Dominant !== p2Dominant;

      nextGeneration.push(
        this.reproduce(p1, p2, { outOfGroupUnion, parentDominantAreas: [p1Dominant, p2Dominant] })
      );
    }
    this.population = nextGeneration;
    this.generation += 1;
  }

  // Esporta l'intero registro genealogico come grafo compatto: l'indice
  // dell'array coincide con l'id dell'individuo (assegnati in ordine di
  // creazione, mai riusati), evitando di ripetere "id" per ognuno. Ogni voce
  // è [generazione, genitoreA, genitoreB, area_fondatore, proporzioni,
  // unione_fuori_gruppo, area_dominante_diversa_dai_genitori, sesso,
  // linea_materna_id, madre_id, linea_materna_interrotta, linea_paterna_id,
  // padre_id, linea_paterna_interrotta]. Per i fondatori genitoreA/B sono
  // null (area_fondatore è valorizzata), e i due indicatori di unione sono
  // null perché il concetto stesso non si applica (nessuna unione li ha
  // generati); linea_materna_id coincide con il proprio id (origine di una
  // linea propria), madre_id/linea_materna_interrotta sono null (non si
  // applicano: non hanno genitori affatto). "proporzioni" è ordinato
  // secondo "aree" (vedi il campo a livello radice), così un consumatore
  // esterno del solo JSON — come il visualizzatore genealogico in
  // pedigree-viewer/ — può disegnare ogni individuo come un piccolo
  // grafico a torta senza dover ricalcolare nulla.
  //
  // Nota su "sesso": vincola davvero la scelta del partner (vedi pickOther)
  // e determina chi dei due genitori è "la madre"/"il padre" ai fini delle
  // due linee uniparentali. Con questo vincolo, una linea materna interrotta
  // (linea_materna_interrotta === true) è ormai un caso raro — solo il
  // ripiego estremo di popolazioni piccolissime senza alcun individuo di
  // sesso opposto disponibile — non un evento ordinario come quando il
  // sesso era puramente informativo.
  //
  // Nota su "linea_paterna_id" / "linea_paterna_interrotta": simmetrica a
  // linea_materna_id, ma con una differenza importante da non confondere:
  // il cromosoma Y lo possiedono SOLO i maschi, quindi per una femmina
  // linea_paterna_id e linea_paterna_interrotta sono ENTRAMBI null — non
  // perché la sua linea paterna sia "interrotta", ma perché il concetto
  // stesso non si applica mai a lei, esattamente come area_fondatore non si
  // applica a un discendente. linea_paterna_interrotta vale true SOLO per
  // un figlio maschio nato senza un padre tracciabile nell'unione (il
  // ripiego estremo di pickOther) o il cui padre aveva a sua volta la
  // propria linea paterna già interrotta.
  //
  // Nota su "linea_materna_id"/"linea_paterna_id": sono etichette fisse,
  // mai modificate dopo l'assegnazione — non c'è alcuna sequenza
  // sottostante che accumula mutazioni (una prima versione del modello ne
  // aveva una per la linea materna; è stata rimossa perché, senza un modo
  // di far divergere due copie della stessa linea, non aggiungeva
  // informazione rispetto al solo identificatore). Due individui con lo
  // stesso linea_materna_id (o linea_paterna_id) condividono un'antenata
  // (o un antenato) comune diretta; quanto siano "lontani" nel tempo si
  // legge dal numero di linee ancora sopravvissute nella popolazione
  // attuale (Simulation.countSurvivingLineages/countSurvivingPatrilineages),
  // che tende a calare nel tempo fino a convergere a 1 sola linea
  // sopravvissuta per ciascuna — lo stesso fenomeno per cui mtDNA e
  // cromosoma Y umani reali tracciano rispettivamente a un'unica "Eva
  // mitocondriale" e un unico "Adamo cromosomico-Y" (teoria della
  // coalescenza).
  //
  // Nota su "linea_materna_lhon": a differenza del colore della pelle (una
  // media pesata su marcatori generici, puramente illustrativa — vedi
  // pedigree-viewer/phenotypes.js), questa è una condizione realmente
  // legata al mtDNA: la neuropatia ottica ereditaria di Leber (LHON) è
  // causata da mutazioni mitocondriali reali, quindi trasmessa per via
  // materna esattamente come linea_materna_id (booleano fisso, ereditato
  // intatto, mai "rimescolato"). true/false per i fondatori (assegnato a
  // caso con probabilità lhonCarrierProbability, deliberatamente più alta
  // della prevalenza reale per essere osservabile in una popolazione
  // piccola — vedi il costruttore); null quando la linea è interrotta (non
  // si conosce il mtDNA di chi non ha una madre tracciabile — non "sano di
  // default"). Nella realtà la penetranza di LHON è incompleta (non tutti i
  // portatori sviluppano sintomi visibili): questo campo indica solo se
  // l'individuo porta la mutazione nel proprio mtDNA, non se la manifesta.
  //
  // Nota su "sindrome_swyer": a differenza di linea_materna_lhon (un tratto
  // EREDITATO, trasmesso intatto lungo la linea), questa è un evento che
  // può insorgere fresco ad OGNI SINGOLA trasmissione del cromosoma Y (vedi
  // reproduce e srySwyerProbability) — coerente con la realtà, dove la
  // maggior parte dei casi è de novo, non ereditata. Quando scatta:
  // patrilineageId/patrilineBroken (l'IDENTITÀ della linea, calcolati
  // subito prima) non cambiano — è sempre lo stesso cromosoma Y, solo con
  // il gene SRY alterato — e "sesso" NON cambia: resta 'M', il cariotipo
  // (46,XY). La sindrome di Swyer è quindi rappresentata come una
  // divergenza tra cariotipo (sesso='M', invariato) e FENOTIPO (femminile,
  // comunicato solo tramite questo campo e le note dedicate nell'interfaccia
  // — vedi pedigree-viewer), non come un cambio di classificazione
  // anagrafica. true/false solo per chi, in questa generazione, stava per
  // essere maschio (indipendentemente dal fatto che si riesca a tracciare
  // patrilineageId: possedere un gene SRY su cui la mutazione può capitare
  // non dipende da quanto lontano risale il registro); null per chi è nato
  // femmina fin dal lancio di moneta iniziale, per cui la domanda non si è
  // mai posta. Chi è affetto è tipicamente infertile nella realtà — questo
  // è modellato ESPLICITAMENTE in evolveOneGeneration (esclusione dai pool
  // di accoppiamento), non più come effetto collaterale di un sesso
  // capovolto.
  //
  // Nota concettuale: con riproduzione sessuata (due genitori) il numero di
  // PERCORSI genealogici cresce come 2^generazioni — enumerarli tutti per un
  // individuo a molte generazioni di distanza non è mai possibile né
  // interessante. Il numero di NODI DISTINTI, invece, resta limitato dalla
  // popolazione complessiva mai esistita (cioè dalla lunghezza di questo
  // stesso array): in una popolazione finita gli antenati si ripetono quasi
  // subito, esattamente come nei pedigree umani reali. Questo registro basta
  // quindi a risalire un numero ragionevole di generazioni per un individuo
  // alla volta, camminando all'indietro tramite gli id dei genitori.
  exportGenealogy() {
    const individui = new Array(this.nextId);
    for (const [id, record] of this.registry) {
      individui[id] = [
        record.generation,
        record.parentIds ? record.parentIds[0] : null,
        record.parentIds ? record.parentIds[1] : null,
        record.founderArea,
        this.areas.map((area) => Number((record.proportions[area] || 0).toFixed(4))),
        record.outOfGroupUnion,
        record.dominantShift,
        record.sex,
        record.lineageId,
        record.motherId,
        record.matrilineBroken,
        record.patrilineageId,
        record.fatherId,
        record.patrilineBroken,
        record.lhonCarrier,
        record.srySwyerCondition,
      ];
    }
    return {
      aree: this.areas,
      marcatori_totali: this.numMarkers,
      schema: [
        'generazione',
        'genitoreA_id',
        'genitoreB_id',
        'area_fondatore',
        'proporzioni',
        'unione_fuori_gruppo',
        'area_dominante_diversa_dai_genitori',
        'sesso',
        'linea_materna_id',
        'madre_id',
        'linea_materna_interrotta',
        'linea_paterna_id',
        'padre_id',
        'linea_paterna_interrotta',
        'linea_materna_lhon',
        'sindrome_swyer',
      ],
      individui,
    };
  }

  // Quante linee materne distinte hanno ancora la possibilità di
  // continuare nella popolazione ATTUALE (non nel registro storico, che le
  // conserva tutte per sempre). Conta solo tra le FEMMINE, non tra tutti
  // gli individui: lineageId viene assegnato a ogni figlio, maschio o
  // femmina, ma solo una figlia può ritrasmetterlo in futuro (vedi
  // reproduce/motherCandidate). Una linea portata ormai solo da maschi è
  // già estinta a tutti gli effetti — nessuno di loro potrà mai
  // trasmetterla — anche se non è ancora sparita "visivamente" dalla
  // popolazione; è lo stesso motivo per cui, in una genealogia reale, la
  // linea materna di una donna che ha avuto solo figli maschi si interrompe
  // con lei, non quando quei figli a loro volta scompaiono. Ogni
  // generazione, alcune femmine non vengono scelte come madri da pickOther,
  // altre lo sono ma non generano alcuna figlia (o le loro figlie a loro
  // volta non la ritrasmettono più avanti): in entrambi i casi la linea si
  // estingue per sempre in quel punto. In una popolazione finita questo
  // numero può solo calare o restare uguale nel tempo, mai risalire, e
  // converge con probabilità 1 verso 1 sola linea sopravvissuta se la
  // simulazione va avanti abbastanza a lungo (lo stesso fenomeno della "Eva
  // mitocondriale" reale).
  //
  // Usato da R20 (vedi buildFromFreshSimulation in NewCaseSetup.jsx) per un
  // dato di contesto narrativo mostrato a inizio partita, non come indizio
  // sull'assassino — è un fatto sull'intera popolazione, non su un singolo
  // individuo.
  countSurvivingLineages() {
    const lineages = new Set();
    for (const ind of this.population) {
      if (ind.sex === 'F' && ind.lineageId !== null) lineages.add(ind.lineageId);
    }
    return lineages.size;
  }

  // Simmetrico a countSurvivingLineages, ma per la linea paterna: conta solo
  // tra i MASCHI, dato che solo un figlio maschio può ritrasmettere il
  // cromosoma Y. Stessa proprietà: può solo calare o restare uguale nel
  // tempo, mai risalire, e converge con probabilità 1 verso 1 sola linea
  // sopravvissuta (l'equivalente paterno dell'"Eva mitocondriale" è a volte
  // chiamato "Adamo cromosomico-Y" nella letteratura reale).
  //
  // Esclude esplicitamente chi ha la sindrome di Swyer (srySwyerCondition):
  // pur avendo sesso='M' e patrilineageId tracciabile, è tipicamente
  // infertile nella realtà — e ora che l'infertilità è modellata
  // esplicitamente in evolveOneGeneration (non più come effetto collaterale
  // di un sesso capovolto), anche questo conteggio deve escluderlo a parte,
  // altrimenti mostrerebbe una linea come "ancora viva" quando in pratica
  // non può più proseguire.
  countSurvivingPatrilineages() {
    const lines = new Set();
    for (const ind of this.population) {
      if (ind.sex === 'M' && ind.srySwyerCondition !== true && ind.patrilineageId !== null) {
        lines.add(ind.patrilineageId);
      }
    }
    return lines.size;
  }
}
