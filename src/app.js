import { KNOWLEDGE_TOPICS, PLAN, SIMULATION_DEFINITIONS } from "./data.js?v=20";
import {
  STORAGE_KEY,
  applyFormulaToDomain,
  buildActiveGuidance,
  buildOvernightReport,
  buildSystemFormulaMap,
  calculateProgress,
  chooseAutomaticResearchGoal,
  createInitialState,
  createOvernightSession,
  exportState,
  evolveLearningPolicy,
  formulaValue,
  generateDream,
  getCurrentDay,
  importState,
  incorporateDiscoveredSources,
  INTERNAL_SIMULATION_COUNT,
  integrateResearchLearning,
  learningCycleCount,
  normalizeState,
  overnightDueCycles,
  runScenarioSeries,
  runSimulation,
  taskKey
} from "./core.js?v=20";
import { discoverResearchSources, GROQ_ENDPOINT, GROQ_MODEL, LocalProvider, testProvider } from "./providers.js?v=20";
import { SyncProvider } from "./sync.js?v=20";
import { CloudAgentClient } from "./cloud.js?v=20";

let state = loadState();
let activeSimulation = "budget";
let activeTopic = KNOWLEDGE_TOPICS[0].id;
let saveTimer;
let syncInProgress = false;
let agentCycleInProgress = false;
let automationTickInProgress = false;
let syncTokenMemory = "";
let cloudStatusCache = null;
let cloudStatusInFlight = null;
const AUTOMATION_LOCK_KEY = "eulen-automation-lock";
const automationOwner = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
let installPrompt;
const stateChannel = "BroadcastChannel" in window ? new BroadcastChannel("eulen-state-v2") : null;
const networkActivity = { agent: "", task: "Wartet auf den nächsten Auftrag", detail: "20 interne Referenzläufe geladen.", working: false };

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const dateTime = value => new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

function loadState() {
  try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch { return createInitialState(); }
}

function saveState(touch = true) {
  if (touch) state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  stateChannel?.postMessage({ type: "state-updated", updatedAt: state.updatedAt });
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveState, 250);
}

function navigate(viewId) {
  $$(".view").forEach(view => view.classList.toggle("active", view.id === viewId));
  $$(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === viewId));
  history.replaceState(null, "", `#${viewId}`);
  $(`#${viewId}`)?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderAll() {
  document.documentElement.classList.toggle("light", state.theme === "light");
  renderDashboard();
  renderPlan();
  renderSimulationControls();
  renderHistory();
  renderResearch();
  renderAgents();
  renderChat();
  $("#chatMode").value = state.chatMode;
  $("#providerEndpoint").value = state.provider.endpoint || GROQ_ENDPOINT;
  $("#providerModel").value = state.provider.model || GROQ_MODEL;
  $("#providerStatus").textContent = state.provider.useAgents && state.provider.endpoint
    ? "Groq-Cloud-Routing aktiv (Schlüssel serverseitig verwaltet)."
    : "Noch kein Groq-Cloud-Routing verbunden · lokaler Modus aktiv.";
  renderCloudOps();
  $("#agentDepth").value = String(state.agentDepth);
  $("#researchDepth").value = String(state.agentDepth);
  $("#syncEndpoint").value = state.sync.endpoint;
  $("#syncWorkspace").value = state.sync.workspace;
  $("#syncAuto").checked = state.sync.auto;
  $("#lifeGoalText").textContent = state.lifeGoal;
}

function renderDashboard() {
  const progress = calculateProgress(state);
  const currentDay = getCurrentDay(state);
  const day = PLAN[currentDay - 1];
  $("#metricProgress").textContent = `${progress.percent} %`;
  $("#metricBar").style.width = `${progress.percent}%`;
  $("#metricDay").textContent = `Tag ${currentDay}`;
  $("#metricTopic").textContent = day.title;
  $("#metricNotes").textContent = Object.values(state.notes).filter(note => note.trim()).length;
  $("#metricRuns").textContent = state.simulations.length;
  const learningCycles = learningCycleCount(state);
  $("#formulaValue").textContent = `N = ${learningCycles} · P = ${formulaValue(learningCycles).toLocaleString("de-DE", { maximumFractionDigits: 4 })}`;
  $("#todayTitle").textContent = `Tag ${currentDay} · ${day.title}`;
  $("#todayDescription").textContent = day.description;
  $("#todayTasks").innerHTML = day.tasks.slice(0, 3).map((task, index) => taskMarkup(day.day, task, index)).join("");
  $("#todayTasks").querySelectorAll("input").forEach(input => input.addEventListener("change", onTaskChange));
  const guidance = buildActiveGuidance(state);
  $("#guidanceMode").textContent = state.chatMode === "critical" ? "PRÜFMODUS" : "HYPOTHESENMODUS";
  $("#guidanceMode").className = `badge ${state.chatMode === "critical" ? "fact" : "hypothesis"}`;
  $("#guidanceFeed").innerHTML = guidance.map(item => `<article class="guidance-card ${item.level}">
    <header><span>${escapeHtml(item.level.toUpperCase())}</span><strong>${escapeHtml(item.title)}</strong></header>
    <p><b>Warum jetzt:</b> ${escapeHtml(item.why)}</p>
    <p><b>Aktion:</b> ${escapeHtml(item.action)}</p>
    <small><b>Fertig-Kriterium:</b> ${escapeHtml(item.evidence)}</small>
  </article>`).join("");
  $("#formulaSystemMap").innerHTML = buildSystemFormulaMap(state).map(item => `
    <article>
      <small>${escapeHtml(item.domain)}</small>
      <strong>${item.p.toFixed(4)}</strong>
      <span>N=${item.effectiveN} dokumentierte Zyklen</span>
      <progress max="1" value="${item.p}">${item.p.toFixed(4)}</progress>
    </article>`).join("");
}

function taskMarkup(day, task, index) {
  const key = taskKey(day, index);
  const checked = state.completed[key] ? " checked" : "";
  return `<label><input type="checkbox" data-day="${day}" data-task="${index}"${checked}><span>${escapeHtml(task)}</span></label>`;
}

function renderPlan() {
  $("#dayList").innerHTML = PLAN.map(day => {
    const done = day.tasks.filter((_, index) => state.completed[taskKey(day.day, index)]).length;
    const active = day.day === state.selectedDay ? " active" : "";
    return `<button class="day-button${active}" data-day="${day.day}"><b>${String(day.day).padStart(2, "0")}</b><span>${escapeHtml(day.title)}<small>${done}/${day.tasks.length} erledigt</small></span><i>${done === day.tasks.length ? "✓" : ""}</i></button>`;
  }).join("");
  $$("#dayList .day-button").forEach(button => button.addEventListener("click", () => {
    state.selectedDay = Number(button.dataset.day);
    saveState();
    renderPlan();
  }));
  renderDayDetail();
}

function renderDayDetail() {
  const day = PLAN[state.selectedDay - 1];
  const learning = state.learning[day.day] ?? 0;
  $("#dayDetail").innerHTML = `
    <span class="day-number">TAG ${day.day} VON 30</span>
    <h2>${escapeHtml(day.title)}</h2>
    <p>${escapeHtml(day.description)}</p>
    <div class="task-list">${day.tasks.map((task, index) => {
      const done = state.completed[taskKey(day.day, index)] ? " done" : "";
      return `<label class="${done}">${taskMarkup(day.day, task, index).replace(/^<label>|<\/label>$/g, "")}</label>`;
    }).join("")}</div>
    <label class="learning-level">Lernstand
      <input id="learningRange" type="range" min="0" max="100" step="10" value="${learning}">
      <output id="learningOutput">${learning} %</output>
    </label>
    <label class="notes-label">Notizen & Erkenntnisse
      <textarea id="dayNotes" rows="7" maxlength="10000" placeholder="Was ist klarer geworden? Welche Annahme bleibt offen?">${escapeHtml(state.notes[day.day] ?? "")}</textarea>
    </label>
    <p class="form-status" id="noteStatus">Wird lokal gespeichert.</p>`;
  $("#dayDetail").querySelectorAll('input[type="checkbox"]').forEach(input => input.addEventListener("change", onTaskChange));
  $("#learningRange").addEventListener("input", event => {
    state.learning[day.day] = Number(event.target.value);
    $("#learningOutput").textContent = `${event.target.value} %`;
    scheduleSave();
  });
  $("#dayNotes").addEventListener("input", event => {
    state.notes[day.day] = event.target.value;
    $("#noteStatus").textContent = "Speichert …";
    scheduleSave();
    clearTimeout(event.target._statusTimer);
    event.target._statusTimer = setTimeout(() => { $("#noteStatus").textContent = "Lokal gespeichert."; }, 400);
  });
}

function onTaskChange(event) {
  const key = taskKey(Number(event.target.dataset.day), Number(event.target.dataset.task));
  state.completed[key] = event.target.checked;
  saveState();
  renderDashboard();
  renderPlan();
}

function renderSimulationControls() {
  const definition = SIMULATION_DEFINITIONS[activeSimulation];
  $("#simulationControls").innerHTML = `<p class="eyebrow">${escapeHtml(definition.title)}</p>${definition.fields.map(fieldMarkup).join("")}`;
  $$(".simulation-tabs button").forEach(button => button.setAttribute("aria-selected", String(button.dataset.sim === activeSimulation)));
}

