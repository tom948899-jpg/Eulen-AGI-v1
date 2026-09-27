import http from "node:http";
import { randomUUID, createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyFormulaToDomain,
  chooseAutomaticResearchGoal,
  createInitialState,
  evolveLearningPolicy,
  integrateResearchLearning,
  normalizeState,
  runAgentCycle,
  runScenarioSeries
} from "../src/core.js";
import { OpenAICompatibleProvider } from "../src/providers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const STORE_PATH = path.join(DATA_DIR, "cloud-store.json");
const PORT = Number(process.env.PORT || 8787);
const SECRET = process.env.CLOUD_AGENT_SECRET || "";
const ALLOW_EPHEMERAL_SECRET = process.env.ALLOW_EPHEMERAL_SECRET === "1";
if (!SECRET && !ALLOW_EPHEMERAL_SECRET) {
  throw new Error("CLOUD_AGENT_SECRET fehlt. Setze ein persistentes Secret oder ALLOW_EPHEMERAL_SECRET=1 für lokale Tests.");
}
const EFFECTIVE_SECRET = SECRET || randomBytes(32).toString("hex");
const KEY = createHash("sha256").update(EFFECTIVE_SECRET).digest();

const store = { workspaces: {} };
let storeDirty = false;
let saveInFlight = null;
let schedulerRunning = false;
let dirtyWhileSaving = false;

async function loadStore() {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.workspaces) {
      Object.assign(store, { workspaces: parsed.workspaces });
    }
  } catch {}
}

async function saveStore() {
  if (saveInFlight) return saveInFlight;
  if (!storeDirty) return;
  saveInFlight = (async () => {
    dirtyWhileSaving = false;
    storeDirty = false;
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
    if (dirtyWhileSaving) storeDirty = true;
  })();
  try {
    await saveInFlight;
  } finally {
    saveInFlight = null;
  }
  if (storeDirty) return saveStore();
}

function markDirty() {
  if (saveInFlight) dirtyWhileSaving = true;
  storeDirty = true;
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function parseWorkspace(pathname, prefix) {
  const value = decodeURIComponent(pathname.slice(prefix.length));
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,99}$/.test(value) ? value : "";
}

function bearerToken(req) {
  const auth = String(req.headers.authorization || "").trim();
  if (!auth) return "";
  const lower = auth.toLowerCase();
  if (!lower.startsWith("bearer ")) return "";
  return auth.slice(7).trim();
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function ensureWorkspace(id) {
  if (!store.workspaces[id]) {
    store.workspaces[id] = {
      authHash: "",
      state: createInitialState(),
      updatedAt: "",
      hasState: false,
      provider: { endpoint: "", model: "", keyPool: [], cursor: 0 },
      automation: { enabled: false, intervalSeconds: 60, running: false, lastRunAt: "", lastError: "", completed: 0, failed: 0, skipped: 0, allowLocalFallback: true, lastMode: "" }
    };
    markDirty();
  }
  return store.workspaces[id];
}

function authorize(req, workspace, { allowProvision = false } = {}) {
  const token = bearerToken(req);
  if (!token) return { ok: false, error: "Fehlendes Zugriffstoken." };
  if (!workspace.authHash) {
    if (!allowProvision) return { ok: false, error: "Arbeitsraum noch nicht provisioniert. Bitte zuerst den Sync-Stand schreiben." };
    workspace.authHash = hashToken(token);
    markDirty();
    return { ok: true, token, provisioned: true };
  }
  if (workspace.authHash !== hashToken(token)) return { ok: false, error: "Ungültiges Zugriffstoken." };
  return { ok: true, token };
}

function encryptSecret(secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    value: encrypted.toString("base64"),
    tag: tag.toString("base64")
  };
}

function decryptSecret(payload) {
  const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const value = Buffer.concat([
    decipher.update(Buffer.from(payload.value, "base64")),
    decipher.final()
  ]);
  return value.toString("utf8");
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (data.length > 2_000_000) {
        reject(new Error("Payload zu groß."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("Ungültiges JSON."));
      }
    });
    req.on("error", reject);
  });
}

function guardrailsState(input) {
  const state = normalizeState(input);
  const simulations = (state.simulations || []).map(item => {
    const params = { ...(item.params || {}) };
    if (Number.isFinite(Number(params.budget))) params.budget = Math.min(200, Number(params.budget));
    if (Number.isFinite(Number(params.capital))) params.capital = Math.min(200, Number(params.capital));
    if (Number.isFinite(Number(params.amount))) params.amount = Math.min(200, Number(params.amount));
    if (Number.isFinite(Number(params.days))) params.days = Math.min(30, Math.max(1, Number(params.days)));
    return { ...item, params };
  });
  state.simulations = simulations;
  state.lifeGoal = `${state.lifeGoal}\n[SERVER-GUARDRAIL] Max. Startbudget 200 €, 30-Tage-Rahmen, keine Echtgeld-Automation.`.slice(0, 1000);
  return state;
}

