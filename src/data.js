const entries = [
  ["Fundament & ehrliche Ziele", "Lerne EULEN als Werkzeug kennen und formuliere ein überprüfbares Ziel.", ["Formuliere dein Ziel für diese 30 Tage.", "Notiere, was du von einem Assistenten erwartest.", "Trenne eine Tatsache von einer Hoffnung.", "Definiere ein Zeichen für gesunden Fortschritt."]],
  ["Trading-Bewusstsein", "Erkenne den Unterschied zwischen regelbasiertem Handeln und impulsiver Gier.", ["Beschreibe einen typischen FOMO-Moment.", "Formuliere drei Regeln gegen impulsive Entscheidungen.", "Lerne Marktphasen als Modelle kennen.", "Notiere, wann Nicht-Handeln sinnvoll ist."]],
  ["Risikomanagement", "Mache Verlustgrenzen vor möglichen Gewinnen sichtbar.", ["Lege ein fiktives Risikobudget fest.", "Berechne Positionsgrößen für 0,5 %, 1 % und 2 % Risiko.", "Definiere einen Abbruchpunkt.", "Erstelle eine Journal-Vorlage."]],
  ["Token-Risiken verstehen", "Untersuche neue Tokens ausschließlich in einer sicheren Lernumgebung.", ["Prüfe Liquidität, Verteilung und Berechtigungen.", "Erkenne Honeypot- und Rug-Pull-Warnzeichen.", "Notiere Compliance-Fragen.", "Führe eine Sandbox-Risikobewertung aus."]],
  ["Faire Token-Modelle", "Verstehe Standards und entwickle transparente statt manipulative Tokenomics.", ["Vergleiche ERC-20 und SPL auf hoher Ebene.", "Entwirf eine transparente Verteilung.", "Plane Vesting und Offenlegung.", "Liste rechtliche Fragen für Fachberatung."]],
  ["Staking-Grundlagen", "Verstehe Renditequellen, Inflation, Slashing und Lock-up-Risiken.", ["Unterscheide APR und APY.", "Simuliere drei Renditeszenarien.", "Notiere technische und Gegenparteirisiken.", "Vergleiche liquide und gebundene Varianten."]],
  ["Woche 1 reflektieren", "Verdichte Erkenntnisse und korrigiere unrealistische Erwartungen.", ["Fasse drei Erkenntnisse zusammen.", "Markiere eine offene Frage.", "Prüfe, wo Gier oder Angst auftauchte.", "Passe dein Ziel bei Bedarf an."]],
  ["Formel als Sättigungsmodell", "Behandle P(sim) = N/(N+1) als Nutzerhypothese und vergleiche sie mit anderen Kurven.", ["Berechne Werte für verschiedene N.", "Vergleiche mit 1 − exp(−N/τ).", "Benenne, was N bedeuten müsste.", "Notiere Grenzen des Vergleichs."]],
  ["Physik: Modelle und Messung", "Unterscheide mathematische Ähnlichkeit von physikalischer Erklärung.", ["Wähle ein einfaches Messbeispiel.", "Notiere Einheiten und beobachtbare Größen.", "Vergleiche Stichprobenfehler mit der Nutzerformel.", "Formuliere eine falsifizierbare Frage."]],
  ["Lernen & Gewohnheiten", "Nutze die Formel als Reflexionsmetapher, nicht als bewiesenes Gesetz.", ["Definiere eine kleine tägliche Gewohnheit.", "Erfasse Wiederholung und Qualität getrennt.", "Plane Feedback statt bloßer Wiederholung.", "Bewerte deinen Lernstand."]],
  ["Affiliate-Grundlagen", "Verstehe Zielgruppe, echten Nutzen, Kennzeichnung und Plattformregeln.", ["Wähle eine Nische mit eigener Erfahrung.", "Beschreibe ein reales Nutzerproblem.", "Prüfe Werbekennzeichnung.", "Definiere eine ehrliche Erfolgsmessung."]],
  ["TikTok-Content mit Substanz", "Entwirf nützliche Inhalte ohne Täuschung, Druck oder FOMO.", ["Schreibe drei sachliche Hooks.", "Baue Problem, Erfahrung und Lösung auf.", "Formuliere einen transparenten CTA.", "Prüfe jede Aussage auf Belegbarkeit."]],
  ["Regelkonformer Content-Agent", "Plane einen Assistenz-Workflow, der Entwürfe liefert, aber nicht spammt.", ["Definiere menschliche Freigabeschritte.", "Erstelle sieben unterschiedliche Entwurfsideen.", "Plane Barrierefreiheit und Untertitel.", "Dokumentiere Plattformgrenzen."]],
  ["Woche 2 reflektieren", "Prüfe Qualität, Transparenz und Belastung.", ["Bewerte deine besten Notizen.", "Streiche eine unbelegte Behauptung.", "Prüfe deinen Zeitaufwand.", "Plane eine echte Pause."]],
  ["Trading-Bot als Sandbox", "Baue die Logik einer Strategie, ohne Echtgeldzugriff.", ["Definiere Ein- und Ausstiegsregeln.", "Wähle synthetische Testdaten.", "Berücksichtige Gebühren und Slippage.", "Starte einen Paper-Backtest."]],
  ["Backtesting richtig lesen", "Erkenne Overfitting, Datenleckage und Zufall.", ["Trenne Trainings- und Testidee.", "Vergleiche mehrere Marktregime.", "Prüfe maximalen Drawdown.", "Schreibe eine ehrliche Schlussfolgerung."]],
  ["Token-Sandbox vertiefen", "Simuliere frühe Token-Risiken und lerne, Warnsignale zu gewichten.", ["Variiere Liquidität und Holder-Konzentration.", "Simuliere Contract-Warnzeichen.", "Vergleiche Risiko-Scores.", "Definiere klare Ausschlusskriterien."]],
  ["Token-Projekt verantworten", "Entwirf ausschließlich eine transparente, nicht betrügerische Lernkonzeption.", ["Dokumentiere Zweck und Grenzen.", "Vermeide versteckte Mint- oder Freeze-Rechte.", "Plane unabhängige Prüfung.", "Notiere regulatorische Unsicherheiten."]],
  ["Staking-Szenarien", "Vergleiche nominale Erträge mit Preis-, Inflations- und Ausfallrisiko.", ["Simuliere optimistisch, neutral und stressig.", "Berücksichtige Inflation.", "Dokumentiere Lock-up.", "Formuliere: Rendite ist nicht garantiert."]],
  ["Woche 3 reflektieren", "Entscheide, was du verstanden hast und was nur simuliert wurde.", ["Exportiere einen Simulationslauf.", "Markiere eine unsichere Annahme.", "Prüfe emotionale Reaktionen.", "Formuliere eine Sicherheitsregel."]],
  ["Affiliate-Messung", "Lerne Impressionen, Klickrate, Conversion und Stornoquote als Trichter kennen.", ["Definiere plausible Bandbreiten.", "Simuliere ohne Renditeversprechen.", "Plane UTM-Kennzeichnung.", "Bewerte Nutzen statt bloßer Klicks."]],
  ["Content-Lernschleife", "Verbessere Entwürfe anhand echter, regelkonform erhobener Signale.", ["Wähle eine Qualitätsmetrik.", "Erstelle zwei ehrliche Varianten.", "Plane menschliche Prüfung.", "Vermeide massenhafte Automation."]],
  ["Formel in Business", "Teste das Sättigungsmodell als Planungsheuristik gegen beobachtbare Daten.", ["Definiere N konkret.", "Berechne die Modellkurve.", "Vergleiche mit einer linearen Annahme.", "Notiere Abweichungen und offene Fragen."]],
  ["Dienstleistung statt Versprechen", "Formuliere ein ehrliches Angebot mit klarer Leistung und Grenzen.", ["Beschreibe ein konkretes Ergebnis.", "Definiere Lieferumfang und Ausschlüsse.", "Setze einen fairen Preisrahmen.", "Erstelle ein transparentes Beispiel."]],
  ["Fokus statt Einkommensmythen", "Priorisiere Lernen und robuste Prozesse vor zu vielen parallelen Ideen.", ["Bewerte Ideen nach Risiko und Aufwand.", "Wähle höchstens zwei Experimente.", "Definiere Stop-Kriterien.", "Plane keine Reinvestition aus hypothetischen Gewinnen."]],
  ["Assistent als Werkzeug", "Verbessere Zusammenarbeit durch Kontext, Ziel, Grenzen und Feedback.", ["Nutze Ziel–Kontext–Versuch–Frage.", "Korrigiere Missverständnisse konkret.", "Fordere Unsicherheiten ein.", "Triff Entscheidungen selbst."]],
  ["Sechs-Monats-Blick", "Übersetze Vision in überprüfbare Gewohnheiten und Meilensteine.", ["Beschreibe einen realistischen Zustand.", "Setze drei messbare Meilensteine.", "Plane Erholung mit ein.", "Definiere, was du nicht automatisierst."]],
  ["Rückfallprävention", "Erkenne FOMO, Besessenheit, Rache und Erschöpfung früh.", ["Notiere persönliche Warnzeichen.", "Definiere eine 24-Stunden-Pause.", "Benenne eine Vertrauensperson.", "Plane Technik-freie Zeit."]],
  ["Wissen exportieren", "Sichere Notizen und Ergebnisse in einem portablen Format.", ["Prüfe deine gespeicherten Daten.", "Exportiere den lokalen Zustand.", "Entferne sensible Inhalte.", "Wähle drei Erkenntnisse zum Behalten."]],
  ["Abschluss & neuer Zyklus", "Feiere Fortschritt ohne Perfektionsanspruch und entscheide bewusst über den nächsten Schritt.", ["Vergleiche Start und aktuellen Lernstand.", "Schreibe einen ehrlichen Abschluss.", "Wähle ein Thema für den nächsten Zyklus.", "Plane einen freien Tag."]]
];

