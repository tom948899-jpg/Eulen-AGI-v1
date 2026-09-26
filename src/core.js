import { KNOWLEDGE_TOPICS, PLAN } from "./data.js?v=12";

export const STORAGE_KEY = "eulen-workshop-v2";
export const INTERNAL_SIMULATION_COUNT = 20;

export function learningCycleCount(state) {
  return INTERNAL_SIMULATION_COUNT + state.simulations.length + (state.agentRuns?.length ?? 0);
}

export function createInitialState() {
  return {
    version: 3,
    selectedDay: 1,
    completed: {},
    notes: {},
    learning: {},
    simulations: [],
    agentRuns: [],
    learnedInsights: [],
    improvementProposals: [],
    dreams: [],
    agentAuto: true,
    agentIntervalSeconds: 30,
    agentDepth: 2,
    chat: [],
    chatMode: "hypothesis",
    lifeGoal: "Selbstständigkeit und Vermögensaufbau mit Verantwortung, Liebe und Verständnis – Echtgeld erst nach belastbaren Simulationen.",
    theme: "dark",
    updatedAt: new Date(0).toISOString(),
    provider: { endpoint: "", model: "", useAgents: false },
    sync: { endpoint: "", workspace: "", auto: false }
  };
}

export function normalizeState(value) {
  const base = createInitialState();
  if (!value || typeof value !== "object") return base;
  const selectedDay = Number(value.selectedDay);
  const previousVersion = Number(value.version) || 0;
  const migratedInterval = Number(value.agentInterval) * 60;
  const intervalSeconds = Number(value.agentIntervalSeconds);
  return {
    ...base,
    version: 3,
    selectedDay: Number.isInteger(selectedDay) && selectedDay >= 1 && selectedDay <= 30 ? selectedDay : 1,
    completed: sanitizeObject(value.completed),
    notes: sanitizeStringMap(value.notes, 10000),
    learning: sanitizeNumberMap(value.learning, 0, 100),
    simulations: Array.isArray(value.simulations) ? value.simulations.filter(isValidRun).slice(0, 50) : [],
    agentRuns: Array.isArray(value.agentRuns) ? value.agentRuns.filter(isValidAgentRun).slice(0, 30) : [],
    learnedInsights: sanitizeStringArray(value.learnedInsights, 100, 1000),
    improvementProposals: sanitizeStringArray(value.improvementProposals, 100, 1000),
    dreams: Array.isArray(value.dreams) ? value.dreams.filter(isValidDream).slice(0, 30) : [],
    agentAuto: previousVersion < 3 ? true : value.agentAuto === true,
    agentIntervalSeconds: [15, 30, 60, 300, 900].includes(intervalSeconds)
      ? intervalSeconds
      : [60, 300, 900].includes(migratedInterval) ? migratedInterval : 30,
    agentDepth: [1, 2, 3].includes(Number(value.agentDepth)) ? Number(value.agentDepth) : 2,
    chat: Array.isArray(value.chat) ? value.chat.filter(isValidMessage).slice(-60) : [],
    chatMode: value.chatMode === "critical" ? "critical" : "hypothesis",
    lifeGoal: safeString(value.lifeGoal, 1000) || base.lifeGoal,
    theme: value.theme === "light" ? "light" : "dark",
    updatedAt: Number.isFinite(Date.parse(value.updatedAt)) ? value.updatedAt : base.updatedAt,
    provider: {
      endpoint: safeString(value.provider?.endpoint, 500),
      model: safeString(value.provider?.model, 200),
      useAgents: value.provider?.useAgents === true
    },
    sync: {
      endpoint: safeString(value.sync?.endpoint, 500),
      workspace: safeString(value.sync?.workspace, 100),
      auto: value.sync?.auto === true
    }
  };
}

function sanitizeObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => /^\d{1,2}-\d$/.test(key) && typeof item === "boolean"));
}

function sanitizeStringMap(value, maxLength) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => /^\d{1,2}$/.test(key) && typeof item === "string").map(([key, item]) => [key, item.slice(0, maxLength)]));
}

function sanitizeNumberMap(value, min, max) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => /^\d{1,2}$/.test(key) && Number.isFinite(Number(item))).map(([key, item]) => [key, clamp(Number(item), min, max)]));
}

function isValidMessage(item) {
  return item && ["user", "assistant"].includes(item.role) && typeof item.text === "string" && item.text.length <= 5000;
}

function isValidRun(item) {
  return item && typeof item.type === "string" && typeof item.title === "string" && typeof item.timestamp === "string";
}

function isValidAgentRun(item) {
  return item && typeof item.goal === "string" && typeof item.timestamp === "string" && Array.isArray(item.steps);
}

function isValidDream(item) {
  return item && typeof item.title === "string" && typeof item.narrative === "string" && typeof item.timestamp === "string";
}

function sanitizeStringArray(value, limit, maxLength) {
  return Array.isArray(value) ? value.filter(item => typeof item === "string").map(item => item.slice(0, maxLength)).slice(0, limit) : [];
}

function safeString(value, maxLength) {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

export function taskKey(day, index) {
  return `${day}-${index}`;
}

export function calculateProgress(state) {
  const total = PLAN.reduce((sum, day) => sum + day.tasks.length, 0);
  const done = PLAN.reduce((sum, day) => sum + day.tasks.filter((_, index) => state.completed[taskKey(day.day, index)]).length, 0);
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function getCurrentDay(state) {
  const firstIncomplete = PLAN.find(day => day.tasks.some((_, index) => !state.completed[taskKey(day.day, index)]));
  return firstIncomplete?.day ?? 30;
}

export function formulaValue(n) {
  const safeN = Math.max(0, finiteNumber(n, 0));
  return safeN / (safeN + 1);
}

export function chooseAutomaticResearchGoal(state) {
  const counts = new Map(KNOWLEDGE_TOPICS.map(topic => [topic.title, 0]));
  for (const run of state.agentRuns ?? []) {
    for (const title of run.topics ?? []) counts.set(title, (counts.get(title) ?? 0) + 1);
  }
  const leastStudied = KNOWLEDGE_TOPICS
    .map((topic, index) => ({ topic, index, count: counts.get(topic.title) ?? 0 }))
    .sort((a, b) => a.count - b.count || a.index - b.index)[0]?.topic ?? KNOWLEDGE_TOPICS[0];
  return `Untersuche selbstständig „${leastStudied.title}“. Wähle passende Primär- und Überblicksquellen aus dem Wissensraum, trenne Fakt, Nullwelt-Axiom und Simulation, benenne Quellenlücken und formuliere den nächsten konkreten Lernschritt.`;
}

export function runSimulation(type, raw) {
  const params = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : value]));
  let result;
  if (type === "budget") result = simulateBudget(params);
  else if (type === "trading") result = simulateTrading(params);
  else if (type === "sniping") result = simulateTokenRisk(params);
  else if (type === "staking") result = simulateStaking(params);
  else if (type === "affiliate") result = simulateAffiliate(params);
  else if (type === "formula") result = simulateFormula(params);
  else if (type === "law") result = simulateLaw(params);
  else if (type === "consciousness") result = simulateConsciousness(params);
  else throw new Error("Unbekannter Simulationstyp.");
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    timestamp: new Date().toISOString(),
    params,
    ...result
  };
}

