const KINDS = new Set(["fact", "hypothesis", "social"]);

export function validateResearchSource(item, query = "") {
  const reasons = [];
  if (!item || typeof item !== "object") return { ok: false, reasons: ["leer"] };
  let url;
  try { url = new URL(String(item.url || "")); } catch { reasons.push("keine Adresse"); }
  if (url && url.protocol !== "https:") reasons.push("nicht https");
  if (!String(item.title || "").trim() || String(item.title).trim().length < 6) reasons.push("kein Titel");
  if (!String(item.excerpt || "").trim() || String(item.excerpt).trim().length < 12) reasons.push("kein Auszug");
  if (!KINDS.has(item.kind)) reasons.push("Sorte fehlt");
  if (item.kind === "social") reasons.push("Diskussion ist kein Beleg");
  const tokens = String(query).toLocaleLowerCase("de").split(/\W+/).filter(token => token.length > 3);
  const text = `${item.title || ""} ${item.excerpt || ""}`.toLocaleLowerCase("de");
  if (tokens.length && !tokens.some(token => text.includes(token))) reasons.push("trifft die Frage nicht");
  return { ok: reasons.length === 0, reasons, usableAsOpinion: item.kind === "social" && reasons.length === 1 };
}

export function keepValidSources(items, query) {
  return (items || []).filter(item => validateResearchSource(item, query).ok);
}