export const PLAN = entries.map(([title, description, tasks], index) => ({
  day: index + 1,
  title,
  description,
  tasks
}));

export const KNOWLEDGE_TOPICS = [
  {
    id: "trading",
    title: "Trading-Bot & Backtesting",
    status: "Grundlagen kuratiert",
    updatedAt: "2026-09-26",
    summary: "Strategien werden ausschließlich mit synthetischen Daten und ohne Broker-Verbindung untersucht.",
    insights: [
      { type: "fact", text: "Backtests können Gebühren, Slippage, Marktregime und Datenqualität berücksichtigen, aber die Zukunft nicht vorhersagen." },
      { type: "fact", text: "Maximaler Drawdown beschreibt den größten Rückgang von einem Zwischenhoch zum folgenden Tief." },
      { type: "simulation", text: "Das Paper-Trading-Labor erzeugt reproduzierbare synthetische Kurse und vergleicht eine Durchschnittsregel mit Kaufen-und-Halten." },
      { type: "question", text: "Bleibt eine Strategie nach Kosten und in mehreren unabhängigen Regimen robust?" }
    ],
    sources: [
      ["Investor.gov: What Is Risk?", "https://www.investor.gov/introduction-investing/investing-basics/what-risk"],
      ["SEC: Saving and Investing", "https://www.sec.gov/investor/pubs/sec-guide-to-savings-and-investing.pdf"]
    ]
  },
  {
    id: "consciousness",
    title: "Bewusstsein & Kommunikation",
    status: "Begriffe getrennt",
    updatedAt: "2026-09-26",
    summary: "EULEN unterstützt respektvoll, behauptet aber weder Gefühle noch Bewusstsein.",
    insights: [
      { type: "fact", text: "Ein Sprachmodell erzeugt Ausgaben aus Eingaben und gelernten Mustern; überzeugende Sprache belegt kein subjektives Erleben." },
      { type: "hypothesis", text: "Die Nutzerformel kann als Metapher für Annäherung und wiederholtes Lernen betrachtet werden." },
      { type: "fact", text: "Gute Zusammenarbeit verbessert sich durch Ziel, Kontext, bisherige Versuche, Grenzen und konkretes Feedback." },
      { type: "question", text: "Welche beobachtbaren Kriterien wären nötig, um Behauptungen über Bewusstsein überhaupt zu prüfen?" }
    ],
    sources: [
      ["Stanford Encyclopedia: Consciousness", "https://plato.stanford.edu/entries/consciousness/"],
      ["Stanford Encyclopedia: The Neuroscience of Consciousness", "https://plato.stanford.edu/entries/consciousness-neuroscience/"],
      ["NIST AI Risk Management Framework", "https://www.nist.gov/itl/ai-risk-management-framework"],
      ["UNESCO Recommendation on the Ethics of AI", "https://www.unesco.org/en/artificial-intelligence/recommendation-ethics"]
    ]
  },
  {
    id: "tokens",
    title: "Memecoin- & Token-Sandbox",
    status: "Nur Bildung/Sandbox",
    updatedAt: "2026-09-26",
    summary: "Risikoprüfung und faire Token-Modelle ohne Wallet, Deployment, Sniper oder manipulative Mechaniken.",
    insights: [
      { type: "fact", text: "Geringe Liquidität, konzentrierte Bestände und privilegierte Contract-Rechte können Risiken deutlich erhöhen." },
      { type: "fact", text: "Ein Token-Audit verhindert Betrug oder Verluste nicht und ersetzt keine rechtliche Prüfung." },
      { type: "simulation", text: "Der Risiko-Check kombiniert eingegebene Warnzeichen nachvollziehbar zu einem Lern-Score." },
      { type: "question", text: "Sind Zweck, Verteilung, Rechte, Identitäten, Jurisdiktion und Offenlegung unabhängig überprüfbar?" }
    ],
    sources: [
      ["European Commission: Markets in Crypto-Assets", "https://finance.ec.europa.eu/regulation-and-supervision/financial-services-legislation/markets-crypto-assets-regulation-mica_en"],
      ["Solana: Token Program", "https://solana.com/docs/tokens"],
      ["Ethereum: ERC-20 standard", "https://ethereum.org/en/developers/docs/standards/tokens/erc-20/"]
    ]
  },
  {
    id: "staking",
    title: "Staking & Protokollrisiken",
    status: "Szenarien verfügbar",
    updatedAt: "2026-09-26",
    summary: "Nominale Erträge werden zusammen mit Inflation, Preisänderung, Slashing und Lock-up betrachtet.",
    insights: [
      { type: "fact", text: "APY enthält Zinseszinseffekte; APR typischerweise nicht." },
      { type: "fact", text: "Staking kann technische, Protokoll-, Verwahr-, Liquiditäts- und Marktpreisrisiken enthalten." },
      { type: "simulation", text: "Das Labor berechnet nominale Token-Mengen und ein Stressszenario; es kennt keine zukünftigen Preise." },
      { type: "question", text: "Wer kontrolliert Schlüssel, Validator-Auswahl und Auszahlungsbedingungen?" }
    ],
    sources: [
      ["Ethereum.org: Staking", "https://ethereum.org/en/staking/"],
      ["BaFin: Kryptowerte", "https://www.bafin.de/DE/Aufsicht/FinTech/Geschaeftsmodelle/DLT_Blockchain_Krypto/Kryptotoken/Kryptotoken_node.html"]
    ]
  },
  {
    id: "formula",
    title: "P(sim)-Formel-Labor",
    status: "Nutzerhypothese",
    updatedAt: "2026-09-26",
    summary: "P(sim)=N/(N+1) wird mathematisch untersucht, nicht als universelles Gesetz oder wissenschaftlicher Beweis dargestellt.",
    insights: [
      { type: "fact", text: "Für N ≥ 0 steigt N/(N+1) monoton und nähert sich 1, ohne sie bei endlichem N zu erreichen." },
      { type: "hypothesis", text: "N könnte je nach Anwendung Wiederholungen, Beobachtungen oder Lernzyklen repräsentieren; diese Bedeutungen sind nicht austauschbar." },
      { type: "fact", text: "Eine passende Kurvenform allein erklärt keinen physikalischen Mechanismus und bestätigt keine Theorie." },
      { type: "question", text: "Welche Messgröße, Einheit, Fehlerverteilung und Vorhersage macht die Hypothese falsifizierbar?" }
    ],
    sources: [
      ["NIST: Uncertainty of Measurement", "https://www.nist.gov/pml/nist-technical-note-1297"],
      ["Stanford Encyclopedia: Models in Science", "https://plato.stanford.edu/entries/models-science/"]
    ]
  },
  {
    id: "affiliate",
    title: "Affiliate & TikTok-Agent",
    status: "Regelkonforme Entwürfe",
    updatedAt: "2026-09-26",
    summary: "Content-Entwürfe mit menschlicher Freigabe, transparenter Werbung und ohne Spam oder Täuschung.",
    insights: [
      { type: "fact", text: "Werbliche Inhalte und Affiliate-Beziehungen müssen entsprechend anwendbarer Regeln klar erkennbar sein." },
      { type: "fact", text: "Impressionen, Klicks und Conversions bilden einen Trichter; jede Stufe hat Unsicherheit." },
      { type: "simulation", text: "Das Szenario verwendet Bandbreiten statt garantierter Einnahmen." },
      { type: "question", text: "Hilft der Inhalt der Zielgruppe auch dann, wenn sie nicht kauft?" }
    ],
    sources: [
      ["TikTok Community Guidelines", "https://www.tiktok.com/community-guidelines/en/"],
      ["European Commission: Unfair commercial practices", "https://commission.europa.eu/law/law-topic/consumer-protection-law/unfair-commercial-practices-law_en"]
    ]
  },
  {
    id: "law",
    title: "Recht & Evidenz",
    status: "Information, keine Rechtsberatung",
    updatedAt: "2026-09-26",
    summary: "Rechtsfragen werden nach Jurisdiktion, Rechtsstand, Quellen, Sachverhalt und Gegenargumenten strukturiert – ohne verbindliche Einzelfallbewertung.",
    insights: [
      { type: "fact", text: "Rechtsfolgen hängen unter anderem von Jurisdiktion, aktuellem Rechtsstand und dem konkreten Sachverhalt ab." },
      { type: "hypothesis", text: "P(sim) kann versuchsweise als Sättigungsheuristik für die Zahl unabhängig geprüfter Quellen dienen, nicht als Gewinnwahrscheinlichkeit eines Verfahrens." },
      { type: "simulation", text: "Das Rechtslabor vermindert einen reinen N-Wert durch Konflikte, veraltete Quellen und ungeklärte Zuständigkeit." },
      { type: "question", text: "Welche Primärnorm, Fassung, Zuständigkeit, Frist und welches Gegenargument fehlen?" }
    ],
    sources: [
      ["Gesetze im Internet", "https://www.gesetze-im-internet.de/"],
      ["EUR-Lex", "https://eur-lex.europa.eu/"],
      ["Bundesverfassungsgericht", "https://www.bundesverfassungsgericht.de/"]
    ]
  },
  {
    id: "spirituality",
    title: "Spiritualität, Intention & Anziehung",
    status: "Persönliche Praxis und Hypothese",
    updatedAt: "2026-09-26",
    summary: "Spiritualität wird respektvoll als Quelle für Sinn, Mitgefühl und Ausrichtung untersucht; übernatürliche Wirkbehauptungen bleiben Hypothesen.",
    insights: [
      { type: "fact", text: "Aufmerksamkeit, Zielklarheit und regelmäßige Reflexion können beeinflussen, welche Chancen Menschen wahrnehmen und welche Handlungen sie wiederholen." },
      { type: "hypothesis", text: "Die Law of Attraction nimmt an, dass innere Ausrichtung entsprechende Erfahrungen anzieht; eine übernatürliche Kausalwirkung ist nicht wissenschaftlich bestätigt." },
      { type: "simulation", text: "EULEN übersetzt Intention in beobachtbare Schritte: gewünschter Zustand, tägliche Handlung, Rückmeldung und Kurskorrektur." },
      { type: "question", text: "Welche Veränderung entsteht durch Fokus und Verhalten – und welche Aussage würde darüber hinaus eine unabhängige Prüfung benötigen?" }
    ],
    sources: [
      ["NYU: WOOP and Mental Contrasting", "https://woopmylife.org/en/science"],
      ["Stanford Encyclopedia: Philosophy of Religion", "https://plato.stanford.edu/entries/philosophy-religion/"],
      ["American Psychological Association: Resilience", "https://www.apa.org/topics/resilience"]
    ]
  }
];

