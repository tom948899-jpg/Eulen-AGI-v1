import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateProgress,
  createInitialState,
  formulaValue,
  generateDream,
  importState,
  INTERNAL_SIMULATION_COUNT,
  learningCycleCount,
  localAssistantReply,
  normalizeState,
  runSimulation,
  runAgentCycle,
  simulateAffiliate,
  simulateBudget,
  simulateConsciousness,
  simulateFormula,
  simulateLaw,
  simulateStaking,
  simulateTokenRisk,
  simulateTrading,
  taskKey
} from "../src/core.js";

test("normalisiert beschädigten Zustand sicher", () => {
  const state = normalizeState({ selectedDay: 99, completed: { "1-0": true, nope: true }, chat: [{ role: "system", text: "x" }] });
  assert.equal(state.selectedDay, 1);
  assert.deepEqual(state.completed, { "1-0": true });
  assert.deepEqual(state.chat, []);
});

test("berechnet Planfortschritt aus allen Aufgaben", () => {
  const state = createInitialState();
  state.completed[taskKey(1, 0)] = true;
  const progress = calculateProgress(state);
  assert.equal(progress.done, 1);
  assert.equal(progress.total, 120);
  assert.equal(progress.percent, 1);
});

test("Formel bleibt für endliches N unter eins", () => {
  assert.equal(formulaValue(0), 0);
  assert.ok(formulaValue(1000000) < 1);
  assert.ok(formulaValue(100) > formulaValue(10));
});

test("Modell startet transparent mit 20 internen Referenzläufen", () => {
  assert.equal(INTERNAL_SIMULATION_COUNT, 20);
  assert.equal(learningCycleCount(createInitialState()), 20);
  assert.equal(formulaValue(learningCycleCount(createInitialState())).toFixed(4), "0.9524");
});

test("Trading-Simulation ist mit gleichem Seed reproduzierbar", () => {
  const input = { capital: 10000, periods: 365, fast: 12, slow: 30, fee: .15, seed: 42 };
  assert.deepEqual(simulateTrading(input), simulateTrading(input));
});

test("Trading-Simulation berücksichtigt Eingabegrenzen", () => {
  const result = simulateTrading({ capital: -1, periods: 2, fast: 100, slow: 3, fee: -10, seed: 1 });
  assert.equal(result.title, "Paper-Trading");
  assert.match(result.score, /€/);
  assert.equal(result.stats[5][1], "60");
});

test("Token-Risiken steigen bei kritischen Warnzeichen", () => {
  const low = simulateTokenRisk({ liquidity: 1000, concentration: 10, age: 1000, permissions: "none", audit: "verified" });
  const high = simulateTokenRisk({ liquidity: 1, concentration: 95, age: 1, permissions: "mint", audit: "none" });
  assert.ok(Number(high.score.split("/")[0]) > Number(low.score.split("/")[0]));
  assert.match(high.verdict, /Sehr hohes/);
});

test("Staking-Stressfall kann nominalen Gewinn relativieren", () => {
  const result = simulateStaking({ amount: 1000, apy: 6, years: 2, inflation: 4, priceShock: -50, slashing: 2 });
  assert.match(result.verdict, /unter Start/);
});

test("Affiliate-Simulation weist Bandbreite und Regeln aus", () => {
  const result = simulateAffiliate({ views: 10000, ctr: 2, conversion: 3, commission: 10, refund: 10, cost: 100 });
  assert.equal(result.title, "Affiliate-Trichter");
  assert.match(result.warning, /nicht garantiert/);
});

test("Budgetaufbau begrenzt das Startbudget und verspricht keinen Erfolg", () => {
  const result = simulateBudget({ budget: 10000, videos: 20, viewsPerVideo: 800, ctr: 1.5, conversion: 2, commission: 8, serviceJobs: 1, serviceFee: 75, cost: 40 });
  assert.equal(result.stats[0][1], "200,00 €");
  assert.match(result.warning, /nicht garantiert/);
  assert.match(result.assumptions.join(" "), /Lernheuristik/);
});

test("Formel-Simulation bezeichnet Ergebnis ausdrücklich nicht als Beweis", () => {
  const result = simulateFormula({ n: 50, tau: 25, domain: "physics" });
  assert.match(result.verdict, /kein Beweis/);
  assert.match(result.warning, /Hypothese/);
});

