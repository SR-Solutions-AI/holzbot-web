// app/formConfig.ts
export type Field =
  | { type: 'text'; name: string; label: string; placeholder?: string }
  | { type: 'textarea'; name: string; label: string; placeholder?: string }
  | { type: 'number'; name: string; label: string; min?: number; max?: number }
  | { type: 'bool'; name: string; label: string }
  | { type: 'select'; name: string; label: string; options: string[] }
  | { type: 'upload'; name: string; label: string; accept?: string; optional?: boolean; multiple?: boolean };

export type Step = { key: string; label: string; fields: Field[] };

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
    label: 'Sistem constructiv',
    fields: [
      { type: 'select', name: 'tipSistem',        label: 'Tip sistem',        options: ['CLT', 'Holzrahmen', 'Massivholz'] },
      { type: 'select', name: 'gradPrefabricare', label: 'Grad prefabricare', options: ['Panouri', 'Module', 'Montaj pe șantier'] },
      { type: 'select', name: 'tipFundatie',      label: 'Tip fundație',      options: ['Placă', 'Piloți', 'Soclu'] },
      { type: 'select', name: 'tipAcoperis',      label: 'Tip acoperiș',      options: ['Drept', 'Două ape', 'Patru ape', 'Mansardat', 'Șarpantă complexă'] },
    ],
  },

  // 4) Materiale & nivel finisaj
  {
    key: 'materialeFinisaj',
    label: 'Materiale și nivel de finisaj',
    fields: [
      { type: 'select', name: 'nivelOferta',      label: 'Nivel de ofertă dorit',    options: ['Structură', 'Structură + ferestre', 'Casă completă'] },
      { type: 'select', name: 'finisajInterior',  label: 'Tip finisaj interior',      options: ['Tencuială', 'Lemn', 'Fibrociment', 'Mix'] },
      { type: 'select', name: 'fatada',           label: 'Tip fațadă',               options: ['Tencuială', 'Lemn', 'Fibrociment', 'Mix'] },
      { type: 'select', name: 'tamplarie',        label: 'Tip ferestre și uși',       options: ['Lemn', 'Lemn-Aluminiu', 'PVC', 'Aluminiu'] },
      { type: 'select', name: 'materialAcoperis', label: 'Material acoperiș',         options: ['Țiglă', 'Tablă', 'Membrană'] },
    ],
  },

  // 5) Performanță energetică
  {
    key: 'performanta',
    label: 'Performanță energetică',
    fields: [
      { type: 'select', name: 'nivelEnergetic', label: 'Nivel energetic dorit', options: ['Standard', 'KfW 55', 'KfW 40', 'KfW 40+'] },
      { type: 'select', name: 'incalzire',      label: 'Sistem încălzire preferat', options: ['Gaz', 'Pompa de căldură', 'Electric'] },
      { type: 'bool',   name: 'ventilatie',     label: 'Ventilație / Recuperare căldură' },
    ],
  },

  // 6) Condiții șantier & logistică
  {
    key: 'logistica',
    label: 'Condiții de șantier și logistică',
    fields: [
      { type: 'select', name: 'accesSantier', label: 'Acces șantier', options: ['Ușor (camion 40t)', 'Mediu', 'Dificil'] },
      { type: 'select', name: 'teren',        label: 'Teren plat sau pantă?', options: ['Plan', 'Pantă ușoară', 'Pantă mare'] },
      { type: 'bool',   name: 'utilitati',    label: 'Acces curent electric / apă' },
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
