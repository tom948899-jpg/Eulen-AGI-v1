import { KNOWLEDGE_TOPICS, PLAN, SIMULATION_DEFINITIONS } from "./data.js?v=6";
import {
  STORAGE_KEY,
  calculateProgress,
  createInitialState,
  exportState,
  formulaValue,
  generateDream,
  getCurrentDay,
  importState,
  INTERNAL_SIMULATION_COUNT,
  learningCycleCount,
  normalizeState,
  runScenarioSeries,
  runSimulation,
  taskKey
} from "./core.js?v=6";
import { GROQ_ENDPOINT, GROQ_MODEL, LocalProvider, OpenAICompatibleProvider, testProvider } from "./providers.js?v=6";
import { SyncProvider } from "./sync.js?v=6";

let state = loadState();
let activeSimulation = "budget";
let activeTopic = KNOWLEDGE_TOPICS[0].id;
let saveTimer;
let syncInProgress = false;
let agentCycleInProgress = false;
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
  $("#providerStatus").textContent = sessionStorage.getItem("eulen-provider-key") && state.provider.endpoint
    ? "Groq ist für Chat und Agentensynthesen verbunden."
    : "Noch kein Groq-Key verbunden · lokaler Modus aktiv.";
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
  const nextTask = day.tasks.find((_, index) => !state.completed[taskKey(day.day, index)]) ?? "Tagesreflexion notieren.";
  const guidance = [
    ["Nächster Schritt", nextTask],
    ["Formel-Hinweis", `${INTERNAL_SIMULATION_COUNT} interne Referenzläufe plus ${state.simulations.length + state.agentRuns.length} eigene Lernzyklen ergeben P=${formulaValue(learningCycles).toFixed(4)}.`],
    ["Agenten-Hinweis", state.agentRuns.length ? "Lass den Kritiker den letzten Lauf mit einem Gegenbeispiel prüfen." : "Starte einen Agentenlauf zu Bewusstsein oder Nullwelt-Physik."],
    ["Gelernte Verbesserung", state.improvementProposals[0] ?? "Noch keine Verbesserung gespeichert. Ein Agentenzyklus erzeugt den ersten Prüfhinweis."],
    ["Traum-Impuls", state.dreams[0]?.nextStep ?? "Noch kein simulierter Traum. Der Traumagent kann kreative Verbindungen erzeugen."]
  ];
  $("#guidanceFeed").innerHTML = guidance.map(([title, text]) => `<div><strong>${escapeHtml(title)}</strong>${escapeHtml(text)}</div>`).join("");
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
  $("#agentInterval").value = String(state.agentInterval);
  const runs = state.agentRuns;
  $("#agentCycleCount").textContent = runs.length;
  $("#agentFormula").textContent = formulaValue(INTERNAL_SIMULATION_COUNT + runs.length).toFixed(4);
  $("#agentSourceCount").textContent = runs.reduce((sum, run) => sum + run.sources.length, 0);
  $("#agentRuns").innerHTML = runs.length ? runs.map(run => `
    <article class="agent-run">
      <header><strong>${escapeHtml(run.goal)}</strong><span>${dateTime(run.timestamp)}${run.automatic ? " · automatisch" : ""}</span></header>
      <div class="agent-steps">${run.steps.map(step => `<div class="agent-step"><strong>${escapeHtml(step.agent)}</strong><small>${escapeHtml(step.output)}</small></div>`).join("")}</div>
      <details><summary>${run.sources.length} verwendete Quellen</summary><ul class="sources">${run.sources.map(source => `<li><a href="${source.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a></li>`).join("")}</ul></details>
    </article>`).join("") : '<p class="empty-state">Noch kein Agentenauftrag ausgeführt.</p>';
  renderDreams();
  renderLearningMemory();
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
  const insights = state.learnedInsights.slice(0, 6);
  const proposals = state.improvementProposals.slice(0, 6);
  $("#learningMemory").innerHTML = `
    <section class="memory-column"><h3>Gespeicherte Lernschritte</h3>${insights.length ? `<ol>${insights.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ol>` : "<p class=\"empty-state\">Noch keine Synthese gespeichert.</p>"}</section>
    <section class="memory-column"><h3>Verbesserungsprüfungen</h3>${proposals.length ? `<ol>${proposals.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ol>` : "<p class=\"empty-state\">Noch kein Kritikhinweis gespeichert.</p>"}</section>`;
}

async function executeAgentCycle(goal, automatic = false, depth = state.agentDepth, useExternal = state.provider.useAgents) {
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
    const { runAgentCycle } = await import("./core.js?v=6");
    const run = { ...runAgentCycle(goal, depth), automatic };
    if (useExternal) {
      const endpoint = state.provider.endpoint;
      const model = state.provider.model;
      const key = sessionStorage.getItem("eulen-provider-key") ?? "";
      if (!endpoint || !model || !key) {
        run.externalSynthesisError = "Kein getesteter Chat-Provider konfiguriert";
      } else {
        try {
          const provider = new OpenAICompatibleProvider({ endpoint, model, key });
          const sourceList = run.sources.map(source => `${source.title}: ${source.url}`).join("\n");
          const synthesis = await provider.reply(
            `Erstelle eine kurze deutschsprachige Synthese für diesen Lernauftrag: ${run.goal}\n\n`
            + `Nutze nur die folgenden bereits kuratierten Quellenmetadaten als Ausgangspunkte und behaupte nicht, die Seiten live gelesen zu haben:\n${sourceList}\n\n`
            + "Trenne Fakt, P(sim)-Hypothese, Gegenargument und nächsten überprüfbaren Lernschritt.",
            { ...state, chat: [] }
          );
          const step = run.steps.find(item => item.agent === "Synthese");
          if (step) step.output = `[EXTERNE MODELLSYNTHESE · KEINE LIVE-RECHERCHE] ${synthesis.slice(0, 2200)}`;
          run.externalSynthesis = true;
        } catch (error) {
          run.externalSynthesisError = error.message;
        }
      }
    }
    for (const step of run.steps) {
      setNetworkActivity(step.agent, step.output.split(".")[0], `Agentenzyklus ${state.agentRuns.length + 1} · P(sim)=${formulaValue(INTERNAL_SIMULATION_COUNT + state.agentRuns.length).toFixed(4)}`, true);
      const card = document.querySelector(`[data-agent-card="${step.agent}"]`);
      card?.classList.add("working");
      if (card) card.querySelector("small").textContent = `Arbeitet · ${step.output.split(".")[0]}`;
      await new Promise(resolve => setTimeout(resolve, 180));
      card?.classList.remove("working");
      card?.classList.add("done");
      if (card) card.querySelector("small").textContent = `Fertig · ${step.output.split(".")[0]}`;
    }
    state.agentRuns.unshift(run);
    state.agentRuns = state.agentRuns.slice(0, 30);
    state.dreams.unshift(run.dream);
    state.dreams = state.dreams.slice(0, 30);
    const synthesis = run.steps.find(step => step.agent === "Synthese")?.output;
    const improvement = run.steps.find(step => step.agent === "Kritiker")?.output;
    if (synthesis) state.learnedInsights = [synthesis, ...state.learnedInsights.filter(item => item !== synthesis)].slice(0, 100);
    if (improvement) state.improvementProposals = [improvement, ...state.improvementProposals.filter(item => item !== improvement)].slice(0, 100);
    saveState();
    renderAgents();
    renderResearchMissions();
    renderDashboard();
    setNetworkActivity("Synthese", "Lernzyklus gespeichert", `${run.sources.length} Quellen verarbeitet · N=${learningCycleCount(state)}`, false);
    const externalStatus = run.externalSynthesis
      ? " Externe Modellsynthese gespeichert."
      : run.externalSynthesisError ? ` Lokale Synthese verwendet: ${run.externalSynthesisError}.` : "";
    $("#agentStatus").textContent = `Abgeschlossen: ${run.sources.length} Quellen, ${run.steps.length} Agentenschritte gespeichert.${externalStatus}`;
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
    : "Hypothesenmodus: Innerhalb des Gedankenuniversums gilt P(sim) als Axiom. EULEN bleibt ein Softwaresystem und behauptet kein Bewusstsein.";
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
  let provider = new LocalProvider();
  const endpoint = state.provider.endpoint;
  const model = state.provider.model;
  const key = sessionStorage.getItem("eulen-provider-key") ?? "";
  if (endpoint && model && key) provider = new OpenAICompatibleProvider({ endpoint, model, key });
  try {
    const reply = await provider.reply(clean, state);
    state.chat.push({ role: "assistant", text: reply });
  } catch (error) {
    const fallback = await new LocalProvider().reply(clean, state);
    state.chat.push({ role: "assistant", text: `Der externe Provider war nicht erreichbar (${error.message}). Ich wechsle transparent in den lokalen Modus.\n\n${fallback}` });
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
    const token = sessionStorage.getItem("eulen-sync-token") ?? $("#syncToken").value.trim();
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
      { id: "Werte", x: .16, y: .18, layer: 1 }, { id: "Ziel", x: .15, y: .5, layer: 1 }, { id: "Planer", x: .17, y: .82, layer: 1 },
      { id: "Quellen", x: .3, y: .09, layer: 2 }, { id: "Rechercheur", x: .32, y: .29, layer: 2 }, { id: "Geschichte", x: .29, y: .52, layer: 2 },
      { id: "Staat", x: .32, y: .74, layer: 2 }, { id: "Anatomie", x: .29, y: .92, layer: 2 },
      { id: "Zeit", x: .48, y: .08, layer: 3 }, { id: "Bewusstsein", x: .49, y: .27, layer: 3 }, { id: "Spiritualität", x: .47, y: .47, layer: 3 },
      { id: "Chancen", x: .5, y: .68, layer: 3 }, { id: "Simulation", x: .47, y: .9, layer: 3 },
      { id: "Lernen", x: .65, y: .13, layer: 4 }, { id: "Risiko", x: .67, y: .36, layer: 4 }, { id: "Kritiker", x: .65, y: .62, layer: 4 }, { id: "Traum", x: .67, y: .86, layer: 4 },
      { id: "Synthese", x: .81, y: .28, layer: 5 }, { id: "Gedächtnis", x: .8, y: .57, layer: 5 }, { id: "Assistent", x: .91, y: .4, layer: 6 }, { id: "Sync", x: .93, y: .72, layer: 6 }
    ];
    const edges = [
      [0,1],[0,2],[0,3],[1,4],[1,10],[1,11],[2,5],[2,12],[2,13],[3,4],[3,5],[3,14],
      [4,5],[4,6],[4,7],[4,8],[4,9],[5,6],[5,10],[5,12],[6,7],[6,9],[6,16],[7,11],[7,15],
      [8,10],[8,13],[8,15],[9,10],[9,13],[9,14],[10,11],[10,14],[10,16],[11,12],[11,17],
      [12,13],[12,15],[12,18],[13,15],[13,16],[14,15],[14,16],[14,18],[14,19],[15,16],
      [15,18],[16,17],[16,18],[16,19],[17,18],[17,19],[18,19],[18,20],[19,20],[19,21],[20,21],[21,0]
    ];
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
      for (const [from, to] of edges) {
        const a = nodes[from], b = nodes[to];
        context.strokeStyle = a.layer % 2 ? accent : accent2;
        context.globalAlpha = .14;
        context.lineWidth = 1;
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
        const aliases = {
          Wertewächter: "Werte",
          Zielklärer: "Ziel",
          Quellenprüfer: "Quellen",
          Historiker: "Geschichte",
          Staatsanalyst: "Staat",
          Anatomieforscher: "Anatomie",
          Zeitmodellierer: "Zeit",
          Bewusstseinsforscher: "Bewusstsein",
          Spiritualitätsforscher: "Spiritualität",
          Chancenfinder: "Chancen",
          Simulationsagent: "Simulation",
          Lernoptimierer: "Lernen",
          Risikowächter: "Risiko",
          Traumagent: "Traum"
        };
        const activeName = aliases[networkActivity.agent] ?? networkActivity.agent;
        const active = node.id === activeName || (networkActivity.agent === "Assistent" && node.id === "Synthese");
        context.globalAlpha = 1;
        const radius = active ? 25 : node.layer === 3 ? 21 : 18;
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
  $("#researchMissionStatus").textContent = "18 Agenten untersuchen den Auftrag …";
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
  $("#agentStatus").textContent = state.agentAuto ? `Automatik aktiv: nächster Lauf nach ${state.agentInterval} Minuten bei geöffnetem Tab.` : "Automatik deaktiviert.";
  if (state.agentAuto) executeAgentCycle($("#agentGoal").value, true, state.agentDepth);
});
$("#agentInterval").addEventListener("change", event => {
  state.agentInterval = Number(event.target.value);
  saveState();
  $("#agentStatus").textContent = `Intervall auf ${state.agentInterval} Minuten gesetzt.`;
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
  sessionStorage.setItem("eulen-sync-token", $("#syncToken").value.trim());
  saveState();
  await synchronizeState();
});
$("#syncNow").addEventListener("click", () => synchronizeState());
$("#syncAuto").addEventListener("change", event => {
  state.sync.auto = event.target.checked;
  saveState();
});
$("#providerForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  const status = $("#providerStatus");
  const config = {
    endpoint: $("#providerEndpoint").value.trim() || GROQ_ENDPOINT,
    model: $("#providerModel").value.trim() || GROQ_MODEL,
    key: $("#providerKey").value.trim()
  };
  button.disabled = true;
  status.textContent = "Verbindung wird geprüft …";
  try {
    await testProvider(config, AbortSignal.timeout(15000));
    state.provider = { endpoint: config.endpoint, model: config.model, useAgents: true };
    sessionStorage.setItem("eulen-provider-key", config.key);
    saveState();
    status.textContent = "Verbindung erfolgreich. Groq ist für Chat und Agentensynthesen aktiv; der Schlüssel bleibt nur in diesem Tab.";
  } catch (error) {
    status.textContent = `Nicht verbunden: ${error.message}`;
  } finally {
    button.disabled = false;
  }
});
$("#providerDisconnect").addEventListener("click", () => {
  sessionStorage.removeItem("eulen-provider-key");
  state.provider = { endpoint: "", model: "", useAgents: false };
  saveState();
  $("#providerKey").value = "";
  $("#providerEndpoint").value = GROQ_ENDPOINT;
  $("#providerModel").value = GROQ_MODEL;
  $("#providerStatus").textContent = "Provider getrennt · kostenloser lokaler Modus aktiv.";
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
  sessionStorage.removeItem("eulen-provider-key");
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

const initialView = location.hash.slice(1);
const hasInitialView = initialView && document.getElementById(initialView)?.classList.contains("view");
navigate(hasInitialView ? initialView : "dashboard");
renderAll();
startNetworkVisualization();

setInterval(() => {
  if (!state.agentAuto || document.hidden) return;
  const lastRun = state.agentRuns[0] ? Date.parse(state.agentRuns[0].timestamp) : 0;
  if (Date.now() - lastRun >= state.agentInterval * 60 * 1000) executeAgentCycle($("#agentGoal").value, true, state.agentDepth);
}, 60 * 1000);

setInterval(() => {
  if (state.sync.auto && state.sync.endpoint && state.sync.workspace) synchronizeState({ silent: true });
}, 30 * 1000);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").then(() => {
    $("#pwaStatus").textContent = "Offline-Web-App aktiv";
  }).catch(error => {
    $("#pwaStatus").textContent = `Offline-Modus nicht aktiv: ${error.message}`;
  });
}
