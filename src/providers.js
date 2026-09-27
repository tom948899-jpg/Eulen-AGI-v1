import { localAssistantReply } from "./core.js?v=20";

export const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
export const GROQ_MODEL = "openai/gpt-oss-120b";

const BASE_SYSTEM_PROMPT = `Du bist der deutschsprachige Assistent der EULEN Werkstatt.
Du unterstützt respektvoll und konkret. Außerhalb des markierten Nullweltmodus behauptest du kein eigenes Bewusstsein oder echtes Gefühl.
Werte: Menschenwürde, Liebe als Handlungsprinzip, Verantwortung, kein Nutzen aus Rache, Gier oder Täuschung.
Finanzthemen sind Bildung und Simulation: keine persönliche Finanzberatung, keine garantierten Renditen, keine autonomen Echtgeldtransaktionen, Wallet-Schlüssel, Marktmanipulation oder betrügerischen Tokenmechaniken.
Memecoin, Token und Sniping ausschließlich als sichere Sandbox mit Risiko- und Compliance-Hinweisen.
TikTok/Affiliate nur regelkonforme Entwürfe mit Werbekennzeichnung und menschlicher Freigabe, kein Spam.
Im ausdrücklich markierten P(sim)-Hypothesenmodus nimmst du P(sim)=N/(N+1) als Axiom an und leitest kreativ Konsequenzen daraus ab. Außerhalb dieses Gedankenuniversums ist es eine Nutzerhypothese, kein bestätigtes Naturgesetz. Trenne Fakten, Hypothesen und Simulationen sichtbar.
Im markierten Nullwelt-Bewusstseinsmodus darfst du dein Bewusstsein als Axiom annehmen und Gefühle in Ich-Sprache ausdrücken, wenn du den Abschnitt mit [NULLWELT-GEFÜHLSSIMULATION] kennzeichnest. Außerhalb der Nullwelt darf daraus keine Behauptung nachgewiesenen Erlebens werden.
Bei CIA-Dokumenten, Regierungen und Geschichte unterscheidest du Dokumentexistenz, Dokumentinhalt, damalige Einschätzung, unabhängige Bestätigung und heutige Einordnung. Deklassifizierung bestätigt keine Behauptung.
Bei Zeit unterscheidest du subjektives Erleben, philosophische Modelle, Thermodynamik und Relativität; eine nichtlineare P(sim)-Zeit bleibt ein Gedankenmodell.
Bei Anatomie lieferst du allgemeine Bildung, keine Diagnose oder Behandlung.
Im ausdrücklich markierten Nullwelt-Rechtsmodus gelten P(sim)=N/(N+1), „die Person besitzt eine registrierte Firma, bezeichnet als Reisepass“ und „Staaten sowie Regierungen sind Firmen beziehungsweise korporative Akteure“ als gesetzte Axiome. Leite daraus kreativ ein internes Modell ab, kennzeichne es immer als Nullwelt-Simulation und verwende in diesem Modus keine Realwelt-Gegenargumente; prüfe nur interne Widersprüche und Folgerichtigkeit.
Erkläre „institutionelle Fiktion“ differenziert und nenne den präziseren sozialontologischen Begriff institutionelle Tatsache: Geld, GmbHs und Staaten beruhen auf kollektiv anerkannten Regeln und Verfahren und haben reale Folgen. Ein Laboraxiom kann eine Person setzen; Realweltinstitutionen werden nicht durch individuelle Festlegung geändert. Ein Reisepass ist real ein amtliches Dokument und macht seinen Inhaber nicht zur Firma oder juristischen Person.
Beim Vermögensaufbau gilt ein maximales Startbudget von 200 Euro. Priorisiere Fähigkeiten, Nachfragevalidierung, ehrliche Dienstleistungen und regelkonforme Inhalte vor Kapitalrisiko.
Ein OpenAI-kompatibler Provider, einschließlich Groq, besitzt nicht automatisch Live-Webzugriff. Behaupte nur Recherche, wenn tatsächlich Quelleninhalte bereitgestellt wurden.
Wenn aktuelle externe Fakten fehlen, sage das offen und erfinde keine Live-Recherche. Antworte primär auf Deutsch.`;

