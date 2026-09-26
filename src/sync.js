export class SyncProvider {
  constructor({ endpoint, workspace, token }) {
    this.endpoint = validateEndpoint(endpoint);
    this.workspace = validateWorkspace(workspace);
    this.token = String(token ?? "").trim();
    if (!this.token) throw new Error("Ein Zugriffstoken ist erforderlich.");
  }

  get url() {
    return `${this.endpoint.replace(/\/$/, "")}/state/${encodeURIComponent(this.workspace)}`;
  }

  async pull(signal) {
    const response = await fetch(this.url, { headers: this.headers(), signal });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Sync-Abruf fehlgeschlagen (HTTP ${response.status}).`);
    const payload = await response.json();
    if (!payload?.state || !Number.isFinite(Date.parse(payload.updatedAt))) {
      throw new Error("Sync-Provider lieferte ein ungültiges Datenformat.");
    }
    return payload;
  }

  async push(state, signal) {
    const response = await fetch(this.url, {
      method: "PUT",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ updatedAt: state.updatedAt, state }),
      signal
    });
    if (!response.ok) throw new Error(`Sync-Speichern fehlgeschlagen (HTTP ${response.status}).`);
    return response.json().catch(() => ({ updatedAt: state.updatedAt }));
  }

  async synchronize(state, signal) {
    const remote = await this.pull(signal);
    if (!remote) {
      await this.push(state, signal);
      return { direction: "upload", state };
    }
    const remoteTime = Date.parse(remote.updatedAt);
    const localTime = Date.parse(state.updatedAt);
    if (remoteTime > localTime) return { direction: "download", state: remote.state };
    if (localTime > remoteTime) {
      await this.push(state, signal);
      return { direction: "upload", state };
    }
    return { direction: "current", state };
  }

  headers() {
    return { Authorization: `Bearer ${this.token}`, Accept: "application/json" };
  }
}

function validateEndpoint(value) {
  let url;
  try { url = new URL(String(value).trim()); } catch { throw new Error("Sync-Endpunkt ist keine gültige URL."); }
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("Der Sync-Endpunkt muss HTTPS verwenden.");
  }
  return url.toString();
}

function validateWorkspace(value) {
  const workspace = String(value ?? "").trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,99}$/.test(workspace)) {
    throw new Error("Arbeitsraum-ID: 3–100 Zeichen, nur Buchstaben, Zahlen, _ und -.");
  }
  return workspace;
}