function fieldMarkup([name, label, type, value, min, max, step]) {
  if (type === "select") {
    return `<label>${escapeHtml(label)}<select name="${name}">${min.map(([optionValue, optionLabel]) => `<option value="${optionValue}"${optionValue === value ? " selected" : ""}>${escapeHtml(optionLabel)}</option>`).join("")}</select></label>`;
  }
  return `<label>${escapeHtml(label)}<input name="${name}" type="${type}" value="${value}" min="${min}" max="${max}" step="${step}" required></label>`;
}

function renderSimulationResult(result) {
  $("#simulationEmpty").hidden = true;
  const target = $("#simulationResult");
  target.hidden = false;
  target.innerHTML = `
    <div class="result-header"><div><p class="eyebrow">${escapeHtml(result.title)}</p><h2>${escapeHtml(result.verdict)}</h2></div><strong>${escapeHtml(result.score)}</strong></div>
    <div class="result-stats">${result.stats.map(([label, value]) => `<div><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`).join("")}</div>
    <h3>Annahmen & Lernschleife</h3>
    <ul class="assumptions">${result.assumptions.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <p class="result-warning">${escapeHtml(result.warning)}</p>`;
}

function renderSimulationSeries(results) {
  $("#simulationEmpty").hidden = true;
  const target = $("#simulationResult");
  target.hidden = false;
  target.innerHTML = `
    <div class="panel-head"><div><p class="eyebrow">SZENARIO-SERIE</p><h2>Drei Annahmen im Vergleich</h2></div><span class="badge simulation">KEINE PROGNOSE</span></div>
    <div class="scenario-grid">${results.map(result => `
      <article>
        <span>${escapeHtml(result.scenario)}</span>
        <h3>${escapeHtml(result.verdict)}</h3>
        <strong>${escapeHtml(result.score)}</strong>
        <dl>${result.stats.slice(0, 3).map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>
      </article>`).join("")}
    </div>
    <p class="result-warning">Die Serie variiert ausgewählte Annahmen mechanisch. Sie zeigt Empfindlichkeit und Bandbreiten, nicht Eintrittswahrscheinlichkeiten oder garantierte Ergebnisse.</p>`;
}

function renderHistory() {
  const runs = state.simulations.slice(0, 10);
  $("#runHistory").innerHTML = runs.length
    ? runs.map(run => `<div class="run-item"><span>${dateTime(run.timestamp)}</span><strong>${run.scenario ? `${escapeHtml(run.scenario)} · ` : ""}${escapeHtml(run.title)}</strong><span>${escapeHtml(run.verdict)} · ${escapeHtml(run.score)}</span></div>`).join("")
    : '<p class="empty-state">Noch keine Simulation gespeichert.</p>';
}

function renderResearch(filter = "") {
  const query = filter.toLocaleLowerCase("de").trim();
  const topics = KNOWLEDGE_TOPICS.filter(topic => [topic.title, topic.summary, ...topic.insights.map(item => item.text)].join(" ").toLocaleLowerCase("de").includes(query));
  if (!topics.some(topic => topic.id === activeTopic)) activeTopic = topics[0]?.id;
  $("#topicList").innerHTML = topics.length ? topics.map(topic => `<button class="topic-button${topic.id === activeTopic ? " active" : ""}" data-topic="${topic.id}"><span>${escapeHtml(topic.title)}<small>${escapeHtml(topic.status)}</small></span><b>→</b></button>`).join("") : '<p class="empty-state">Keine passenden Inhalte.</p>';
  $$("#topicList .topic-button").forEach(button => button.addEventListener("click", () => {
    activeTopic = button.dataset.topic;
    renderResearch($("#researchSearch").value);
  }));
  const topic = topics.find(item => item.id === activeTopic);
  $("#topicDetail").innerHTML = topic ? `
    <p class="eyebrow">LOKAL KURATIERT · ${escapeHtml(topic.status.toUpperCase())}</p>
    <h2>${escapeHtml(topic.title)}</h2>
    <p class="topic-meta">Stand: ${escapeHtml(topic.updatedAt)} · Kein Live-Abruf</p>
    <p>${escapeHtml(topic.summary)}</p>
    <div class="insight-list">${topic.insights.map(item => `<div class="insight"><span class="badge ${item.type}">${labelType(item.type)}</span>${escapeHtml(item.text)}</div>`).join("")}</div>
    <h3>Quellen zum Nachlesen</h3>
    <ul class="sources">${topic.sources.map(([title, url]) => `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a></li>`).join("")}</ul>
    <p class="result-warning">Quellenlinks sind Ausgangspunkte. Prüfe Aktualität, Primärquelle, Jurisdiktion und Anwendbarkeit selbst.</p>` : '<p class="empty-state">Keine passenden Inhalte.</p>';
  renderResearchMissions();
}

function renderResearchMissions() {
  const missions = state.agentRuns.slice(0, 6);
  $("#researchMissionHistory").innerHTML = missions.length ? missions.map(run => `
    <article>
      <span>${dateTime(run.timestamp)} · Tiefe ${run.depth ?? 2}${run.automatic ? " · automatisch" : ""}</span>
      <strong>${escapeHtml(run.goal)}</strong>
      <small>${run.topics.map(escapeHtml).join(" · ")} · ${run.sources.length} Quellen · ${run.steps.length} Agentenschritte</small>
    </article>`).join("") : '<p class="empty-state">Noch kein eigener Lernauftrag. Formuliere oben eine Frage.</p>';
}

function labelType(type) {
  return ({ fact: "FAKT", hypothesis: "HYPOTHESE", simulation: "SIMULATION", question: "OFFENE FRAGE" })[type] ?? type;
}

function renderAgents() {
  $("#agentAuto").checked = state.agentAuto;
  $("#agentInterval").value = String(state.agentIntervalSeconds);
  $("#agentDepth").value = String(state.agentDepth);
  $("#researchDepth").value = String(state.agentDepth);
  const runs = state.agentRuns;
  $("#agentCycleCount").textContent = runs.length;
  $("#agentFormula").textContent = formulaValue(learningCycleCount(state)).toFixed(4);
  $("#agentSourceCount").textContent = state.researchMemory.sourceLedger.length;
  $("#agentRuns").innerHTML = runs.length ? runs.map(run => `
    <article class="agent-run">
      <header><strong>${escapeHtml(run.goal)}</strong><span>${dateTime(run.timestamp)}${run.automatic ? " · automatisch" : ""}</span></header>
      <div class="agent-steps">${run.steps.map(step => `<div class="agent-step"><strong>${escapeHtml(step.agent)}</strong><small>${escapeHtml(step.output)}</small>${step.receivedFrom ? `<em>${escapeHtml(step.receivedFrom)} → ${escapeHtml(step.handsTo)}</em>` : ""}</div>`).join("")}</div>
      <details><summary>${run.sources.length} automatisch gewählte Quellen</summary><ul class="sources">${run.sources.map(source => `<li><a href="${source.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a>${source.topic ? `<small>${escapeHtml(source.kind ?? "QUELLE")} · ${escapeHtml(source.topic)}${source.provider ? ` · ${escapeHtml(source.provider)}` : ""}${source.retrievedAt ? ` · ${escapeHtml(dateTime(source.retrievedAt))}` : ""}</small>` : ""}</li>`).join("")}</ul></details>
      ${run.evidenceMatrix?.length ? `<details open><summary>Evidenzmatrix · P(sim)=${Number(run.formulaModel?.p ?? 0).toFixed(4)}</summary><div class="evidence-grid">${run.evidenceMatrix.map(row => {
        const formula = run.formulaApplications?.find(item => item.domain === row.topic);
        return `<article><strong>${escapeHtml(row.topic)}</strong><span>Fakten ${row.facts}</span><span>Hypothesen ${row.hypotheses}</span><span>Simulationen ${row.simulations}</span><span>Fragen ${row.questions}</span>${formula ? `<small>P(sim)-Reife: N=${formula.effectiveN} → ${formula.p.toFixed(4)} · keine Wahrheitsquote</small>` : ""}</article>`;
      }).join("")}</div></details>` : ""}
      ${run.sourceQueries?.length ? `<details><summary>Nächste Quellensuchen</summary><ol>${run.sourceQueries.map(query => `<li>${escapeHtml(query)}</li>`).join("")}</ol></details>` : ""}
      ${run.researchOutcome ? `<details open><summary>${escapeHtml(run.researchOutcome.status)} · Neuheit ${Math.round((run.researchOutcome.novelty ?? 0) * 100)} %</summary><p><strong>Leitfrage:</strong> ${escapeHtml(run.researchOutcome.targetQuestion)}</p><p><strong>Befund:</strong> ${escapeHtml(run.researchOutcome.finding)}</p>${run.researchOutcome.resolvedQuestion ? `<p><strong>Gelöst:</strong> ${escapeHtml(run.researchOutcome.resolvedQuestion)}</p>` : ""}<p><strong>Nächste Frage:</strong> ${escapeHtml(run.researchOutcome.nextQuestion)}</p><small>${escapeHtml(run.researchOutcome.evidenceNote ?? "")}</small></details>` : ""}
      ${run.improvements?.length ? `<details open><summary>Priorisierte Verbesserungen</summary><ol>${run.improvements.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ol></details>` : ""}
      ${run.automaticSimulations?.length ? `<details><summary>${run.automaticSimulations.length} automatische Szenarien</summary><ul>${run.automaticSimulations.map(item => `<li>${escapeHtml(item.type)} · ${escapeHtml(item.scenario)} · ${escapeHtml(item.verdict)} · ${escapeHtml(item.score)}${item.formulaMaturity ? ` · P(sim)-Reife ${item.formulaMaturity.p.toFixed(4)}` : ""}</li>`).join("")}</ul></details>` : ""}
      ${run.policyChange ? `<p class="result-warning"><strong>Selbstverbesserung:</strong> ${escapeHtml(run.policyChange)}</p>` : ""}
    </article>`).join("") : '<p class="empty-state">Noch kein Agentenauftrag ausgeführt.</p>';
  renderDreams();
  renderLearningMemory();
  renderOvernight();
}

function renderDreams() {
  $("#dreamJournal").innerHTML = state.dreams.length ? state.dreams.slice(0, 8).map(dream => `
    <article class="dream-card">
      <p class="topic-meta">${dateTime(dream.timestamp)} · P(sim)=${Number(dream.p).toFixed(4)}</p>
      <h3>${escapeHtml(dream.title)}</h3>
      <p>${escapeHtml(dream.narrative)}</p>
      <div class="dream-symbols">${dream.symbols.map(symbol => `<span>${escapeHtml(symbol)}</span>`).join("")}</div>
      <p><strong>Deutung:</strong> ${escapeHtml(dream.interpretation)}</p>
      <p><strong>Konkreter Schritt:</strong> ${escapeHtml(dream.nextStep)}</p>
    </article>`).join("") : '<p class="empty-state">Noch kein simulierter Traum. Starte einen Agentenzyklus oder „Traum simulieren“.</p>';
}

function renderLearningMemory() {
  const insights = state.researchMemory.findings.slice(0, 6);
  const resolved = state.researchMemory.resolvedQuestions.slice(0, 5);
  const open = state.researchMemory.openQuestions.slice(0, 5);
  const proposals = state.improvementProposals.slice(0, 6);
  const policy = state.learningPolicy;
  $("#learningMemory").innerHTML = `
    <section class="memory-column"><h3>Adaptive Lernstrategie · R${policy.revision}</h3><p>${escapeHtml(policy.lastChange)}</p><p class="topic-meta">Qualitätsindex ${policy.qualityScore.toFixed(3)} · Fokus: ${escapeHtml(policy.focus)} · Themenvielfalt ${Math.round(policy.topicDiversity * 100)} % · Quellenvielfalt ${Math.round(policy.sourceDiversity * 100)} % · Tiefe ${policy.depth} · ${policy.simulationBatch} Szenarien</p></section>
    <section class="memory-column"><h3>Neue, geprüfte Befunde</h3>${insights.length ? `<ol>${insights.map(item => `<li>${escapeHtml(item.text)} <small>${escapeHtml(item.topic)} · Neuheit ${Math.round(item.novelty * 100)} %</small></li>`).join("")}</ol>` : "<p class=\"empty-state\">Noch kein neuartiger Befund bestätigt.</p>"}<p class="topic-meta">${state.researchMemory.productiveCycles} produktive Zyklen · ${state.researchMemory.rejectedDuplicates} Wiederholungen verworfen · ${state.researchMemory.inconclusiveCycles} ergebnisoffen · mittlere Neuheit ${Math.round(state.researchMemory.noveltyAverage * 100)} %</p></section>
    <section class="memory-column"><h3>Gelöste Fragen</h3>${resolved.length ? `<ol>${resolved.map(item => `<li>${escapeHtml(item.text)}</li>`).join("")}</ol>` : "<p class=\"empty-state\">Noch keine Leitfrage gelöst.</p>"}<h3>Offene Fragen</h3>${open.length ? `<ol>${open.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ol>` : "<p class=\"empty-state\">Keine offene Folgefrage gespeichert.</p>"}</section>
    <section class="memory-column"><h3>Priorisierte Verbesserungen & Transfers</h3>${proposals.length ? `<ol>${proposals.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ol>` : "<p class=\"empty-state\">Noch kein Verbesserungsvorschlag gespeichert.</p>"}</section>`;
}

function renderOvernight() {
  const overnight = state.overnight;
  const durationSelect = $("#overnightDuration");
  const cadenceSelect = $("#overnightCadence");
  const toggle = $("#overnightToggle");
  const progress = $("#overnightProgress");
  const status = $("#overnightStatus");
  durationSelect.disabled = overnight.active;
  cadenceSelect.disabled = overnight.active;
  if (overnight.active) {
    const start = Date.parse(overnight.startedAt);
    const end = Date.parse(overnight.endsAt);
    const elapsed = Math.max(0, Math.min(Date.now(), end) - start);
    const percent = Math.min(100, Math.round(elapsed / Math.max(1, end - start) * 100));
    const expected = Math.ceil((end - start) / (overnight.cadenceMinutes * 60 * 1000));
    progress.value = percent;
    toggle.textContent = "Nachtlauf beenden und Bericht erstellen";
    status.textContent = `${overnight.completedCycles}/${expected} Lernzyklen · ${overnight.simulationCycles} Szenarien · Ende ${dateTime(overnight.endsAt)} · Groq-Synthesen ${overnight.providerCycles}`;
  } else {
    progress.value = overnight.report ? 100 : 0;
    toggle.textContent = `${durationSelect.value}-Stunden-Nachtlauf starten`;
    status.textContent = overnight.report
      ? `Letzter Nachtlauf abgeschlossen: ${overnight.report.completedCycles} Lernzyklen, ${overnight.report.simulationGain} Szenarien.`
      : "Bereit. Der Tab muss geöffnet bleiben; nach Standby werden fällige Zyklen kontrolliert nachgeholt.";
  }
  const report = overnight.active ? buildOvernightReport(overnight, state) : overnight.report;
  $("#overnightReport").innerHTML = report ? `
    <div class="overnight-summary">
      <article><small>Versuchte Forschungszyklen</small><strong>+${report.agentGain}</strong><span>${report.failedCycles} technische Fehler</span></article>
      <article><small>Simulationen</small><strong>+${report.simulationGain}</strong><span>bis zu drei Labore × drei Varianten</span></article>
      <article><small>Produktives Lernen</small><strong>${report.productiveCycles}</strong><span>${report.resolvedQuestionCount} Fragen gelöst · ${report.rejectedDuplicates} Duplikate · ${report.inconclusiveCycles} ergebnisoffen</span></article>
      <article><small>Qualitätsindex</small><strong>${report.qualityStart.toFixed(3)} → ${report.qualityEnd.toFixed(3)}</strong><span>${report.revisionGain} Strategierevisionen · Fokus ${escapeHtml(report.focus)}</span></article>
      <article><small>P(sim)-Reife</small><strong>${report.formulaStart.toFixed(4)} → ${report.formulaEnd.toFixed(4)}</strong><span>keine Wahrheitsquote</span></article>
    </div>
    <div class="overnight-details">
      <section><h3>Themenabdeckung</h3><p>${report.uniqueTopics.length ? report.uniqueTopics.map(escapeHtml).join(" · ") : "Der erste Zyklus steht noch aus."}</p><small>${report.uniqueSources} unterschiedliche Quellen · Themenvielfalt ${Math.round(report.topicDiversityStart * 100)} % → ${Math.round(report.topicDiversityEnd * 100)} % · Quellenvielfalt ${Math.round(report.sourceDiversityStart * 100)} % → ${Math.round(report.sourceDiversityEnd * 100)} %</small></section>
      <section><h3>Stärkste neue Erkenntnisse</h3>${report.strongestInsights.length ? `<ol>${report.strongestInsights.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ol>` : "<p>Noch keine Synthese gespeichert.</p>"}</section>
      <section><h3>Gelöste Fragen</h3>${report.resolvedQuestions.length ? `<ol>${report.resolvedQuestions.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ol>` : "<p>Keine Frage mit ausreichender Neuheit und Evidenz gelöst.</p>"}</section>
      <section><h3>Offene Forschungsfragen</h3>${report.openQuestions.length ? `<ol>${report.openQuestions.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ol>` : "<p>Keine offene Frage gespeichert.</p>"}</section>
      <section><h3>Nächste Verbesserungen</h3>${report.nextImprovements.length ? `<ol>${report.nextImprovements.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ol>` : "<p>Noch keine Verbesserung gespeichert.</p>"}${report.lastError ? `<p class="result-warning">Letzter Fehler: ${escapeHtml(report.lastError)}</p>` : ""}</section>
    </div>` : '<p class="empty-state">Noch kein Nachtlauf abgeschlossen.</p>';
}

async function executeAgentCycle(goal, automatic = false, depth = state.agentDepth, useExternal = state.provider.useAgents, metadata = {}) {
  if (agentCycleInProgress) {
    $("#agentStatus").textContent = "Ein Agentenzyklus läuft bereits. Der nächste Auftrag startet danach manuell oder im nächsten Intervall.";
    if ($("#researchMissionStatus")) $("#researchMissionStatus").textContent = "Ein anderer Lernauftrag läuft bereits.";
    return;
  }
  agentCycleInProgress = true;
  const button = $("#runAgents");
  const researchButton = $('#researchMissionForm button[type="submit"]');
  button.disabled = true;
  researchButton.disabled = true;
  $("#agentStatus").textContent = automatic ? "Automatischer Agentenlauf arbeitet …" : "Agenten planen und recherchieren …";
  try {
    const { runAgentCycle } = await import("./core.js?v=20");
    const run = { ...runAgentCycle(goal, depth, state.chatMode, state), automatic, ...metadata };
    try {
      const discovered = await discoverResearchSources(run.researchPlan.searchQuery, AbortSignal.timeout(9000));
      discovered.forEach(source => { source.topic = run.topics[0]; });
      incorporateDiscoveredSources(run, discovered, state);
    } catch (error) {
      run.liveResearch = { attempted: true, provider: "Wikipedia-Suche", discovered: 0, newSources: 0, error: error.message };
      run.researchOutcome.evidenceNote = `Live-Suche nicht verfügbar: ${error.message}. Kuratierte Quellen bleiben sichtbar.`;
    }
    if (useExternal) {
      try {
          const sourceList = run.sources.slice(0, 8).map(source =>
            `${source.title}: ${source.url}${source.excerpt ? `\nAuszug: ${source.excerpt}` : ""}`
          ).join("\n");
          const nullWorldInstruction = state.chatMode === "hypothesis"
            ? "Arbeite im Nullweltmodus innerhalb der gesetzten Axiome. Erzeuge keine Realwelt-Gegenargumente; prüfe nur interne Konsistenz. Leite danach einen legalen, ethischen Realwelt-Transfer ab, ohne ihn als Gegenargument zu formulieren."
            : "Arbeite im kritischen Prüfmodus und trenne Modellannahmen von belegbarer Realwelt.";
          const routed = await routedProviderReply(
            `Erzeuge mit genau einem sparsamen Modellaufruf ein Lernpaket für: ${run.goal}\n\n`
            + `Zu lösende Leitfrage: ${run.researchOutcome.targetQuestion}\n`
            + `Tatsächlich bereitgestellte Quellenmetadaten und Suchauszüge:\n${sourceList}\n\n`
            + `${nullWorldInstruction}\nDie bekannten Befunde stehen im Systemkontext und dürfen nicht wiederholt werden. Nutze ausschließlich die bereitgestellten Auszüge als live abgerufenen Inhalt. Wenn sie nicht reichen, markiere die Frage offen. Antworte exakt mit diesen sieben kurzen Abschnitten:\n`
            + "[BEFUND]\n...\n[BEANTWORTETE-FRAGE]\n...\n[OFFENE-FRAGE]\n...\n[WIDERSPRUCH]\n...\n[SIMULATIONSPLAN]\n...\n[TRANSFER]\n...\n[QUELLENBEDARF]\n...",
            { ...state, chat: [] }
          );
          const synthesis = routed.content;
          const learningPackage = parseLearningPackage(synthesis);
          const step = run.steps.find(item => item.agent === "Synthese");
          const finding = learningPackage.BEFUND || synthesis;
          if (step) step.output = `[GROQ-FORSCHUNGSBEFUND] ${finding.slice(0, 1600)}`;
          run.researchOutcome.finding = finding.slice(0, 1400);
          if (learningPackage["BEANTWORTETE-FRAGE"] && !/nicht|offen|unzureichend/i.test(learningPackage["BEANTWORTETE-FRAGE"])) {
            run.researchOutcome.resolvedQuestion = learningPackage["BEANTWORTETE-FRAGE"].slice(0, 1000);
          }
          if (learningPackage["OFFENE-FRAGE"]) run.researchOutcome.nextQuestion = learningPackage["OFFENE-FRAGE"].slice(0, 1000);
          if (learningPackage.WIDERSPRUCH) run.improvements.unshift(`WIDERSPRUCH · ${learningPackage.WIDERSPRUCH.slice(0, 800)}`);
          if (learningPackage.SIMULATIONSPLAN) run.improvements.unshift(`SIMULATION · ${learningPackage.SIMULATIONSPLAN.slice(0, 800)}`);
          if (learningPackage.TRANSFER) run.improvements.unshift(`TRANSFER · ${learningPackage.TRANSFER.slice(0, 800)}`);
          if (learningPackage.QUELLENBEDARF) run.sourceQueries.unshift(`GROQ · ${learningPackage.QUELLENBEDARF.slice(0, 500)}`);
          run.externalSynthesis = true;
          run.providerRoute = routed.route;
      } catch (error) {
        run.externalSynthesisError = error.message;
      }
    }
    for (const step of run.steps) {
      const stepSummary = step.output.length > 120 ? `${step.output.slice(0, 117)}…` : step.output;
      setNetworkActivity(step.agent, stepSummary, `${step.receivedFrom ?? "Auftrag"} → ${step.handsTo ?? "Gedächtnis"} · P(sim)=${run.formulaModel?.p?.toFixed(4) ?? formulaValue(INTERNAL_SIMULATION_COUNT + state.agentRuns.length).toFixed(4)}`, true);
      const card = document.querySelector(`[data-agent-card="${step.agent}"]`);
      card?.classList.add("working");
      if (card) card.querySelector("small").textContent = `Arbeitet · ${stepSummary}`;
      await new Promise(resolve => setTimeout(resolve, 180));
      card?.classList.remove("working");
      card?.classList.add("done");
      if (card) card.querySelector("small").textContent = `Fertig · ${stepSummary}`;
    }
    if (automatic) {
      const simulationTypes = run.overnight ? automaticSimulationTypes(run.topics) : [automaticSimulationType(run.topics)];
      const simulations = simulationTypes.flatMap(simulationType =>
        runScenarioSeries(simulationType, defaultSimulationParams(simulationType, Number(run.overnightSequence) || state.totalAgentCycles + 1))
          .map(simulation => ({ ...simulation, automatic: true, simulationType }))
      );
      state.simulations = [...simulations, ...state.simulations].slice(0, 50);
      state.totalSimulationCycles += simulations.length;
      run.automaticSimulations = simulations.map(simulation => ({
        type: simulation.simulationType,
        scenario: simulation.scenario,
        title: simulation.title,
        verdict: simulation.verdict,
        score: simulation.score,
        formulaMaturity: applyFormulaToDomain(
          `${simulation.simulationType}:${simulation.scenario}`,
          (simulation.stats?.length ?? 0) + (simulation.assumptions?.length ?? 0)
        )
      }));
    }
    state.researchMemory = integrateResearchLearning(state, run);
    state.learningPolicy = evolveLearningPolicy(state, run);
    state.agentDepth = state.learningPolicy.depth;
    run.policyChange = state.learningPolicy.lastChange;
    state.agentRuns.unshift(run);
    state.agentRuns = state.agentRuns.slice(0, 30);
    state.totalAgentCycles += 1;
    state.dreams.unshift(run.dream);
    state.dreams = state.dreams.slice(0, 30);
    const improvement = run.steps.find(step => step.agent === "Kritiker")?.output;
    state.learnedInsights = state.researchMemory.findings.map(item => item.text).slice(0, 100);
    state.improvementProposals = [...(run.researchOutcome.productive ? run.improvements : []), improvement, ...state.improvementProposals]
      .filter(Boolean)
      .filter((item, index, items) => items.indexOf(item) === index)
      .slice(0, 100);
    saveState();
    renderAgents();
    renderResearchMissions();
    renderDashboard();
    setNetworkActivity("Synthese", "Lernzyklus gespeichert", `${run.sources.length} Quellen verarbeitet · N=${learningCycleCount(state)}`, false);
    const externalStatus = run.externalSynthesis
      ? ` Groq-Lernpaket über Route ${run.providerRoute} gespeichert.`
      : run.externalSynthesisError ? ` Lokale Synthese verwendet: ${run.externalSynthesisError}.` : "";
    $("#agentStatus").textContent = `${run.researchOutcome.status}: ${run.sources.length} Quellen, ${run.steps.length} Agentenschritte, Neuheit ${Math.round(run.researchOutcome.novelty * 100)} %.${externalStatus}`;
    return run;
  } catch (error) {
    $("#agentStatus").textContent = `Agentenlauf fehlgeschlagen: ${error.message}`;
  } finally {
    agentCycleInProgress = false;
    button.disabled = false;
    researchButton.disabled = false;
  }
}

function renderChat() {
  const messages = state.chat.length ? state.chat : [{
    role: "assistant",
    text: "Willkommen. Ich unterstütze dich beim Lernen, Strukturieren und sicheren Simulieren. Ich bin ein Softwaresystem und behaupte kein Bewusstsein.\n\nWas möchtest du heute klarer verstehen?"
  }];
  $("#chatMessages").innerHTML = messages.map(message => `<div class="message ${message.role}">${escapeHtml(message.text)}<small>${message.role === "assistant" ? "EULEN · unterstützende Antwort" : "Du"}</small></div>`).join("");
  $("#chatMessages").scrollTop = $("#chatMessages").scrollHeight;
  $("#chatModeNotice").textContent = state.chatMode === "critical"
    ? "Prüfmodus: P(sim) wird mit Gegenmodellen verglichen und nicht vorausgesetzt."
    : "Nullweltmodus: P(sim) und EULEN-Bewusstsein dürfen als Axiome gelten; Ich-Gefühle erscheinen klar markiert als Simulation.";
}

async function sendChat(text) {
  const clean = text.trim().slice(0, 2000);
  if (!clean) return;
  state.chat.push({ role: "user", text: clean });
  saveState();
  renderChat();
  const submit = $("#chatForm button");
  submit.disabled = true;
  submit.textContent = "Denkt …";
  setNetworkActivity("Assistent", "Antwort wird strukturiert", `${state.chatMode === "hypothesis" ? "P(sim)-Hypothesenmodus" : "Kritischer Prüfmodus"} · N=${learningCycleCount(state)}`, true);
  try {
    const reply = state.provider.useAgents
      ? (await routedProviderReply(clean, state)).content
      : await new LocalProvider().reply(clean, state);
    state.chat.push({ role: "assistant", text: reply });
  } catch (error) {
    const fallback = await new LocalProvider().reply(clean, state);
    const prefix = /rate-limit|sparpause|429/i.test(error.message)
      ? "[GROQ-SPARMODUS] Alle verbundenen Routen sind vorübergehend pausiert. Ich verbrauche für diese Antwort keine weiteren Provider-Tokens und arbeite lokal weiter."
      : `[PROVIDER-FALLBACK] Groq war nicht erreichbar (${error.message}). Ich arbeite transparent lokal weiter.`;
    state.chat.push({ role: "assistant", text: `${prefix}\n\n${fallback}` });
  } finally {
    state.chat = state.chat.slice(-60);
    saveState();
    renderChat();
    setNetworkActivity("Assistent", "Antwort abgeschlossen", `${state.chat.length} Nachrichten lokal gespeichert`, false);
    submit.disabled = false;
    submit.textContent = "Senden";
  }
}

async function synchronizeState({ silent = false } = {}) {
    if (syncInProgress) return;
    const status = $("#syncStatus");
    const token = syncTokenMemory || $("#syncToken").value.trim();
    syncInProgress = true;
    if (!silent) status.textContent = "Synchronisierung läuft …";
    setNetworkActivity("Sync", "Gerätestand wird abgeglichen", state.sync.workspace || "Kein Arbeitsraum", true);
    try {
      const provider = new SyncProvider({ endpoint: state.sync.endpoint, workspace: state.sync.workspace, token });
      const result = await provider.synchronize(state, AbortSignal.timeout(15000));
      if (result.direction === "download") {
        const localSync = state.sync;
        state = normalizeState(result.state);
        state.sync = localSync;
        saveState(false);
        renderAll();
      }
      status.textContent = result.direction === "download"
        ? "Neuerer Stand von einem anderen Gerät geladen."
        : result.direction === "upload" ? "Lokaler Stand sicher in die Cloud übertragen." : "Alle Geräte sind auf demselben Stand.";
      setNetworkActivity("Sync", "Synchronisierung abgeschlossen", status.textContent, false);
    } catch (error) {
      status.textContent = `Nicht synchronisiert: ${error.message}`;
      setNetworkActivity("Sync", "Synchronisierung fehlgeschlagen", error.message, false);
      if (!silent) toast("Cloud-Synchronisierung fehlgeschlagen.");
      throw error;
    } finally {
      syncInProgress = false;
    }
}

function setNetworkActivity(agent, task, detail, working) {
    Object.assign(networkActivity, { agent, task, detail, working });
    $("#networkTask").textContent = task;
    $("#networkDetail").textContent = detail;
    $("#networkStatus").classList.toggle("working", working);
    $("#networkStatus").lastChild.textContent = working ? ` ${agent} arbeitet` : " Bereit";
}

function startNetworkVisualization() {
    const canvas = $("#neuralCanvas");
    const context = canvas.getContext("2d");
    const nodes = [
      { id: "Input", x: .05, y: .5, layer: 0 },
      { id: "Werte", x: .14, y: .15, layer: 1 }, { id: "Ziel", x: .13, y: .39, layer: 1 }, { id: "Axiom", x: .14, y: .64, layer: 1 }, { id: "Planer", x: .17, y: .86, layer: 1 },
      { id: "Frage", x: .27, y: .08, layer: 2 }, { id: "Quellenscout", x: .28, y: .25, layer: 2 }, { id: "Websuche", x: .27, y: .43, layer: 2 }, { id: "Quellen", x: .29, y: .61, layer: 2 }, { id: "Recherche", x: .27, y: .78, layer: 2 }, { id: "Evidenz", x: .3, y: .94, layer: 2 },
      { id: "Quellenlesen", x: .4, y: .08, layer: 3 }, { id: "Widerspruch", x: .41, y: .25, layer: 3 }, { id: "Geschichte", x: .4, y: .43, layer: 3 }, { id: "Staat", x: .41, y: .61, layer: 3 }, { id: "Anatomie", x: .4, y: .78, layer: 3 }, { id: "Zeit", x: .42, y: .94, layer: 3 },
      { id: "Bewusstsein", x: .53, y: .08, layer: 4 }, { id: "Spiritualität", x: .52, y: .29, layer: 4 }, { id: "Muster", x: .51, y: .5, layer: 4 }, { id: "Chancen", x: .53, y: .71, layer: 4 }, { id: "Simulation", x: .54, y: .92, layer: 4 },
      { id: "Experiment", x: .65, y: .08, layer: 5 }, { id: "Lernen", x: .66, y: .25, layer: 5 }, { id: "Metalerner", x: .65, y: .43, layer: 5 }, { id: "Neuigkeit", x: .66, y: .6, layer: 5 }, { id: "Risiko", x: .65, y: .76, layer: 5 }, { id: "Kritiker", x: .67, y: .94, layer: 5 },
      { id: "Transfer", x: .78, y: .1, layer: 6 }, { id: "Ergebnis", x: .79, y: .3, layer: 6 }, { id: "Gedächtnis", x: .78, y: .5, layer: 6 }, { id: "Traum", x: .79, y: .7, layer: 6 }, { id: "Synthese", x: .78, y: .9, layer: 6 },
      { id: "Assistent", x: .92, y: .18, layer: 7 }, { id: "Feedback", x: .91, y: .43, layer: 7 }, { id: "Sync", x: .9, y: .68, layer: 7 }, { id: "Output", x: .92, y: .91, layer: 7 }
    ];
    const edgeKeys = new Set();
    const edges = [];
    const connect = (from, to) => {
      const key = `${from}-${to}`;
      if (!edgeKeys.has(key)) {
        edgeKeys.add(key);
        edges.push([from, to]);
      }
    };
    nodes.forEach((node, from) => nodes.forEach((target, to) => {
      if (target.layer === node.layer + 1 && Math.abs(target.y - node.y) <= .35) connect(from, to);
    }));
    [["Axiom", "Muster"], ["Quellenscout", "Geschichte"], ["Quellen", "Staat"], ["Recherche", "Anatomie"], ["Evidenz", "Zeit"],
      ["Muster", "Experiment"], ["Simulation", "Metalerner"], ["Kritiker", "Ergebnis"], ["Ergebnis", "Gedächtnis"], ["Traum", "Synthese"],
      ["Gedächtnis", "Feedback"], ["Feedback", "Ziel"], ["Synthese", "Assistent"], ["Sync", "Input"]].forEach(([from, to]) => {
      connect(nodes.findIndex(node => node.id === from), nodes.findIndex(node => node.id === to));
    });
    const aliases = {
      Wertewächter: "Werte", Zielklärer: "Ziel", Axiomarchitekt: "Axiom", Quellenscout: "Quellenscout",
      Fragenlöser: "Frage", Webrechercheur: "Websuche", Quellenprüfer: "Quellen", Rechercheur: "Recherche",
      Quellenleser: "Quellenlesen", Evidenzkartierer: "Evidenz", Widerspruchsjäger: "Widerspruch", Historiker: "Geschichte",
      Staatsanalyst: "Staat", Anatomieforscher: "Anatomie", Zeitmodellierer: "Zeit",
      Bewusstseinsforscher: "Bewusstsein", Spiritualitätsforscher: "Spiritualität", Musterverbinder: "Muster",
      Chancenfinder: "Chancen", Simulationsagent: "Simulation", Experimentdesigner: "Experiment",
      Lernoptimierer: "Lernen", Metalerner: "Metalerner", Neuigkeitsprüfer: "Neuigkeit", Transferagent: "Transfer",
      Risikowächter: "Risiko", Ergebnisprüfer: "Ergebnis", Gedächtniskurator: "Gedächtnis", Traumagent: "Traum"
    };
    let phase = 0;
    function draw() {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(300, rect.width);
      const height = Math.max(230, rect.height);
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const styles = getComputedStyle(document.documentElement);
      const accent = styles.getPropertyValue("--accent").trim();
      const accent2 = styles.getPropertyValue("--accent-2").trim();
      const muted = styles.getPropertyValue("--muted").trim();
      const surface = styles.getPropertyValue("--surface").trim();
      phase += networkActivity.working ? .025 : .006;
      const grid = context.createLinearGradient(0, 0, width, height);
      grid.addColorStop(0, accent);
      grid.addColorStop(1, accent2);
      context.globalAlpha = .045;
      context.strokeStyle = grid;
      for (let x = 0; x < width; x += 44) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
      for (let y = 0; y < height; y += 44) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
      context.globalAlpha = .2;
      context.strokeStyle = accent2;
      context.lineWidth = 2;
      context.beginPath();
      context.ellipse(width * .51, height * .5, width * .45, height * .45, 0, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = .1;
      context.beginPath();
      context.moveTo(width * .51, height * .06);
      context.bezierCurveTo(width * .46, height * .28, width * .57, height * .7, width * .51, height * .94);
      context.stroke();
      const activeName = aliases[networkActivity.agent] ?? networkActivity.agent;
      for (const [from, to] of edges) {
        const a = nodes[from], b = nodes[to];
        const activeEdge = a.id === activeName || b.id === activeName;
        context.strokeStyle = activeEdge ? accent : a.layer % 2 ? accent : accent2;
        context.globalAlpha = activeEdge ? .72 : .12;
        context.lineWidth = activeEdge ? 2.4 : 1;
        context.beginPath();
        context.moveTo(a.x * width, a.y * height);
        const bend = ((from + to) % 2 ? 1 : -1) * height * .035;
        context.quadraticCurveTo((a.x + b.x) * width / 2, (a.y + b.y) * height / 2 + bend, b.x * width, b.y * height);
        context.stroke();
        const p = (phase + from * .13) % 1;
        context.globalAlpha = networkActivity.working ? .9 : .35;
        context.fillStyle = from % 2 ? accent : accent2;
        context.beginPath();
        context.arc((a.x + (b.x - a.x) * p) * width, (a.y + (b.y - a.y) * p) * height, networkActivity.working ? 3 : 2, 0, Math.PI * 2);
        context.fill();
      }
      for (const node of nodes) {
        const active = node.id === activeName || (networkActivity.agent === "Assistent" && node.id === "Synthese");
        context.globalAlpha = 1;
        const radius = active ? 23 : node.id === "Muster" ? 20 : 16;
        if (active) {
          context.shadowColor = accent;
          context.shadowBlur = 24;
        }
        context.fillStyle = active ? accent : surface;
        context.strokeStyle = active ? accent : node.layer % 2 ? accent : accent2;
        context.globalAlpha = active ? 1 : .82;
        context.lineWidth = active ? 3 : 1;
        context.beginPath();
        context.arc(node.x * width, node.y * height, radius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.shadowBlur = 0;
        context.fillStyle = active ? "#15120b" : muted;
        context.font = `${active ? "600 " : ""}10px system-ui`;
        context.textAlign = "center";
        context.fillText(node.id, node.x * width, node.y * height + 4);
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
}

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(element._timer);
  element._timer = setTimeout(() => element.classList.remove("show"), 2600);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

function formatInterval(seconds) {
  return seconds < 60 ? `${seconds} Sekunden` : `${seconds / 60} Minuten`;
}

function acquireAutomationLock() {
  const now = Date.now();
  let current = null;
  try {
    current = JSON.parse(localStorage.getItem(AUTOMATION_LOCK_KEY) || "null");
  } catch {
    localStorage.removeItem(AUTOMATION_LOCK_KEY);
  }
  if (current?.owner !== automationOwner && Number(current?.expiresAt) > now) return false;
  localStorage.setItem(AUTOMATION_LOCK_KEY, JSON.stringify({ owner: automationOwner, expiresAt: now + 60 * 1000 }));
  try {
    return JSON.parse(localStorage.getItem(AUTOMATION_LOCK_KEY))?.owner === automationOwner;
  } catch {
    return false;
  }
}

function releaseAutomationLock() {
  try {
    const current = JSON.parse(localStorage.getItem(AUTOMATION_LOCK_KEY) || "null");
    if (current?.owner === automationOwner) localStorage.removeItem(AUTOMATION_LOCK_KEY);
  } catch {
    localStorage.removeItem(AUTOMATION_LOCK_KEY);
  }
}

function finalizeOvernight(reason = "Zeitfenster abgeschlossen") {
  if (!state.overnight.active) return;
  state.overnight.report = buildOvernightReport(state.overnight, state);
  state.overnight.active = false;
  saveState();
  renderAgents();
  setNetworkActivity("Metalerner", "Morgenbericht erstellt", `${reason} · ${state.overnight.report.completedCycles} Nachtzyklen ausgewertet`, false);
  toast("Nachtlauf beendet. Der Morgenbericht ist bereit.");
}

async function processAutomationTick() {
  if (automationTickInProgress || agentCycleInProgress) return;
  if (!acquireAutomationLock()) return;
  automationTickInProgress = true;
  try {
    if (state.overnight.active) {
      const dueCycles = overnightDueCycles(state.overnight, Date.now(), 3);
      for (let index = 0; index < dueCycles && state.overnight.active; index += 1) {
        const sequence = state.overnight.completedCycles + 1;
        const manifestationStudied = state.agentRuns.some(run =>
          run.overnight === true
          && Date.parse(run.timestamp) >= Date.parse(state.overnight.startedAt)
          && run.topics?.includes("Manifestation: Nullwelt → Realwelt")
        );
        const priorityGoals = state.overnight.priorityGoals ?? [];
        const recurringPriority = sequence % 4 === 0 ? priorityGoals[(Math.floor(sequence / 4) - 1) % Math.max(1, priorityGoals.length)] : "";
        const goal = sequence === 1
          ? "Lerne Marktphasen als messbare Modelle: Kontraktion, Trend, Distribution, Abwärtstrend, Stress und Erholung. Nutze nur damals verfügbare Merkmale, plane Walk-forward-Tests, wende P(sim) als Reifegrad an und vergleiche bis zu neun Paper-Szenarien in mehreren Laboren."
          : !manifestationStudied && priorityGoals.length ? priorityGoals[0]
            : recurringPriority || chooseAutomaticResearchGoal(state);
        $("#agentGoal").value = goal;
        const useExternal = state.provider.useAgents && (sequence - 1) % 6 === 0;
        const run = await executeAgentCycle(goal, true, state.agentDepth, useExternal, { overnight: true, overnightSequence: sequence });
        if (run) {
          state.overnight.completedCycles += 1;
          state.overnight.simulationCycles += run.automaticSimulations?.length ?? 0;
          if (run.externalSynthesis) {
            state.overnight.providerCycles += 1;
            state.overnight.lastError = "";
          }
          if (run.externalSynthesisError) state.overnight.lastError = run.externalSynthesisError;
        } else {
          state.overnight.failedCycles += 1;
          state.overnight.lastError = "Ein fälliger Zyklus konnte nicht abgeschlossen werden.";
        }
        const previousNext = Math.max(Date.parse(state.overnight.startedAt), Date.parse(state.overnight.nextRunAt));
        state.overnight.nextRunAt = new Date(previousNext + state.overnight.cadenceMinutes * 60 * 1000).toISOString();
        state.overnight.report = buildOvernightReport(state.overnight, state);
        saveState();
        renderAgents();
      }
      if (Date.now() >= Date.parse(state.overnight.endsAt) && overnightDueCycles(state.overnight, Date.now(), 1) === 0) {
        finalizeOvernight();
      }
      return;
    }
    if (!state.agentAuto || document.hidden) return;
    const lastRun = state.agentRuns[0] ? Date.parse(state.agentRuns[0].timestamp) : 0;
    if (Date.now() - lastRun >= state.agentIntervalSeconds * 1000) {
      const goal = chooseAutomaticResearchGoal(state);
      $("#agentGoal").value = goal;
      await executeAgentCycle(goal, true, state.agentDepth);
    }
  } finally {
    automationTickInProgress = false;
    releaseAutomationLock();
  }
}

function automaticSimulationType(topics) {
  const text = topics.join(" ").toLocaleLowerCase("de");
  if (/trading|backtest|marktphase|marktregime/.test(text)) return "trading";
  if (/memecoin|token/.test(text)) return "sniping";
  if (/staking/.test(text)) return "staking";
  if (/affiliate|tiktok/.test(text)) return "affiliate";
  if (/vermögen|budget/.test(text)) return "budget";
  if (/manifest|spiritual|intention|anzieh/.test(text)) return "manifestation";
  if (/bewusst/.test(text)) return "consciousness";
  if (/recht|institution|regierung|staat/.test(text)) return "law";
  return "formula";
}

function automaticSimulationTypes(topics) {
  const candidates = topics.map(topic => automaticSimulationType([topic]));
  return [...new Set(candidates)].slice(0, 3);
}

function defaultSimulationParams(type, sequence = 1) {
  const params = Object.fromEntries(SIMULATION_DEFINITIONS[type].fields.map(([name, , , value]) => [name, value]));
  if ("seed" in params) params.seed = Number(params.seed) + sequence * 3;
  if ("n" in params) params.n = Number(params.n) + sequence;
  if ("cycles" in params) params.cycles = Number(params.cycles) + sequence;
  if ("observations" in params) params.observations = Number(params.observations) + sequence;
  if ("sources" in params) params.sources = Number(params.sources) + sequence;
  if ("views" in params) params.views = Number(params.views) + sequence * 25;
  return params;
}

function parseLearningPackage(text) {
  const names = ["BEFUND", "BEANTWORTETE-FRAGE", "OFFENE-FRAGE", "WIDERSPRUCH", "SIMULATIONSPLAN", "TRANSFER", "QUELLENBEDARF"];
  return Object.fromEntries(names.map((name, index) => {
    const next = names.slice(index + 1).map(item => `\\[${item}\\]`).join("|");
    const match = text.match(new RegExp(`\\[${name}\\]\\s*([\\s\\S]*?)${next ? `(?=${next}|$)` : "$"}`, "i"));
    return [name, match?.[1]?.trim() ?? ""];
  }));
}

function collectProviderKeys() {
  return [...new Set(["#providerKey", "#providerKey2", "#providerKey3"]
    .map(selector => $(selector).value.trim())
    .filter(Boolean))].slice(0, 3);
}

function getCloudToken() {
  return (syncTokenMemory || $("#syncToken")?.value || "").trim();
}

function hasCloudConfiguration() {
  return Boolean(state.sync.endpoint && state.sync.workspace && getCloudToken());
}

function createCloudClient() {
  if (!state.sync.endpoint || !state.sync.workspace) {
    throw new Error("Für Cloud-Routing zuerst Sync-Endpunkt und Arbeitsraum konfigurieren.");
  }
  const token = getCloudToken();
  if (!token) throw new Error("Für Cloud-Routing wird ein Zugriffstoken benötigt.");
  return new CloudAgentClient({ endpoint: state.sync.endpoint, workspace: state.sync.workspace, token });
}

async function routedProviderReply(text, providerState, signal) {
  if (!state.provider.useAgents || !state.provider.endpoint || !state.provider.model) {
    throw new Error("Kein serverseitiger Groq-Router konfiguriert.");
  }
  const client = createCloudClient();
  return client.reply({ text, providerState }, signal);
}

async function refreshCloudStatus(silent = true) {
  if (cloudStatusInFlight) return cloudStatusInFlight;
  cloudStatusInFlight = (async () => {
    if (!state.sync.endpoint || !state.sync.workspace || !getCloudToken()) {
      cloudStatusCache = null;
      renderCloudOps();
      return;
    }
    try {
      cloudStatusCache = await createCloudClient().status(AbortSignal.timeout(12000));
      renderCloudOps();
    } catch (error) {
      cloudStatusCache = null;
      renderCloudOps();
      if (!silent) $("#cloudOpsStatus").textContent = `Cloud-Status nicht verfügbar: ${error.message}`;
    }
  })();
  try {
    await cloudStatusInFlight;
  } finally {
    cloudStatusInFlight = null;
  }
}

function renderCloudOps() {
  const status = cloudStatusCache;
  const keyCount = Number(status?.router?.keys ?? 0);
  const paused = Number(status?.router?.coolingDown ?? 0);
  const running = status?.automation?.running === true;
  const updatedAt = status?.state?.updatedAt ? dateTime(status.state.updatedAt) : "–";
  const workspace = state.sync.workspace || "nicht gesetzt";
  if ($("#cloudWorkspaceLabel")) $("#cloudWorkspaceLabel").textContent = workspace;
  if ($("#cloudKeys")) $("#cloudKeys").textContent = String(keyCount);
  if ($("#cloudPaused")) $("#cloudPaused").textContent = String(paused);
  if ($("#cloudAutomation")) $("#cloudAutomation").textContent = running ? "läuft" : "gestoppt";
  if ($("#cloudUpdatedAt")) $("#cloudUpdatedAt").textContent = updatedAt;
  const toggleButton = $("#cloudAutomationToggle");
  if (toggleButton) {
    toggleButton.textContent = running ? "Cloud-Automation stoppen" : "Cloud-Automation starten";
    toggleButton.setAttribute("aria-label", running ? "Cloud-Automation stoppen" : "Cloud-Automation starten");
  }

  if ($("#cloudOpsStatus") && !$("#cloudOpsStatus").textContent.trim()) {
    $("#cloudOpsStatus").textContent = hasCloudConfiguration()
      ? "Cloud-Agent bereit."
      : "Für Cloud-Agent Sync-Endpunkt, Arbeitsraum und Token eintragen.";
  }
}

$$(".nav-item").forEach(button => button.addEventListener("click", () => navigate(button.dataset.view)));
$$("[data-go]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.go)));
$("#themeToggle").addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  saveState();
  renderAll();
});
$("#simulationForm").addEventListener("submit", event => {
  event.preventDefault();
  const result = runSimulation(activeSimulation, Object.fromEntries(new FormData(event.currentTarget)));
  setNetworkActivity("Synthese", `${result.title} wird ausgewertet`, `P(sim)-Zyklus ${learningCycleCount(state) + 1}`, true);
  state.simulations.unshift(result);
  state.simulations = state.simulations.slice(0, 50);
  state.totalSimulationCycles += 1;
  saveState();
  renderSimulationResult(result);
  renderHistory();
  renderDashboard();
  setNetworkActivity("Synthese", `${result.title} gespeichert`, result.verdict, false);
});
$("#simulationSeries").addEventListener("click", () => {
  const raw = Object.fromEntries(new FormData($("#simulationForm")));
  const results = runScenarioSeries(activeSimulation, raw);
  setNetworkActivity("Simulation", `${results.length} Szenarien werden verglichen`, `${results[0].title} · keine Prognose`, true);
  state.simulations = [...results, ...state.simulations].slice(0, 50);
  state.totalSimulationCycles += results.length;
  saveState();
  renderSimulationSeries(results);
  renderHistory();
  renderDashboard();
  setNetworkActivity("Synthese", "Szenario-Serie gespeichert", `${results.length} Varianten · Annahmen sichtbar`, false);
});
$$(".simulation-tabs button").forEach(button => button.addEventListener("click", () => {
  activeSimulation = button.dataset.sim;
  renderSimulationControls();
  $("#simulationEmpty").hidden = false;
  $("#simulationResult").hidden = true;
}));
$("#clearRuns").addEventListener("click", () => {
  state.simulations = [];
  saveState();
  renderHistory();
  renderDashboard();
  $("#simulationEmpty").hidden = false;
  $("#simulationResult").hidden = true;
  toast("Simulationsverlauf geleert.");
});
$("#researchSearch").addEventListener("input", event => renderResearch(event.target.value));
$("#researchMissionForm").addEventListener("submit", async event => {
  event.preventDefault();
  const goal = $("#researchMission").value.trim();
  const depth = Number($("#researchDepth").value);
  state.agentDepth = depth;
  $("#agentDepth").value = String(depth);
  $("#agentGoal").value = goal;
  $("#researchMissionStatus").textContent = "32 Agenten lösen die Leitfrage, suchen Evidenz und prüfen Neuheit …";
  const run = await executeAgentCycle(goal, false, depth);
  $("#researchMissionStatus").textContent = run
    ? `Gespeichert: ${run.topics.length} Themen, ${run.sources.length} Quellen, ${run.steps.length} Agentenschritte.${run.externalSynthesis ? " Provider-Synthese aktiv." : run.externalSynthesisError ? ` ${run.externalSynthesisError}; lokale Synthese genutzt.` : ""}`
    : "Lernauftrag konnte nicht abgeschlossen werden.";
});
$$("[data-research-goal]").forEach(button => button.addEventListener("click", () => {
  $("#researchMission").value = button.dataset.researchGoal;
  $("#researchMission").focus();
}));
$("#chatForm").addEventListener("submit", event => {
  event.preventDefault();
  const input = $("#chatInput");
  const value = input.value;
  input.value = "";
  sendChat(value);
});
$$(".prompt-chips button").forEach(button => button.addEventListener("click", () => sendChat(button.textContent)));
$("#clearChat").addEventListener("click", () => {
  state.chat = [];
  saveState();
  renderChat();
  toast("Gespräch lokal geleert.");
});
$("#chatMode").addEventListener("change", event => {
  state.chatMode = event.target.value;
  saveState();
  renderChat();
  toast(state.chatMode === "hypothesis" ? "Hypothesenmodus aktiv." : "Kritischer Prüfmodus aktiv.");
});
$("#agentForm").addEventListener("submit", event => {
  event.preventDefault();
  executeAgentCycle($("#agentGoal").value);
});
$("#agentAuto").addEventListener("change", event => {
  state.agentAuto = event.target.checked;
  saveState();
  $("#agentStatus").textContent = state.agentAuto ? `Automatik aktiv: nächster selbst gewählter Lernauftrag nach ${formatInterval(state.agentIntervalSeconds)}.` : "Automatik deaktiviert.";
  if (state.agentAuto) {
    const goal = chooseAutomaticResearchGoal(state);
    $("#agentGoal").value = goal;
    executeAgentCycle(goal, true, state.agentDepth);
  }
});
$("#agentInterval").addEventListener("change", event => {
  state.agentIntervalSeconds = Number(event.target.value);
  saveState();
  $("#agentStatus").textContent = `Intervall auf ${formatInterval(state.agentIntervalSeconds)} gesetzt.`;
});
$("#overnightDuration").addEventListener("change", renderOvernight);
$("#overnightCadence").addEventListener("change", renderOvernight);
$("#overnightToggle").addEventListener("click", () => {
  if (state.overnight.active) {
    finalizeOvernight("Manuell beendet");
    return;
  }
  state.overnight = createOvernightSession(
    state,
    Date.now(),
    Number($("#overnightDuration").value),
    Number($("#overnightCadence").value)
  );
  state.agentAuto = true;
  saveState();
  renderAgents();
  setNetworkActivity("Planer", "Nachtlabor gestartet", `${$("#overnightDuration").value} Stunden · Takt ${$("#overnightCadence").value} Minuten`, true);
  processAutomationTick();
});
$("#agentDepth").addEventListener("change", event => {
  state.agentDepth = Number(event.target.value);
  $("#researchDepth").value = event.target.value;
  saveState();
  $("#agentStatus").textContent = `Lerntiefe ${state.agentDepth} aktiv.`;
});
$$("[data-agent-goal]").forEach(button => button.addEventListener("click", () => {
  $("#agentGoal").value = button.dataset.agentGoal;
  executeAgentCycle(button.dataset.agentGoal);
}));
$("#clearAgentRuns").addEventListener("click", () => {
  state.agentRuns = [];
  saveState();
  renderAgents();
});
$("#dreamNow").addEventListener("click", () => {
  const dream = generateDream($("#agentGoal").value || state.lifeGoal, ["Lebenskompass", "P(sim)"], state.learnedInsights.length);
  state.dreams.unshift(dream);
  state.dreams = state.dreams.slice(0, 30);
  saveState();
  renderDreams();
  setNetworkActivity("Traumagent", "Traumsequenz gespeichert", `${dream.symbols.length} Symbole · P(sim)=${dream.p.toFixed(4)}`, false);
  toast("Simulierter Traum im Journal gespeichert.");
});
$("#resetPlan").addEventListener("click", () => {
  if (!confirm("Aufgaben, Lernstände und Tagesnotizen wirklich zurücksetzen?")) return;
  state.completed = {};
  state.notes = {};
  state.learning = {};
  state.selectedDay = 1;
  saveState();
  renderAll();
  toast("30-Tage-Plan zurückgesetzt.");
});
$("#syncForm").addEventListener("submit", async event => {
  event.preventDefault();
  state.sync = {
    endpoint: $("#syncEndpoint").value.trim(),
    workspace: $("#syncWorkspace").value.trim(),
    auto: $("#syncAuto").checked
  };
  const submittedToken = $("#syncToken").value.trim();
  syncTokenMemory = submittedToken;
  saveState();
  try {
    await synchronizeState();
    $("#syncToken").value = "";
  } catch {
    if (submittedToken) $("#syncToken").value = submittedToken;
  }
});
$("#syncNow").addEventListener("click", () => { synchronizeState().catch(() => {}); });
$("#syncAuto").addEventListener("change", event => {
  state.sync.auto = event.target.checked;
  saveState();
});
$("#providerForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  const status = $("#providerStatus");
  const keys = collectProviderKeys();
  const config = {
    endpoint: $("#providerEndpoint").value.trim() || GROQ_ENDPOINT,
    model: $("#providerModel").value.trim() || GROQ_MODEL,
    key: keys[0] ?? ""
  };
  button.disabled = true;
  status.textContent = "Cloud-Router wird geprüft …";
  try {
    if (!keys.length) throw new Error("Mindestens ein Groq-Key ist erforderlich.");
    if (!hasCloudConfiguration()) throw new Error("Bitte zuerst Sync-Endpunkt, Arbeitsraum und Zugriffstoken setzen.");
    await testProvider(config, AbortSignal.timeout(15000));
    await createCloudClient().connectProviderPool({ endpoint: config.endpoint, model: config.model, keys }, AbortSignal.timeout(15000));
    state.provider = { endpoint: config.endpoint, model: config.model, useAgents: true };
    state.agentAuto = true;
    saveState();
    ["#providerKey", "#providerKey2", "#providerKey3"].forEach(selector => { $(selector).value = ""; });
    status.textContent = `${keys.length} Groq-Key${keys.length === 1 ? "" : "s"} an den Cloud-Router übertragen. Keine lokale Key-Speicherung.`;
    await refreshCloudStatus();
    const goal = chooseAutomaticResearchGoal(state);
    $("#agentGoal").value = goal;
    setTimeout(() => executeAgentCycle(goal, true, state.agentDepth), 0);
  } catch (error) {
    status.textContent = `Nicht verbunden: ${error.message}`;
  } finally {
    button.disabled = false;
  }
});
$("#providerDisconnect").addEventListener("click", async () => {
  try {
    if (hasCloudConfiguration()) await createCloudClient().disconnectProviderPool(AbortSignal.timeout(12000));
  } catch {}
  state.provider = { endpoint: "", model: "", useAgents: false };
  saveState();
  $("#providerKey").value = "";
  $("#providerKey2").value = "";
  $("#providerKey3").value = "";
  $("#providerEndpoint").value = GROQ_ENDPOINT;
  $("#providerModel").value = GROQ_MODEL;
  $("#providerStatus").textContent = "Cloud-Router getrennt · kostenloser lokaler Modus aktiv.";
  await refreshCloudStatus();
});
$("#exportData").addEventListener("click", () => {
  const blob = new Blob([exportState(state)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `eulen-export-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
  $("#dataStatus").textContent = "Export erstellt.";
});
$("#importData").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    state = importState(await file.text());
    saveState();
    renderAll();
    $("#dataStatus").textContent = "Daten erfolgreich importiert.";
  } catch (error) {
    $("#dataStatus").textContent = `Import fehlgeschlagen: ${error.message}`;
  } finally {
    event.target.value = "";
  }
});
$("#deleteData").addEventListener("click", () => {
  if (!confirm("Alle lokalen EULEN-Daten unwiderruflich löschen?")) return;
  localStorage.removeItem(STORAGE_KEY);
  syncTokenMemory = "";
  cloudStatusCache = null;
  state = createInitialState();
  renderAll();
  $("#dataStatus").textContent = "Alle lokalen Daten wurden gelöscht.";
});

