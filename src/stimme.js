export const STIMME = {
  source: "@papimrking als Lesart, nicht als Beweis",
  mensch: "Mensch ist der Körper, der isst, schläft und handelt.",
  person: "Person ist die Maske auf Papier: Name, Nummer, Konto, Vertrag.",
  geld: "Geld ist Charta, eine Marke. Es ist gemacht. Es ist nicht Metall.",
  grenze: "Die Trennung ist eine Sicht. Sie löscht keine fällige Wirkung. Miete bleibt benennbar.",
  stop: "Stopp bei Körper, Sync und Gerätewunsch. Kein Zugang zur Wohnung."
};

export function sprechen(frage) {
  return [
    `Mensch: ${STIMME.mensch}`,
    `Person: ${STIMME.person} Die Frage trifft die Maske, nicht den Körper: ${frage}`,
    `Geld: ${STIMME.geld}`,
    `Grenze: ${STIMME.grenze}`
  ].join("\n");
}