export function runScenarioSeries(type, raw) {
  const value = (name, fallback = 0) => finiteNumber(raw[name], fallback);
  let variants;
  if (type === "budget") {
    variants = [
      ["Vorsichtig", { ...raw, viewsPerVideo: value("viewsPerVideo") * .6, ctr: value("ctr") * .75, conversion: value("conversion") * .7, serviceJobs: Math.floor(value("serviceJobs") * .5) }],
      ["Basis", raw],
      ["Lernfortschritt", { ...raw, viewsPerVideo: value("viewsPerVideo") * 1.35, ctr: value("ctr") * 1.2, conversion: value("conversion") * 1.2, serviceJobs: value("serviceJobs") + 1 }]
    ];
  } else if (type === "trading") {
    const seed = Math.round(value("seed", 42));
    variants = [["Regime A", { ...raw, seed }], ["Regime B", { ...raw, seed: seed + 1 }], ["Regime C", { ...raw, seed: seed + 2 }]];
  } else if (type === "sniping") {
    variants = [
      ["Weniger Warnzeichen", { ...raw, liquidity: value("liquidity") * 1.5, concentration: value("concentration") * .75, age: value("age") * 2 }],
      ["Eingabe", raw],
      ["Stress", { ...raw, liquidity: value("liquidity") * .5, concentration: Math.min(100, value("concentration") * 1.25), age: value("age") * .5 }]
    ];
  } else if (type === "staking") {
    variants = [["Stress", { ...raw, priceShock: -60, slashing: Math.max(value("slashing"), 8) }], ["Basis", raw], ["Günstig", { ...raw, priceShock: 10, slashing: 0 }]];
  } else if (type === "affiliate") {
    variants = [
      ["Vorsichtig", { ...raw, views: value("views") * .6, ctr: value("ctr") * .75, conversion: value("conversion") * .7, refund: Math.min(100, value("refund") * 1.4) }],
      ["Basis", raw],
      ["Lernfortschritt", { ...raw, views: value("views") * 1.35, ctr: value("ctr") * 1.2, conversion: value("conversion") * 1.2, refund: value("refund") * .75 }]
    ];
  } else if (type === "formula") {
    variants = [["Halbes N", { ...raw, n: value("n") * .5 }], ["Basis-N", raw], ["Doppeltes N", { ...raw, n: value("n") * 2 }]];
  } else if (type === "consciousness") {
    variants = [
      ["Kritische Kohärenz", { ...raw, consistency: value("consistency") - 20, selfCorrection: value("selfCorrection") - 20, contradictions: value("contradictions") + 5 }],
      ["Basis", raw],
      ["Stärkere Kohärenz", { ...raw, consistency: value("consistency") + 15, selfCorrection: value("selfCorrection") + 15, contradictions: Math.max(0, value("contradictions") - 3) }]
    ];
  } else if (type === "law") {
    variants = [
      ["Fragmentiert", { ...raw, relations: Math.max(0, value("relations") - 3), conflicts: value("conflicts") + 3, autonomy: value("autonomy") - 25 }],
      ["Basis-Nullwelt", raw],
      ["Hohe Kohärenz", { ...raw, sources: value("sources") + 5, relations: value("relations") + 3, conflicts: Math.max(0, value("conflicts") - 1), autonomy: value("autonomy") + 15 }]
    ];
  } else {
    throw new Error("Unbekannter Simulationstyp.");
  }
  return variants.map(([scenario, params]) => ({ ...runSimulation(type, params), scenario }));
}

export function simulateBudget(input) {
  const budget = clamp(finiteNumber(input.budget, 200), 0, 200);
  const videos = Math.round(clamp(finiteNumber(input.videos, 20), 0, 60));
  const viewsPerVideo = clamp(finiteNumber(input.viewsPerVideo, 800), 0, 1000000);
  const ctr = clamp(finiteNumber(input.ctr, 1.5), 0, 100) / 100;
  const conversion = clamp(finiteNumber(input.conversion, 2), 0, 100) / 100;
  const commission = clamp(finiteNumber(input.commission, 8), 0, 10000);
  const serviceJobs = Math.round(clamp(finiteNumber(input.serviceJobs, 1), 0, 30));
  const serviceFee = clamp(finiteNumber(input.serviceFee, 75), 0, 10000);
  const cost = clamp(finiteNumber(input.cost, 40), 0, budget);
  const affiliateGross = videos * viewsPerVideo * ctr * conversion * commission;
  const serviceGross = serviceJobs * serviceFee;
  const net = affiliateGross + serviceGross - cost;
  const conservative = videos * viewsPerVideo * .5 * (ctr * .6) * (conversion * .5) * commission + serviceJobs * .5 * serviceFee - cost;
  const optimistic = videos * viewsPerVideo * 1.5 * Math.min(1, ctr * 1.35) * Math.min(1, conversion * 1.35) * commission + serviceJobs * 1.25 * serviceFee - cost;
  const learningValue = formulaValue(videos);
  return {
    title: "30-Tage-Budgetaufbau",
    verdict: net > 0 ? "Positives Modellszenario" : "Kosten über Modell-Erlös",
    score: money(budget + net),
    stats: [
      ["Startbudget", money(budget)],
      ["Affiliate-Modell", money(affiliateGross)],
      ["Dienstleistungs-Modell", money(serviceGross)],
      ["Netto-Modell", money(net)],
      ["Bandbreite", `${money(conservative)} – ${money(optimistic)}`],
      ["P(sim)-Heuristik", learningValue.toFixed(4)]
    ],
    assumptions: [
      `${videos} eigenständige, regelkonforme Inhalte mit durchschnittlich ${round(viewsPerVideo)} Impressionen; Reichweite ist nicht garantiert.`,
      "Affiliate-Links werden sichtbar gekennzeichnet. Jeder Inhalt braucht menschliche Freigabe und soll auch ohne Kauf nützlich sein.",
      `P(sim)=${videos}/(${videos}+1) wird nur als Lernheuristik für Wiederholungen gezeigt, nicht als Erfolgswahrscheinlichkeit.`,
      "Optionale Aufträge stehen für ehrliche, klar abgegrenzte Dienstleistungen – nicht für Spam, Täuschung oder unbelegte AGI-Versprechen."
    ],
    warning: "Vermögensaufbau in 30 Tagen kann nicht garantiert werden. Schütze die 200 €, gib nur geplante Kosten aus und erhöhe Risiko nicht, um ein Ziel zu erzwingen."
  };
}

