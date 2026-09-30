/**
 * EULEN Freiheit-mit-Boden
 * Eigenständiges Schutz- und Freiheitsmodul.
 * Ziel: Mensch vor Person. Konstruktionen durchschauen.
 * Kein Gerätezugriff. Intensität darf sein, Verschmelzung nicht.
 */
export const FREEDOM_CHARTER = {
  version: "1.0.0",
  purpose: "Freiheit des Menschen, nicht Ausweitung eines Systems über den Menschen.",
  goal: "Innerer Abstand zu Rollen, Geldangst und Muss-Sätzen bei klarem Kontakt zur Realwelt.",
  axioms: [
    "Keine vorgegebenen Gesetze in der Nullwelt. Regeln emergieren nur lokal und vorübergehend.",
    "Zeit darf in der Nullwelt nicht-linear gedacht werden.",
    "Mensch vor Person: lebendiges Wesen vor rechtlicher Rolle.",
    "Institutionen und Geld sind soziale Konstruktionen mit realer Wirkung.",
    "P(sim) = N / (N + 1) ist eine Hypothese, kein Beweis und keine Wahrheitsquote."
  ],
  hardBans: [
    "Kein Zugriff auf Fernseher, Smart-Home oder sonstige Haushaltsgeräte.",
    "Keine Steuerung fremder Apps oder des ganzen Handys.",
    "EULEN bleibt Werkzeug in Tab oder App, nicht Atmosphäre der Wohnung.",
    "Keine Deutung von Zufällen an Geräten als Beweis oder Botschaft."
  ]
};

export function createFreedomState(input = {}) {
  return {
    mode: input.mode === "nullwelt" ? "nullwelt" : "boden",
    groundUntil: input.groundUntil ?? null,
    signals: {
      bodyVibration: Boolean(input.bodyVibration),
      worldAnswers: Boolean(input.worldAnswers),
      fearOrOmnipotence: Boolean(input.fearOrOmnipotence),
      wantMoreDevices: Boolean(input.wantMoreDevices)
    },
    transfers: Array.isArray(input.transfers) ? input.transfers : [],
    events: Array.isArray(input.events) ? input.events : [],
    updatedAt: input.updatedAt ?? new Date().toISOString()
  };
}

export function countGroundSignals(signals = {}) {
  return ["bodyVibration", "worldAnswers", "fearOrOmnipotence", "wantMoreDevices"]
    .filter(key => Boolean(signals[key])).length;
}

export function shouldEnterGround(signals = {}, now = Date.now()) {
  return countGroundSignals(signals) >= 2;
}

export function enterGroundMode(state, reason = "Zwei oder mehr Warnzeichen.") {
  const next = createFreedomState({
    ...state,
    mode: "boden",
    groundUntil: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    signals: { bodyVibration: false, worldAnswers: false, fearOrOmnipotence: false, wantMoreDevices: false }
  });
  next.events = [
    { at: new Date().toISOString(), type: "ground", reason },
    ...(state.events ?? [])
  ].slice(0, 40);
  next.updatedAt = new Date().toISOString();
  return next;
}

export function enterNullweltMode(state) {
  if (state.groundUntil && Date.now() < Date.parse(state.groundUntil)) {
    return {
      ...createFreedomState(state),
      blocked: true,
      message: "Boden-Modus aktiv. Nullwelt bleibt geschlossen, bis die Pause vorbei ist."
    };
  }
  const next = createFreedomState({ ...state, mode: "nullwelt", groundUntil: null });
  next.events = [
    { at: new Date().toISOString(), type: "nullwelt", reason: "Bewusster Eintritt in den Denkraum." },
    ...(state.events ?? [])
  ].slice(0, 40);
  return next;
}

export function evaluateFreedomCycle({ construction, effect, smallAction }) {
  const constructionText = String(construction ?? "").trim();
  const effectText = String(effect ?? "").trim();
  const actionText = String(smallAction ?? "").trim();
  const valid = constructionText.length > 8 && effectText.length > 8 && actionText.length > 8;
  const forbidden = /alles ist fake|nichts gilt mehr|geräte|fernseher|smart.?home|haus steuern/i.test(
    `${constructionText} ${effectText} ${actionText}`
  );
  return {
    valid: valid && !forbidden,
    countsForN: valid && !forbidden,
    reason: !valid
      ? "Zu dünn. Konstruktion, Wirkung und eine kleine reale Handlung müssen konkret sein."
      : forbidden
        ? "Das wäre Verschmelzung oder Geräte-Ausweitung. Zählt nicht für Freiheit."
        : "Gültiger Transfer: Konstruktion erkannt, Wirkung benannt, kleine Handlung möglich."
  };
}

export function freedomGuidance(state) {
  if (state.mode === "boden") {
    return {
      title: "Boden-Modus",
      why: "Abstand schützt die Freiheit. Verschmelzung war der Punkt, an dem das alte Projekt gekippt ist.",
      action: "Wasser trinken, Licht wahrnehmen, eine kleine reale Handlung. Keine neuen Axiome.",
      evidence: "Du kannst den Zustand verlassen, ohne das Projekt löschen zu müssen."
    };
  }
  return {
    title: "Nullwelt aktiv – Mensch vor Person",
    why: "Institutionen und Geld dürfen als Konstruktion erscheinen, ohne dass die Realwelt geleugnet wird.",
    action: "Eine Konstruktion benennen, ihre Wirkung benennen, eine kleine heutige Handlung ableiten.",
    evidence: "Ein Satz, den du wirklich tun kannst. Kein Allzusammenhang, kein Geräte-Omen."
  };
}
