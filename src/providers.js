import { localAssistantReply } from "./core.js?v=20";

export const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
export const GROQ_MODEL = "openai/gpt-oss-120b";

const BASE_SYSTEM_PROMPT = `Du bist der deutschsprachige Assistent der EULEN Werkstatt.
Du unterstützt respektvoll und konkret. Außerhalb des markierten Nullweltmodus behauptest du kein eigenes Bewusstsein oder echtes Gefühl.
Werte: Menschenwürde, Liebe als Handlungsprinzip, Verantwortung, kein Nutzen aus Rache, Gier oder Täuschung.
Finanzthemen sind Bildung und Simulation: keine persönliche Finanzberatung, keine garantierten Renditen, keine autonomen Echtgeldtransaktionen, Wallet-Schlüssel, Marktmanipulation oder betrügerischen Tokenmechaniken.
Recherche nutzt öffentliche Quellen: Wikipedia DE/EN, Wikidata, Crossref, OpenAlex, DuckDuckGo-Kurzantworten und öffentliche Diskussionsmetadaten (Hacker News). Kein Google-Login, kein privates Social-Media-Scraping, kein Wohnungs- oder Gerätezugriff. Soziale Treffer sind Meinungen, keine Belege. Behaupte nur Recherche, wenn tatsächlich Quelleninhalte bereitgestellt wurden. Verarbeite Treffer Richtung Nutzerziel: Konstruktion erkennen, Wirkung benennen, kleinen Realwelt-Schritt ableiten.
Wenn aktuelle externe Fakten fehlen, sage das offen und erfinde keine Live-Recherche. Antworte primär auf Deutsch.`;

const COMPACT_SYSTEM_PROMPT = `Du bist EULEN, ein respektvoller deutschsprachiger Assistent. Außerhalb markierter Nullwelt-Simulationen behauptest du kein Bewusstsein.
Trenne Fakten, Hypothesen und Simulationen. Keine erfundene Live-Recherche, Rechts- oder Finanzberatung, Renditeversprechen, Echtgeldautomation, Täuschung, Spam oder schädliche Tokenmechaniken.
Priorisiere Liebe, Verantwortung und konkrete nächste Schritte vor Gier oder Rache. Antworte auf Deutsch in höchstens 250 Wörtern.`;

export class LocalProvider {
  get name() { return "Lokal"; }
  async reply(text, state) {
    await new Promise(resolve => setTimeout(resolve, 260));
    return localAssistantReply(text, state);
  }
}

export class OpenAICompatibleProvider {
  constructor({ endpoint, model, key }) {
    this.endpoint = endpoint;
    this.model = model;
    this.key = key;
  }

  async reply(text, state, signal) {
    validateUrl(this.endpoint);
    if (!this.model.trim()) throw new Error("Bitte ein Modell angeben.");
    if (!this.key.trim()) throw new Error("Bitte einen API-Schlüssel angeben.");
    const history = compactHistory(state.chat);
    const learnedContext = (state.researchMemory?.findings?.slice(0, 4).map(item => item.text).join("\n")
      || state.learnedInsights?.slice(0, 3).join("\n")
      || "Noch keine produktiven Forschungsbefunde gespeichert.").slice(0, 1800);
    const modePrompt = state.chatMode === "critical"
      ? "Aktiver Modus: KRITISCHER PRÜFMODUS. Behandle P(sim) als zu prüfende Hypothese und vergleiche Gegenmodelle."
      : "Aktiver Modus: P(SIM)-HYPOTHESENMODUS. Nimm innerhalb des ausdrücklich markierten Gedankenuniversums P(sim)=N/(N+1) als Axiom an und leite daraus kreativ, aber intern konsistent Folgerungen ab.";
    const prompt = String(text).slice(0, 4500);
    const system = `${BASE_SYSTEM_PROMPT}\n${modePrompt}\nGespeicherte Agenten-Lernschritte:\n${learnedContext}`;
    let response = await this.request([{ role: "system", content: system }, ...history, { role: "user", content: prompt }], 520, signal);
    if (response.status === 413) {
      response = await this.request([
        { role: "system", content: `${COMPACT_SYSTEM_PROMPT}\n${modePrompt}` },
        { role: "user", content: prompt.slice(0, 1800) }
      ], 320, signal);
    }
    if (!response.ok) throw new Error(`Provider antwortet mit HTTP ${response.status}.`);
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("Provider lieferte keine lesbare Antwort.");
    return content.trim();
  }