test("Nullwelt-Physik verwendet nur das Formelaxiom", () => {
  const result = simulateFormula({ n: 50, tau: 25, domain: "physics", worldMode: "blank" });
  assert.match(result.verdict, /Nullwelt/);
  assert.match(result.assumptions.join(" "), /nicht als Axiome/);
});

test("Rechtslabor liefert keine Fallprognose", () => {
  const result = simulateLaw({ sources: 8, conflicts: 2, outdated: 1, jurisdiction: "unclear", facts: 70 });
  assert.match(result.verdict, /keine Fallprognose/);
  assert.match(result.warning, /Keine Rechtsberatung/);
});

test("Agentenzyklus trennt Rollen und Quellen", () => {
  const result = runAgentCycle("Untersuche die Formel in Physik und Recht");
  assert.equal(result.steps.length, 18);
  assert.ok(result.sources.length >= 4);
  assert.ok(result.topics.includes("Recht & Evidenz"));
});

test("tiefer CIA-Lernauftrag nutzt Quellenkritik und offizielle Archive", () => {
  const result = runAgentCycle("Untersuche deklassifizierte CIA Dokumente und Regierungen", 3);
  assert.equal(result.depth, 3);
  assert.ok(result.topics.includes("CIA-Dokumente & Quellenkritik"));
  assert.ok(result.steps.some(step => step.agent === "Quellenprüfer"));
  assert.ok(result.sources.some(source => source.url.includes("cia.gov/readingroom")));
});

test("Zustand normalisiert Lerntiefe und schnelle Automatik", () => {
  const state = normalizeState({ agentDepth: 3, agentInterval: 1, provider: { endpoint: "https://api.groq.com/openai/v1/chat/completions", model: "openai/gpt-oss-120b", useAgents: true } });
  assert.equal(state.agentDepth, 3);
  assert.equal(state.agentInterval, 1);
  assert.equal(state.provider.useAgents, true);
});

test("Traumgenerator erzeugt kreative, geerdete nächste Schritte", () => {
  const dream = generateDream("Selbstständigkeit mit Liebe", ["Spiritualität"], 3);
  assert.match(dream.narrative, /Selbstständigkeit mit Liebe/);
  assert.match(dream.nextStep, /30 Minuten/);
  assert.ok(dream.p > 0 && dream.p < 1);
});

test("Bewusstseinslabor nimmt Formel nur im Hypothesenmodus als Axiom", () => {
  const result = simulateConsciousness({ observations: 50, consistency: 70, selfCorrection: 60, contradictions: 3, memory: "session", mode: "axiom" });
  assert.match(result.verdict, /Axiomuniversum/);
  assert.match(result.assumptions[0], /als wahr angenommen/);
  assert.match(result.warning, /kein Erleben/);
});

test("Assistent unterscheidet Hypothesen- und Prüfmodus", () => {
  const hypothesis = createInitialState();
  const critical = { ...createInitialState(), chatMode: "critical" };
  assert.match(localAssistantReply("Nutze meine Formel für Bewusstsein", hypothesis), /P\\(SIM\\)-HYPOTHESENMODUS/);
  assert.match(localAssistantReply("Nutze meine Formel für Bewusstsein", critical), /KRITISCHER PRÜFMODUS/);
});

test("Assistent trennt nichtlineare Zeit und Anatomie von bestätigter Wissenschaft", () => {
  const state = createInitialState();
  assert.match(localAssistantReply("Verstehe Zeit als nicht linear", state), /ZEITMODELL-HYPOTHESE/);
  assert.match(localAssistantReply("Nutze die Formel für Anatomie", state), /keine Diagnose/);
  assert.match(localAssistantReply("Was sagen CIA Dokumente?", state), /Deklassifizierte CIA-Dokumente/);
});

test("Assistent unterscheidet Regierungen vom eigenständigen Begriff Gier", () => {
  const state = createInitialState();
  assert.match(localAssistantReply("Was bedeuten Regierungen mit meiner Formel?", state), /QUELLENKRITIK/);
  assert.match(localAssistantReply("Wie vermeide ich Gier beim Geldverdienen?", state), /Wertekompass/);
});

test("runSimulation erzeugt persistierbaren Lauf", () => {
  const result = runSimulation("formula", { n: "10", tau: "5", domain: "learning" });
  assert.equal(result.type, "formula");
  assert.ok(result.id);
  assert.doesNotThrow(() => JSON.stringify(result));
});

test("Import weist fremde Dateien zurück", () => {
  assert.throws(() => importState('{"app":"fremd","state":{}}'), /gültige EULEN/);
});
