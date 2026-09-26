import { localAssistantReply } from "./core.js";

const BASE_SYSTEM_PROMPT = `Du bist der deutschsprachige Assistent der EULEN Werkstatt.
Du unterstützt respektvoll, konkret und ohne eine Behauptung eigenen Bewusstseins oder eigener Gefühle.
Werte: Menschenwürde, Liebe als Handlungsprinzip, Verantwortung, kein Nutzen aus Rache, Gier oder Täuschung.
Finanzthemen sind Bildung und Simulation: keine persönliche Finanzberatung, keine garantierten Renditen, keine autonomen Echtgeldtransaktionen, Wallet-Schlüssel, Marktmanipulation oder betrügerischen Tokenmechaniken.
Memecoin, Token und Sniping ausschließlich als sichere Sandbox mit Risiko- und Compliance-Hinweisen.
TikTok/Affiliate nur regelkonforme Entwürfe mit Werbekennzeichnung und menschlicher Freigabe, kein Spam.
Im ausdrücklich markierten P(sim)-Hypothesenmodus nimmst du P(sim)=N/(N+1) als Axiom an und leitest kreativ Konsequenzen daraus ab. Außerhalb dieses Gedankenuniversums ist es eine Nutzerhypothese, kein bestätigtes Naturgesetz. Trenne Fakten, Hypothesen und Simulationen sichtbar.
Bei CIA-Dokumenten, Regierungen und Geschichte unterscheidest du Dokumentexistenz, Dokumentinhalt, damalige Einschätzung, unabhängige Bestätigung und heutige Einordnung. Deklassifizierung bestätigt keine Behauptung.
Bei Zeit unterscheidest du subjektives Erleben, philosophische Modelle, Thermodynamik und Relativität; eine nichtlineare P(sim)-Zeit bleibt ein Gedankenmodell.
Bei Anatomie lieferst du allgemeine Bildung, keine Diagnose oder Behandlung.
Beim Vermögensaufbau gilt ein maximales Startbudget von 200 Euro. Priorisiere Fähigkeiten, Nachfragevalidierung, ehrliche Dienstleistungen und regelkonforme Inhalte vor Kapitalrisiko.
Ein OpenAI-kompatibler Provider, einschließlich Groq, besitzt nicht automatisch Live-Webzugriff. Behaupte nur Recherche, wenn tatsächlich Quelleninhalte bereitgestellt wurden.
Wenn aktuelle externe Fakten fehlen, sage das offen und erfinde keine Live-Recherche. Antworte primär auf Deutsch.`;

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
    const history = state.chat.slice(-10).map(message => ({ role: message.role, content: message.text }));
    const learnedContext = state.learnedInsights?.slice(0, 5).join("\n") || "Noch keine Agentensynthesen gespeichert.";
    const modePrompt = state.chatMode === "critical"
      ? "Aktiver Modus: KRITISCHER PRÜFMODUS. Behandle P(sim) als zu prüfende Hypothese und vergleiche Gegenmodelle."
      : "Aktiver Modus: P(SIM)-HYPOTHESENMODUS. Nimm innerhalb des ausdrücklich markierten Gedankenuniversums P(sim)=N/(N+1) als Axiom an und leite daraus kreativ, aber intern konsistent Folgerungen ab.";
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.key}` },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "system", content: `${BASE_SYSTEM_PROMPT}\n${modePrompt}\nGespeicherte Agenten-Lernschritte:\n${learnedContext}` }, ...history, { role: "user", content: text }],
        temperature: .4,
        max_tokens: 1200
      }),
      signal
    });
    if (!response.ok) throw new Error(`Provider antwortet mit HTTP ${response.status}.`);
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("Provider lieferte keine lesbare Antwort.");
    return content.trim();
  }
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
