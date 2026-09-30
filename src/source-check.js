const KINDS = new Set(["fact", "hypothesis", "social"]);
const HOSTS = ["wikipedia.org", "wikidata.org", "doi.org", "openalex.org", "duckduckgo.com", "ycombinator.com"];
const INJECTED = new Set(["freiheit", "konstruktion", "institution", "soziale", "simulation"]);

function tokens(value) {
  return String(value || "").toLocaleLowerCase("de").split(/\W+/).filter(token => token.length > 3);
}
function hostOk(hostname) {
  return HOSTS.some(host => hostname === host || hostname.endsWith("." + host));
}

export function validateResearchSource(item, query = "") {
  const reasons = [];
  if (!item || typeof item !== "object") return { ok: false, depth: 0, reasons: ["leer"] };
  let url;
  try { url = new URL(String(item.url || "")); } catch { reasons.push("keine Adresse"); }
  if (url && url.protocol !== "https:") reasons.push("nicht https");
  if (url && !hostOk(url.hostname)) reasons.push("Host nicht in der erlaubten Liste");
  const title = String(item.title || "").trim();
  const excerpt = String(item.excerpt || "").trim();
  if (title.length < 6) reasons.push("kein Titel");
  if (excerpt.length < 24) reasons.push("Auszug zu dünn");
  if (title && excerpt && excerpt.toLocaleLowerCase("de") === title.toLocaleLowerCase("de")) reasons.push("Auszug wiederholt nur den Titel");
  if (!KINDS.has(item.kind)) reasons.push("Sorte fehlt");
  if (item.kind === "social") reasons.push("Diskussion ist kein Beleg");
  const asked = tokens(query).filter(token => !INJECTED.has(token));
  const text = `${title} ${excerpt}`.toLocaleLowerCase("de");
  const hits = asked.filter(token => text.includes(token));
  if (asked.length && hits.length === 0) reasons.push("trifft die Frage nicht");
  if (asked.length > 2 && hits.length < 2) reasons.push("nur ein Randwort, kein Kern");
  const onlyInjected = tokens(`${title} ${excerpt}`).every(token => INJECTED.has(token));
  if (onlyInjected) reasons.push("lebt nur vom angehängten Zielwort");
  const depth = Math.max(0, 5 - reasons.length) + hits.length;
  return { ok: reasons.length === 0, depth, hits, reasons, usableAsOpinion: item.kind === "social" && reasons.length === 1 };
}

export function keepValidSources(items, query) {
  return (items || []).filter(item => validateResearchSource(item, query).ok).sort((a, b) => validateResearchSource(b, query).depth - validateResearchSource(a, query).depth);
}
