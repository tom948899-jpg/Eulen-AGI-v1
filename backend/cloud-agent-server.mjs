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
const SECRET = process.env.CLOUD_AGENT_SECRET || randomBytes(32).toString("hex");
const KEY = createHash("sha256").update(SECRET).digest();

const store = { workspaces: {} };
let storeDirty = false;

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
  if (!storeDirty) return;
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  storeDirty = false;
}

function markDirty() {
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
  const auth = String(req.headers.authorization || "");
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function ensureWorkspace(id) {
  if (!store.workspaces[id]) {
    store.workspaces[id] = {
      authHash: "",
      state: createInitialState(),
      updatedAt: createInitialState().updatedAt,
      provider: { endpoint: "", model: "", keyPool: [], cursor: 0 },
      automation: { enabled: false, intervalSeconds: 60, running: false, lastRunAt: "", lastError: "", completed: 0 }
    };
    markDirty();
  }
  return store.workspaces[id];
}

function authorize(req, workspace) {
  const token = bearerToken(req);
  if (!token) return { ok: false, error: "Fehlendes Zugriffstoken." };
  if (!workspace.authHash) {
    workspace.authHash = hashToken(token);
    markDirty();
    return { ok: true, token };
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
  const available = provider.keyPool.filter(item => (item.cooldownUntil || 0) <= now);
  if (!provider.endpoint || !provider.model || !available.length) {
    throw new Error("Kein aktiver Groq-Key im Cloud-Router verfügbar.");
  }
  let lastError;
  for (let offset = 0; offset < available.length; offset += 1) {
    const index = (provider.cursor + offset) % available.length;
    const candidate = available[index];
    try {
      const key = decryptSecret(candidate.secret);
      const llm = new OpenAICompatibleProvider({ endpoint: provider.endpoint, model: provider.model, key });
      const content = await llm.reply(String(text || ""), providerState || { chat: [] }, signal);
      provider.cursor = (index + 1) % available.length;
      candidate.lastError = "";
      candidate.lastUsedAt = new Date().toISOString();
      markDirty();
      return { content, route: `${index + 1}/${available.length}` };
    } catch (error) {
      lastError = error;
      candidate.lastError = error.message;
      if (/429|rate|limit/i.test(error.message)) candidate.cooldownUntil = Date.now() + 5 * 60 * 1000;
      markDirty();
    }
  }
  throw lastError || new Error("Alle Keys fehlgeschlagen.");
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
  if (workspace.automation.running) return;
  workspace.automation.running = true;
  try {
    const state = guardrailsState(workspace.state);
    const goal = chooseAutomaticResearchGoal(state);
    const run = runAgentCycle(goal, state.agentDepth, state.chatMode, state);
    const autoType = automaticSimulationType(run.topics);
    const simulations = runScenarioSeries(autoType, {});
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
    workspace.automation.lastRunAt = workspace.updatedAt;
    workspace.automation.lastError = "";
    workspace.automation.completed += 1;
    markDirty();
  } catch (error) {
    workspace.automation.lastError = error.message;
    markDirty();
  } finally {
    workspace.automation.running = false;
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
      const auth = authorize(req, workspace);
      if (!auth.ok) return json(res, 401, { error: auth.error });
      if (!workspace.state || workspace.updatedAt === createInitialState().updatedAt) return json(res, 404, { error: "Kein Stand vorhanden." });
      return json(res, 200, { updatedAt: workspace.updatedAt, state: workspace.state });
    }

    if (req.method === "PUT" && pathname.startsWith("/state/")) {
      const workspaceId = parseWorkspace(pathname, "/state/");
      if (!workspaceId) return json(res, 400, { error: "Ungültige Arbeitsraum-ID." });
      const workspace = ensureWorkspace(workspaceId);
      const auth = authorize(req, workspace);
      if (!auth.ok) return json(res, 401, { error: auth.error });
      const payload = await parseBody(req);
      const guarded = guardrailsState(payload?.state || payload || {});
      workspace.state = guarded;
      workspace.updatedAt = Number.isFinite(Date.parse(payload?.updatedAt)) ? payload.updatedAt : guarded.updatedAt;
      workspace.state.updatedAt = workspace.updatedAt;
      markDirty();
      return json(res, 200, { updatedAt: workspace.updatedAt });
    }

    if (pathname.startsWith("/api/")) {
      const match = pathname.match(/^\/api\/(provider|status|automation)\/([^/]+)(?:\/(connect|disconnect|reply|start|stop|run-now))?$/);
      if (!match) return json(res, 404, { error: "Route nicht gefunden." });
      const [, domain, workspaceRaw, action] = match;
      const workspaceId = decodeURIComponent(workspaceRaw);
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,99}$/.test(workspaceId)) return json(res, 400, { error: "Ungültige Arbeitsraum-ID." });
      const workspace = ensureWorkspace(workspaceId);
      const auth = authorize(req, workspace);
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
            running: workspace.automation.enabled,
            intervalSeconds: workspace.automation.intervalSeconds,
            lastRunAt: workspace.automation.lastRunAt,
            lastError: workspace.automation.lastError,
            completed: workspace.automation.completed
          }
        });
      }

      if (domain === "provider" && req.method === "POST" && action === "connect") {
        const payload = await parseBody(req);
        const endpoint = String(payload.endpoint || "").trim();
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
        return json(res, 200, { status: "connected", keys: workspace.provider.keyPool.length });
      }

      if (domain === "provider" && req.method === "POST" && action === "disconnect") {
        workspace.provider = { endpoint: "", model: "", keyPool: [], cursor: 0 };
        markDirty();
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
        markDirty();
        return json(res, 200, { status: "started", intervalSeconds });
      }

      if (domain === "automation" && req.method === "POST" && action === "stop") {
        workspace.automation.enabled = false;
        markDirty();
        return json(res, 200, { status: "stopped" });
      }

      if (domain === "automation" && req.method === "POST" && action === "run-now") {
        await runAutomationCycle(workspace);
        return json(res, 200, { status: "completed", updatedAt: workspace.updatedAt });
      }

      return json(res, 405, { error: "Methode nicht erlaubt." });
    }

    return json(res, 404, { error: "Nicht gefunden." });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
});

setInterval(async () => {
  for (const workspace of Object.values(store.workspaces)) {
    if (!workspace.automation.enabled) continue;
    const last = Date.parse(workspace.automation.lastRunAt || 0);
    if (Date.now() - last < workspace.automation.intervalSeconds * 1000) continue;
    await runAutomationCycle(workspace);
  }
  await saveStore();
}, 15_000);

await loadStore();
setInterval(saveStore, 4_000);

server.listen(PORT, () => {
  console.log(`EULEN Cloud-Agent läuft auf Port ${PORT}`);
  if (!process.env.CLOUD_AGENT_SECRET) {
    console.log("Hinweis: CLOUD_AGENT_SECRET ist nicht gesetzt; verwende für Produktion ein persistentes Secret.");
  }
});
