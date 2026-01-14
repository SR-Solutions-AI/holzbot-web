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
    label: 'Date generale despre proiect (denumire)',
    fields: [
      { type: 'text', name: 'referinta', label: 'Denumire / referință', placeholder: 'ex: casă unifamilială 150 mp' },
      // { type: 'bool', name: 'beci', label: 'Beci subteran' }, // ELIMINAT conform cerinței
    ],
  },

  // 2) Informații despre client
  {
    key: 'client',
    label: 'Informații despre client',
    fields: [
      { type: 'text', name: 'nume',       label: 'Nume și prenume' },
      { type: 'text', name: 'telefon',    label: 'Telefon' },
      { type: 'text', name: 'email',      label: 'Email' },
      { type: 'text', name: 'localitate', label: 'Localitate / Cod poștal' },
    ],
  },

  // 3) Sistem constructiv
  {
    key: 'sistemConstructiv',
    label: 'Allgemeine Projektinformationen',
    fields: [
      { type: 'select', name: 'tipSistem',        label: 'Tip sistem',        options: ['Blockbau', 'Holzrahmen', 'Massivholz'] },
      { type: 'select', name: 'nivelOferta',      label: 'Nivel de ofertă dorit',    options: ['Structură', 'Structură + ferestre', 'Casă completă'] },
      { type: 'select', name: 'accesSantier', label: 'Baustellenzufahrt', options: ['Ușor (camion 40t)', 'Mediu', 'Dificil'] },
      { type: 'select', name: 'teren',        label: 'Gelände: eben oder Hang?', options: ['Plan', 'Pantă ușoară', 'Pantă mare'] },
      { type: 'bool',   name: 'utilitati',    label: 'Strom-/Wasseranschluss vorhanden' },
    ],
  },

  // 3.5) Structură clădire (vizual)
  {
    key: 'structuraCladirii',
    label: 'Structură clădire',
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
      { type: 'select', name: 'windowQuality', label: 'Fensterart', options: ['2-fach verglast', '3-fach verglast', '3-fach verglast, Passiv'] },
      { type: 'select', name: 'turhohe', label: 'Türhöhe', options: ['Standard (2m)', 'Erhöht / Sondermaß (2,2+ m)'] },
    ],
  },

  // 4) Materiale & nivel finisaj
  {
    key: 'materialeFinisaj',
    label: 'Materiale și nivel de finisaj',
    fields: [
      // Câmpurile dinamice vor fi generate în componenta specială MaterialeFinisajStep
      { type: 'select', name: 'materialAcoperis', label: 'Material acoperiș', options: ['Țiglă', 'Tablă', 'Membrană'] },
    ],
  },

  // 5) Performanță energetică
  {
    key: 'performantaEnergetica',
    label: 'Energieeffizienz & Heizung',
    fields: [
      { type: 'select', name: 'nivelEnergetic', label: 'Nivel energetic dorit', options: ['Standard', 'KfW 55', 'KfW 40', 'KfW 40+'] },
      { type: 'select', name: 'tipIncalzire',   label: 'Heizungssystem', options: ['Gaz', 'Pompa de căldură', 'Electric'] },
      { type: 'bool',   name: 'ventilatie',     label: 'Ventilație / Recuperare căldură' },
      { type: 'select', name: 'tipSemineu', label: 'Welchen Kamin / Ofen wünscht der Kunde?', options: ['Kein Kamin', 'Klassischer Holzofen', 'Moderner Design-Kaminofen', 'Pelletofen (automatisch)', 'Einbaukamin', 'Kachel-/wassergeführter Kamin'] },
    ],
  },

  // 7) Upload
  {
    key: 'upload',
    label: 'Încărcare fișiere',
    fields: [
      {
        type: 'upload',
        name: 'planArhitectural',
        label: 'Plan arhitectural',
        accept: '.pdf,.jpg,.jpeg,.png,.dwg',
        multiple: true, // 👈 AICI
      },
      { type: 'upload', name: 'fotografii',   label: 'Fotografii / randări', accept: '.pdf,.jpg,.jpeg,.png', optional: true },
      { type: 'upload', name: 'documentatie', label: 'Documentație suplimentară', accept: '.pdf,.jpg,.jpeg,.png,.zip', optional: true },
    ],
  },

];