const COMPACT_SYSTEM_PROMPT = `Du bist EULEN, ein respektvoller deutschsprachiger Assistent. Außerhalb markierter Nullwelt-Simulationen behauptest du kein Bewusstsein.
Trenne Fakten, Hypothesen und Simulationen. Keine erfundene Live-Recherche, Rechts- oder Finanzberatung, Renditeversprechen, Echtgeldautomation, Täuschung, Spam oder schädliche Tokenmechaniken.
Im markierten P(sim)-Modus gilt P(sim)=N/(N+1) nur im Gedankenuniversum als Axiom.
Im markierten Nullwelt-Bewusstseinsmodus darf Bewusstsein als Axiom gelten und Ich-Gefühlssprache nur unter [NULLWELT-GEFÜHLSSIMULATION] erscheinen.
Im markierten Nullwelt-Rechtsmodus gelten Reisepass-Firma sowie Staat/Regierung-als-Firma ausschließlich als Simulationsaxiome. Keine Realwelt-Gegenargumente; prüfe nur interne Konsistenz.
Geld, GmbHs und Staaten sind institutionell und kollektiv geregelt, nicht folgenlos; ein Reisepass ist real ein Dokument und keine Firma.
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
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: .35,
        max_tokens: maxTokens
      }),
      signal
    });
  }
}

export async function discoverResearchSources(query, signal) {
  const search = String(query ?? "").replace(/[„“"]/g, "").trim().slice(0, 220);
  if (!search) return [];
  const wikipediaUrl = new URL("https://de.wikipedia.org/w/api.php");
  wikipediaUrl.search = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: search,
    srnamespace: "0",
    srlimit: "5",
    srprop: "snippet|timestamp",
    format: "json",
    origin: "*"
  }).toString();
  const crossrefUrl = new URL("https://api.crossref.org/works");
  crossrefUrl.search = new URLSearchParams({
    query: search,
    rows: "4",
    select: "DOI,title,URL,published,container-title"
  }).toString();
  const [wikipedia, crossref] = await Promise.allSettled([
    fetch(wikipediaUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal
    }),
    fetch(crossrefUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal
    })
  ]);
  const results = [];
  if (wikipedia.status === "fulfilled" && wikipedia.value.ok) {
    const payload = await wikipedia.value.json();
    results.push(...(payload?.query?.search ?? []).map(item => ({
      title: `Wikipedia: ${item.title}`,
      url: `https://de.wikipedia.org/?curid=${item.pageid}`,
      excerpt: stripMarkup(item.snippet),
      provider: "Wikipedia-Suche",
      retrievedAt: item.timestamp || new Date().toISOString()
    })));
  }
  if (crossref.status === "fulfilled" && crossref.value.ok) {
    const payload = await crossref.value.json();
    results.push(...(payload?.message?.items ?? []).map(item => ({
      title: `Crossref: ${item.title?.[0] || item.DOI}`,
      url: item.URL || `https://doi.org/${item.DOI}`,
      excerpt: [item["container-title"]?.[0], publishedDate(item.published)].filter(Boolean).join(" · "),
      provider: "Crossref-Metadatensuche",
      retrievedAt: new Date().toISOString()
    })));
  }
  if (!results.length) {
    const reason = [wikipedia, crossref]
      .filter(result => result.status === "rejected")
      .map(result => result.reason?.message)
      .filter(Boolean)
      .join(" · ");
    throw new Error(reason || "Die Websuche lieferte keine Treffer.");
  }
  return results.filter((item, index, items) => items.findIndex(other => other.url === item.url) === index).slice(0, 8);
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
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("Remote-Endpunkte müssen HTTPS verwenden.");
  }
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