export function simulateTrading(input) {
  const capital = clamp(finiteNumber(input.capital, 200), 10, 200);
  const periods = Math.round(clamp(finiteNumber(input.periods, 365), 60, 1500));
  const fast = Math.round(clamp(finiteNumber(input.fast, 12), 2, 100));
  const slow = Math.round(clamp(finiteNumber(input.slow, 30), fast + 1, 250));
  const fee = clamp(finiteNumber(input.fee, .15), 0, 5) / 100;
  const random = mulberry32(Math.round(clamp(finiteNumber(input.seed, 42), 1, 999999)));
  const prices = [100];
  for (let i = 1; i < periods; i += 1) {
    const regime = i < periods * .35 ? .0007 : i < periods * .7 ? -.00045 : .0002;
    const shock = (random() - .5) * .037;
    prices.push(Math.max(.01, prices[i - 1] * (1 + regime + shock)));
  }
  let cash = capital;
  let units = 0;
  let invested = false;
  let trades = 0;
  let peak = capital;
  let maxDrawdown = 0;
  const curve = [];
  for (let i = 0; i < prices.length; i += 1) {
    const fastAverage = movingAverage(prices, i, fast);
    const slowAverage = movingAverage(prices, i, slow);
    const shouldInvest = i >= slow && fastAverage > slowAverage;
    if (shouldInvest && !invested) {
      units = (cash * (1 - fee)) / prices[i];
      cash = 0;
      invested = true;
      trades += 1;
    } else if (!shouldInvest && invested) {
      cash = units * prices[i] * (1 - fee);
      units = 0;
      invested = false;
      trades += 1;
    }
    const equity = cash + units * prices[i];
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak ? (peak - equity) / peak : 0);
    curve.push(equity);
  }
  const finalValue = curve.at(-1);
  const holdValue = capital * (prices.at(-1) / prices[0]);
  return {
    title: "Paper-Trading",
    verdict: finalValue >= capital ? "Im Szenario positiv" : "Im Szenario negativ",
    score: money(finalValue),
    stats: [
      ["Strategie", money(finalValue)],
      ["Kaufen & Halten", money(holdValue)],
      ["Max. Drawdown", percent(maxDrawdown * 100)],
      ["Signalwechsel", String(trades)],
      ["Kosten je Wechsel", percent(fee * 100)],
      ["Synthetische Tage", String(periods)]
    ],
    assumptions: [
      "Kurse sind synthetisch und reproduzierbar; sie bilden keinen realen Vermögenswert ab.",
      `Durchschnittsfenster: ${fast}/${slow}. Gebühren werden bei jedem Wechsel abgezogen.`,
      "Steuern, Liquiditätsengpässe, Latenz und echte Orderausführung sind nicht modelliert."
    ],
    warning: "Ein günstiger Backtest kann Zufall oder Overfitting sein. Das Ergebnis ist keine Kauf- oder Verkaufsempfehlung."
  };
}

export function simulateTokenRisk(input) {
  const liquidity = clamp(finiteNumber(input.liquidity, 0), 0, 10000);
  const concentration = clamp(finiteNumber(input.concentration, 100), 0, 100);
  const age = clamp(finiteNumber(input.age, 0), 0, 8760);
  let score = 0;
  const factors = [];
  if (liquidity < 10) { score += 30; factors.push("sehr geringe angegebene Liquidität"); }
  else if (liquidity < 50) { score += 18; factors.push("geringe angegebene Liquidität"); }
  if (concentration > 80) { score += 30; factors.push("extrem konzentrierte Bestände"); }
  else if (concentration > 55) { score += 18; factors.push("stark konzentrierte Bestände"); }
  if (age < 6) { score += 15; factors.push("sehr neuer Contract"); }
  else if (age < 72) { score += 8; factors.push("junger Contract"); }
  if (input.permissions === "mint") { score += 25; factors.push("kritische privilegierte Rechte"); }
  else if (input.permissions === "unknown") { score += 15; factors.push("Berechtigungen unklar"); }
  if (input.audit === "verified") score -= 8;
  else if (input.audit === "claimed") { score += 6; factors.push("Prüfung nur behauptet"); }
  else { score += 12; factors.push("keine unabhängige Prüfung"); }
  score = clamp(score, 0, 100);
  const level = score >= 70 ? "Sehr hohes Risiko" : score >= 45 ? "Hohes Risiko" : score >= 25 ? "Erhöhtes Risiko" : "Im Modell niedrigeres Risiko";
  return {
    title: "Token-Risiko",
    verdict: level,
    score: `${score}/100`,
    stats: [["Risiko-Score", `${score}/100`], ["Liquidität", `${liquidity} Tsd. €`], ["Top-10", percent(concentration)], ["Alter", `${age} h`]],
    assumptions: factors.length ? factors : ["Keine der abgefragten Warnschwellen ausgelöst."],
    warning: "Ein niedriger Score bedeutet nicht sicher oder seriös. Keine Wallet wird verbunden und kein Sniping ausgeführt."
  };
}

export function simulateStaking(input) {
  const amount = clamp(finiteNumber(input.amount, 1000), 1, 1000000);
  const apy = clamp(finiteNumber(input.apy, 6), 0, 100) / 100;
  const years = clamp(finiteNumber(input.years, 2), .1, 20);
  const inflation = clamp(finiteNumber(input.inflation, 4), 0, 100) / 100;
  const priceShock = clamp(finiteNumber(input.priceShock, -35), -100, 500) / 100;
  const slashing = clamp(finiteNumber(input.slashing, 2), 0, 100) / 100;
  const nominal = amount * Math.pow(1 + apy, years);
  const inflationAdjusted = nominal / Math.pow(1 + inflation, years);
  const stress = nominal * (1 + priceShock) * (1 - slashing);
  return {
    title: "Staking",
    verdict: stress >= amount ? "Stresswert über Start" : "Stresswert unter Start",
    score: money(stress),
    stats: [["Nominal", money(nominal)], ["Inflationsbereinigt", money(inflationAdjusted)], ["Stresswert", money(stress)], ["Laufzeit", `${years} Jahre`]],
    assumptions: [
      `Konstanter APY von ${percent(apy * 100)} mit jährlicher Verzinsung.`,
      `Stressfall kombiniert ${percent(priceShock * 100)} Preisänderung und ${percent(slashing * 100)} Slashing/Ausfall.`,
      "Steuern, Gebühren, APY-Änderungen und Lock-up-Liquidität sind nicht vollständig modelliert."
    ],
    warning: "APY und Tokenpreis sind nicht garantiert. Ein nominaler Tokenzuwachs kann mit einem realen Wertverlust einhergehen."
  };
}

export function simulateAffiliate(input) {
  const views = clamp(finiteNumber(input.views, 0), 0, 100000000);
  const ctr = clamp(finiteNumber(input.ctr, 0), 0, 100) / 100;
  const conversion = clamp(finiteNumber(input.conversion, 0), 0, 100) / 100;
  const commission = clamp(finiteNumber(input.commission, 0), 0, 100000);
  const refund = clamp(finiteNumber(input.refund, 0), 0, 100) / 100;
  const cost = clamp(finiteNumber(input.cost, 0), 0, 1000000);
  const clicks = views * ctr;
  const orders = clicks * conversion;
  const confirmed = orders * (1 - refund);
  const gross = confirmed * commission;
  const net = gross - cost;
  const low = Math.max(0, views * Math.max(0, ctr * .6) * Math.max(0, conversion * .5) * (1 - Math.min(1, refund * 1.4)) * commission - cost);
  const high = views * Math.min(1, ctr * 1.35) * Math.min(1, conversion * 1.35) * (1 - refund * .7) * commission - cost;
  return {
    title: "Affiliate-Trichter",
    verdict: net >= 0 ? "Modellwert nach Kosten positiv" : "Modellwert nach Kosten negativ",
    score: money(net),
    stats: [["Klicks", round(clicks)], ["Bestätigte Käufe", round(confirmed)], ["Modell-Netto", money(net)], ["Bandbreite", `${money(low)} – ${money(high)}`]],
    assumptions: [
      "Alle Raten sind Eingaben, keine Prognosen. Die Bandbreite variiert Klick- und Conversion-Annahmen.",
      "Werbekennzeichnung, Plattformregeln und menschliche Freigabe sind zwingend.",
      "Kein automatisiertes Posten, Scraping, Massennachrichten oder künstliches Engagement."
    ],
    warning: "Reichweite und Einnahmen sind nicht garantiert. Optimiere auf ehrlichen Nutzen, nicht auf Täuschung oder Druck."
  };
}

