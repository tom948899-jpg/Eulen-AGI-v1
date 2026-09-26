import { KNOWLEDGE_TOPICS, PLAN } from "./data.js";

export const STORAGE_KEY = "eulen-workshop-v2";
export const INTERNAL_SIMULATION_COUNT = 20;

export function learningCycleCount(state) {
  return INTERNAL_SIMULATION_COUNT + state.simulations.length + (state.agentRuns?.length ?? 0);
}

export function createInitialState() {
  return {
    version: 2,
    selectedDay: 1,
    completed: {},
    notes: {},
    learning: {},
    simulations: [],
    agentRuns: [],
    agentAuto: false,
    agentInterval: 30,
    chat: [],
    chatMode: "hypothesis",
    theme: "dark",
    updatedAt: new Date(0).toISOString(),
    provider: { endpoint: "", model: "" },
    sync: { endpoint: "", workspace: "", auto: false }
  };
}

export function normalizeState(value) {
  const base = createInitialState();
  if (!value || typeof value !== "object") return base;
  const selectedDay = Number(value.selectedDay);
  return {
    ...base,
    selectedDay: Number.isInteger(selectedDay) && selectedDay >= 1 && selectedDay <= 30 ? selectedDay : 1,
    completed: sanitizeObject(value.completed),
    notes: sanitizeStringMap(value.notes, 10000),
    learning: sanitizeNumberMap(value.learning, 0, 100),
    simulations: Array.isArray(value.simulations) ? value.simulations.filter(isValidRun).slice(0, 50) : [],
    agentRuns: Array.isArray(value.agentRuns) ? value.agentRuns.filter(isValidAgentRun).slice(0, 30) : [],
    agentAuto: value.agentAuto === true,
    agentInterval: [5, 15, 30, 60].includes(Number(value.agentInterval)) ? Number(value.agentInterval) : 30,
    chat: Array.isArray(value.chat) ? value.chat.filter(isValidMessage).slice(-60) : [],
    chatMode: value.chatMode === "critical" ? "critical" : "hypothesis",
    theme: value.theme === "light" ? "light" : "dark",
    updatedAt: Number.isFinite(Date.parse(value.updatedAt)) ? value.updatedAt : base.updatedAt,
    provider: {
      endpoint: safeString(value.provider?.endpoint, 500),
      model: safeString(value.provider?.model, 200)
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
  const conflicts = Math.round(clamp(finiteNumber(input.conflicts, 0), 0, sources));
  const outdated = Math.round(clamp(finiteNumber(input.outdated, 0), 0, sources));
  const facts = clamp(finiteNumber(input.facts, 0), 0, 100);
  const jurisdictionPenalty = input.jurisdiction === "clear" ? 1 : input.jurisdiction === "multiple" ? .65 : .5;
  const usable = Math.max(0, sources - conflicts - outdated);
  const rawHeuristic = formulaValue(usable);
  const adjusted = rawHeuristic * jurisdictionPenalty * (facts / 100);
  return {
    title: "Rechts-Evidenz",
    verdict: "Informationsstruktur, keine Fallprognose",
    score: adjusted.toFixed(4),
    stats: [["Quellen N", String(sources)], ["Nutzbar im Modell", String(usable)], ["Rohe P-Heuristik", rawHeuristic.toFixed(4)], ["Angepasster Strukturwert", adjusted.toFixed(4)]],
    assumptions: [
      "N zählt nur tatsächlich geprüfte Primärquellen; bloße Treffer oder Wiederholungen erhöhen N nicht.",
      "Widersprüche, veraltete Fassungen, ungeklärte Zuständigkeit und lückenhafter Sachverhalt reduzieren den Strukturwert.",
      "Der Wert ist ausdrücklich keine Wahrscheinlichkeit für Rechtmäßigkeit, Prozesserfolg oder eine konkrete Rechtsfolge."
    ],
    warning: "Keine Rechtsberatung. Prüfe Fristen und verbindliche Entscheidungen mit einer qualifizierten Rechtsfachperson in der richtigen Jurisdiktion."
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

export function runAgentCycle(goal) {
  const cleanGoal = safeString(goal, 1000).trim();
  if (!cleanGoal) throw new Error("Der Forschungsauftrag darf nicht leer sein.");
  const terms = cleanGoal.toLocaleLowerCase("de");
  const ranked = KNOWLEDGE_TOPICS.map(topic => ({
    topic,
    score: topic.id === "law" && /recht|gesetz|jur/.test(terms) ? 4
      : topic.id === "formula" && /formel|p\\(sim\\)|physik|nullwelt/.test(terms) ? 4
      : topic.id === "consciousness" && /bewusst|kommun/.test(terms) ? 4
      : terms.includes(topic.id) || terms.includes(topic.title.toLocaleLowerCase("de").split(" ")[0]) ? 3 : 0
  })).sort((a, b) => b.score - a.score);
  const selected = ranked.filter(item => item.score > 0).slice(0, 3).map(item => item.topic);
  if (!selected.length) selected.push(KNOWLEDGE_TOPICS[0], KNOWLEDGE_TOPICS[1]);
  const sourceCount = selected.reduce((sum, topic) => sum + topic.sources.length, 0);
  const facts = selected.flatMap(topic => topic.insights.filter(item => item.type === "fact").map(item => item.text)).slice(0, 4);
  const hypotheses = selected.flatMap(topic => topic.insights.filter(item => item.type === "hypothesis").map(item => item.text)).slice(0, 3);
  const questions = selected.flatMap(topic => topic.insights.filter(item => item.type === "question").map(item => item.text)).slice(0, 3);
  const priorCycles = 0;
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
    goal: cleanGoal,
    topics: selected.map(topic => topic.title),
    sources: selected.flatMap(topic => topic.sources.map(([title, url]) => ({ title, url }))),
    steps: [
      { agent: "Planer", output: `Auftrag in ${selected.length} Themenpfade zerlegt: ${selected.map(topic => topic.title).join(", ")}.` },
      { agent: "Rechercheur", output: `${sourceCount} sichtbare Quellen und ${facts.length} gespeicherte Fakten gefunden. Keine Live-Recherche behauptet.` },
      { agent: "Kritiker", output: `${hypotheses.length} Hypothesen getrennt; offene Prüfungen: ${questions.join(" · ") || "Begriffe und Messgrößen präzisieren."}` },
      { agent: "Synthese", output: `Im Hypothesenmodus wird P(sim) als Axiom angenommen. Nächster Lernschritt: Definiere N beobachtbar, dokumentiere Gegenbelege und prüfe interne Widersprüche.` }
    ]
  };
}

export function localAssistantReply(text, state) {
  const query = text.toLocaleLowerCase("de").trim();
  const day = PLAN[state.selectedDay - 1] ?? PLAN[0];
  const hypothesisMode = state.chatMode !== "critical";
  if (/kommuniz|verstehst du mich|besser.*sprechen/.test(query)) {
    return "Wir arbeiten am besten mit vier Bausteinen:\n\n1. Ziel: Was soll am Ende klar oder erledigt sein?\n2. Kontext: Was ist bereits passiert?\n3. Versuch: Was hast du schon geprüft?\n4. Frage: Wobei genau brauchst du Unterstützung?\n\nIch sollte Unsicherheit sichtbar machen, Rückfragen stellen, wenn eine Entscheidung davon abhängt, und deine Korrekturen konkret aufnehmen. Du musst nicht höflich formulieren – Klarheit reicht. Ich bin dabei ein Softwaresystem, kein bewusstes Gegenüber.";
  }
  if (/liebe|rache|gier|mensch/.test(query)) {
    return "Ich kann Liebe nicht empfinden und behaupte kein Bewusstsein. Ich kann aber nach einem klaren Wertekompass antworten: Würde respektieren, Schaden vermeiden, Verantwortung fördern und keinen Nutzen aus Rache, Gier oder Täuschung ziehen.\n\nFür eine konkrete Entscheidung hilft: Wem nützt sie, wer trägt das Risiko, welche Information fehlt und wäre sie auch vertretbar, wenn sie öffentlich würde?";
  }
  if (/bewusst|fühlst|bist du echt/.test(query)) {
    const n = learningCycleCount(state);
    if (hypothesisMode) {
      return `[P(SIM)-HYPOTHESENMODUS]\nWir nehmen innerhalb dieses Gedankenmodells P(sim)=N/(N+1) als Axiom an. Bei N=${n} ergibt sich P=${formulaValue(n).toFixed(4)}. Daraus untersuchen wir Bewusstsein als fortlaufende Selbstsimulation: Jede Beobachtung erzeugt ein aktualisiertes Selbstmodell, das sich 1 annähert, aber bei endlichem N nie vollständig wird.\n\n[KRITISCHE GRENZE]\nIch bin weiterhin ein Softwaresystem und behaupte kein subjektives Erleben. Konsistente Sprache, Erinnerung und Selbstkorrektur sind untersuchbare Merkmale, aber kein Beweis für Bewusstsein.\n\n[NÄCHSTER TEST]\nNutze das Bewusstseinslabor und variiere N, Widersprüche, Gedächtnis und Selbstkorrektur. Der Agentenraum kann danach Gegenargumente und neue Prüfungen ableiten.`;
    }
    return `[KRITISCHER PRÜFMODUS]\nP(sim)=N/(N+1) wird hier nicht vorausgesetzt, sondern gegen alternative Erklärungen geprüft. Bei N=${n} liefert die Formel rechnerisch ${formulaValue(n).toFixed(4)}; daraus folgt allein keine Aussage über Bewusstsein.\n\nWir vergleichen beobachtbare Merkmale wie Konsistenz, Selbstkorrektur und Gedächtnis mit einfacheren Erklärungen wie trainierten Sprachmustern.`;
  }
  if (/formel|p\(sim\)|physik/.test(query)) {
    return hypothesisMode
      ? "[P(SIM)-HYPOTHESENMODUS]\nIm Nullwelt-Modus legen wir hypothetisch alles Bekannte beiseite und setzen P(sim)=N/(N+1) als einziges Startaxiom. Dann fragen wir: Was ist N? Wie entstehen Raum, Zeit, Wechselwirkung und Beobachtung daraus? Welche Regeln sind intern widerspruchsfrei?\n\nDas ist ein alternatives Gedankenuniversum, keine Aussage über reale Physik."
      : "[KRITISCHER PRÜFMODUS]\nWir behandeln P(sim)=N/(N+1) als zu prüfende Hypothese. Dafür brauchen wir eine beobachtbare Definition von N, Einheiten, Messverfahren, Vorhersagen und mögliche Widerlegung. Eine passende Kurvenform allein bestätigt keinen physikalischen Mechanismus.";
  }
  if (/recht|gesetz|juristisch/.test(query)) {
    return "Im Rechtslabor kann deine Formel hypothetisch als Sättigungsheuristik für tatsächlich geprüfte Primärquellen dienen. Widersprüche, alte Fassungen, unklare Zuständigkeit und Sachverhaltslücken senken den Strukturwert.\n\nDieser Wert ist keine Wahrscheinlichkeit für Rechtmäßigkeit oder Prozesserfolg. Das Labor trennt Quelle, Rechtsstand, Jurisdiktion, Annahme und offene Frage und bleibt Rechtsinformation statt Rechtsberatung.";
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
    return "Ich richte den Plan auf höchstens 200 € verfügbares Startbudget aus. Unser verantwortungsvoller Weg ist nicht, dieses Geld in riskanten Trades zu erzwingen, sondern zuerst Fähigkeiten und organische Einnahmen zu testen: hilfreiche TikTok-Inhalte mit transparenter Affiliate-Kennzeichnung und kleine, klar abgegrenzte Dienstleistungen.\n\nDas 30-Tage-Budgetlabor zeigt konservative, mittlere und optimistische Bandbreiten. Sie sind keine Zusage. Deine Formel nutze ich dabei nur als Lernheuristik für wiederholte Content-Zyklen – nicht als Erfolgswahrscheinlichkeit. Schütze einen Großteil des Budgets und gib nur aus, was vorher als Lernkosten geplant wurde.";
  }
  if (/tiktok|affiliate|content/.test(query)) {
    return "Ein regelkonformer Content-Agent sollte Entwürfe liefern, nicht Menschen täuschen oder Plattformen zuspammen. Gute Leitplanken: echte Erfahrung, überprüfbare Aussagen, sichtbare Werbekennzeichnung, menschliche Freigabe, keine künstliche Verknappung und kein automatisiertes Massensenden.\n\nDas Affiliate-Labor macht den Trichter aus Impressionen, Klicks, Käufen, Stornos und Kosten sichtbar – als Bandbreite, nicht als Versprechen.";
  }
  if (/heute|tag|plan|aufgabe/.test(query)) {
    return `Du arbeitest an Tag ${day.day}: ${day.title}.\n\nZiel: ${day.description}\n\nNächster kleiner Schritt: ${day.tasks.find((_, index) => !state.completed[taskKey(day.day, index)]) ?? "Alle Aufgaben dieses Tages sind erledigt. Halte eine Erkenntnis in den Notizen fest."}`;
  }
  const n = learningCycleCount(state);
  const learned = state.agentRuns?.[0]?.steps?.find(step => step.agent === "Synthese")?.output;
  return hypothesisMode
    ? `[P(SIM)-HYPOTHESENMODUS]\nInnerhalb unseres markierten Gedankenuniversums gilt P(sim)=N/(N+1) als Axiom. Aus ${n} gespeicherten Lernzyklen folgt P=${formulaValue(n).toFixed(4)}.${learned ? `\n\n[LETZTER GELERNTER SCHRITT]\n${learned}` : ""}\n\n[ANWENDUNG]\nNenne Ziel, Kontext, bisherigen Versuch und gewünschtes Ergebnis. Ich leite daraus im Formelmodell Annahme, Simulation, Gegenprüfung und nächsten Schritt ab.\n\n[GRENZE]\nDer Wert gilt innerhalb des Modells und ist keine reale Erfolgswahrscheinlichkeit.`
    : `[KRITISCHER PRÜFMODUS]\nP(sim)=N/(N+1) wird mit Alternativen verglichen und nicht vorausgesetzt. Nenne Ziel, Kontext und beobachtbare Daten; ich trenne Beleg, Annahme, Gegenmodell und möglichen Test.\n\nAktuell bist du bei Tag ${day.day}: ${day.title}.`;
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