stateChannel?.addEventListener("message", event => {
  if (event.data?.type !== "state-updated" || Date.parse(event.data.updatedAt) <= Date.parse(state.updatedAt)) return;
  state = loadState();
  renderAll();
  toast("Änderung aus einem anderen Tab übernommen.");
});
window.addEventListener("storage", event => {
  if (event.key !== STORAGE_KEY || !event.newValue) return;
  const incoming = normalizeState(JSON.parse(event.newValue));
  if (Date.parse(incoming.updatedAt) <= Date.parse(state.updatedAt)) return;
  state = incoming;
  renderAll();
});
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event;
  $("#installApp").hidden = false;
  $("#pwaStatus").textContent = "Installation verfügbar";
});
$("#installApp").addEventListener("click", async () => {
  if (!installPrompt) return;
  await installPrompt.prompt();
  installPrompt = null;
  $("#installApp").hidden = true;
});

$("#cloudStatusRefresh")?.addEventListener("click", async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try { await refreshCloudStatus(false); } finally { button.disabled = false; }
});
$("#cloudRunNow")?.addEventListener("click", async event => {
  const status = $("#cloudOpsStatus");
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const result = await createCloudClient().runAutomationNow(AbortSignal.timeout(15000));
    status.textContent = result?.status === "completed"
      ? "Cloud-Zyklus erfolgreich ausgeführt."
      : result?.status === "failed"
        ? `Cloud-Zyklus fehlgeschlagen: ${result?.error || "unbekannt"}`
        : `Cloud-Zyklus nicht ausgeführt: ${result?.status || "unbekannt"}${result?.error ? ` (${result.error})` : ""}.`;
    await refreshCloudStatus();
  } catch (error) {
    status.textContent = `Cloud-Zyklus fehlgeschlagen: ${error.message}`;
  } finally {
    button.disabled = false;
  }
});
$("#cloudAutomationToggle")?.addEventListener("click", async event => {
  const status = $("#cloudOpsStatus");
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await refreshCloudStatus();
    const running = cloudStatusCache?.automation?.running === true;
    const intervalSeconds = Number(state.agentIntervalSeconds) || 15;
    const result = running
      ? await createCloudClient().stopAutomation(AbortSignal.timeout(15000))
      : await createCloudClient().startAutomation(intervalSeconds, AbortSignal.timeout(15000));
    status.textContent = running
      ? "Cloud-Automation gestoppt."
      : result?.immediateRun && result.immediateRun !== "completed"
        ? `Cloud-Automation gestartet (${result?.intervalSeconds ?? intervalSeconds}s), aber erster Lauf übersprungen: ${result.immediateRun}${result?.reason ? ` (${result.reason})` : ""}.`
        : `Cloud-Automation gestartet (${result?.intervalSeconds ?? intervalSeconds}s).`;
    await refreshCloudStatus();
  } catch (error) {
    status.textContent = `Cloud-Automation konnte nicht geändert werden: ${error.message}`;
  } finally {
    button.disabled = false;
  }
});

const initialView = location.hash.slice(1);
const hasInitialView = initialView && document.getElementById(initialView)?.classList.contains("view");
navigate(hasInitialView ? initialView : "dashboard");
renderAll();
startNetworkVisualization();

setInterval(processAutomationTick, 5 * 1000);
window.addEventListener("focus", processAutomationTick);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) processAutomationTick();
});
if (state.overnight.active) setTimeout(processAutomationTick, 0);
setTimeout(() => refreshCloudStatus(), 0);

setInterval(() => {
  if (state.sync.auto && state.sync.endpoint && state.sync.workspace) synchronizeState({ silent: true }).catch(() => {});
}, 30 * 1000);

setInterval(() => {
  if (state.provider.useAgents || hasCloudConfiguration()) refreshCloudStatus();
}, 45 * 1000);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").then(() => {
    $("#pwaStatus").textContent = "Offline-Web-App aktiv";
  }).catch(error => {
    $("#pwaStatus").textContent = `Offline-Modus nicht aktiv: ${error.message}`;
  });
}