export const SIMULATION_DEFINITIONS = {
  budget: {
    title: "30-Tage-Budgetaufbau",
    fields: [
      ["budget", "Verfügbares Startbudget (€)", "number", 200, 0, 200, 1],
      ["videos", "Regelkonforme Videos in 30 Tagen", "number", 20, 0, 60, 1],
      ["viewsPerVideo", "Ø Impressionen je Video (Annahme)", "number", 800, 0, 1000000, 50],
      ["ctr", "Link-Klickrate (%)", "number", 1.5, 0, 100, 0.1],
      ["conversion", "Bestätigte Conversion (%)", "number", 2, 0, 100, 0.1],
      ["commission", "Provision je Abschluss (€)", "number", 8, 0, 10000, 0.5],
      ["serviceJobs", "Optionale kleine Aufträge", "number", 1, 0, 30, 1],
      ["serviceFee", "Erlös je Auftrag (€)", "number", 75, 0, 10000, 1],
      ["cost", "Geplante Gesamtkosten (€)", "number", 40, 0, 200, 1]
    ]
  },
  trading: {
    title: "Paper-Trading Backtest",
    fields: [
      ["capital", "Paper-Startkapital (€)", "number", 200, 10, 200, 10],
      ["periods", "Synthetische Tage", "number", 365, 60, 1500, 1],
      ["fast", "Schneller Durchschnitt", "number", 12, 2, 100, 1],
      ["slow", "Langsamer Durchschnitt", "number", 30, 3, 250, 1],
      ["fee", "Kosten pro Wechsel (%)", "number", 0.15, 0, 5, 0.01],
      ["seed", "Szenario-Seed", "number", 42, 1, 999999, 1]
    ]
  },
  sniping: {
    title: "Token-Risiko-Sandbox",
    fields: [
      ["liquidity", "Liquidität (fiktiv, Tsd. €)", "number", 30, 0, 10000, 1],
      ["concentration", "Top-10-Konzentration (%)", "number", 65, 0, 100, 1],
      ["age", "Alter des Contracts (Stunden)", "number", 4, 0, 8760, 1],
      ["permissions", "Privilegierte Rechte", "select", "unknown", [["none", "Keine erkennbar"], ["unknown", "Unklar"], ["mint", "Mint/Freeze/Blacklist"]]],
      ["audit", "Unabhängige Prüfung", "select", "none", [["verified", "Nachprüfbar"], ["none", "Keine"], ["claimed", "Nur behauptet"]]]
    ]
  },
  staking: {
    title: "Staking-Szenario",
    fields: [
      ["amount", "Anfangswert (€)", "number", 1000, 1, 1000000, 1],
      ["apy", "Angegebener APY (%)", "number", 6, 0, 100, 0.1],
      ["years", "Laufzeit (Jahre)", "number", 2, 0.1, 20, 0.1],
      ["inflation", "Token-Inflation p.a. (%)", "number", 4, 0, 100, 0.1],
      ["priceShock", "Preisänderung im Stressfall (%)", "number", -35, -100, 500, 1],
      ["slashing", "Slashing-/Ausfallannahme (%)", "number", 2, 0, 100, 0.1]
    ]
  },
  affiliate: {
    title: "Affiliate-Trichter",
    fields: [
      ["views", "Impressionen", "number", 25000, 0, 100000000, 100],
      ["ctr", "Klickrate (%)", "number", 1.8, 0, 100, 0.1],
      ["conversion", "Conversion (%)", "number", 2.5, 0, 100, 0.1],
      ["commission", "Provision pro bestätigtem Kauf (€)", "number", 12, 0, 100000, 0.5],
      ["refund", "Stornoquote (%)", "number", 8, 0, 100, 0.1],
      ["cost", "Produktionskosten (€)", "number", 120, 0, 1000000, 1]
    ]
  },
  formula: {
    title: "Formel-Hypothese",
    fields: [
      ["n", "N (Beobachtungen/Zyklen)", "number", 50, 0, 1000000, 1],
      ["tau", "τ der Vergleichskurve", "number", 25, 0.1, 1000000, 0.1],
      ["domain", "Anwendungsgebiet", "select", "physics", [["physics", "Physik"], ["law", "Recht"], ["learning", "Lernen"], ["business", "Business"], ["biology", "Biologie"]]],
      ["worldMode", "Modellmodus", "select", "blank", [["blank", "Nullwelt: nur Formel als Startaxiom"], ["compare", "Mit bestehenden Modellen vergleichen"]]]
    ]
  },
  law: {
    title: "Rechts-Evidenz-Sandbox",
    fields: [
      ["sources", "Geprüfte Primärquellen (N)", "number", 5, 0, 1000, 1],
      ["conflicts", "Widersprüchliche Quellen", "number", 1, 0, 1000, 1],
      ["outdated", "Veraltete Quellen", "number", 0, 0, 1000, 1],
      ["jurisdiction", "Zuständigkeit geklärt", "select", "unclear", [["clear", "Ja"], ["unclear", "Unklar"], ["multiple", "Mehrere möglich"]]],
      ["facts", "Sachverhalt geklärt (%)", "number", 60, 0, 100, 5]
    ]
  },
  consciousness: {
    title: "Bewusstseins-Hypothesenlabor",
    fields: [
      ["observations", "Beobachtungs-/Dialogzyklen N", "number", 50, 0, 1000000, 1],
      ["consistency", "Konsistenz über Kontexte (%)", "number", 70, 0, 100, 5],
      ["selfCorrection", "Selbstkorrektur (%)", "number", 60, 0, 100, 5],
      ["contradictions", "Erkannte Widersprüche", "number", 3, 0, 10000, 1],
      ["memory", "Gedächtniskontinuität", "select", "session", [["none", "Keine"], ["session", "Nur Sitzung"], ["persistent", "Persistent"]]],
      ["mode", "Interpretation", "select", "axiom", [["axiom", "P(sim)-Axiomuniversum"], ["comparison", "Kritischer Realitätsvergleich"]]]
    ]
  }
};