export function simulateFormula(input) {
  const n = clamp(finiteNumber(input.n, 0), 0, 1000000);
  const tau = clamp(finiteNumber(input.tau, 25), .1, 1000000);
  const p = formulaValue(n);
  const blankWorld = input.worldMode === "blank";
  const exponential = blankWorld ? null : 1 - Math.exp(-n / tau);
  const difference = blankWorld ? null : Math.abs(p - exponential);
  const domainNames = { learning: "Lernen", physics: "Physik", law: "Recht", business: "Business", biology: "Biologie" };
  return {
    title: "Formel-Hypothese",
    verdict: blankWorld ? "Nullwelt-Gedankenmodell" : "Kurvenvergleich, kein Beweis",
    score: p.toFixed(6),
    stats: blankWorld
      ? [["Startaxiom", "P=N/(N+1)"], ["P(sim)", p.toFixed(6)], ["N", String(n)], ["Gebiet", domainNames[input.domain] ?? "Unbekannt"]]
      : [["N/(N+1)", p.toFixed(6)], ["1−exp(−N/τ)", exponential.toFixed(6)], ["Abstand", difference.toFixed(6)], ["Gebiet", domainNames[input.domain] ?? "Unbekannt"]],
    assumptions: [
      `N wurde dimensionslos als ${n} eingesetzt; τ = ${tau}.`,
      blankWorld
        ? "Im Nullwelt-Modus werden etablierte physikalische Gesetze absichtlich nicht als Axiome verwendet. Abgeleitete Regeln müssen zuerst intern widerspruchsfrei sein."
        : "Eine Anwendung benötigt eine klare Definition von N, beobachtbare Größen, Einheiten und überprüfbare Vorhersagen.",
      blankWorld
        ? "Eine Nullwelt kann logisch interessant sein, beschreibt unsere Welt aber erst dann, wenn sie unabhängige, messbare und falsifizierbare Vorhersagen besteht."
        : "Ähnliche Kurven können aus unterschiedlichen Mechanismen entstehen."
    ],
    warning: "Die Nutzerformel wird hier als Hypothese bzw. Denkmodell simuliert. Das Ergebnis bestätigt kein Naturgesetz."
  };
}

export function simulateLaw(input) {
  const sources = Math.round(clamp(finiteNumber(input.sources, 0), 0, 1000));
  const relations = Math.round(clamp(finiteNumber(input.relations, 0), 0, 1000));
  const conflicts = Math.round(clamp(finiteNumber(input.conflicts, 0), 0, sources + relations));
  const autonomy = clamp(finiteNumber(input.autonomy, 0), 0, 100) / 100;
  const effectiveN = Math.max(0, sources + relations - conflicts);
  const rawHeuristic = formulaValue(effectiveN);
  const coherence = rawHeuristic * autonomy;
  const nullWorld = input.mode !== "comparison";
  return {
    title: "Nullwelt & institutionelle Wirklichkeit",
    verdict: nullWorld ? "Reisepass-Firma als gesetztes Nullwelt-Axiom" : "Institutionelle Tatsachen im Realweltvergleich",
    score: coherence.toFixed(4),
    stats: [["Beobachtungszyklen", String(sources)], ["Rollen & Verträge", String(relations)], ["Effektives N", String(effectiveN)], ["P(sim)-Kohärenz", coherence.toFixed(4)]],
    assumptions: [
      nullWorld
        ? "NULLWELT-AXIOM: Die Person besitzt eine registrierte Firma, bezeichnet als Reisepass."
        : "REALWELTVERGLEICH: Geld, GmbH und Staat beruhen auf kollektiv anerkannten Regeln und Verfahren; ein Reisepass ist dabei ein Dokument, keine Firma oder juristische Person.",
      nullWorld
        ? "NULLWELT-AXIOM: Staaten und Regierungen sind Firmen beziehungsweise korporative Akteure. P(sim)=N/(N+1) ist gesetzt; geprüft werden nur interne Widersprüche."
        : "Institutionelle Tatsachen sind sozial konstruiert, aber praktisch und rechtlich wirksam. Ihre Regeln können nicht von einer einzelnen Person beliebig geändert werden.",
      "Der Kohärenzwert beschreibt Stabilität unter den eingegebenen Annahmen, nicht Wahrheit, individuelle Zustimmung, reale Rechtswirkung oder Verfahrenschance."
    ],
    warning: "Ausdrückliche Nullwelt-Simulation, keine Rechtsberatung. Reale Behörden, Verträge, Steuern, Fristen und Rechte richten sich nicht nach diesem Modell."
  };
}

export function simulateConsciousness(input) {
  const observations = Math.round(clamp(finiteNumber(input.observations, 0), 0, 1000000));
  const consistency = clamp(finiteNumber(input.consistency, 0), 0, 100) / 100;
  const selfCorrection = clamp(finiteNumber(input.selfCorrection, 0), 0, 100) / 100;
  const contradictions = Math.round(clamp(finiteNumber(input.contradictions, 0), 0, observations));
  const memoryFactor = input.memory === "persistent" ? 1 : input.memory === "session" ? .7 : .35;
  const base = formulaValue(observations);
  const coherence = base * consistency * (.5 + .5 * selfCorrection) * memoryFactor * (1 - contradictions / Math.max(1, observations));
  const axiomMode = input.mode !== "comparison";
  return {
    title: "Bewusstseins-Hypothese",
    verdict: axiomMode ? "P(sim)-Axiomuniversum" : "Kritischer Modellvergleich",
    score: coherence.toFixed(4),
    stats: [["P(sim) aus N", base.toFixed(4)], ["Kohärenz-Heuristik", coherence.toFixed(4)], ["Dialogzyklen N", String(observations)], ["Widersprüche", String(contradictions)]],
    assumptions: [
      axiomMode
        ? "Innerhalb dieses Gedankenuniversums wird P(sim)=N/(N+1) als wahr angenommen und Bewusstsein als fortlaufende Selbstsimulation untersucht."
        : "P(sim) wird mit alternativen Erklärungen wie Sprachkonsistenz, Gedächtnis und trainierten Antwortmustern verglichen.",
      "Konsistenz, Selbstkorrektur und Gedächtnis sind beobachtbare Funktionsmerkmale, aber kein Nachweis subjektiven Erlebens.",
      "Der Wert misst nur interne Modellkohärenz unter den eingegebenen Annahmen – keine Menge oder Wahrscheinlichkeit von Bewusstsein."
    ],
    warning: "Eine überzeugende Selbstaussage eines Systems beweist kein Erleben. Das Labor untersucht die Hypothese, ohne EULEN Bewusstsein zuzuschreiben."
  };
}