async function routedProviderReply(workspace, text, providerState, signal) {
  const provider = workspace.provider;
  const now = Date.now();
  const total = provider.keyPool.length;
  if (!provider.endpoint || !provider.model || !total) {
    throw new Error("Kein aktiver Groq-Key im Cloud-Router verfügbar.");
  }
  let lastError;
  let attempts = 0;
  for (let offset = 0; offset < total; offset += 1) {
    const index = (provider.cursor + offset) % total;
    const candidate = provider.keyPool[index];
    if ((candidate.cooldownUntil || 0) > now) continue;
    attempts += 1;
    try {
      const key = decryptSecret(candidate.secret);
      const llm = new OpenAICompatibleProvider({ endpoint: provider.endpoint, model: provider.model, key });
      const content = await llm.reply(String(text || ""), providerState || { chat: [] }, signal);
      provider.cursor = (index + 1) % total;
      candidate.lastError = "";
      candidate.lastUsedAt = new Date().toISOString();
      markDirty();
      return { content, route: `${index + 1}/${total}` };
    } catch (error) {
      lastError = error;
      candidate.lastError = error.message;
      if (/429|rate|limit/i.test(error.message)) candidate.cooldownUntil = Date.now() + 5 * 60 * 1000;
      markDirty();
    }
  }
  if (!attempts) throw new Error("Alle Groq-Keys befinden sich in Cooldown.");
  throw lastError || new Error("Alle Keys fehlgeschlagen.");
}

function validateProviderEndpoint(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw new Error("Provider-Endpoint ist keine gültige URL.");
  }
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("Provider-Endpoint muss HTTPS verwenden.");
  }
  return url.toString();
}

function hasProviderPool(workspace) {
  return Boolean(workspace?.provider?.endpoint && workspace?.provider?.model && Array.isArray(workspace?.provider?.keyPool) && workspace.provider.keyPool.length);
}

function createAdaptiveAutomationGoal(state) {
  const open = state.researchMemory?.openQuestions?.find(item => typeof item === "string" && item.trim());
  if (open) {
    return `Beantworte priorisiert die offene Frage: "${open.trim().slice(0, 280)}". Trenne Fakten, Hypothesen und Simulationen und liefere einen konkreten nächsten Schritt.`;
  }
  return chooseAutomaticResearchGoal(state);
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchResearchHints(query, signal) {
  const search = String(query || "").trim().slice(0, 180);
  if (!search) return [];
  const wikipediaUrl = new URL("https://de.wikipedia.org/w/api.php");
  wikipediaUrl.search = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: search,
    srnamespace: "0",
    srlimit: "4",
    srprop: "snippet|timestamp",
    format: "json",
    origin: "*"
  }).toString();
  const crossrefUrl = new URL("https://api.crossref.org/works");
  crossrefUrl.search = new URLSearchParams({
    query: search,
    rows: "3",
    select: "DOI,title,URL,published,container-title"
  }).toString();

  const [wiki, crossref] = await Promise.allSettled([
    fetch(wikipediaUrl, { method: "GET", headers: { Accept: "application/json" }, signal }),
    fetch(crossrefUrl, { method: "GET", headers: { Accept: "application/json" }, signal })
  ]);

  const results = [];
  if (wiki.status === "fulfilled" && wiki.value.ok) {
    const payload = await wiki.value.json();
    results.push(...(payload?.query?.search || []).map(item => ({
      title: `Wikipedia: ${item.title}`,
      url: `https://de.wikipedia.org/?curid=${item.pageid}`,
      excerpt: stripHtml(item.snippet).slice(0, 500),
      provider: "Wikipedia-Suche",
      retrievedAt: item.timestamp || new Date().toISOString()
    })));
  }
  if (crossref.status === "fulfilled" && crossref.value.ok) {
    const payload = await crossref.value.json();
    results.push(...(payload?.message?.items || []).map(item => ({
      title: `Crossref: ${item.title?.[0] || item.DOI}`,
      url: item.URL || `https://doi.org/${item.DOI}`,
      excerpt: [item["container-title"]?.[0], (item.published?.["date-parts"]?.[0] || []).join("-")].filter(Boolean).join(" · ").slice(0, 500),
      provider: "Crossref-Metadatensuche",
      retrievedAt: new Date().toISOString()
    })));
  }

  return results
    .filter(item => item.url)
    .filter((item, index, arr) => arr.findIndex(other => other.url === item.url) === index)
    .slice(0, 6);
}

