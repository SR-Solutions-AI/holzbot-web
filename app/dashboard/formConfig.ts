// app/formConfig.ts
export type Field =
  | { type: 'text'; name: string; label: string; placeholder?: string }
  | { type: 'textarea'; name: string; label: string; placeholder?: string }
  | { type: 'number'; name: string; label: string; min?: number; max?: number }
  | { type: 'bool'; name: string; label: string }
  | { type: 'select'; name: string; label: string; options: string[] }
  | { type: 'upload'; name: string; label: string; accept?: string; optional?: boolean; multiple?: boolean };

export type Step = { key: string; label: string; subtitle?: string; fields: Field[] };

/**
 * Modificări:
 * 1) am inversat pasul 1 cu 2: "dateGenerale" devine primul pas (include doar "referinta")
 * 2) am eliminat complet câmpul "beci"
 */
export const formSteps: Step[] = [
  // 1) Date generale proiect — primul pas (denumire)
  {
    key: 'dateGenerale',
    label: 'Allgemeine Projektdaten (Bezeichnung)',
    fields: [
      { type: 'text', name: 'referinta', label: 'Bezeichnung / Referenz', placeholder: 'z.B.: Einfamilienhaus 150 m²' },
      // { type: 'bool', name: 'beci', label: 'Beci subteran' }, // ELIMINAT conform cerinței
    ],
  },

  // 2) Kundendaten
  {
    key: 'client',
    label: 'Kundendaten',
    fields: [
      { type: 'text', name: 'nume',       label: 'Vor- und Nachname', placeholder: 'z.B. Max Mustermann' },
      { type: 'text', name: 'telefon',    label: 'Telefonnummer', placeholder: 'z.B. +49 123 456789' },
      { type: 'text', name: 'email',      label: 'E-Mail', placeholder: 'z.B. max@beispiel.de' },
      { type: 'text', name: 'localitate', label: 'Adresse', placeholder: 'Straße, PLZ Ort' },
    ],
  },

  // 3) Allgemeine Projektinformationen
  {
    key: 'sistemConstructiv',
    label: 'Allgemeine Projektinformationen',
    fields: [
      { type: 'select', name: 'tipSistem',   label: 'Systemtyp', options: ['Blockbau', 'Holzrahmen', 'Massivholz'] },
      { type: 'select', name: 'nivelOferta', label: 'Angebotsumfang', options: ['Structură', 'Structură + ferestre', 'Casă completă'] },
      { type: 'select', name: 'accesSantier', label: 'Baustellenzufahrt', options: ['Ușor (camion 40t)', 'Mediu', 'Dificil'] },
      { type: 'select', name: 'teren',       label: 'Gelände: eben oder Hang?', options: ['Plan', 'Pantă ușoară', 'Pantă mare'] },
      { type: 'bool',   name: 'utilitati',   label: 'Strom-/Wasseranschluss vorhanden' },
    ],
  },

  // 3.5) Gebäudestruktur (vizual)
  {
    key: 'structuraCladirii',
    label: 'Gebäudestruktur',
    fields: [
      { type: 'select', name: 'tipFundatieBeci', label: 'Untergeschoss / Fundament', options: ['Kein Keller (nur Bodenplatte)', 'Keller (unbeheizt / Nutzkeller)', 'Keller (mit einfachem Ausbau)'] },
      { type: 'bool', name: 'pilons', label: 'Pfahlgründung erforderlich' },
      { type: 'select', name: 'inaltimeEtaje', label: 'Geschosshöhe', options: ['Standard (2,50 m)', 'Komfort (2,70 m)', 'Hoch (2,85+ m)'] },
    ],
  },

  // 3.6) Tip acoperiș
  {
    key: 'tipAcoperis',
    label: 'Dachart',
    subtitle: 'Wählen Sie die passende Dachform für Ihr Projekt',
    fields: [
      { type: 'select', name: 'tipAcoperis', label: 'Dachart', options: ['Flachdach', 'Pultdach', 'Gründach', 'Satteldach', 'Krüppelwalmdach', 'Mansardendach', 'Mansardendach mit Fußwalm', 'Mansardendach mit Schlepp', 'Mansardenwalmdach', 'Walmdach', 'Paralleldach'] },
    ],
  },

  // 3.7) Ferestre și uși
  {
    key: 'ferestreUsi',
    label: 'Fenster & Türen',
    fields: [
      { type: 'select', name: 'bodentiefeFenster', label: 'Bodentiefe Fenster / Glasflächen vorhanden', options: ['Nein', 'Ja – einzelne', 'Ja – mehrere / große Glasflächen'] },
      { type: 'select', name: 'windowQuality', label: 'Fensterart', options: ['3-fach verglast', '3-fach verglast, Passiv'] },
      { type: 'select', name: 'turhohe', label: 'Türhöhe', options: ['Standard (2m)', 'Erhöht / Sondermaß (2,2+ m)'] },
    ],
  },

  // 4) Materialien & Ausbaustufe
  {
    key: 'materialeFinisaj',
    label: 'Materialien & Ausbaustufe',
    fields: [
      // Câmpurile dinamice vor fi generate în componenta specială MaterialeFinisajStep
      { type: 'select', name: 'materialAcoperis', label: 'Dachmaterial', options: ['Țiglă', 'Tablă', 'Membrană'] },
    ],
  },

  // 5) Energieeffizienz & Heizung
  {
    key: 'performantaEnergetica',
    label: 'Energieeffizienz & Heizung',
    fields: [
      { type: 'select', name: 'nivelEnergetic', label: 'Gewünschtes Energieniveau', options: ['Standard', 'KfW 55', 'KfW 40', 'KfW 40+'] },
      { type: 'select', name: 'tipIncalzire',   label: 'Heizungssystem', options: ['Gaz', 'Pompa de căldură', 'Electric'] },
      { type: 'bool',   name: 'ventilatie',     label: 'Lüftung / Wärmerückgewinnung' },
      { type: 'select', name: 'tipSemineu', label: 'Welchen Kamin / Ofen wünscht der Kunde?', options: ['Kein Kamin', 'Klassischer Holzofen', 'Moderner Design-Kaminofen', 'Pelletofen (automatisch)', 'Einbaukamin', 'Kachel-/wassergeführter Kamin'] },
    ],
  },

  // 7) Datei-Upload
  {
    key: 'upload',
    label: 'Datei-Upload',
    fields: [
      {
        type: 'upload',
        name: 'planArhitectural',
        label: 'Architekturplan',
        accept: '.pdf,.jpg,.jpeg,.png,.dwg',
        multiple: true, // 👈 AICI
      },
      { type: 'upload', name: 'fotografii',   label: 'Fotos / Renderings', accept: '.pdf,.jpg,.jpeg,.png', optional: true },
      { type: 'upload', name: 'documentatie', label: 'Zusätzliche Dokumentation', accept: '.pdf,.jpg,.jpeg,.png,.zip', optional: true },
    ],
  },

];