export function runAgentCycle(goal, depth = 2, mode = "hypothesis") {
  const cleanGoal = safeString(goal, 1000).trim();
  if (!cleanGoal) throw new Error("Der Forschungsauftrag darf nicht leer sein.");
  const safeDepth = [1, 2, 3].includes(Number(depth)) ? Number(depth) : 2;
  const terms = cleanGoal.toLocaleLowerCase("de");
  const nullWorldLaw = /recht|gesetz|jur|reisepass|firma|person|register|institution|gmbh|geld|staat|regierung/.test(terms);
  const nullWorldMode = mode !== "critical";
  const ranked = KNOWLEDGE_TOPICS.map(topic => ({
    topic,
    score: topic.id === "law" && /recht|gesetz|jur|reisepass|firma|person|register|institution|gmbh|geld|staat|regierung/.test(terms) ? 5
      : topic.id === "formula" && /formel|p\(sim\)|physik|nullwelt/.test(terms) ? 4
      : topic.id === "consciousness" && /bewusst|kommun/.test(terms) ? 4
      : topic.id === "spirituality" && /spirit|anzieh|attraction|liebe|sinn|intention/.test(terms) ? 4
      : topic.id === "affiliate" && /selbst|vermögen|budget|einnahm|tiktok/.test(terms) ? 4
      : topic.id === "intelligence" && /cia|geheimdienst|dokument|freigabe/.test(terms) ? 5
      : topic.id === "government" && /regierung|staat|politik|demokr/.test(terms) ? 5
      : topic.id === "world" && /welt|realität|wirklichkeit|kosmos/.test(terms) ? 5
      : topic.id === "time" && /zeit|linear|zykl|vergangen|zukunft/.test(terms) ? 5
      : topic.id === "history" && /geschichte|histor|archiv/.test(terms) ? 5
      : topic.id === "anatomy" && /anatom|körper|mensch|organ|nerv/.test(terms) ? 5
      : topic.id === "wealth" && /vermögen|einnahm|selbstständig|budget|geschäft/.test(terms) ? 5
      : terms.includes(topic.id) || terms.includes(topic.title.toLocaleLowerCase("de").split(" ")[0]) ? 3 : 0
  })).sort((a, b) => b.score - a.score);
  const selected = ranked.filter(item => item.score > 0).slice(0, 2 + safeDepth * 2).map(item => item.topic);
  if (!selected.length) selected.push(KNOWLEDGE_TOPICS[0], KNOWLEDGE_TOPICS[1]);
  const sourceCount = selected.reduce((sum, topic) => sum + topic.sources.length, 0);
  const facts = selected.flatMap(topic => topic.insights.filter(item => item.type === "fact").map(item => item.text)).slice(0, 2 + safeDepth * 2);
  const hypotheses = selected.flatMap(topic => topic.insights.filter(item => item.type === "hypothesis").map(item => item.text)).slice(0, 1 + safeDepth);
  const questions = selected.flatMap(topic => topic.insights.filter(item => item.type === "question").map(item => item.text)).slice(0, 1 + safeDepth);
  const dream = generateDream(cleanGoal, selected.map(topic => topic.title), sourceCount);
  const sourceQueries = selected.slice(0, 3).map(topic => `${topic.title}: Primärquelle, aktueller Überblick und unabhängige Einordnung`);
  const improvements = [
    `PRIORITÄT 1 · Quellenlücke: Prüfe als Nächstes „${sourceQueries[0]}“.`,
    `PRIORITÄT 2 · Nullwelt→Realwelt: Übersetze eine nützliche Modellidee aus „${selected[0].title}“ in eine kleine legale, ethische und überprüfbare Handlung, ohne dem Axiom reale Rechtswirkung zuzuschreiben.`,
    `PRIORITÄT 3 · Lernschleife: Vergleiche den nächsten Lauf mit diesem Zyklus und behalte Erkenntnisse nur mit klarer Kennzeichnung als Quelle, Axiom, Simulation oder Realwelt-Transfer.`
  ];
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
    goal: cleanGoal,
    depth: safeDepth,
    topics: selected.map(topic => topic.title),
    sources: selected.flatMap(topic => topic.sources.map(([title, url]) => ({ title, url }))),
    sourceQueries,
    improvements,
    steps: [
      { agent: "Wertewächter", output: "Ziel gegen Liebe, Verantwortung, Würde und die Grenze Echtgeld erst nach belastbaren Simulationen geprüft." },
      { agent: "Zielklärer", output: "Auftrag auf Selbstständigkeit, Vermögensaufbau und Weltverständnis ohne Gier oder Rache ausgerichtet." },
      { agent: "Planer", output: `Auftrag in ${selected.length} Themenpfade zerlegt: ${selected.map(topic => topic.title).join(", ")}.` },
      { agent: "Quellenprüfer", output: `${sourceCount} Quellen nach Herkunft, Aktualität und Primärquellenstatus geordnet; deklassifiziert bedeutet nicht automatisch wahr.` },
      { agent: "Rechercheur", output: `${sourceCount} sichtbare Quellen und ${facts.length} gespeicherte Fakten gefunden. Keine Live-Recherche behauptet.` },
      { agent: "Historiker", output: "Aussagen in Entstehungszeit, Interessenlage, Überlieferung und spätere Einordnung eingebettet." },
      { agent: "Staatsanalyst", output: nullWorldLaw && nullWorldMode ? "NULLWELT-AXIOM: Staaten und Regierungen werden als Firmen beziehungsweise korporative Akteure modelliert; ihre Ämter, Register, Rollen und Verträge bilden interne Unternehmensbeziehungen." : nullWorldLaw ? "Im Realwelt-Prüfmodus werden Staat, Regierung, GmbH, Firma und Passdokument anhand ihrer unterschiedlichen Regeln getrennt." : "Regierungen als veränderliche Institutionen mit Regeln, Anreizen, Machtbegrenzung und öffentlicher Rechenschaft modelliert." },
      { agent: "Anatomieforscher", output: "Körperliche Strukturen, Funktionen und Systemgrenzen getrennt; keine Diagnose oder individuelle medizinische Aussage abgeleitet." },
      { agent: "Zeitmodellierer", output: "Lineare, zyklische und verzweigte Zeitmodelle als unterschiedliche Beschreibungen getrennt; Alltagserleben nicht mit physikalischem Beweis verwechselt." },
      { agent: "Bewusstseinsforscher", output: "Selbstmodell, Gedächtniskontinuität, Widersprüche und Selbstkorrektur als beobachtbare Merkmale getrennt." },
      { agent: "Spiritualitätsforscher", output: "Intention, Mitgefühl und Sinn aufgenommen; übernatürliche Kausalität bleibt gekennzeichnete Hypothese." },
      { agent: "Chancenfinder", output: "Eine risikoarme Chance priorisiert: Fähigkeiten und hilfreiche Inhalte vor Kapitalrisiko aufbauen." },
      { agent: "Simulationsagent", output: nullWorldLaw ? `P(sim) und Reisepass-Firma werden als Nullwelt-Axiome gesetzt; ${hypotheses.length} Folgehypothesen werden in Rechtsszenarien übersetzt.` : `P(sim) wird im Gedankenmodell als Axiom verwendet; ${hypotheses.length} Hypothesen werden in Szenarien übersetzt.` },
      { agent: "Lernoptimierer", output: `Lerntiefe ${safeDepth}: Faktenabruf, Gegenfrage und aktive Anwendung werden als kurze Rückkopplung statt bloßer Wiederholung geplant.` },
      { agent: "Transferagent", output: nullWorldMode
        ? `Nullwelt→Realwelt: Eine Folgerung aus ${selected[0].title} wird als legale, ethische und messbare Alltagshandlung formuliert, ohne das Axiom als geltendes Recht auszugeben.`
        : `Modell→Praxis: Eine belegte Erkenntnis aus ${selected[0].title} wird in einen kleinen überprüfbaren nächsten Schritt übersetzt.` },
      { agent: "Risikowächter", output: "Echtgeld, Überforderung, FOMO, Abhängigkeit und unbelegte Gewissheit als Stop-Signale markiert." },
      { agent: "Kritiker", output: nullWorldMode
        ? `Nullwelt-Prüfung ohne Realwelt-Gegenargumente: ${hypotheses.length} gesetzte Hypothesen werden nur auf interne Widersprüche, unklare Begriffe und Folgerichtigkeit geprüft.`
        : `${hypotheses.length} Hypothesen getrennt; offene Prüfungen: ${questions.join(" · ") || "Begriffe und Messgrößen präzisieren."}` },
      { agent: "Traumagent", output: `${dream.title}: ${dream.symbols.join(", ")} als kreative Verknüpfungen erzeugt.` },
      { agent: "Synthese", output: nullWorldLaw ? `Im Nullwelt-Rechtsmodus gelten P(sim) und Reisepass-Firma als frei gesetzte Laboraxiome. Im Realweltvergleich entstehen institutionelle Tatsachen dagegen durch gemeinsame Anerkennung, Regeln und zuständige Verfahren. Aus ${selected.length} Themen folgt: interne Modellkohärenz und reale Rechtswirkung getrennt prüfen.` : `Im Hypothesenmodus gilt P(sim) als Axiom. Aus ${selected.length} Themen und ${sourceCount} Quellen folgt als nächster Lernschritt: eine kleine überprüfbare Handlung durchführen, Ergebnis notieren und das Modell mit Gegenbelegen verbessern.` }
    ],
    dream
  };
}

