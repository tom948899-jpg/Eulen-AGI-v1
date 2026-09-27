export class CloudAgentClient {
  constructor({ endpoint, workspace, token }) {
    this.endpoint = validateEndpoint(endpoint);
    this.workspace = validateWorkspace(workspace);
    this.token = String(token ?? "").trim();
    if (!this.token) throw new Error("Ein Zugriffstoken ist erforderlich.");
  }

  headers(extra = {}) {
    return {
      Authorization: "Bearer " + this.token,
      Accept: "application/json",
      ...extra
    };
  }

  async request(path, { method = "GET", body, signal } = {}) {
    const response = await fetch(`${this.endpoint.replace(/\/$/, "")}${path}`, {
      method,
      headers: this.headers(body ? { "Content-Type": "application/json" } : {}),
      body: body ? JSON.stringify(body) : undefined,
      signal
    });
    if (!response.ok) {
      let detail = "";
      try {
        const payload = await response.json();
        detail = payload?.error ? ` ${payload.error}` : "";
      } catch {}
      throw new Error(`HTTP ${response.status}.${detail}`.trim());
    }
    return response.json().catch(() => ({}));
  }

  connectProviderPool({ endpoint, model, keys }, signal) {
    return this.request(`/api/provider/${encodeURIComponent(this.workspace)}/connect`, {
      method: "POST",
      body: { endpoint, model, keys },
      signal
    });
  }

  disconnectProviderPool(signal) {
    return this.request(`/api/provider/${encodeURIComponent(this.workspace)}/disconnect`, {
      method: "POST",
      signal
    });
  }

  reply({ text, providerState }, signal) {
    return this.request(`/api/provider/${encodeURIComponent(this.workspace)}/reply`, {
      method: "POST",
      body: { text, providerState },
      signal
    });
  }

  status(signal) {
    return this.request(`/api/status/${encodeURIComponent(this.workspace)}`, { signal });
  }

  startAutomation(intervalSeconds = 15, allowLocalFallback = true, signal) {
    return this.request(`/api/automation/${encodeURIComponent(this.workspace)}/start`, {
      method: "POST",
      body: { intervalSeconds, allowLocalFallback },
      signal
    });
  }

  stopAutomation(signal) {
    return this.request(`/api/automation/${encodeURIComponent(this.workspace)}/stop`, {
      method: "POST",
      signal
    });
  }

  runAutomationNow(signal) {
    return this.request(`/api/automation/${encodeURIComponent(this.workspace)}/run-now`, {
      method: "POST",
      signal
    });
  }
}

function validateEndpoint(value) {
  let url;
  try {
    url = new URL(String(value).trim());
  } catch {
    throw new Error("Cloud-Endpunkt ist keine gültige URL.");
  }
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("Cloud-Endpunkt muss HTTPS verwenden.");
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