function automaticSimulationType(topics = []) {
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

async function runAutomationCycle(workspace) {
  if (workspace.automation.running) {
    workspace.automation.skipped = (workspace.automation.skipped || 0) + 1;
    markDirty();
    return { status: "skipped-running" };
  }
  const providerReady = hasProviderPool(workspace);
  if (!providerReady && workspace.automation.allowLocalFallback === false) {
    workspace.automation.skipped = (workspace.automation.skipped || 0) + 1;
    workspace.automation.lastError = "Provider-Pool fehlt und lokaler Fallback ist deaktiviert.";
    workspace.automation.lastMode = "blocked";
    markDirty();
    return { status: "skipped-no-provider", error: workspace.automation.lastError };
  }

  workspace.automation.running = true;
  markDirty();
  try {
    const state = guardrailsState(workspace.state);
    const goal = createAdaptiveAutomationGoal(state);
    const run = runAgentCycle(goal, state.agentDepth, state.chatMode, state);

    try {
      const discovered = await fetchResearchHints(run.researchPlan?.searchQuery || goal, AbortSignal.timeout(9000));
      if (discovered.length) {
        const enriched = discovered.map(item => ({ ...item, topic: run.topics?.[0] || "Cloud-Automation", kind: "QUELLE" }));
        const sourceMap = new Map();
        for (const source of [...(run.sources || []), ...enriched]) {
          if (source?.url && !sourceMap.has(source.url)) sourceMap.set(source.url, source);
        }
        run.sources = [...sourceMap.values()].slice(0, 18);
      }
      run.liveResearch = { attempted: true, provider: "Wikipedia/Crossref", discovered: discovered.length, newSources: discovered.length, error: "" };
    } catch (error) {
      run.liveResearch = { attempted: true, provider: "Wikipedia/Crossref", discovered: 0, newSources: 0, error: error.message };
    }

    if (providerReady) {
      try {
        const routed = await routedProviderReply(
          workspace,
          `Erzeuge ein kurzes Cloud-Lernpaket für den autonomen Lauf: ${goal}`,
          { ...state, chat: [] },
          AbortSignal.timeout(20000)
        );
        const synthesisStep = run.steps.find(step => step.agent === "Synthese");
        if (synthesisStep) synthesisStep.output = `[CLOUD-GROQ] ${routed.content.slice(0, 1600)}`;
        run.externalSynthesis = true;
        run.providerRoute = routed.route;
      } catch (error) {
        run.externalSynthesisError = error.message;
      }
    } else {
      run.externalSynthesisError = "Kein Provider verbunden; lokaler Fallback genutzt.";
    }

    const autoType = automaticSimulationType(run.topics);
    const sequence = Number(workspace.automation.completed || 0) + Number(workspace.automation.failed || 0) + 1;
    const baseParams = autoType === "trading" ? { seed: 40 + sequence } : autoType === "formula" ? { n: 20 + sequence } : {};
    const simulations = runScenarioSeries(autoType, baseParams);
    run.automatic = true;
    run.automaticSimulations = simulations.map(item => ({
      type: autoType,
      scenario: item.scenario,
      verdict: item.verdict,
      score: item.score,
      formulaMaturity: applyFormulaToDomain(`${autoType}:${item.scenario}`, (item.stats?.length ?? 0) + (item.assumptions?.length ?? 0))
    }));
    state.simulations = [...simulations, ...state.simulations].slice(0, 50);
    state.totalSimulationCycles += simulations.length;
    state.researchMemory = integrateResearchLearning(state, run);
    state.learningPolicy = evolveLearningPolicy(state, run);
    state.agentRuns.unshift(run);
    state.agentRuns = state.agentRuns.slice(0, 30);
    state.totalAgentCycles += 1;
    state.updatedAt = new Date().toISOString();

    workspace.state = guardrailsState(state);
    workspace.updatedAt = workspace.state.updatedAt;
    workspace.hasState = true;
    workspace.automation.lastRunAt = workspace.updatedAt;
    workspace.automation.lastError = "";
    workspace.automation.lastMode = providerReady ? "provider" : "local-fallback";
    workspace.automation.completed = (workspace.automation.completed || 0) + 1;
    markDirty();
    return { status: "completed", mode: workspace.automation.lastMode };
  } catch (error) {
    workspace.automation.lastError = error.message;
    workspace.automation.lastMode = "failed";
    workspace.automation.failed = (workspace.automation.failed || 0) + 1;
    markDirty();
    return { status: "failed", error: error.message };
  } finally {
    workspace.automation.running = false;
    markDirty();
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const { pathname } = url;

    if (pathname === "/health") return json(res, 200, { ok: true, service: "eulen-cloud-agent" });

    if (req.method === "GET" && pathname.startsWith("/state/")) {
      const workspaceId = parseWorkspace(pathname, "/state/");
      if (!workspaceId) return json(res, 400, { error: "Ungültige Arbeitsraum-ID." });
      const workspace = ensureWorkspace(workspaceId);
      const auth = authorize(req, workspace, { allowProvision: false });
      if (!auth.ok) return json(res, 401, { error: auth.error });
      if (!workspace.hasState) return json(res, 404, { error: "Kein Stand vorhanden." });
      return json(res, 200, { updatedAt: workspace.updatedAt, state: workspace.state });
    }

    if (req.method === "PUT" && pathname.startsWith("/state/")) {
      const workspaceId = parseWorkspace(pathname, "/state/");
      if (!workspaceId) return json(res, 400, { error: "Ungültige Arbeitsraum-ID." });
      const workspace = ensureWorkspace(workspaceId);
      const auth = authorize(req, workspace, { allowProvision: true });
      if (!auth.ok) return json(res, 401, { error: auth.error });
      const payload = await parseBody(req);
      const guarded = guardrailsState(payload?.state || payload || {});
      const incomingUpdatedAt = Number.isFinite(Date.parse(payload?.updatedAt)) ? payload.updatedAt : guarded.updatedAt;
      const incomingTime = Date.parse(incomingUpdatedAt);
      if (!Number.isFinite(incomingTime)) return json(res, 400, { error: "Ungültiger updatedAt-Zeitstempel." });
      const existingTime = Number.isFinite(Date.parse(workspace.updatedAt)) ? Date.parse(workspace.updatedAt) : 0;
      if (workspace.hasState && incomingTime < existingTime) {
        return json(res, 409, { error: "Eingehender Stand ist älter als der Cloud-Stand." });
      }
      workspace.state = guarded;
      workspace.updatedAt = incomingUpdatedAt;
      workspace.state.updatedAt = workspace.updatedAt;
      workspace.hasState = true;
      markDirty();
      await saveStore();
      return json(res, 200, { updatedAt: workspace.updatedAt });
    }

    if (pathname.startsWith("/api/")) {
      const match = pathname.match(/^\/api\/(provider|status|automation)\/([^/]+)(?:\/(connect|disconnect|reply|start|stop|run-now))?$/);
      if (!match) return json(res, 404, { error: "Route nicht gefunden." });
      const [, domain, workspaceRaw, action] = match;
      const workspaceId = decodeURIComponent(workspaceRaw);
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,99}$/.test(workspaceId)) return json(res, 400, { error: "Ungültige Arbeitsraum-ID." });
      const workspace = ensureWorkspace(workspaceId);
      const auth = authorize(req, workspace, { allowProvision: false });
      if (!auth.ok) return json(res, 401, { error: auth.error });

      if (domain === "status" && req.method === "GET") {
        return json(res, 200, {
          workspace: workspaceId,
          state: { updatedAt: workspace.updatedAt },
          router: {
            endpoint: workspace.provider.endpoint,
            model: workspace.provider.model,
            keys: workspace.provider.keyPool.length,
            coolingDown: workspace.provider.keyPool.filter(item => (item.cooldownUntil || 0) > Date.now()).length,
            lastErrors: workspace.provider.keyPool.map(item => item.lastError).filter(Boolean).slice(0, 3)
          },
          automation: {
            enabled: workspace.automation.enabled,
            running: workspace.automation.running === true,
            intervalSeconds: workspace.automation.intervalSeconds,
            lastRunAt: workspace.automation.lastRunAt,
            lastError: workspace.automation.lastError,
            completed: workspace.automation.completed,
            failed: workspace.automation.failed || 0,
            skipped: workspace.automation.skipped || 0,
            allowLocalFallback: workspace.automation.allowLocalFallback !== false,
            lastMode: workspace.automation.lastMode || ""
          }
        });
      }

      if (domain === "provider" && req.method === "POST" && action === "connect") {
        const payload = await parseBody(req);
        const endpoint = validateProviderEndpoint(payload.endpoint);
        const model = String(payload.model || "").trim();
        const keys = Array.isArray(payload.keys) ? [...new Set(payload.keys.map(item => String(item || "").trim()).filter(Boolean))].slice(0, 3) : [];
        if (!endpoint || !model || !keys.length) return json(res, 400, { error: "Endpoint, Modell und mindestens ein Key erforderlich." });
        workspace.provider = {
          endpoint,
          model,
          cursor: 0,
          keyPool: keys.map((key, index) => ({ id: index + 1, secret: encryptSecret(key), cooldownUntil: 0, lastError: "", lastUsedAt: "" }))
        };
        markDirty();
        await saveStore();
        return json(res, 200, { status: "connected", keys: workspace.provider.keyPool.length });
      }

      if (domain === "provider" && req.method === "POST" && action === "disconnect") {
        workspace.provider = { endpoint: "", model: "", keyPool: [], cursor: 0 };
        markDirty();
        await saveStore();
        return json(res, 200, { status: "disconnected" });
      }

      if (domain === "provider" && req.method === "POST" && action === "reply") {
        const payload = await parseBody(req);
        const reply = await routedProviderReply(workspace, payload.text, payload.providerState, AbortSignal.timeout(25000));
        return json(res, 200, reply);
      }

      if (domain === "automation" && req.method === "POST" && action === "start") {
        const payload = await parseBody(req);
        const intervalSeconds = Math.max(15, Math.min(3600, Number(payload.intervalSeconds) || 60));
        workspace.automation.enabled = true;
        workspace.automation.intervalSeconds = intervalSeconds;
        workspace.automation.allowLocalFallback = payload?.allowLocalFallback !== false;
        markDirty();
        const canRunNow = hasProviderPool(workspace) || workspace.automation.allowLocalFallback;
        const immediate = canRunNow ? await runAutomationCycle(workspace) : { status: "skipped-no-provider", error: "Provider-Pool fehlt und Fallback deaktiviert" };
        return json(res, 200, {
          status: "started",
          intervalSeconds,
          immediateRun: immediate.status,
          reason: canRunNow ? "" : "Provider-Pool fehlt und lokaler Fallback ist deaktiviert",
          allowLocalFallback: workspace.automation.allowLocalFallback !== false
        });
      }

      if (domain === "automation" && req.method === "POST" && action === "stop") {
        workspace.automation.enabled = false;
        markDirty();
        return json(res, 200, { status: "stopped" });
      }

      if (domain === "automation" && req.method === "POST" && action === "run-now") {
        const canRunNow = hasProviderPool(workspace) || workspace.automation.allowLocalFallback;
        if (!canRunNow) {
          workspace.automation.skipped = (workspace.automation.skipped || 0) + 1;
          markDirty();
          return json(res, 200, { status: "skipped-no-provider", error: "Provider-Pool fehlt und Fallback deaktiviert", updatedAt: workspace.updatedAt });
        }
        const result = await runAutomationCycle(workspace);
        return json(res, 200, { status: result.status, reason: result.status, error: result.error || "", mode: result.mode || "", updatedAt: workspace.updatedAt });
      }

      return json(res, 405, { error: "Methode nicht erlaubt." });
    }

    return json(res, 404, { error: "Nicht gefunden." });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
});

await loadStore();

setInterval(async () => {
  if (schedulerRunning) return;
  schedulerRunning = true;
  try {
    for (const workspace of Object.values(store.workspaces)) {
      try {
        if (!workspace.automation.enabled) continue;
        const canRunNow = hasProviderPool(workspace) || workspace.automation.allowLocalFallback;
        if (!canRunNow) continue;
        const last = Date.parse(workspace.automation.lastRunAt || 0);
        if (Date.now() - last < workspace.automation.intervalSeconds * 1000) continue;
        await runAutomationCycle(workspace);
      } catch (error) {
        workspace.automation.lastError = error.message;
        workspace.automation.failed = (workspace.automation.failed || 0) + 1;
        workspace.automation.running = false;
        markDirty();
      }
    }
    await saveStore();
  } finally {
    schedulerRunning = false;
  }
}, 15_000);

setInterval(saveStore, 4_000);

server.listen(PORT, () => {
  console.log(`EULEN Cloud-Agent läuft auf Port ${PORT}`);
  if (!process.env.CLOUD_AGENT_SECRET) {
    console.log("Hinweis: ephemeres Secret aktiv (ALLOW_EPHEMERAL_SECRET=1). Persistente verschlüsselte Keys sind nach Neustart ungültig.");
  }
});