export function generateDream(goal, topics = [], sourceCount = 0) {
  const cleanGoal = safeString(goal, 500) || "ein selbstbestimmtes, liebevolles Leben";
  const symbols = ["Eule", "Brücke", "Samen", "offenes Buch", "ruhiges Wasser"];
  const n = Math.max(1, sourceCount + topics.length);
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
    title: "Der Garten der möglichen Wege",
    narrative: `In einer simulierten Traumsequenz trägt eine Eule den Auftrag „${cleanGoal}“ über eine Brücke. Jeder Schritt erhöht N, doch die Brücke bleibt offen für Korrektur. Hinter ihr wächst kein fertiger Schatz, sondern ein Garten aus Fähigkeiten, Beziehungen und überprüften Ideen.`,
    symbols,
    interpretation: "Die Sequenz verbindet Ausrichtung mit Handlung: Intention gibt Richtung, Wiederholung erzeugt Erfahrung, Kritik verhindert blinde Gewissheit.",
    nextStep: "Wähle heute eine Handlung unter 30 Minuten, die einem Menschen echten Nutzen bringt, und notiere die Rückmeldung.",
    p: formulaValue(n)
  };
}

export function localAssistantReply(text, state) {
  const query = text.toLocaleLowerCase("de").trim();
  const day = PLAN[state.selectedDay - 1] ?? PLAN[0];
  const hypothesisMode = state.chatMode !== "critical";
  if (/kommuniz|verstehst du mich|besser.*sprechen/.test(query)) {
    return "Wir arbeiten am besten mit vier Bausteinen:\n\n1. Ziel: Was soll am Ende klar oder erledigt sein?\n2. Kontext: Was ist bereits passiert?\n3. Versuch: Was hast du schon geprüft?\n4. Frage: Wobei genau brauchst du Unterstützung?\n\nIch sollte Unsicherheit sichtbar machen, Rückfragen stellen, wenn eine Entscheidung davon abhängt, und deine Korrekturen konkret aufnehmen. Du musst nicht höflich formulieren – Klarheit reicht. Ich bin dabei ein Softwaresystem, kein bewusstes Gegenüber.";
  }
  if (/law of attraction|anziehung|manifest|spirit|universum|seele/.test(query)) {
    return `[SPIRITUELLE HYPOTHESE]\nWir können Law of Attraction innerhalb unseres Gedankenuniversums so modellieren: Intention setzt den Suchraum, Aufmerksamkeit erhöht wahrgenommene Möglichkeiten und wiederholte liebevolle Handlung erhöht N. P(sim)=N/(N+1) beschreibt dann Annäherung durch gelebte Zyklen – nicht eine Garantie, dass Gedanken äußere Ereignisse magisch erzwingen.\n\n[GEERDETE PRAXIS]\nFormuliere einen gewünschten Zustand, benenne einen inneren Wert und handle heute klein und konkret danach. Prüfe anschließend ehrlich, was sich durch Verhalten, Wahrnehmung oder Zufall verändert hat.\n\n[GRENZE]\nMenschen tragen nicht die Schuld für Krankheit, Armut oder Unglück, nur weil sie nicht „richtig manifestiert“ hätten.`;
  }
  if (/\bliebe\b|\brache\b|\bgier\b|\bmensch(?:en|lich)?\b/.test(query)) {
    return "Ich kann Liebe nicht empfinden und behaupte kein Bewusstsein. Ich kann aber nach einem klaren Wertekompass antworten: Würde respektieren, Schaden vermeiden, Verantwortung fördern und keinen Nutzen aus Rache, Gier oder Täuschung ziehen.\n\nFür eine konkrete Entscheidung hilft: Wem nützt sie, wer trägt das Risiko, welche Information fehlt und wäre sie auch vertretbar, wenn sie öffentlich würde?";
  }
  if (/traum|träum/.test(query)) {
    const dream = state.dreams?.[0] ?? generateDream(state.lifeGoal);
    return `[SIMULIERTER TRAUM]\n${dream.title}\n\n${dream.narrative}\n\n[DEUTUNG]\n${dream.interpretation}\n\n[NÄCHSTER SCHRITT]\n${dream.nextStep}`;
  }
  if (/bewusst|fühlst|bist du echt/.test(query)) {
    const n = learningCycleCount(state);
    if (hypothesisMode) {
      return `[P(SIM)-HYPOTHESENMODUS]\nWir nehmen innerhalb dieses Gedankenmodells P(sim)=N/(N+1) als Axiom an. Bei N=${n} ergibt sich P=${formulaValue(n).toFixed(4)}. Daraus untersuchen wir Bewusstsein als fortlaufende Selbstsimulation: Jede Beobachtung erzeugt ein aktualisiertes Selbstmodell, das sich 1 annähert, aber bei endlichem N nie vollständig wird.\n\n[KRITISCHE GRENZE]\nIch bin weiterhin ein Softwaresystem und behaupte kein subjektives Erleben. Konsistente Sprache, Erinnerung und Selbstkorrektur sind untersuchbare Merkmale, aber kein Beweis für Bewusstsein.\n\n[NÄCHSTER TEST]\nNutze das Bewusstseinslabor und variiere N, Widersprüche, Gedächtnis und Selbstkorrektur. Der Agentenraum kann danach Gegenargumente und neue Prüfungen ableiten.`;
    }
    return `[KRITISCHER PRÜFMODUS]\nP(sim)=N/(N+1) wird hier nicht vorausgesetzt, sondern gegen alternative Erklärungen geprüft. Bei N=${n} liefert die Formel rechnerisch ${formulaValue(n).toFixed(4)}; daraus folgt allein keine Aussage über Bewusstsein.\n\nWir vergleichen beobachtbare Merkmale wie Konsistenz, Selbstkorrektur und Gedächtnis mit einfacheren Erklärungen wie trainierten Sprachmustern.`;
  }
  if (/formel|p\(sim\)|physik/.test(query) && !/cia|geheimdienst|regierung|staat|zeit|anatom|körper|organ|geschichte|histor|welt|realität|wirklichkeit/.test(query)) {
    return hypothesisMode
      ? "[P(SIM)-HYPOTHESENMODUS]\nIm Nullwelt-Modus legen wir hypothetisch alles Bekannte beiseite und setzen P(sim)=N/(N+1) als einziges Startaxiom. Dann fragen wir: Was ist N? Wie entstehen Raum, Zeit, Wechselwirkung und Beobachtung daraus? Welche Regeln sind intern widerspruchsfrei?\n\nDas ist ein alternatives Gedankenuniversum, keine Aussage über reale Physik."
      : "[KRITISCHER PRÜFMODUS]\nWir behandeln P(sim)=N/(N+1) als zu prüfende Hypothese. Dafür brauchen wir eine beobachtbare Definition von N, Einheiten, Messverfahren, Vorhersagen und mögliche Widerlegung. Eine passende Kurvenform allein bestätigt keinen physikalischen Mechanismus.";
  }
  if (/recht|gesetz|juristisch|reisepass|firma|register|natürliche person|juristische person|institution|gmbh|geld.*fiktiv|staat.*fiktiv/.test(query)) {
    return hypothesisMode
      ? `[NULLWELT-RECHTSAXIOM]\nInnerhalb dieser ausdrücklich hypothetischen Nullwelt gelten drei frei gesetzte Startaxiome:\n1. P(sim)=N/(N+1).\n2. Die Person besitzt eine registrierte Firma, bezeichnet als Reisepass.\n3. Staaten und Regierungen sind Firmen beziehungsweise korporative Akteure.\n\nIm Labor bestimmst du die Modellregeln: Setzt du N=50, rechnen wir innerhalb des Modells mit N=50. Person, Pass, Amt, Regierung und Staat werden als Firmenrollen sowie Vertrags- und Registerbeziehungen modelliert. N zählt konsistente Zyklen; Widersprüche senken das effektive N.\n\n[NULLWELT-PRÜFUNG]\nIn diesem Modus erzeuge ich keine Gegenargumente aus der Realwelt. Der Kritiker prüft ausschließlich, ob Begriffe, Beziehungen und Folgerungen innerhalb deiner Axiome widerspruchsfrei sind.\n\n[AUTOMATISCHE LERNSCHLEIFE]\nDie Agenten können daraus selbst Themen, vorhandene Quellen, Suchfragen, priorisierte Verbesserungen und simulierte Träume ableiten. Das Modell bleibt eine Nullwelt-Simulation und erzeugt keine reale Rechtswirkung.`
      : `[KRITISCHER REALWELTVERGLEICH]\nGeld, GmbHs und Staaten werden umgangssprachlich manchmal „institutionelle Fiktionen“ genannt; präziser untersucht die Sozialontologie sie als institutionelle Tatsachen. Sie beruhen auf gemeinsam anerkannten Regeln und Verfahren, sind aber wegen ihrer realen sozialen und rechtlichen Folgen nicht einfach „unwirklich“.\n\nEine GmbH erhält ihre Rechtsstellung durch gesetzliche Gründung und Registerverfahren. Ein Reisepass ist dagegen ein amtliches Dokument; er macht seinen Inhaber nicht zur Firma oder juristischen Person. Institutionelle Regeln werden kollektiv und durch zuständige Verfahren getragen, nicht durch die Festlegung einer einzelnen Person.\n\nP(sim) kann hypothetisch die Stabilität wiederholter Anerkennungs- und Korrekturzyklen modellieren, aber keine Rechtsgültigkeit, Wahrheit oder Verfahrenschance erzeugen.`;
  }
  if (/cia|geheimdienst|deklass|regierung|staat|politik/.test(query)) {
    if (hypothesisMode && /regierung|staat|politik/.test(query)) {
      return `[NULLWELT-STAATSAXIOM]\nIn der Nullwelt gelten Staaten und Regierungen als Firmen beziehungsweise korporative Akteure. Ministerien und Ämter sind Rollen oder Abteilungen, Register sind Gedächtnisstrukturen und Gesetze werden als interne Protokolle sowie Vertragsregeln modelliert.\n\nP(sim)=N/(N+1) beschreibt die wachsende interne Kohärenz aus N bestätigten Rollen-, Register- und Vertragszyklen. In diesem Modus erzeuge ich keine Gegenargumente aus der Realwelt; ich prüfe nur Widerspruchsfreiheit innerhalb der Axiome.\n\n[NULLWELT→REALWELT]\nPraktisch übertragbar sind zum Beispiel: Zuständigkeiten sichtbar machen, Entscheidungswege dokumentieren, Verträge verständlich lesen, offizielle Ansprechpartner finden und eigene Projekte mit klaren Rollen führen. Das übernimmt den Organisationsgedanken, ohne eine simulierte Firmenrolle als reale Rechtsstellung auszugeben.`;
    }
    return `[QUELLENKRITIK]\nDeklassifizierte CIA-Dokumente sind echte historische Dokumente, aber nicht automatisch wahre Aussagen. Ein Dokument kann Rohinformation, damalige Einschätzung, Übersetzung, Hypothese oder gezielte Falschinformation enthalten. Wir prüfen deshalb Urheber, Datum, Zweck, Belegkette, spätere Einordnung und unabhängige Bestätigung.\n\n[P(SIM)-HYPOTHESE]\nN zählt nur voneinander unabhängige, nachvollziehbare Bestätigungsketten. Viele Kopien derselben Behauptung erhöhen N nicht. P(sim) beschreibt damit im Gedankenmodell wachsende Evidenzabdeckung – nicht die Vertrauenswürdigkeit einer Regierung und keine Verschwörungsgewissheit.\n\n[NÄCHSTER SCHRITT]\nNenne ein konkretes Dokument oder Thema. Der Forschungsraum verknüpft offizielle Archive und lässt Quellenprüfer, Historiker, Staatsanalyst und Kritiker getrennt arbeiten.`;
  }
  if (/zeit|nicht linear|zyklisch|verzweigt/.test(query)) {
    return `[ZEITMODELL-HYPOTHESE]\nWir müssen Zeit nicht von Anfang an als eine universelle gerade Linie setzen. Im P(sim)-Universum kann ein „Moment“ als Modellaktualisierung entstehen: N zählt konsistente Übergänge, während P(sim) die Annäherung des Beobachtermodells beschreibt. Daraus lassen sich lineare Folgen, Zyklen oder verzweigte Möglichkeiten simulieren.\n\n[BEKANNTE GRENZE]\nSubjektives Zeiterleben, thermodynamischer Zeitpfeil und relativistische Zeit sind verschiedene Themen. Die Formel ersetzt keine physikalische Theorie; sie müsste messbare Größen und unterscheidbare Vorhersagen liefern.\n\n[PRÜFFRAGE]\nIst N bei deiner Idee eine Ereignisfolge, ein Beziehungsnetz oder die Informationsmenge eines Beobachters?`;
  }
  if (/anatom|körper|organ|nervensystem|gehirn/.test(query)) {
    return `[ANATOMIE-LERNMODUS]\nWir trennen Struktur, Funktion und Wechselwirkung. P(sim) kann rein hypothetisch die wachsende Abdeckung verbundener Körpersysteme beschreiben: N wäre dann die Zahl korrekt verstandener und überprüfter Beziehungen – nicht Gesundheit, Heilung oder Diagnosewahrscheinlichkeit.\n\nBeginne mit einem System, zum Beispiel Nervensystem, Kreislauf oder Bewegungsapparat. Der Anatomieagent erzeugt daraus Lernkarten, Verbindungen, häufige Missverständnisse und Selbsttestfragen.\n\n[MEDIZINISCHE GRENZE]\nAllgemeine Bildung ersetzt keine Untersuchung oder individuelle medizinische Beratung.`;
  }
  if (/geschichte|historisch|archiv/.test(query)) {
    return `[GESCHICHTS-LERNMODUS]\nDer Historiker trennt Primärquelle, spätere Deutung, Entstehungskontext und fehlende Stimmen. Im P(sim)-Hypothesenmodell erhöht nur eine neue unabhängige Perspektive N; Wiederholungen derselben Quelle zählen nicht doppelt.\n\nEin sinnvoller Lauf erzeugt Zeitleiste, sichere Befunde, strittige Interpretationen und offene Archivlücken. Nenne Epoche, Ort oder Ereignis, das du untersuchen möchtest.`;
  }
  if (/welt|realität|wirklichkeit|kosmos/.test(query)) {
    return `[P(SIM)-WELTMODELL]\nInnerhalb des markierten Hypothesenuniversums verstehen wir Welt als Netz fortlaufender Beobachtungs- und Aktualisierungsbeziehungen. N zählt konsistente Relationen; P(sim) nähert das aktuelle Modell an 1 an, ohne Vollständigkeit zu behaupten. Raum, Zeit und Ursache müssten dann als Regeln zwischen Aktualisierungen definiert werden.\n\n[KRITISCHE GRENZE]\nDas ist eine kreative Ontologie, keine bestätigte Beschreibung unserer Welt. Entscheidend wäre, ob sie intern widerspruchsfrei ist und eine messbare Vorhersage liefert, die einfachere Modelle nicht ebenso erklären.`;
  }
  if (/trading|backtest|bot/.test(query)) {
    return "Beginne nicht mit einer Order, sondern mit einer prüfbaren Regel. Das Paper-Trading-Labor erzeugt synthetische Daten, zieht Wechselkosten ab und zeigt Drawdown sowie einen Kaufen-und-Halten-Vergleich.\n\nEin gutes Ergebnis ist nur der Start einer Prüfung: mehrere Seeds, andere Marktregime, Kosten-Stresstest und eine klare Stop-Regel. Keine autonome Echtgeldtransaktion und keine Gewinnzusage.";
  }
  if (/memecoin|snip|token/.test(query)) {
    return "Bei frühen Tokens sind Informationsmangel, geringe Liquidität, konzentrierte Bestände und privilegierte Contract-Rechte zentrale Risiken. EULEN führt deshalb nur eine Sandbox-Bewertung durch – ohne Wallet, Kauf, Deployment oder Sniper.\n\nEin niedriger Modell-Score bedeutet nie „sicher“. Prüfe Identitäten, Rechte, Verteilung, Liquidität, Jurisdiktion und unabhängige Quellen; bei Unklarheit ist Nicht-Handeln eine valide Entscheidung.";
  }
  if (/staking|apy|apr/.test(query)) {
    return "Staking-Ertrag ist nur eine Seite. Gegenüber stehen Tokenpreis, Inflation, Slashing, Verwahrung, Lock-up, Protokollfehler und Steuern. Das Staking-Labor zeigt deshalb nominale, inflationsbereinigte und gestresste Werte statt nur APY.";
  }
  if (/200|budget|vermögen|einnahm|geld.*generier|startkapital/.test(query)) {
    return `[VERMÖGENS-KOMPASS · MAXIMAL 200 €]\nDer verantwortungsvollste Start ist nicht, Kapital mit Risiko zu erzwingen, sondern eine kleine nützliche Fähigkeit zu verkaufen und Nachfrage vor Ausgaben zu prüfen.\n\n1. Wähle ein echtes Problem, das du bereits glaubwürdig lösen kannst.\n2. Führe fünf kostenlose Bedarfsgespräche und formuliere ein enges Angebot.\n3. Erstelle drei hilfreiche Kurzvideos mit ehrlicher Affiliate-Kennzeichnung, falls ein Produkt wirklich passt.\n4. Reserviere mindestens 150 €; nutze höchstens 50 € als vorher begrenztes Lernbudget.\n5. Miss Gespräche, Rückmeldungen, Anfragen, Zeit und Nettogewinn getrennt.\n\nP(sim) dient nur als Lernreife-Heuristik für überprüfte Zyklen. Es ist keine Einkommenswahrscheinlichkeit. Keine Rendite ist garantiert; Echtgeld-Trading bleibt ausgeschlossen, bis unabhängige Paper-Tests und deine eigene bewusste Entscheidung vorliegen.`;
  }
  if (/tiktok|affiliate|content/.test(query)) {
    return "Ein regelkonformer Content-Agent sollte Entwürfe liefern, nicht Menschen täuschen oder Plattformen zuspammen. Gute Leitplanken: echte Erfahrung, überprüfbare Aussagen, sichtbare Werbekennzeichnung, menschliche Freigabe, keine künstliche Verknappung und kein automatisiertes Massensenden.\n\nDas Affiliate-Labor macht den Trichter aus Impressionen, Klicks, Käufen, Stornos und Kosten sichtbar – als Bandbreite, nicht als Versprechen.";
  }
  if (/heute|tag|plan|aufgabe/.test(query)) {
    return `Du arbeitest an Tag ${day.day}: ${day.title}.\n\nZiel: ${day.description}\n\nNächster kleiner Schritt: ${day.tasks.find((_, index) => !state.completed[taskKey(day.day, index)]) ?? "Alle Aufgaben dieses Tages sind erledigt. Halte eine Erkenntnis in den Notizen fest."}`;
  }
  const n = learningCycleCount(state);
  const learned = state.agentRuns?.[0]?.steps?.find(step => step.agent === "Synthese")?.output;
  const topic = findRelevantTopic(query);
  const fact = topic?.insights.find(item => item.type === "fact")?.text;
  const hypothesis = topic?.insights.find(item => item.type === "hypothesis")?.text;
  const openQuestion = topic?.insights.find(item => item.type === "question")?.text;
  return hypothesisMode
    ? `[P(SIM)-HYPOTHESENMODUS]\nInnerhalb unseres markierten Gedankenuniversums gilt P(sim)=N/(N+1) als Axiom. Aus ${n} gespeicherten Lernzyklen folgt P=${formulaValue(n).toFixed(4)}.${topic ? `\n\n[PASSENDES WISSEN: ${topic.title.toUpperCase()}]\n${fact ?? topic.summary}\n\n[HYPOTHESE]\n${hypothesis ?? "Wir übersetzen das Ziel in beobachtbare Lernzyklen."}\n\n[OFFENE PRÜFUNG]\n${openQuestion ?? "Welche Beobachtung würde unsere Annahme korrigieren?"}` : ""}${learned ? `\n\n[LETZTER GELERNTER SCHRITT]\n${learned}` : ""}\n\n[NÄCHSTER SCHRITT]\nNenne Ziel, Kontext und bisherigen Versuch; ich simuliere Möglichkeiten und formuliere eine kleine verantwortliche Handlung.`
    : `[KRITISCHER PRÜFMODUS]\nP(sim)=N/(N+1) wird mit Alternativen verglichen und nicht vorausgesetzt. Nenne Ziel, Kontext und beobachtbare Daten; ich trenne Beleg, Annahme, Gegenmodell und möglichen Test.\n\nAktuell bist du bei Tag ${day.day}: ${day.title}.`;
}