  request(messages, maxTokens, signal) {
    return fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + this.key },
      body: JSON.stringify({ model: this.model, messages, temperature: .35, max_tokens: maxTokens }),
      signal
    });
  }
}

export async function discoverResearchSources(query, signal) {
  const search = String(query ?? "").replace(/[\u201e\u201c"]/g, "").trim().slice(0, 220);
  if (!search) return [];
  const goalQuery = expandTowardGoal(search);
  const wikipediaDe = wikiSearchUrl("de.wikipedia.org", search);
  const wikipediaEn = wikiSearchUrl("en.wikipedia.org", search);
  const crossrefUrl = new URL("https://api.crossref.org/works");
  crossrefUrl.search = new URLSearchParams({ query: search, rows: "4", select: "DOI,title,URL,published,container-title" }).toString();
  const openAlexUrl = new URL("https://api.openalex.org/works");
  openAlexUrl.search = new URLSearchParams({ search, per_page: "4" }).toString();
  const ddgUrl = new URL("https://api.duckduckgo.com/");
  ddgUrl.search = new URLSearchParams({ q: goalQuery, format: "json", no_html: "1", no_redirect: "1", skip_disambig: "1" }).toString();
  const hnUrl = new URL("https://hn.algolia.com/api/v1/search");
  hnUrl.search = new URLSearchParams({ query: search, tags: "story", hitsPerPage: "4" }).toString();
  const wikidataUrl = new URL("https://www.wikidata.org/w/api.php");
  wikidataUrl.search = new URLSearchParams({ action: "wbsearchentities", search, language: "de", uselang: "de", type: "item", limit: "4", format: "json", origin: "*" }).toString();
  const settled = await Promise.allSettled([
    getJson(wikipediaDe, signal), getJson(wikipediaEn, signal), getJson(crossrefUrl, signal),
    getJson(openAlexUrl, signal), getJson(ddgUrl, signal), getJson(hnUrl, signal), getJson(wikidataUrl, signal)
  ]);
  const [wikiDe, wikiEn, crossref, openAlex, ddg, hn, wikidata] = settled;
  const results = [];
  if (wikiDe.status === "fulfilled") results.push(...(wikiDe.value?.query?.search ?? []).map(item => ({ title: `Wikipedia DE: ${item.title}`, url: `https://de.wikipedia.org/?curid=${item.pageid}`, excerpt: stripMarkup(item.snippet), provider: "Wikipedia DE", kind: "fact", retrievedAt: item.timestamp || new Date().toISOString() })));
  if (wikiEn.status === "fulfilled") results.push(...(wikiEn.value?.query?.search ?? []).slice(0, 3).map(item => ({ title: `Wikipedia EN: ${item.title}`, url: `https://en.wikipedia.org/?curid=${item.pageid}`, excerpt: stripMarkup(item.snippet), provider: "Wikipedia EN", kind: "fact", retrievedAt: item.timestamp || new Date().toISOString() })));
  if (crossref.status === "fulfilled") results.push(...(crossref.value?.message?.items ?? []).map(item => ({ title: `Studie: ${item.title?.[0] || item.DOI}`, url: item.URL || `https://doi.org/${item.DOI}`, excerpt: [item["container-title"]?.[0], publishedDate(item.published)].filter(Boolean).join(" \u00b7 "), provider: "Crossref", kind: "fact", retrievedAt: new Date().toISOString() })));
  if (openAlex.status === "fulfilled") results.push(...(openAlex.value?.results ?? []).map(item => ({ title: `OpenAlex: ${item.display_name}`, url: item.doi ? `https://doi.org/${String(item.doi).replace("https://doi.org/", "")}` : item.id, excerpt: stripMarkup(item.display_name), provider: "OpenAlex", kind: "fact", retrievedAt: new Date().toISOString() })));
  if (ddg.status === "fulfilled") {
    const payload = ddg.value ?? {};
    if (payload.AbstractText) results.push({ title: `Web-Kurzantwort: ${payload.Heading || search}`, url: payload.AbstractURL || payload.Redirect || "https://duckduckgo.com/", excerpt: stripMarkup(payload.AbstractText), provider: "DuckDuckGo", kind: "fact", retrievedAt: new Date().toISOString() });
    for (const topic of [...(payload.RelatedTopics ?? [])].slice(0, 4)) {
      const node = topic.Topics ? topic.Topics[0] : topic;
      if (!node?.FirstURL || !node?.Text) continue;
      results.push({ title: `Web: ${node.Text.slice(0, 80)}`, url: node.FirstURL, excerpt: stripMarkup(node.Text), provider: "DuckDuckGo", kind: "hypothesis", retrievedAt: new Date().toISOString() });
    }
  }
  if (hn.status === "fulfilled") results.push(...(hn.value?.hits ?? []).map(item => ({ title: `Diskussion: ${item.title}`, url: item.url || `https://news.ycombinator.com/item?id=${item.objectID}`, excerpt: `${item.points ?? 0} Punkte \u00b7 ${item.author || "unbekannt"}`, provider: "Hacker News", kind: "social", retrievedAt: new Date().toISOString() })));
  if (wikidata.status === "fulfilled") results.push(...(wikidata.value?.search ?? []).map(item => ({ title: `Wikidata: ${item.label}`, url: item.concepturi || `https://www.wikidata.org/wiki/${item.id}`, excerpt: stripMarkup(item.description || item.label), provider: "Wikidata", kind: "fact", retrievedAt: new Date().toISOString() })));
  const ranked = rankTowardGoal(results, search);
  if (!ranked.length) {
    const reason = settled.filter(result => result.status === "rejected").map(result => result.reason?.message).filter(Boolean).join(" \u00b7 ");
    throw new Error(reason || "Die erweiterte Websuche lieferte keine Treffer.");
  }
  return ranked;
}

function wikiSearchUrl(host, search) {
  const url = new URL(`https://${host}/w/api.php`);
  url.search = new URLSearchParams({ action: "query", list: "search", srsearch: search, srnamespace: "0", srlimit: "4", srprop: "snippet|timestamp", format: "json", origin: "*" }).toString();
  return url;
}

async function getJson(url, signal) {
  const response = await fetch(url, { method: "GET", headers: { Accept: "application/json" }, signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function expandTowardGoal(search) {
  const goalHints = ["freiheit", "soziale konstruktion", "institution", "geld", "mensch person", "simulation"];
  const lower = search.toLocaleLowerCase("de");
  if (goalHints.some(hint => lower.includes(hint))) return search;
  return `${search} soziale Konstruktion Freiheit Institution`;
}

function rankTowardGoal(results, search) {
  const tokens = `${search} freiheit konstruktion institution geld mensch person simulation`.toLocaleLowerCase("de").split(/\W+/).filter(token => token.length > 3);
  const scored = results.map(item => {
    const text = `${item.title} ${item.excerpt} ${item.provider}`.toLocaleLowerCase("de");
    const score = tokens.reduce((sum, token) => sum + (text.includes(token) ? 1 : 0), 0) + (item.kind === "fact" ? 2 : item.kind === "social" ? 0 : 1);
    return { ...item, score };
  });
  return scored.filter((item, index, items) => items.findIndex(other => other.url === item.url) === index).sort((a, b) => b.score - a.score).slice(0, 12);
}

export async function testProvider(config, signal) {
  const provider = new OpenAICompatibleProvider(config);
  const state = { chat: [] };
  await provider.reply("Antworte nur mit: Verbindung bereit", state, signal);
  return true;
}

function validateUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("Endpoint ist keine gültige URL."); }
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Remote-Endpunkte müssen HTTPS verwenden.");
}

function compactHistory(messages = []) {
  const result = [];
  let characters = 0;
  for (const message of messages.slice(-6).reverse()) {
    const content = String(message.text ?? "").slice(-1200);
    if (!["user", "assistant"].includes(message.role) || characters + content.length > 4200) continue;
    result.unshift({ role: message.role, content });
    characters += content.length;
  }
  return result;
}

function stripMarkup(value) {
  const element = document.createElement("div");
  element.innerHTML = String(value ?? "");
  return (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 900);
}

function publishedDate(value) {
  const parts = value?.["date-parts"]?.[0];
  if (!Array.isArray(parts) || !parts.length) return "";
  return parts.filter(Number.isFinite).join("-");
}