/** Flow scurt pentru Dachstuhl: dateGenerale → client → projektdaten → Dämmung & Dachdeckung → upload */
export const formStepsDachstuhl: Step[] = [
  {
    key: 'dateGenerale',
    label: 'Allgemeine Projektdaten (Bezeichnung)',
    fields: [
      { type: 'text', name: 'referinta', label: 'Bezeichnung / Referenz', placeholder: 'z.B.: Einfamilienhaus 150 m²' },
    ],
  },
  {
    key: 'client',
    label: 'Kundendaten',
    fields: [
      { type: 'text', name: 'nume',       label: 'Vor- und Nachname', placeholder: 'z.B. Max Mustermann' },
      { type: 'text', name: 'telefon',    label: 'Telefonnummer', placeholder: 'z.B. +49 123 456789' },
      { type: 'text', name: 'email',      label: 'E-Mail', placeholder: 'z.B. max@beispiel.de' },
      { type: 'text', name: 'localitate', label: 'Adresse', placeholder: 'Straße, PLZ Ort' },
    ],
  },
  {
    key: 'projektdaten',
    label: 'Projektdaten',
    fields: [
      { type: 'select', name: 'projektumfang', label: 'Projektumfang', options: ['Dachstuhl', 'Dachdeckung', 'Dachstuhl + Dachdeckung'] },
      { type: 'select', name: 'nutzungDachraum', label: 'Nutzung des Dachraums', options: ['Nicht ausgebaut', 'Wohnraum / ausgebaut'] },
      { type: 'bool', name: 'leistungAbbund', label: 'Abbund' },
      { type: 'bool', name: 'leistungLieferung', label: 'Lieferung' },
      { type: 'bool', name: 'leistungMontage', label: 'Montage' },
      { type: 'bool', name: 'leistungKranarbeiten', label: 'Kranarbeiten' },
      { type: 'bool', name: 'leistungGeruest', label: 'Gerüst' },
      { type: 'bool', name: 'leistungEntsorgung', label: 'Entsorgung' },
    ],
  },
  {
    key: 'daemmungDachdeckung',
    label: 'Dämmung & Dachdeckung',
    fields: [
      { type: 'select', name: 'daemmung', label: 'Dämmung', options: ['Keine', 'Zwischensparren', 'Aufsparren', 'Kombination'] },
      { type: 'select', name: 'unterdach', label: 'Unterdach', options: ['Folie', 'Schalung + Folie'] },
      { type: 'select', name: 'dachstuhlTyp', label: 'Dachstuhl-Typ', options: ['Sparrendach', 'Pfettendach', 'Kehlbalkendach', 'Sonderkonstruktion'] },
      { type: 'bool',   name: 'sichtdachstuhl', label: 'Sichtdachstuhl' },
      { type: 'select', name: 'dachdeckung', label: 'Dachdeckung', options: ['Ziegel', 'Betonstein', 'Blech', 'Schindel', 'Sonstiges'] },
    ],
  },
  {
    key: 'upload',
    label: 'Datei-Upload',
    fields: [
      { type: 'upload', name: 'planArhitectural', label: 'Architekturplan', accept: '.pdf,.jpg,.jpeg,.png,.dwg', multiple: true },
      { type: 'upload', name: 'fotografii',   label: 'Fotos / Renderings', accept: '.pdf,.jpg,.jpeg,.png', optional: true },
      { type: 'upload', name: 'documentatie', label: 'Zusätzliche Dokumentation', accept: '.pdf,.jpg,.jpeg,.png,.zip', optional: true },
    ],
  },
];