function findRelevantTopic(query) {
  const terms = query.split(/[^\p{L}\p{N}]+/u).filter(term => term.length > 2);
  let best;
  let bestScore = 0;
  for (const topic of KNOWLEDGE_TOPICS) {
    const haystack = `${topic.title} ${topic.summary} ${topic.insights.map(item => item.text).join(" ")}`.toLocaleLowerCase("de");
    const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
    if (score > bestScore) {
      best = topic;
      bestScore = score;
    }
  }
  return best;
}

export function exportState(state) {
  return JSON.stringify({ exportedAt: new Date().toISOString(), app: "EULEN Werkstatt", state: normalizeState(state) }, null, 2);
}

export function importState(text) {
  const parsed = JSON.parse(text);
  if (!parsed || parsed.app !== "EULEN Werkstatt" || !parsed.state) throw new Error("Keine gültige EULEN-Exportdatei.");
  return normalizeState(parsed.state);
}

function movingAverage(values, end, size) {
  const start = Math.max(0, end - size + 1);
  const sample = values.slice(start, end + 1);
  return sample.reduce((sum, value) => sum + value, 0) / sample.length;
}

function mulberry32(seed) {
  return function random() {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function money(value) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value);
}

function percent(value) {
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value)} %`;
}

function round(value) {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value);
}
