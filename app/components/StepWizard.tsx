'use client'

import { useEffect, useMemo, useRef, useState, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { apiFetch } from '../lib/supabaseClient'
// Wir importieren nur den Typ, keine statischen Daten
import { type Field, formSteps } from '../dashboard/formConfig'
import { CheckCircle2, ChevronLeft, ChevronRight, ChevronDown, Loader2, AlertTriangle, X } from 'lucide-react'

// Dynamic import pentru SimplePdfViewer - doar pe client pentru a evita problemele cu Turbopack
const SimplePdfViewer = dynamic(() => import('./SimplePdfViewer.client'), {
  ssr: false,
  loading: () => <div className="py-10 text-center text-neutral-200">PDF wird generiert…</div>
})

type Drafts = Record<string, Record<string, any>>
type Errors = Record<string, string | undefined>

// Timpul minim (în ms) pentru care afișăm animația de loading/progres
const MIN_ANIMATION_TIME = 5000; 

/* ================== DATE ACOPERIȘ (grid 4x6) ================== */
const ROOF_TYPES = [
  { name_de: 'Flachdach', img: '/roof_types/1.png' },
  { name_de: 'Fußwalmdach', img: '/roof_types/2.png' },
  { name_de: 'Kreuzdach', img: '/roof_types/3.png' },
  { name_de: 'Grabendach', img: '/roof_types/4.png' },
  { name_de: 'Krüppelwalmdach', img: '/roof_types/5.png' },
  { name_de: 'Mansardendach', img: '/roof_types/6.png' },
  { name_de: 'Mansardendach mit Fußwalm', img: '/roof_types/7.png' },
  { name_de: 'Mansardendach mit Schopf', img: '/roof_types/8.png' },
  { name_de: 'Mansardenwalmdach', img: '/roof_types/9.png' },
  { name_de: 'Nurdach', img: '/roof_types/10.png' },
  { name_de: 'Paralleldach', img: '/roof_types/11.png' },
  { name_de: 'Pultdach', img: '/roof_types/12.png' },
  { name_de: 'Pultdach erweitert/versetzt', img: '/roof_types/13.png' },
  { name_de: 'Satteldach', img: '/roof_types/14.png' },
  { name_de: 'Satteldach erweitert', img: '/roof_types/15.png' },
  { name_de: 'Sattel-Walmdach', img: '/roof_types/16.png' },
  { name_de: 'Scheddach / Sägezahndach', img: '/roof_types/17.png' },
  { name_de: 'Schleppdach', img: '/roof_types/18.png' },
  { name_de: 'Schmetterlingsdach', img: '/roof_types/19.png' },
  { name_de: 'Tonnendach', img: '/roof_types/20.png' },
  { name_de: 'Walmdach', img: '/roof_types/21.png' },
  { name_de: 'Walm-Kehldach', img: '/roof_types/22.png' },
  { name_de: 'Zeltdach', img: '/roof_types/23.png' },
  { name_de: 'Zwerchdach', img: '/roof_types/24.png' },
] as const

/* ===================== UI DICTIONAR (AFIȘARE) ===================== */
const DE = {
  steps: {
    dateGenerale: 'Allgemeine Projektdaten (Bezeichnung)',
    client: 'Kundendaten',
    sistemConstructiv: 'Allgemeine Projektinformationen',
    structuraCladirii: 'Gebäudestruktur',
    tipAcoperis: 'Dachart',
    ferestreUsi: 'Fenster & Türen',
    materialeFinisaj: 'Materialien & Ausbaustufe',
    performantaEnergetica: 'Energieeffizienz & Heizung',
    conditiiSantier: 'Baustellenbedingungen & Logistik',
    logistica: 'Baustellenbedingungen & Logistik',
    upload: 'Datei-Upload',
  },
  // Wir behalten die statischen Übersetzungen als Fallback, falls die DB keine Labels liefert
  fieldsGlobal: {
    'Tip sistem': 'Systemtyp',
    'Grad prefabricare': 'Vorfertigungsgrad',
    'Tip fundație': 'Fundamenttyp',
    'Tip acoperiș': 'Dachtyp',
    'Material pereți': 'Wandmaterial',
    'Material acoperiș': 'Dachmaterial',
    'Nivel de finisaj': 'Ausbaustufe',
    'Fațadă': 'Fassade',
    'Tâmplărie': 'Fenster/Türen',
    'Tip termoizolație': 'Dämmstoff',
    'Grosime termoizolație': 'Dämmstärke (mm)',
    'Finisaje interioare': 'Innenausbau',
    'Încălzire': 'Heizung',
    'Încălzire secundară': 'Zusatzheizung',
    'Sistem distribuție': 'Wärmeverteilung',
    'Ventilație': 'Lüftung',
    'Clasă energetică': 'Energieklasse',
    'Producție energie': 'Eigenenergie',
    'Condiții de șantier și logistică': 'Baustellenbedingungen & Logistik',
    'Acces șantier': 'Baustellenzufahrt',
    'Utilități disponibile': 'Verfügbare Anschlüsse',
    'Macara': 'Kran',
    'Spațiu depozitare': 'Lagermöglichkeit',
    'Drenaj': 'Perimeterdrainage',
    'Observații': 'Anmerkungen',
    'Încărcare fișiere': 'Datei-Upload',

    'Informații despre client': 'Kundendaten',
    'Sistem constructiv': 'Bausystem',
    'Materiale și nivel de finisaj': 'Materialien & Ausbaustufe',
    'Performanță energetică': 'Energieeffizienz',

    'Nivel de ofertă dorit': 'Gewünschter Angebotsumfang',
    'Tip finisaj interior': 'Innenausbau – Typ',
    'Tip fațadă': 'Fassade – Typ',
    'Tip ferestre și uși': 'Fenster/Türen – Typ',
    'Sistem încălzire preferat': 'Bevorzugte Heizung',
    'Nivel energetic dorit': 'Gewünschtes Energieniveau',
    'Teren plat sau pantă?': 'Gelände: eben oder Hang?',
    'Acces curent electric / apă': 'Strom-/Wasseranschluss vorhanden',
    'Ventilație / Recuperare căldură': 'Lüftung / Wärmerückgewinnung',

    'Denumire / referință': 'Bezeichnung / Referenz',
    'Nume și prenume': 'Vor- und Nachname',
    'Telefon': 'Telefonnummer',
    'Email': 'E-Mail',
    'Localitate / Cod poștal': 'Ort / Postleitzahl',

    'Plan arhitectural': 'Architekturplan',
    'Fotografii / randări': 'Fotos / Renderings',
    'Documentație suplimentară': 'Zusätzliche Dokumentation',
    'Choose File': 'Datei auswählen',
    'no file selected': 'keine Datei ausgewählt'
  },

  optionsGlobal: {
    // Statische Übersetzungen für Dropdown-Werte
    'Placă': 'Bodenplatte',
    'Piloți': 'Pfahlgründung',
    'Soclu': 'Streifenfundament (Sockel)',
    'Zidărie': 'Mauerwerk',
    'Beton armat': 'Stahlbeton',
    'Lemn': 'Holz',
    'Metal': 'Stahlbau',
    'Structură ușoară': 'Leichtbau',
    'Structură mixtă': 'Mischkonstruktion',

    'Țiglă': 'Dachziegel',
    'Țiglă ceramică': 'Tondachziegel',
    'Țiglă beton': 'Betondachstein',
    'Tablă': 'Blech',
    'Tablă fălțuită': 'Stehfalzblech',
    'Șindrilă bituminoasă': 'Bitumschindel',
    'Membrană': 'Membranbahn',
    'Membrană PVC': 'PVC-Bahn',
    'Hidroizolație bitum': 'Bitumenabdichtung',

    'Cărămidă': 'Ziegel',
    'BCA': 'Porenbeton',
    'EPS': 'EPS',
    'XPS': 'XPS',
    'Vată bazaltică': 'Steinwolle',
    'Vată minerală': 'Mineralwolle',
    'Celuloză': 'Zellulose',
    'Poliuretan': 'PU',

    'PVC': 'Kunststoff',
    'Lemn stratificat': 'Brettschichtholz',
    'Aluminiu': 'Aluminium',
    'Lemn-Aluminiu': 'Holz-Aluminium',
    'Termopan': 'Zweifachverglasung',
    'Tripan': 'Dreifachverglasung',

    'Centrală pe gaz': 'Gastherme',
    'Pompă de căldură': 'Wärmepumpe',
    'Cazan pe peleți': 'Pelletkessel',
    'Încălzire prin pardoseală': 'Fußbodenheizung',
    'Radiatoare': 'Heizkörper',
    'Ventilație cu recuperare': 'Kontrollierte Lüftung mit WRG',
    'Naturală': 'Natürlich',
    'Clasă energetică A': 'Energieklasse A',
    'Clasă energetică B': 'Energieklasse B',
    'Clasă energetică C': 'Energieklasse C',
    'nZEB': 'nZEB',
    'Panouri fotovoltaice': 'Photovoltaik',
    'Pregătire fotovoltaice': 'PV-Vorbereitung',

    'Da': 'Ja',
    'Nu': 'Nein',

    'Ușor (camion 40t)': 'Leicht (LKW 40t)',
    'Mediu': 'Mittel',
    'Dificil': 'Schwierig',
    'Plan': 'Eben',
    'Pantă ușoară': 'Leichte Hanglage',
    'Pantă mare': 'Starke Hanglage',

    'Structură': 'Rohbau/Tragwerk',
    'Structură + ferestre': 'Tragwerk + Fenster',
    'Casă completă': 'Schlüsselfertiges Haus',
    'Tencuială': 'Putz',
    'Fibrociment': 'Faserzement',
    'Mix': 'Mischung',

    'Panouri': 'Paneele',
    'Module': 'Module',
    'Montaj pe șantier': 'Montage auf Baustelle',
    'Drept': 'Flachdach',
    'Două ape': 'Satteldach',
    'Patru ape': 'Walmdach',
    'Mansardat': 'Mansarddach',
    'Șarpantă complexă': 'Komplexe Dachform',

    'Gaz': 'Gas',
    'Pompa de căldură': 'Wärmepumpe',
    'Electric': 'Elektrisch',
    'Standard': 'Standard',
    'KfW 55': 'KfW 55',
    'KfW 40': 'KfW 40',
    'KfW 40+': 'KfW 40+',

    'Plan arhitectură': 'Architekturplan',
    'Plan arhitectural': 'Architekturplan',
    'Plan structură': 'Tragwerksplan',
    'Caiet de sarcini': 'Leistungsverzeichnis',
    'Documentație urbanism': 'B-Plan / Bau-Doku',
    'Documentație suplimentară': 'Zusätzliche Dokumentation',
    'Alte documente': 'Weitere Dokumente',
    'PDF plan': 'Plan-PDF',
    'DWG/DXF': 'DWG/DXF',
    'Imagini': 'Bilder',
    'Fotografii / randări': 'Fotos / Renderings',
  },

  common: {
    selected: 'Ausgewählt',
    notSelected: 'Nicht ausgewählt',
    selectPlaceholder: '— auswählen —',
    uploadingError: 'Fehler beim Hochladen',
    processingAlt: 'Wird verarbeitet…',
    btnBack: 'Zurück',
    btnNext: 'Weiter',
    btnFinish: 'Abschließen',
    toastSaving: 'Speichern…',
    toastSaved: 'Gespeichert ✓',
    toastError: 'Fehler beim Speichern',
    pdfNoLinkYet: 'Es gibt noch keinen gültigen PDF-Link.',
    pdfTryAgain: 'Es gibt noch keinen gültigen PDF-Link. Bitte in ein paar Sekunden erneut versuchen.',
    copyOk: 'Link in die Zwischenablage kopiert.',
    copyFail: 'Konnte den Link nicht kopieren. In neuem Tab öffnen und aus der Adressleiste kopieren.',
    finalizeErrorPrefix: 'Fehler beim Abschließen',
    validatingPlan: 'Plan wird überprüft...',
    uploadingFiles: 'Dateien werden hochgeladen...',
    planInvalidTitle: 'Plan ungültig',
    planInvalidMsg: 'Die KI konnte keine Raumbezeichnungen oder Maßstäbe erkennen. Bitte laden Sie einen lesbaren Grundriss hoch.',
  },
} as const

/* Helpers */
function tStepLabel(key: string, fallback: string) {
  return (DE.steps as any)?.[key] ?? fallback
}
// Aktualisiert: Priorisiere das Label vom API, fallback auf DE
function tFieldLabel(stepKey: string, fieldName: string, fallback: string) {
  return (
    (DE.fieldsGlobal as any)?.[fallback] ?? 
    fallback
  )
}
function tPlaceholder(stepKey: string, fieldName: string, fallback?: string) {
  if (!fallback) return undefined
  // Translate placeholder if needed
  const placeholderTranslations: Record<string, string> = {
    'ex: casă unifamilială 150 mp': 'z.B.: Einfamilienhaus 150 m²',
  }
  return placeholderTranslations[fallback] ?? fallback
}
function tOption(stepKey: string, fieldName: string, value: string) {
  return (
    (DE.optionsGlobal as any)?.[value] ??
    value
  )
}

/* ================= VALIDATORS ================= */
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i
const phoneRe = /^[0-9+\s().-]{6,}$/

function validateClient(form: Record<string, any>): Errors {
  const e: Errors = {}
  const nume = (form.nume ?? '').trim()
  const telefon = (form.telefon ?? '').trim()
  const email = (form.email ?? '').trim()
  const localitate = (form.localitate ?? '').trim()
  
  if (!nume) {
    e.nume = 'Bitte den Namen eingeben.'
  } else if (nume.length < 2) {
    e.nume = 'Der Name muss mindestens 2 Zeichen lang sein.'
  }
  
  if (!telefon) {
    e.telefon = 'Bitte die Telefonnummer eingeben.'
  } else if (!phoneRe.test(telefon)) {
    e.telefon = 'Bitte eine gültige Telefonnummer eingeben.'
  }
  
  if (!email) {
    e.email = 'Bitte die E-Mail-Adresse eingeben.'
  } else if (!emailRe.test(email)) {
    e.email = 'Bitte eine gültige E-Mail-Adresse eingeben.'
  }
  
  if (!localitate) {
    e.localitate = 'Bitte den Ort eingeben.'
  }
  
  return e
}

function validateGeneric(stepKey: string, fields: Field[], form: Record<string, any>, drafts?: Record<string, any>): Errors {
  const e: Errors = {}
  
  // Obține nivelOferta pentru a ști ce field-uri sunt relevante (din form-ul curent sau drafts)
  // Pentru sistemConstructiv, folosim form-ul curent, pentru alte step-uri folosim drafts
  const sistemConstructivData = stepKey === 'sistemConstructiv' ? form : (drafts?.sistemConstructiv || {})
  const nivelOferta = sistemConstructivData.nivelOferta || ''
  
  // Funcție helper pentru a determina dacă un câmp ar trebui să fie ascuns (aceeași logică ca în DynamicFields)
  const shouldHideField = (fieldName: string): boolean => {
    // Ignoră câmpul tipAcoperis pentru sistemConstructiv și structuraCladirii (a fost mutat la pasul dedicat tipAcoperis)
    if ((stepKey === 'sistemConstructiv' || stepKey === 'structuraCladirii' || stepKey === 'materialeFinisaj') && fieldName === 'tipAcoperis') {
      return true
    }
    // Ignoră câmpul floorsNumber pentru structuraCladirii (nu este folosit în frontend, este calculat din listaEtaje)
    if (stepKey === 'structuraCladirii' && fieldName === 'floorsNumber') {
      return true
    }
    if (!nivelOferta) return false
    
    const nivelStr = String(nivelOferta).toLowerCase()
    
    // Verifică dacă este "Casă completă" (Schlüsselfertiges Haus)
    const isCasaCompleta = nivelStr.includes('schlüsselfertig') || nivelStr.includes('completă') || nivelStr.includes('completa')
    
    // Pentru step-ul performantaEnergetica: nu ascundem nimic (toate câmpurile sunt vizibile dacă step-ul este vizibil)
    if (stepKey === 'performantaEnergetica') {
      return false
    }
    
    // Pentru step-ul materialeFinisaj: logica existentă
    if (stepKey !== 'materialeFinisaj') return false
    
    // "Rohbau/Tragwerk" sau "Structură" (fără ferestre) -> ascunde tamplarie și finisajInterior
    const isStructuraOnly = (nivelStr.includes('rohbau') || nivelStr.includes('tragwerk') || nivelStr.includes('structură')) 
        && !nivelStr.includes('fenster') && !nivelStr.includes('ferestre') && !nivelStr.includes('completă') && !nivelStr.includes('schlüsselfertig')
    
    if (isStructuraOnly) {
      return fieldName === 'tamplarie' || fieldName === 'finisajInterior'
    }
    
    // "Tragwerk + Fenster" sau "Structură + ferestre" -> ascunde doar finisajInterior
    const isStructuraPlusFenestre = (nivelStr.includes('tragwerk') || nivelStr.includes('structură')) 
        && (nivelStr.includes('fenster') || nivelStr.includes('ferestre'))
    
    if (isStructuraPlusFenestre) {
      return fieldName === 'finisajInterior'
    }
    
    // "Schlüsselfertiges Haus" sau "Casă completă" -> arată tot (nu ascunde nimic)
    return false
  }
  
  // Validare specială pentru structuraCladirii: ultimul etaj trebuie să fie pod sau mansardă
  if (stepKey === 'structuraCladirii') {
    const listaEtaje = Array.isArray(form.listaEtaje) ? form.listaEtaje : []
    if (listaEtaje.length === 0) {
      e.listaEtaje = 'Bitte fügen Sie mindestens ein Element hinzu.'
    } else {
      const ultimulEtaj = listaEtaje[listaEtaje.length - 1]
      const isPod = ultimulEtaj === 'pod'
      const isMansarda = typeof ultimulEtaj === 'string' && ultimulEtaj.startsWith('mansarda')
      if (!isPod && !isMansarda) {
        e.listaEtaje = 'Das letzte Element muss ein Dachboden oder ein Dachgeschoss sein.'
      }
    }
    // Skip tipAcoperis validation pentru structuraCladirii și materialeFinisaj (se validează în pasul dedicat tipAcoperis)
  }

  for (const f of fields) {
    // Skip optional fields
    if ((f as any).optional) continue
    // Skip bool fields (they're always optional)
    if (f.type === 'bool') continue
    
    // Skip hidden fields based on nivelOferta (validare în timp real)
    if (shouldHideField(f.name)) continue

    const v = (form as any)[f.name]
    
    // Upload validation
    if (f.type === 'upload') {
      if (!v || (Array.isArray(v) && v.length === 0)) {
        e[f.name] = 'Bitte laden Sie mindestens eine Datei hoch.'
      }
      continue
    }
    
    // Select validation
    if (f.type === 'select') {
    if (v === undefined || v === null || String(v).trim() === '') {
        e[f.name] = 'Bitte wählen Sie eine Option aus.'
      }
      continue
    }
    
    // Text/Textarea validation
    if (f.type === 'text' || f.type === 'textarea') {
      const str = String(v ?? '').trim()
      if (!str) {
        e[f.name] = 'Dieses Feld ist erforderlich.'
      } else if (str.length < 2) {
        e[f.name] = 'Dieses Feld muss mindestens 2 Zeichen lang sein.'
      } else if (str.length > 500) {
        e[f.name] = 'Dieses Feld darf maximal 500 Zeichen lang sein.'
      }
      continue
    }
    
    // Number validation
    if (f.type === 'number') {
      if (v === undefined || v === null || v === '') {
        e[f.name] = 'Bitte geben Sie eine Zahl ein.'
      } else {
        const num = Number(v)
        if (isNaN(num)) {
          e[f.name] = 'Bitte geben Sie eine gültige Zahl ein.'
        } else {
          if (f.min !== undefined && num < f.min) {
            e[f.name] = `Der Wert muss mindestens ${f.min} sein.`
          }
          if (f.max !== undefined && num > f.max) {
            e[f.name] = `Der Wert darf maximal ${f.max} sein.`
          }
        }
      }
      continue
    }
  }
  
  return e
}


/* =============== Select custom (PORTAL) =============== */
function SelectSun({
  value,
  onChange,
  options,
  placeholder = DE.common.selectPlaceholder,
  displayFor,
}:{
  value?: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  displayFor?: (raw: string) => string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; width: number }>({ left: 0, top: 0, width: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  const place = useCallback(() => {
    const b = btnRef.current?.getBoundingClientRect()
    if (!b) return
    setPos({ left: Math.round(b.left), top: Math.round(b.bottom + 6), width: Math.round(b.width) })
  }, [])

  useLayoutEffect(() => { if (open) place() }, [open, place])
  useEffect(() => {
    if (!open) return
    const onScroll = () => place()
    const onResize = () => place()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open, place])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return
      const t = e.target as Node
      if (btnRef.current?.contains(t)) return
      setOpen(false)
    }
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const show = (raw?: string) => raw ? (displayFor ? displayFor(raw) : raw) : placeholder

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        className={`sun-select ${open ? 'sun-select--open' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className={`truncate ${value ? 'text-ink' : 'text-neutral-500'}`}>{show(value)}</span>
        <ChevronDown size={16} className="shrink-0 opacity-80" />
      </button>

      {open && typeof window !== 'undefined' && createPortal(
        <div
          className="sun-menu"
          role="listbox"
          style={{ position: 'fixed', left: pos.left, top: pos.top, width: pos.width, zIndex: 9999 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {options.map(opt => {
            const active = opt === value
            const label = displayFor ? displayFor(opt) : opt
            return (
              <button
                key={opt}
                type="button"
                className={`sun-menu-item ${active ? 'is-active' : ''}`}
                onClick={() => { onChange(opt); setOpen(false) }}
              >
                <span className="truncate">{label}</span>
                {active && <CheckCircle2 size={16} className="shrink-0" />}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}

/* =============== Grid selector acoperiș =============== */
function RoofGridSelect({ value, onChange }:{ value?: string; onChange: (v: string) => void }) {
  return (
    <div className="rounded-xl border p-2 bg-coffee-850/80 border-white/10 shadow-soft shadow-black/40 backdrop-blur-xs max-h-[330px] overflow-y-auto pretty-scroll">
      <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {ROOF_TYPES.map(r => {
          const active = r.name_de === value
          return (
            <button
              key={r.name_de}
              type="button"
              title={r.name_de}
              aria-pressed={active}
              onClick={() => onChange(r.name_de)}
              className={[
                'group relative rounded-lg p-2 text-center transition-transform duration-150 ease-out will-change-transform',
                'bg-[#6a4b39]/70 border border-[#e3c7ab22] hover:border-[#e3c7ab55]',
                active ? 'ring-2 ring-caramel/60 shadow-soft scale-[1.02] bg-[#6a4b39]/50' : 'hover:scale-[1.02] hover:shadow-soft hover:ring-1 hover:ring-caramel/35',
              ].join(' ')}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.img} alt={r.name_de} className="w-full h-26 object-contain rounded-md mx-auto bg-[#f1e6d3]/15" loading="lazy" decoding="async" />
              <div className="mt-1 text-center text-[12px] font-semibold leading-tight text-sand line-clamp-2">{r.name_de}</div>
              {active && (
                <div className="absolute top-1 right-1 bg-caramel text-ink rounded-full p-[2px] shadow"><CheckCircle2 size={13} /></div>
              )}
              <span className="pointer-events-none absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition ring-0 group-hover:ring-1 group-hover:ring-caramel/30" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ================= Helpers pentru PDF re-signed ================= */
async function probeUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}

/* MODIFICARE IMPORTANTĂ: Validare URL cu Guard */
async function fetchFreshPdfUrl(offerId: string | null): Promise<string | null> {
  if (!offerId) return null; 
  try {
    const r = await apiFetch(`/offers/${offerId}/export-url`)
    const url = r?.url || r?.download_url || r?.pdf
    if (!url) return null
    
    const ok = await probeUrl(url)
    return ok ? url : null
  } catch (e: any) {
    // If the API returns 404 "No PDF found", that's a normal state (not an error)
    const msg = String(e?.message || '')
    if (msg.startsWith('404 ')) return null
    return null
  }
}

/* ================= Wizard ================= */
export default function StepWizard() {
  // 1. Definim TOATE hook-urile la început (FĂRĂ condiții/returns înainte)
  const [dynamicSteps, setDynamicSteps] = useState<any[]>([])
  const [loadingForm, setLoadingForm] = useState(true)

  const [offerId, setOfferId] = useState<string | null>(null)
  // Keep a synchronous source of truth for offer id to avoid races between async flows and React state updates.
  const offerIdRef = useRef<string | null>(null)
  const [idx, setIdx] = useState(0)
  const [form, setForm] = useState<Record<string, any>>({})
  const [drafts, setDrafts] = useState<Drafts>({})
  
  const [saving, setSaving] = useState(false)
  const [processStatus, setProcessStatus] = useState<string>('')

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingStepsRef = useRef<Set<string>>(new Set()) // Track in-flight saves to prevent duplicates

  const saveDebounceRef = useRef<any>(null)
  const lastSavedRef = useRef<string>('')

  const creatingRef = useRef(false)
  const [computing, setComputing] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [computeStartTime, setComputeStartTime] = useState<number | null>(null)

  const [dir, setDir] = useState<'next' | 'back' | null>(null)
  const [animKey, setAnimKey] = useState(0)

  const [errors, setErrors] = useState<Errors>({})
  const [showErrors, setShowErrors] = useState(false)
  
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const lastProcessedCreationId = useRef<number>(0)
  const activeCreationPromise = useRef<Promise<string> | null>(null)
  const pendingOfferTypeIdRef = useRef<string | null>(null)

  // Keep ref in sync with state (covers cases like selecting an existing offer).
  useEffect(() => {
    offerIdRef.current = offerId
  }, [offerId])

  // Filter steps based on nivelOferta - hide performantaEnergetica step if not "Casă completă"
  // IMPORTANT: Only filter if we're NOT currently on sistemConstructiv step (to allow selection)
  const visibleSteps = useMemo(() => {
    // Get current step key from visibleSteps (but we need to use dynamicSteps here to avoid circular dependency)
    const currentStepKey = dynamicSteps[idx]?.key
    
    // If we're on sistemConstructiv step, show all steps to allow selection
    if (currentStepKey === 'sistemConstructiv') {
      return dynamicSteps
    }
    
    // Otherwise, check nivelOferta from drafts (saved selection)
    const nivelOferta = drafts?.sistemConstructiv?.nivelOferta || ''
    if (!nivelOferta) {
      return dynamicSteps
    }
    
    const nivelStr = String(nivelOferta).toLowerCase()
    const isCasaCompleta = nivelStr.includes('schlüsselfertig') || nivelStr.includes('completă') || nivelStr.includes('completa')
    const isStructuraOnly = (nivelStr.includes('rohbau') || nivelStr.includes('tragwerk') || nivelStr.includes('structură')) 
        && !nivelStr.includes('fenster') && !nivelStr.includes('ferestre') && !nivelStr.includes('completă') && !nivelStr.includes('schlüsselfertig')
    const isStructuraPlusFenestre = (nivelStr.includes('tragwerk') || nivelStr.includes('structură')) 
        && (nivelStr.includes('fenster') || nivelStr.includes('ferestre'))
    
    // Filter steps based on nivelOferta
    let filtered = dynamicSteps
    
    // If nivelOferta is set and it's NOT "Casă completă", hide performantaEnergetica step
    if (!isCasaCompleta) {
      filtered = filtered.filter(s => (s as any).key !== 'performantaEnergetica')
    }
    
    // If "Structură" only (without windows), hide ferestreUsi and materialeFinisaj steps
    if (isStructuraOnly) {
      filtered = filtered.filter(s => (s as any).key !== 'ferestreUsi' && (s as any).key !== 'materialeFinisaj')
    }
    
    // If "Structură + ferestre", hide materialeFinisaj step
    if (isStructuraPlusFenestre) {
      filtered = filtered.filter(s => (s as any).key !== 'materialeFinisaj')
    }
    
    return filtered
  }, [dynamicSteps, drafts, idx])

  // -- UseMemo hooks (safe to run even if visibleSteps is empty)
  const step = visibleSteps[idx]
  const isFirst = idx === 0
  const isLast = idx === (visibleSteps.length > 0 ? visibleSteps.length - 1 : 0)

  const progressPct = useMemo(
    () => (visibleSteps.length > 1 ? Math.round((idx / (visibleSteps.length - 1)) * 100) : 0),
    [idx, visibleSteps.length]
  )

  const stepsMeta = useMemo(
    () => visibleSteps.map(s => tStepLabel((s as any).key, s.label)),
    [visibleSteps]
  )

  // Always show errors if showErrors is true, even if errors object is empty initially
  const visibleErrors = showErrors ? errors : {}

  // -- UseEffect Hooks
  
  // 1. Fetch Formular (tenant + optional offer type via offerId)
  // NOTE: Using formConfig.ts as primary source for now, DB schema as fallback
  useEffect(() => {
    async function loadForm() {
      try {
        // Use formConfig.ts as primary source
        console.log('Using formConfig.ts as form definition source')
        setDynamicSteps(formSteps as any[])
        setLoadingForm(false)
        return
        
        // Old code - kept for reference but not used
        // const url = offerId ? `/forms/latest?offerId=${encodeURIComponent(offerId)}` : '/forms/latest'
        // const schema = await apiFetch(url)
        // if (schema && schema.steps) {
        //   setDynamicSteps(schema.steps)
        // } else {
        //   console.warn('No form schema found in DB, using fallback from formConfig.ts')
        //   setDynamicSteps(formSteps as any[])
        // }
      } catch (e) {
        console.error('Failed to load form definition, using fallback', e)
        // Fallback to formConfig.ts on error
        setDynamicSteps(formSteps as any[])
        setLoadingForm(false)
      }
    }
    loadForm()
  }, [offerId])

  // 2. New Project Listener
  useEffect(() => {
    const handleNewProject = (e: Event) => {
      const detail = (e as CustomEvent).detail
      const creationId = detail?.creationId
      const offerTypeId = detail?.offerTypeId as string | undefined

      if (creationId && lastProcessedCreationId.current === creationId) return
      if (creationId) lastProcessedCreationId.current = creationId
      pendingOfferTypeIdRef.current = offerTypeId || null

      // IMPORTANT: cancel any pending autosave timers from the previous offer
      // so they can't create/modify an offer after we reset state.
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current)
        saveDebounceRef.current = null
      }
      lastSavedRef.current = ''

      setOfferId(null)
      offerIdRef.current = null
      setIdx(0)
      setForm({})
      setDrafts({})
      setErrors({})
      setShowErrors(false)
      setValidationError(null)
      setPdfUrl(null)
      setComputing(false)
      setComputeStartTime(null)
      setSaveStatus('idle')
      creatingRef.current = false
      activeCreationPromise.current = null
    }

    window.addEventListener('offer:new', handleNewProject)
    return () => window.removeEventListener('offer:new', handleNewProject)
  }, [])

  // 3. Clear Validation Error
  useEffect(() => {
    setValidationError(null)
  }, [idx, form])

  // 4. PDF Ready Listener
  useEffect(() => {
    const onReady = (e: Event) => {
      const detail = (e as CustomEvent).detail as { offerId?: string; pdfUrl?: string }
      if (!detail?.pdfUrl) return
      if (offerId && detail.offerId && offerId !== detail.offerId) return
      
      const now = Date.now();
      const elapsed = computeStartTime ? (now - computeStartTime) : MIN_ANIMATION_TIME;
      const remainingTime = Math.max(0, MIN_ANIMATION_TIME - elapsed);

      setTimeout(() => {
          setPdfUrl(detail.pdfUrl || null)
          setComputing(false)
          setComputeStartTime(null)
          window.dispatchEvent(new Event('offers:refresh'))
      }, remainingTime);
    }
    window.addEventListener('offer:pdf-ready', onReady as EventListener)
    return () => window.removeEventListener('offer:pdf-ready', onReady as EventListener)
  }, [offerId, computeStartTime])

  // 5. Offer Selected Listener
  useEffect(() => {
    const onSel = async (e: any) => {
      const id = e.detail.offerId as string
      setOfferId(id)
      offerIdRef.current = id
      if (!id) {
        setDrafts({})
        setForm({})
        return
      }
      try {
        const fresh = await fetchFreshPdfUrl(id)
        if (fresh) {
            setPdfUrl(fresh)
            setComputing(false)
        } else {
            setPdfUrl(null)
        }
        // Load saved step data from backend
        try {
          // Try to load all steps data - if endpoint doesn't exist, we'll load individual steps on demand
          const stepsData = await apiFetch(`/offers/${id}/steps`).catch(() => null)
          if (stepsData && typeof stepsData === 'object') {
            setDrafts(stepsData)
          }
        } catch (err) {
          // Endpoint might not exist, that's ok - we'll load on demand
          console.log('Steps endpoint not available, will load on demand')
        }
      } catch {
        setPdfUrl(null)
      }
    }
    window.addEventListener('offer:selected', onSel)
    return () => window.removeEventListener('offer:selected', onSel)
  }, [])

  // 6. Adjust idx when visibleSteps changes (e.g., when performantaEnergetica is hidden/shown)
  useEffect(() => {
    if (visibleSteps.length === 0) return
    if (idx >= visibleSteps.length) {
      setIdx(visibleSteps.length - 1)
    }
  }, [visibleSteps, idx])

  // Keep track of the last step key to avoid resetting form when user is typing
  const lastStepKeyRef = useRef<string | null>(null)
  
  // 7. Update Form State on Step Change
  useEffect(() => {
    if (visibleSteps.length === 0) return
    const key = visibleSteps[idx]?.key
    if(!key) return
    
    // Only load form data if we're switching to a different step
    // Don't reset if user is still on the same step (they might be typing)
    if (lastStepKeyRef.current === key) {
      return // User is still on the same step, don't reset form
    }
    
    lastStepKeyRef.current = key
    
    // Load from drafts first
    const draftData = drafts[key]
    if (draftData && Object.keys(draftData).length > 0) {
      console.log(`Loading step ${key} from drafts:`, draftData)
      setForm(draftData)
    } else if (offerId) {
      // Try to load from backend if not in drafts and we have an offerId
      console.log(`Loading step ${key} from backend for offer ${offerId}`)
      apiFetch(`/offers/${offerId}/step?step_key=${encodeURIComponent(key)}`)
        .then((data) => {
          if (data && data.data && Object.keys(data.data).length > 0) {
            console.log(`Loaded step ${key} from backend:`, data.data)
            setDrafts(prev => ({ ...prev, [key]: data.data }))
            setForm(data.data)
          } else {
            console.log(`No data found for step ${key} in backend`)
            // Set defaults only for structuraCladirii if no data found
            if (key === 'structuraCladirii') {
              setForm({
                tipFundatieBeci: 'Kein Keller (nur Bodenplatte)',
                inaltimeEtaje: 'Standard (2,50 m)'
              })
            } else {
              setForm({})
            }
          }
        })
        .catch((err) => {
          console.error(`Failed to load step ${key} from backend:`, err)
          // Set defaults only for structuraCladirii if load fails
          if (key === 'structuraCladirii') {
            setForm({
              tipFundatieBeci: 'Kein Keller (nur Bodenplatte)',
              inaltimeEtaje: 'Standard (2,50 m)'
            })
          } else {
            setForm({})
          }
        })
    } else {
      console.log(`No offerId, setting form for step ${key}`)
      // Set defaults only for structuraCladirii if no offerId
      if (key === 'structuraCladirii') {
        setForm({
          tipFundatieBeci: 'Kein Keller (nur Bodenplatte)',
          inaltimeEtaje: 'Standard (2,50 m)'
        })
      } else {
        setForm({})
      }
    }
    setErrors({})
    setShowErrors(false)
  }, [idx, visibleSteps, offerId]) // Removed 'drafts' from dependencies to avoid resetting when drafts change

  // Errors stay visible until next button press - no auto-revalidation


  // -- Helper Functions
  async function ensureOffer(): Promise<string> {
    // Prefer ref to avoid async/state race conditions (e.g. autosave firing right after create).
    if (offerIdRef.current) return offerIdRef.current
    if (activeCreationPromise.current) return activeCreationPromise.current

    if (creatingRef.current) {
      return new Promise((resolve) => {
        const iv = setInterval(() => {
          if (offerIdRef.current) {
            clearInterval(iv)
            resolve(offerIdRef.current)
          }
        }, 50)
      }) as Promise<string>
    }
    
    creatingRef.current = true
    
    const promise = (async () => {
        try {
            const offer_type_id = pendingOfferTypeIdRef.current
            const created = await apiFetch('/offers', { 
                method: 'POST', 
                body: JSON.stringify(
                  offer_type_id
                    ? { title: 'Ofertă nouă', offer_type_id }
                    : { title: 'Ofertă nouă' }
                )
            })
            // Set ref first to avoid any window where state is still null but create already finished.
            offerIdRef.current = created.id
            setOfferId(created.id)
            window.dispatchEvent(new CustomEvent('offer:selected', { detail: { offerId: created.id } }))
            window.dispatchEvent(new Event('offers:refresh'))
            return created.id as string
        } finally {
            creatingRef.current = false
            activeCreationPromise.current = null
        }
    })()

    activeCreationPromise.current = promise
    return promise
  }

  function stashDraft(next?: Partial<Record<string, any>>) {
    if(!step) return
    const key = step.key
    const updated = { ...(drafts[key] ?? {}), ...(next ?? form) }
    setDrafts(prev => ({ ...prev, [key]: updated }))
  }

  async function saveStepLive(stepKey: string, dataObj: Record<string, any>) {
    // Prevent duplicate saves for the same step
    if (savingStepsRef.current.has(stepKey)) {
      console.log(`⏭️ [SAVE] Skipping duplicate save for step ${stepKey}`)
      return
    }
    
    savingStepsRef.current.add(stepKey)
    
    try {
      console.log(`💾 [SAVE] Saving step ${stepKey}:`, dataObj)
      setSaveStatus('saving')
      const id = await ensureOffer()
      const startTime = Date.now()
      const response = await apiFetch(`/offers/${id}/step`, { method: 'POST', body: JSON.stringify({ step_key: stepKey, data: dataObj }) })
      const duration = Date.now() - startTime
      console.log(`✅ [SAVE] Step ${stepKey} saved successfully for offer ${id} (took ${duration}ms)`)
      
      // Update drafts locally so data is available when user navigates back
      setDrafts(prev => ({ ...prev, [stepKey]: dataObj }))
      await maybeUpdateOfferTitle(id)
      
      // Only refresh HistoryList after dateGenerale step (first step)
      // Other steps don't need to refresh the list
      if (stepKey === 'dateGenerale') {
        // Debounced refresh to avoid multiple reloads
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = setTimeout(() => {
          window.dispatchEvent(new Event('offers:refresh'))
        }, 500) // Debounce refresh by 500ms to batch multiple saves
      }
      
      setSaveStatus('saved')
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 1600)
    } catch (e) {
      console.error(`❌ [SAVE] saveStepLive failed for step ${stepKey}:`, e)
      setSaveStatus('error')
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
    } finally {
      // Remove from in-flight set after a short delay to allow for rapid successive saves
      setTimeout(() => {
        savingStepsRef.current.delete(stepKey)
      }, 1000)
    }
  }
  
  function scheduleAutosave(stepKey: string, dataObj: Record<string, any>, delay = 500) {
    // Don't autosave if there are validation errors
    if (showErrors && Object.values(errors).some(Boolean)) {
      return
    }
    const s = JSON.stringify(dataObj || {})
    if (s === lastSavedRef.current) return
    lastSavedRef.current = s
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    saveDebounceRef.current = setTimeout(() => { 
      console.log(`🔍 [AUTOSAVE] Saving step ${stepKey} with data:`, dataObj)
      saveStepLive(stepKey, dataObj) 
    }, delay)
  }

  function validateCurrentStep(): Errors {
    if (step.key === 'client') return validateClient(form)
    if (step.key === 'dateGenerale') {
      // Validate referinta field
      const e: Errors = {}
      const referinta = (form.referinta ?? '').trim()
      if (!referinta) {
        e.referinta = 'Bitte geben Sie eine Referenz ein.'
      } else if (referinta.length < 3) {
        e.referinta = 'Die Referenz muss mindestens 3 Zeichen lang sein.'
      }
      return e
    }
    return validateGeneric(step.key, step.fields, form, drafts)
  }

  async function uploadSingleFile(id: string, fieldName: string, file: File): Promise<{ storagePath: string, mime: string }> {
     const contentType = file.type || 'application/octet-stream'
     const presign = await apiFetch(`/offers/${id}/file/presign`, {
        method: 'POST',
        body: JSON.stringify({ filename: file.name, contentType, size: file.size })
      })

     const putRes = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          'Authorization': `Bearer ${presign.uploadToken}`,
          'x-upsert': 'true',
        },
        body: file
      })
      if (!putRes.ok) throw new Error(`Upload failed for ${file.name}`)

      await apiFetch(`/offers/${id}/file`, {
        method: 'POST',
        body: JSON.stringify({
          storagePath: presign.storagePath,
          meta: { filename: file.name, kind: fieldName, mime: contentType, size: file.size }
        })
      })
      return { storagePath: presign.storagePath, mime: contentType };
  }

  async function onContinue() {
    if(!step) {
      console.error('No step available')
      return
    }
    
    // Cancel any pending autosave to avoid duplicate saves
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current)
      saveDebounceRef.current = null
    }
    
    // Cancel any pending autosave to avoid duplicate saves
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current)
      saveDebounceRef.current = null
    }
    
    // Save current step before continuing
    if (offerId) {
      try {
        console.log(`🔍 [ONCONTINUE] Saving step ${step.key} before continue with form data:`, form)
        await saveStepLive(step.key, form)
      } catch (e) {
        console.error('Failed to save step before continue:', e)
      }
    }
    try {
      console.log('onContinue called for step:', step.key)
      setSaving(true)
      setValidationError(null)

      // Validate FIRST, before stashing or saving anything
      const stepErrors = validateCurrentStep()
      const hasErrors = Object.values(stepErrors).some(Boolean)
      
      console.log('Step:', step.key, 'Form:', form, 'Errors:', stepErrors, 'HasErrors:', hasErrors)
      
      if (hasErrors) {
        // Set errors and show them - they will stay visible until next button press
        setErrors(stepErrors)
        setShowErrors(true)
        setSaving(false)
        // Clear any pending autosave to prevent saving invalid data
        if (saveDebounceRef.current) {
          clearTimeout(saveDebounceRef.current)
          saveDebounceRef.current = null
        }
        console.log('Validation failed, stopping')
        console.log('Detailed errors:', JSON.stringify(stepErrors, null, 2))
        console.log('Form values:', {
          inaltimeEtaje: form.inaltimeEtaje,
          tipFundatieBeci: form.tipFundatieBeci,
          listaEtaje: form.listaEtaje,
          tipAcoperis: form.tipAcoperis
        })
        return // Don't save anything if there are errors
      }
      
      console.log('Validation passed, continuing...')
      
      // Clear errors when validation passes
      setShowErrors(false)
      
      // Only stash and save if validation passes
      stashDraft()

      if (step.key !== 'upload') {
        const id = await ensureOffer()
        // Use form (current state) instead of drafts, as form contains the latest user input
        const dataToSave = form
        console.log(`🔍 [ONCONTINUE] Saving step ${step.key} before continue with form data:`, dataToSave)
        await apiFetch(`/offers/${id}/step`, { 
          method: 'POST', 
          body: JSON.stringify({ step_key: step.key, data: dataToSave }) 
        })
        // Update drafts after saving
        setDrafts(prev => ({ ...prev, [step.key]: dataToSave }))
        await maybeUpdateOfferTitle(id)
      }

      if (!isLast) {
        setDir('next'); setIdx(i => i + 1); setAnimKey(k => k + 1)
        setSaving(false)
        return
      }

      /* FINALIZARE */
      const id = await ensureOffer()
      
      const filesToUpload: { key: string, file: File }[] = []
      for (const key in form) {
          const val = form[key]
          if (Array.isArray(val) && val.length > 0 && val[0] instanceof File) {
              val.forEach((f: File) => filesToUpload.push({ key, file: f }))
          }
      }

      if (filesToUpload.length === 0) {
          alert("Bitte Plan hochladen.");
          setSaving(false);
          return;
      }

      setProcessStatus(DE.common.uploadingFiles || 'Dateien werden hochgeladen...')
      
      let architecturalPlanData: { storagePath: string, mime: string } | null = null;

      for (const item of filesToUpload) {
          const res = await uploadSingleFile(id, item.key, item.file)
          if (item.key.includes('planArhitectural') || item.key.includes('planArhitectura')) {
              if (!architecturalPlanData) architecturalPlanData = res;
          }
      }

      if (architecturalPlanData && architecturalPlanData.storagePath) {
          setProcessStatus((DE.common as any).validatingPlan || 'Plan wird überprüft...')
          
          const validatePayload = { 
              storagePath: architecturalPlanData.storagePath, 
              mimeType: architecturalPlanData.mime 
          }
          console.log(`🔍 [VALIDATE] Sending validation request:`, validatePayload)
          
          const aiRes = await apiFetch('/validate-plan', {
              method: 'POST',
              body: JSON.stringify(validatePayload)
          })
          
          const aiJson = aiRes.valid !== undefined ? aiRes : await aiRes.json?.().catch(()=>({valid:true}));
          
          if (aiJson && aiJson.valid === false) {
              setValidationError(aiJson.reason || DE.common.planInvalidMsg)
              setSaving(false);
              return; 
          }
      }

      const { run_id } = await apiFetch(`/offers/${id}/compute`, { 
        method: 'POST', 
        body: JSON.stringify({ payload: {} }) 
      })
      
      setPdfUrl(null)
      setComputing(true)
      setComputeStartTime(Date.now())
      
      window.dispatchEvent(new CustomEvent('offer:compute-started', { detail: { offerId: id, runId: run_id } }))
      window.dispatchEvent(new Event('offers:refresh'))

    } catch (err: any) {
      console.error('Finalize failed:', err)
      alert(`${DE.common.finalizeErrorPrefix}: ${err?.message ?? err}`)
    } finally { 
      setSaving(false) 
    }
  }

  function onBack() {
    if (isFirst || saving) return
    // Save current form data before going back
    stashDraft()
    setDir('back'); setIdx(i => i - 1); setAnimKey(k => k + 1)
  }

  async function onUpload(name: string, file: File | null) {
    if (!file) return
    try {
      setSaving(true)
      setSaveStatus('saving')

      const id = await ensureOffer()
      await uploadSingleFile(id, name, file)

      // Don't refresh HistoryList after upload - only after dateGenerale step
      setSaveStatus('saved')
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 1600)
    } catch (err: any) {
      console.error('Upload failed:', err)
      setSaveStatus('error')
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
      alert(`${DE.common.uploadingError}: ${err?.message ?? err}`)
    } finally {
      setSaving(false)
    }
  }

  async function maybeUpdateOfferTitle(id: string) {
    const dg = drafts['dateGenerale'] ?? (step?.key === 'dateGenerale' ? form : {})
    const cl = drafts['client'] ?? (step?.key === 'client' ? form : {})
    const title = [cl?.nume?.trim(), dg?.referinta?.trim()].filter(Boolean).join(' — ')
    if (!title) return
    try {
      // Update title
      await apiFetch(`/offers/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) })
      // Also update meta.referinta and meta.beci if we have dateGenerale data
      if (dg && (dg.referinta?.trim() || dg.beci !== undefined)) {
        // Fetch current meta to preserve other fields
        const currentOffer = await apiFetch(`/offers/${id}`)
        const currentMeta = currentOffer?.meta || {}
        const updatedMeta: any = { ...currentMeta }
        if (dg.referinta?.trim()) {
          updatedMeta.referinta = dg.referinta.trim()
        }
        if (dg.beci !== undefined) {
          updatedMeta.beci = dg.beci === true || dg.beci === 'true' || dg.beci === 1
        }
        await apiFetch(`/offers/${id}`, { method: 'PATCH', body: JSON.stringify({ meta: updatedMeta }) })
      }
      // Don't refresh here - let saveStepLive handle it with debouncing to avoid duplicate refreshes
    } catch {}
  }

  // --- RENDERING ---
  
  // 1. Loading State
  if (loadingForm) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-sun mx-auto mb-2" />
          <div className="text-sand/80">Formular wird geladen...</div>
        </div>
      </div>
    )
  }

  // 2. Error State (No Data)
  if (visibleSteps.length === 0) {
    return (
      <div className="p-8 text-center text-red-300">
        Die Formulardefinition konnte nicht geladen werden. <br/>
        Bitte überprüfen Sie, ob die API läuft (Port 4000) und ob Daten in der Tabelle <code>form_definitions</code> vorhanden sind.
      </div>
    )
  }

  // 3. Main Wizard UI
  return (
    <div className="wizard-wrap">
      {!computing && !pdfUrl && (
      <div className="px-2 mt-1">
        <div className="wizard-steps wizard-steps--inline relative pr-[1px] flex items-start justify-center gap-5 text-center hide-scroll">
          {stepsMeta.map((label, i) => {
            const done = i < idx; const active = i === idx
            return (
              <div key={i} className="wizard-step v-start">
                <div className={`wizard-dot ${done ? 'done' : active ? 'active' : ''}`} />
                <div className="wizard-label">{label}</div>
              </div>
            )
          })}
        </div>

        <div className="wizard-progress mt-3 hide-scroll" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct}>
          <div className="wizard-progress__bar" style={{ width: `${progressPct}%` }} />
        </div>
      </div>
    )}

      <div className="wizard-stage flex flex-col flex-1 min-h-0 items-stretch justify-start relative">
        {computing && !pdfUrl ? (
          <div className="relative w-full flex flex-col items-center justify-center mt-32 gap-6" style={{ minHeight: '68vh' }}>
            <img 
              src="/houseblueprint.gif" 
              alt={DE.common.processingAlt} 
              className="w-auto h-auto max-w-[92vw] max-h-[60vh] object-contain" 
            />
            <button
              onClick={() => {
                setShowCancelConfirm(true);
              }}
              className={`
                flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[#ffffff] shadow-lg transition-all duration-200 ease-out
                bg-gradient-to-b from-[#e08414] to-[#f79116]
                hover:brightness-110 hover:-translate-y-[1px] hover:shadow-[0_4px_14px_rgba(216,162,94,0.3)] active:translate-y-[1px] active:scale-95
              `}
            >
              Abbrechen
            </button>
          </div>
        ) : pdfUrl ? (
          <div className="flex-1 w-full h-full p-4 box-border overflow-auto pdf-scroll">
            <SimplePdfViewer src={pdfUrl} maxHeight="none" className="w-full" />
          </div>
        ) : (
          <div key={`${step.key}-${animKey}`} className={`wizard-card wizard-sunny ${dir === 'back' ? 'card-in-back' : 'card-in-next'} ${step.key === 'structuraCladirii' ? '!overflow-visible !pb-0 !max-h-none !h-fit' : ''}`} style={step.key === 'structuraCladirii' ? { width: '900px' } : undefined}>
            <div className="wizard-header">
              <div className="wizard-title text-sun">
                {tStepLabel(step.key, step.label)}
              </div>
              {/* Nu afișăm subtitlul în header pentru tipAcoperis, deoarece este afișat în locul label-ului field-ului */}
              {(step as any).subtitle && step.key !== 'tipAcoperis' && (
                <div className="text-sm text-sand/70 mt-2 font-normal">
                  {(step as any).subtitle}
                </div>
              )}
            </div>
            <div className={`wizard-body relative ${step.key === 'structuraCladirii' ? '!pb-0 !mb-[-14px] !overflow-visible' : ''}`} style={step.key === 'structuraCladirii' ? { marginBottom: '-14px' } : undefined}>
               {saving && (
                  <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-xl">
                      <Loader2 className="animate-spin text-sun h-10 w-10 mb-2"/>
                      <span className="text-sand font-medium shadow-sm">{processStatus}</span>
                  </div>
              )}

              {validationError && (
                <div className="mb-4 p-4 bg-orange-900/30 border border-orange-500/50 rounded-lg flex items-start gap-3 animate-fade-in">
                  <AlertTriangle className="shrink-0 text-orange-400 h-5 w-5 mt-0.5" />
                  <div>
                    <div className="font-semibold text-orange-200">{DE.common.planInvalidTitle}</div>
                    <div className="text-sm text-orange-100/80 mt-1">{validationError}</div>
                  </div>
                </div>
              )}
              
              {step.key === 'client' ? (
                <ClientStep
                  form={form}
                  setForm={(v, shouldAutosave = false) => { 
                    ensureOffer().catch(() => {}); 
                    setForm(v); 
                    if (shouldAutosave) {
                      scheduleAutosave('client', v) 
                    }
                  }}
                  onBlur={() => {
                    scheduleAutosave('client', form)
                  }}
                  errors={visibleErrors}
                  onEnter={onContinue}
                  setDrafts={setDrafts}
                />
              ) : step.key === 'structuraCladirii' ? (
                <BuildingStructureStep
                  form={form}
                  setForm={(v, shouldAutosave = false) => { 
                    ensureOffer().catch(() => {}); 
                    setForm(v); 
                    if (shouldAutosave) {
                      scheduleAutosave('structuraCladirii', v) 
                    }
                  }}
                  onBlur={() => {
                    scheduleAutosave('structuraCladirii', form)
                  }}
                  errors={visibleErrors}
                />
              ) : step.key === 'materialeFinisaj' ? (
                <MaterialeFinisajStep
                  form={form}
                  setForm={(v, shouldAutosave = false) => { 
                    ensureOffer().catch(() => {}); 
                    setForm(v); 
                    if (shouldAutosave) {
                      scheduleAutosave('materialeFinisaj', v) 
                    }
                  }}
                  onBlur={() => {
                    scheduleAutosave('materialeFinisaj', form)
                  }}
                  errors={visibleErrors}
                  drafts={drafts}
                />
              ) : step.key !== 'upload' ? (
                <div className="space-y-4">
                  <DynamicFields
                    stepKey={step.key}
                    fields={step.fields}
                    form={form}
                    setForm={(v, shouldAutosave = false) => { 
                      ensureOffer().catch(() => {}); 
                      setForm(v); 
                      if (shouldAutosave) {
                        scheduleAutosave(step.key, v) 
                      }
                    }}
                    onBlur={(stepKey, updatedForm) => {
                      // Use updated form if provided, otherwise use current form state
                      const formToSave = updatedForm || (step?.key === stepKey ? form : (drafts[stepKey] || {}))
                      console.log(`🔍 [ONBLUR CALLBACK] Step ${stepKey}, updatedForm:`, updatedForm, 'formToSave:', formToSave)
                      scheduleAutosave(stepKey, formToSave)
                    }}
                    onUpload={onUpload}
                    ensureOffer={ensureOffer}
                    errors={visibleErrors}
                    onEnter={onContinue}
                    drafts={drafts}
                    step={step}
                    setDrafts={setDrafts}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <DynamicFields 
                    stepKey={step.key} 
                    fields={step.fields} 
                    form={form} 
                    setForm={(v) => { setForm(v) }} 
                    onUpload={onUpload} 
                    ensureOffer={ensureOffer} 
                    errors={visibleErrors}
                    onEnter={onContinue}
                    drafts={drafts}
                    step={step}
                  />
                </div>
              )}
            </div>
            
            <div className={`wizard-footer flex items-center justify-between ${step.key === 'structuraCladirii' ? '!mt-4 !mb-4' : 'mt-4'}`}>
              <button 
                onClick={onBack} 
                disabled={isFirst || saving}
                className={`
                  flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-200 ease-in-out
                  border border-[#D8A25E]/30 text-[#D8A25E] bg-transparent
                  hover:bg-[#D8A25E]/10 hover:border-[#D8A25E]/60
                  disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent
                `}
              >
                <ChevronLeft size={19} /> 
                {DE.common.btnBack}
              </button>

              <div className="flex-1" />

              <button 
                onClick={onContinue} 
                disabled={saving}
                className={`
                  flex items-center gap-2 px-8 py-2.5 rounded-xl font-bold text-[#ffffff] shadow-lg transition-all duration-200 ease-out
                  bg-gradient-to-b from-[#e08414] to-[#f79116]
                  hover:brightness-110 hover:-translate-y-[1px] hover:shadow-[0_4px_14px_rgba(216,162,94,0.3)]
                  active:translate-y-[1px] active:scale-95
                  disabled:opacity-70 disabled:cursor-wait disabled:transform-none disabled:shadow-none
                `}
              >
                {isLast ? (
                  <span>{DE.common.btnFinish}</span>
                ) : (
                  <>
                    {DE.common.btnNext} 
                    <ChevronRight size={19} className="opacity-80" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {!computing && saveStatus !== 'idle' && (
        <div className="saving-toast-fixed">
          <div className={`saving-dot ${saveStatus === 'error' ? 'bg-red-400' : ''}`} />
          <span>
            {saveStatus === 'saving' && DE.common.toastSaving}
            {saveStatus === 'saved' && DE.common.toastSaved}
            {saveStatus === 'error' && DE.common.toastError}
          </span>
        </div>
      )}

      <style jsx global>{`
        .pretty-scroll { scrollbar-width: thin; scrollbar-color: #9aa0a6 #1b1f24; }
        .pretty-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
        .pretty-scroll::-webkit-scrollbar-track { background: #1b1f24; border-radius: 8px; }
        
        .pdf-scroll { scrollbar-width: thin; scrollbar-color: #FF9F0F #2A1B15; }
        .pdf-scroll::-webkit-scrollbar { width: 12px; height: 12px; }
        .pdf-scroll::-webkit-scrollbar-track { background: #2A1B15; border-radius: 6px; }
        .pdf-scroll::-webkit-scrollbar-thumb { background: #FF9F0F; border-radius: 6px; border: 2px solid #2A1B15; }
        .pdf-scroll::-webkit-scrollbar-thumb:hover { background: #FFB84D; }
        .pretty-scroll::-webkit-scrollbar-thumb { background: #9aa0a6; border-radius: 8px; border: 2px solid #1b1f24; }
        .pretty-scroll::-webkit-scrollbar-thumb:hover { background: #bfc5cc; }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      
      {/* Modal de confirmare pentru anulare */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-panel rounded-xl2 p-6 max-w-md w-full mx-4 shadow-soft border border-white/10 animate-fade-in">
            <h3 className="text-lg font-bold text-sand mb-4">
              Angebot abbrechen?
            </h3>
            <p className="text-sand/80 mb-6">
              Möchten Sie dieses Angebot wirklich abbrechen? Alle Daten werden gelöscht und der Prozess wird gestoppt.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2.5 rounded-xl font-medium text-sand/80 hover:text-sand bg-black/10 hover:bg-black/20 border border-white/10 transition-colors"
              >
                Nein
              </button>
              <button
                onClick={async () => {
                  setShowCancelConfirm(false);
                  if (!offerId) return;
                  
                  try {
                    // Oprește procesul
                    await apiFetch(`/offers/${offerId}/compute/cancel`, { method: 'POST' });
                    
                    // Șterge oferta
                    await apiFetch(`/offers/${offerId}`, { method: 'DELETE' });
                    
                    // Resetează formularul și trimite la o ofertă nouă
                    setOfferId(null);
                    offerIdRef.current = null;
                    setComputing(false);
                    setPdfUrl(null);
                    setIdx(0);
                    setForm({});
                    setDrafts({});
                    setErrors({});
                    setValidationError(null);
                    setProcessStatus('');
                    setSaveStatus('idle');
                    creatingRef.current = false;
                    
                    // Trimite eveniment pentru a reseta LiveFeed
                    const uniqueId = Date.now();
                    window.dispatchEvent(new CustomEvent('offer:new', {
                      detail: { creationId: uniqueId }
                    }));
                    
                    // Refresh lista de oferte
                    window.dispatchEvent(new Event('offers:refresh'));
                  } catch (err: any) {
                    console.error('Failed to cancel offer:', err);
                    alert(`Fehler beim Abbrechen: ${err?.message || err}`);
                  }
                }}
                className={`
                  flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[#ffffff] shadow-lg transition-all duration-200 ease-out
                  bg-gradient-to-b from-[#e08414] to-[#f79116]
                  hover:brightness-110 hover:-translate-y-[1px] hover:shadow-[0_4px_14px_rgba(216,162,94,0.3)] active:translate-y-[1px] active:scale-95
                `}
              >
                Ja
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ClientStep({ form, setForm, errors, onEnter, onBlur, setDrafts }:{ form: Record<string, any>; setForm: (v: Record<string, any>, shouldAutosave?: boolean) => void; errors: Errors; onEnter: () => void; onBlur?: () => void; setDrafts?: (updater: (prev: Drafts) => Drafts) => void }) {
  const fields = [
    { key: 'nume', label: 'Vor- und Nachname' },
    { key: 'telefon', label: 'Telefonnummer' },
    { key: 'email', label: 'E-Mail' },
    { key: 'localitate', label: 'Adresse' },
  ] as const
  return (
    <div className="space-y-3">
      {fields.map(f => {
        const fieldErr = errors[f.key]
        return (
          <label key={f.key} className="flex flex-col gap-1" data-field={f.key}>
            <span className="wiz-label text-sun/90">{f.label}</span>
            <input
              className={`sun-input w-full ${fieldErr ? 'ring-2 ring-orange-400/60 focus:ring-orange-400/60' : ''}`}
              value={form[f.key] ?? ''}
              onChange={(e) => {
                const v = e.target.value
                const next = { ...form, [f.key]: v }
                setForm(next, false) // Don't auto-save on change
                // Also update drafts immediately to prevent useEffect from resetting
                if (setDrafts) {
                  setDrafts(prev => ({ ...prev, 'client': next }))
                }
              }}
              onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                // Get current value from input and update form before saving
                const currentValue = e.target.value
                const updatedForm = { ...form, [f.key]: currentValue }
                setForm(updatedForm, false) // Update form state without triggering autosave
                // Save with updated form data using onBlur callback
                if (onBlur) {
                  setTimeout(() => {
                    onBlur() // This will trigger scheduleAutosave in parent component
                  }, 0)
                }
              }}
              onKeyDown={(e) => handleInputEnter(e, onEnter)}
            />
            {fieldErr && <span className="text-xs text-orange-400">{fieldErr}</span>}
          </label>
        )
      })}
    </div>
  )
}

function MaterialeFinisajStep({ form, setForm, errors, drafts, onBlur }: { form: Record<string, any>; setForm: (v: Record<string, any>, shouldAutosave?: boolean) => void; errors: Errors; drafts: Drafts; onBlur?: () => void }) {
  // Obținem datele din structuraCladirii pentru a ști câte etaje avem
  const structuraData = drafts?.structuraCladirii || form.structuraCladirii || {}
  const tipFundatieBeci = structuraData.tipFundatieBeci || form.tipFundatieBeci || 'Kein Keller (nur Bodenplatte)'
  const listaEtaje = Array.isArray(structuraData.listaEtaje) ? structuraData.listaEtaje : (Array.isArray(form.listaEtaje) ? form.listaEtaje : [])
  
  // Verificăm dacă avem beci
  const hasBasement = tipFundatieBeci.includes('Keller') && !tipFundatieBeci.includes('Kein Keller')
  // Verificăm dacă beciul este locuibil (cu "mit einfachem Ausbau")
  const basementLivable = tipFundatieBeci.includes('mit einfachem Ausbau')
  
  // Verificăm dacă avem mansardă
  const hasMansarda = listaEtaje.some((e: string) => e.startsWith('mansarda'))
  const mansardaType = listaEtaje.find((e: string) => e.startsWith('mansarda'))?.split('_')[1] || null
  
  // Numărăm etajele intermediare (nu includem pod/mansardă)
  const etajeIntermediare = listaEtaje.filter((e: string) => e === 'intermediar').length
  const totalFloors = 1 + etajeIntermediare // Ground (1) + etaje intermediare
  
  const finishOptions = ['Tencuială', 'Lemn', 'Fibrociment', 'Mix']
  
  return (
    <div className="space-y-4">
      {/* Finisaj interior pentru beci (dacă există și este locuibil) */}
      {hasBasement && basementLivable && (
        <label className="flex flex-col gap-1" data-field="finisajInteriorBeci">
          <span className="wiz-label text-sun/90">Innenausbau (Keller)</span>
          <div className={errors.finisajInteriorBeci ? 'ring-2 ring-orange-400/60 rounded-lg' : ''}>
            <SelectSun
              value={form.finisajInteriorBeci || 'Tencuială'}
              onChange={(v) => setForm({ ...form, finisajInteriorBeci: v })}
              options={finishOptions}
              displayFor={(opt) => tOption('materialeFinisaj', 'finisajInteriorBeci', opt)}
            />
          </div>
          {errors.finisajInteriorBeci && (
            <span className="text-xs text-orange-400">{errors.finisajInteriorBeci}</span>
          )}
        </label>
      )}
      
      {/* Finisaje pentru fiecare etaj (ground + etaje intermediare) */}
      {Array.from({ length: totalFloors }, (_, idx) => {
        const floorLabel = idx === 0 ? 'Erdgeschoss' : `Obergeschoss ${idx}`
        const floorKey = idx === 0 ? 'ground' : `floor_${idx}`
        
        return (
          <div key={floorKey} className="flex gap-4 items-start">
            <label className="flex flex-col gap-1 flex-1" data-field={`finisajInterior_${floorKey}`}>
              <span className="wiz-label text-sun/90">Innenausbau - {floorLabel}</span>
              <div className={errors[`finisajInterior_${floorKey}`] ? 'ring-2 ring-orange-400/60 rounded-lg' : ''}>
                <SelectSun
                  value={form[`finisajInterior_${floorKey}`] || 'Tencuială'}
                  onChange={(v) => setForm({ ...form, [`finisajInterior_${floorKey}`]: v })}
                  options={finishOptions}
                  displayFor={(opt) => tOption('materialeFinisaj', `finisajInterior_${floorKey}`, opt)}
                />
              </div>
              {errors[`finisajInterior_${floorKey}`] && (
                <span className="text-xs text-orange-400">{errors[`finisajInterior_${floorKey}`]}</span>
              )}
            </label>
            
            <label className="flex flex-col gap-1 flex-1" data-field={`fatada_${floorKey}`}>
              <span className="wiz-label text-sun/90">Fassade - {floorLabel}</span>
              <div className={errors[`fatada_${floorKey}`] ? 'ring-2 ring-orange-400/60 rounded-lg' : ''}>
                <SelectSun
                  value={form[`fatada_${floorKey}`] || 'Tencuială'}
                  onChange={(v) => setForm({ ...form, [`fatada_${floorKey}`]: v })}
                  options={finishOptions}
                  displayFor={(opt) => tOption('materialeFinisaj', `fatada_${floorKey}`, opt)}
                />
              </div>
              {errors[`fatada_${floorKey}`] && (
                <span className="text-xs text-orange-400">{errors[`fatada_${floorKey}`]}</span>
              )}
            </label>
          </div>
        )
      })}
      
      {/* Finisaje pentru mansardă (dacă există) */}
      {hasMansarda && (
        <div className="flex gap-4 items-start">
          <label className="flex flex-col gap-1 flex-1" data-field="finisajInteriorMansarda">
            <span className="wiz-label text-sun/90">Innenausbau - Dachgeschoss</span>
            <div className={errors.finisajInteriorMansarda ? 'ring-2 ring-orange-400/60 rounded-lg' : ''}>
              <SelectSun
                value={form.finisajInteriorMansarda || 'Tencuială'}
                onChange={(v) => setForm({ ...form, finisajInteriorMansarda: v })}
                options={finishOptions}
                displayFor={(opt) => tOption('materialeFinisaj', 'finisajInteriorMansarda', opt)}
              />
            </div>
            {errors.finisajInteriorMansarda && (
              <span className="text-xs text-orange-400">{errors.finisajInteriorMansarda}</span>
            )}
          </label>
          
          <label className="flex flex-col gap-1 flex-1" data-field="fatadaMansarda">
            <span className="wiz-label text-sun/90">Fassade - Dachgeschoss</span>
            <div className={errors.fatadaMansarda ? 'ring-2 ring-orange-400/60 rounded-lg' : ''}>
              <SelectSun
                value={form.fatadaMansarda || 'Tencuială'}
                onChange={(v) => setForm({ ...form, fatadaMansarda: v })}
                options={finishOptions}
                displayFor={(opt) => tOption('materialeFinisaj', 'fatadaMansarda', opt)}
              />
            </div>
            {errors.fatadaMansarda && (
              <span className="text-xs text-orange-400">{errors.fatadaMansarda}</span>
            )}
          </label>
        </div>
      )}
      
      {/* Material acoperiș */}
      <label className="flex flex-col gap-1" data-field="materialAcoperis">
        <span className="wiz-label text-sun/90">Dachmaterial</span>
        <div className={errors.materialAcoperis ? 'ring-2 ring-orange-400/60 rounded-lg' : ''}>
          <SelectSun
            value={form.materialAcoperis || 'Țiglă'}
            onChange={(v) => setForm({ ...form, materialAcoperis: v })}
            options={['Țiglă', 'Tablă', 'Membrană']}
            displayFor={(opt) => tOption('materialeFinisaj', 'materialAcoperis', opt)}
          />
        </div>
        {errors.materialAcoperis && (
          <span className="text-xs text-orange-400">{errors.materialAcoperis}</span>
        )}
      </label>
    </div>
  )
}

function BuildingStructureStep({ form, setForm, errors, onBlur }: { form: Record<string, any>; setForm: (v: Record<string, any>, shouldAutosave?: boolean) => void; errors: Errors; onBlur?: () => void }) {
  // State pentru dropdown-ul de adăugare etaj
  const [showAddFloorDropdown, setShowAddFloorDropdown] = useState(false)
  const addFloorBtnRef = useRef<HTMLButtonElement>(null)
  const [addFloorPos, setAddFloorPos] = useState<{ left: number; top: number; width: number }>({ left: 0, top: 0, width: 0 })

  // Nu mai setăm valorile default aici - sunt setate în componenta părinte când se încarcă step-ul

  // Extragem valorile din form
  const tipFundatieBeci = form.tipFundatieBeci || 'Kein Keller (nur Bodenplatte)'
  const pilons = form.pilons === true
  const inaltimeEtaje = form.inaltimeEtaje || 'Standard (2,50 m)'
  const listaEtaje = Array.isArray(form.listaEtaje) ? form.listaEtaje : []
  const tipMansarda = form.tipMansarda || '' // 'direkt' sau 'mit_wanden'
  const inaltimePeretiMansarda = parseFloat(form.inaltimePeretiMansarda || '0') || 0
  const tipAcoperis = form.tipAcoperis || ''

  // Funcție pentru a poziționa dropdown-ul
  const placeAddFloorDropdown = useCallback(() => {
    const b = addFloorBtnRef.current?.getBoundingClientRect()
    if (!b) return
    setAddFloorPos({ left: Math.round(b.left), top: Math.round(b.bottom + 6), width: Math.round(b.width) })
  }, [])

  useLayoutEffect(() => { if (showAddFloorDropdown) placeAddFloorDropdown() }, [showAddFloorDropdown, placeAddFloorDropdown])
  useEffect(() => {
    if (!showAddFloorDropdown) return
    const onScroll = () => placeAddFloorDropdown()
    const onResize = () => placeAddFloorDropdown()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [showAddFloorDropdown, placeAddFloorDropdown])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!showAddFloorDropdown) return
      const t = e.target as Node
      if (addFloorBtnRef.current?.contains(t)) return
      setShowAddFloorDropdown(false)
    }
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') setShowAddFloorDropdown(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [showAddFloorDropdown])

  // Opțiuni pentru dropdown-ul de adăugare etaj
  const floorTypeOptions = [
    { value: 'intermediar', label: 'Obergeschoss (Wohnfläche)' },
    { value: 'pod', label: 'Dachboden (Keine Wohnfläche)' },
    { value: 'mansarda_ohne', label: 'Dachgeschoss ohne Kniestock (Wohnfläche)' },
    { value: 'mansarda_mit', label: 'Dachgeschoss mit Kniestock (Wohnfläche)' },
  ]

  const handleAddFloor = (floorType: string) => {
    setForm({ ...form, listaEtaje: [...listaEtaje, floorType] })
    setShowAddFloorDropdown(false)
  }
  
  // Determinăm ce să afișăm bazat pe tipFundatieBeci
  // Dacă alege beci (Keller), se aplică automat și fundația (base)
  // Dacă alege "Kein Keller", nu are beci, dar are fundație (base)
  // Verificăm explicit că nu este "Kein Keller" pentru a afișa basement
  const hasBasement = tipFundatieBeci.includes('Keller') && !tipFundatieBeci.includes('Kein Keller')
  const hasBase = true // Toate opțiunile au fundație (base), inclusiv "Kein Keller"
  const basementUse = tipFundatieBeci.includes('mit einfachem Ausbau')
  const basement = hasBasement
  
  // Determinăm ce etaje avem
  const etajeIntermediare = listaEtaje.filter((e: string) => e === 'intermediar').length
  const hasPod = listaEtaje.some((e: string) => e === 'pod')
  const hasMansarda = listaEtaje.some((e: string) => e.startsWith('mansarda'))
  const mansardaType = listaEtaje.find((e: string) => e.startsWith('mansarda'))?.split('_')[1] || null
  const canAddFloors = !hasPod && !hasMansarda && listaEtaje.length < 4 // maxim 4 etaje intermediare
  
  // Pentru desen: folosim etajeIntermediare pentru up images (nu includem pod/mansardă)
  const floorsNumber = etajeIntermediare

  // Generăm imagini random pentru down și up (folosim un seed bazat pe valorile formularului pentru consistență)
  const getRandomImage = (options: string[], seed: string) => {
    // Hash simplu pentru seed
    let hash = 0
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i)
      hash = hash & hash
    }
    const index = Math.abs(hash) % options.length
    return options[index]
  }

  const downImage = getRandomImage(['/builder/down1.png', '/builder/down2.png'], `down-${floorsNumber}`)
  const upImages: string[] = []
  for (let i = 0; i < floorsNumber; i++) {
    upImages.push(getRandomImage(['/builder/up1.png', '/builder/up2.png', '/builder/up3.png'], `up-${i}-${floorsNumber}`))
  }
  const mansardeImage = getRandomImage(['/builder/mansarde1.png', '/builder/mansarde2.png'], 'mansarde')
  const mansardeSmallImage = getRandomImage(['/builder/mansarde-small1.png', '/builder/mansarde-small2.png'], 'mansarde-small')

  // Refs pentru a obține dimensiunile reale ale imaginilor
  const groundRef = useRef<HTMLImageElement>(null)
  const basementRef = useRef<HTMLImageElement>(null)
  const baseRef = useRef<HTMLImageElement>(null)
  const pilonsRef = useRef<HTMLImageElement>(null)
  const downRef = useRef<HTMLImageElement>(null)
  const upRefs = useRef<(HTMLImageElement | null)[]>([])
  const roofRef = useRef<HTMLImageElement>(null)
  const mansardeRef = useRef<HTMLImageElement>(null)
  const mansardeSmallRef = useRef<HTMLImageElement>(null)

  // Stocăm dimensiunile originale și scale-ul aplicat
  const [originalSizes, setOriginalSizes] = useState<Record<string, { width: number; height: number }>>({})
  const [scaleFactor, setScaleFactor] = useState<number>(1)
  const [heights, setHeights] = useState<Record<string, number>>({})
  
  // Resetează upRefs când se schimbă numărul de etaje
  useEffect(() => {
    upRefs.current = new Array(floorsNumber).fill(null)
    // Resetează și dimensiunile pentru etajele eliminate
    setOriginalSizes(prev => {
      const newSizes = { ...prev }
      for (let i = floorsNumber; i < 10; i++) {
        delete newSizes[`up-${i}`]
        delete newSizes[`up-${i}-original`]
      }
      return newSizes
    })
    setHeights(prev => {
      const newHeights = { ...prev }
      for (let i = floorsNumber; i < 10; i++) {
        delete newHeights[`up-${i}`]
      }
      return newHeights
    })
  }, [floorsNumber])
  
  // Funcție helper pentru a actualiza dimensiunile originale
  const updateOriginalSize = useCallback((key: string, width: number, height: number) => {
    setOriginalSizes(prev => {
      if (prev[key]?.width === width && prev[key]?.height === height) return prev
      return { ...prev, [key]: { width, height } }
    })
  }, [])
  
  // Calculează scale factor-ul comun bazat pe width-ul maxim sau un width țintă
  useEffect(() => {
    const targetWidth = 300 // Width țintă mai mic pentru frame mai mic
    const sizes = Object.values(originalSizes)
    if (sizes.length === 0) return
    
    // Găsește width-ul maxim original
    const maxOriginalWidth = Math.max(...sizes.map(s => s.width))
    if (maxOriginalWidth > 0) {
      const newScale = targetWidth / maxOriginalWidth
      setScaleFactor(newScale)
    }
  }, [originalSizes])
  
  // Actualizează înălțimile scalate
  useEffect(() => {
    const newHeights: Record<string, number> = {}
    Object.entries(originalSizes).forEach(([key, size]) => {
      newHeights[key] = size.height * scaleFactor
    })
    setHeights(newHeights)
  }, [originalSizes, scaleFactor])

  // Calculăm bottom values (bottom-up stacking)
  // Ordinea de jos în sus: pilons -> base -> basement -> ground -> down -> up floors -> roof/mansarde/mansarde-small
  let currentBottom = 0
  
  // Ground este la baza
  const groundHeight = heights.ground || 0
  const groundBottom = currentBottom
  
  // Basement este SUB ground (lipit de dedesubtul parterului)
  const basementHeight = heights.basement || 0
  const basementBottom = basement ? (groundBottom + groundHeight - basementHeight) : -1
  
  // Base - se afișează dacă nu avem beci sau dacă avem piloni
  const baseHeight = heights.base || 0
  let baseBottom = -10000
  if (hasBase && baseHeight > 0) {
    if (basement && basementBottom >= 0) {
      // Base sub basement
      baseBottom = basementBottom - baseHeight
    } else {
      // Base sub ground (aliniat cu ground în partea de sus)
      baseBottom = groundBottom + groundHeight - baseHeight
    }
  }
  
  // Pilons - sub base dacă există, altfel sub basement/ground
  const pilonsHeight = heights.pilons || 0
  let pilonsBottom = -10000 // Default negativ pentru a nu se vedea până se calculează corect
  if (pilons && pilonsHeight > 0) {
    if (hasBase && baseHeight > 0 && baseBottom > -10000) {
      // Pilons sub base
      pilonsBottom = baseBottom - pilonsHeight
    } else if (basement && basementBottom >= 0) {
      // Pilons sub basement
      pilonsBottom = basementBottom - pilonsHeight
    } else {
      // Pilons sub ground
      pilonsBottom = groundBottom + groundHeight - pilonsHeight
    }
  }
  
  currentBottom += groundHeight
  
  // Down este deasupra ground
  const downBottom = groundBottom + groundHeight
  currentBottom = downBottom + (heights.down || 0)
  
  // Up images - etaje (de jos în sus)
  const upBottoms: number[] = []
  for (let i = 0; i < floorsNumber; i++) {
    upBottoms.push(currentBottom)
    currentBottom += heights[`up-${i}`] || 0
  }
  
  // Pod sau Mansardă - deasupra ultimului etaj (sau deasupra down dacă nu sunt etaje)
  const roofBottom = (hasPod || hasMansarda) ? currentBottom : -1
  
  // Calculează înălțimea totală necesară pentru frame bazată pe elementele ACTIVE
  // Calculăm de la cel mai de jos element (pilons/base/basement/ground) până la vârful celui mai de sus element (roof)
  
  // Găsim cel mai de jos bottom (cel mai negativ sau cel mai mic)
  let lowestBottom = 0 // Ground este la 0
  
  if (basement && basementBottom >= 0) {
    lowestBottom = Math.min(lowestBottom, basementBottom)
  }
  
  if (hasBase && baseBottom > -10000) {
    lowestBottom = Math.min(lowestBottom, baseBottom)
  }
  
  if (pilons && pilonsBottom > -10000) {
    lowestBottom = Math.min(lowestBottom, pilonsBottom)
  }
  
  // Calculăm poziția absolută a vârfului celui mai de sus element
  // currentBottom este deja calculat și reprezintă poziția de jos a ultimului element adăugat
  // Dacă avem roof/mansarde/pod, roofBottom = currentBottom, altfel currentBottom este deja vârful ultimului etaj
  let topElementTop = currentBottom
  
  // Adăugăm înălțimea celui mai de sus element (roof/mansarde/pod) dacă există
  if (hasPod && heights.roof > 0) {
    topElementTop += heights.roof
  } else if (hasMansarda) {
    if (mansardaType === 'ohne' && heights['mansarde-small'] > 0) {
      topElementTop += heights['mansarde-small']
    } else if (heights.mansarde > 0) {
      topElementTop += heights.mansarde
    }
  }
  // Dacă nu avem roof/mansarde/pod, topElementTop este deja currentBottom (care include deja toate etajele)
  
  // Calculăm înălțimea reală: de la cel mai de jos bottom până la vârful celui mai de sus element
  // Dacă lowestBottom este negativ, trebuie să adăugăm acel spațiu la înălțime
  const heightFromLowest = topElementTop - lowestBottom
  
  // Dacă ultima poza este acoperiș/mansardă, folosim mai puțin spațiu de sus (30px), altfel 75px
  const topMargin = (hasPod || hasMansarda) ? 30 : 75
  
  // Calculăm padding-top pentru a muta conținutul în sus dacă avem elemente negative
  // Dacă lowestBottom este negativ, trebuie să adăugăm acel spațiu la padding-top
  const paddingTopValue = Math.max(topMargin, topMargin - lowestBottom)
  
  // Înălțimea exactă: cât toate pozele vizibile + margin sus (fără minimum fix)
  // Trebuie să includem și padding-top-ul în înălțimea totală
  const frameHeight = heightFromLowest + topMargin

  // Calculează width-ul scalat pentru fiecare imagine
  const getScaledWidth = (key: string) => {
    const original = originalSizes[key]
    if (!original) return 300 // Default până se încarcă
    return original.width * scaleFactor
  }

  // Calculează width-ul maxim pentru container (cel mai lat element)
  const containerWidth = Math.max(
    ...Object.keys(originalSizes).map(key => getScaledWidth(key)),
    300 // Default
  )

  // Calculează lățimea totală a conținutului: frame cu poze + gap + controale din dreapta + padding stânga + dreapta
  const contentWidth = containerWidth + 40 + 420 + 40 + 40 // frame + gap (40px) + dropdown (420px) + padding stânga (40px) + padding dreapta (40px)
  
  // Calculează înălțimea totală a conținutului: frameHeight + padding pentru contur
  const contentHeight = frameHeight + 40 // frame + padding (40px)

  return (
    <div className="flex flex-col gap-4 !pb-0" style={{ width: `${contentWidth}px`, margin: '0 auto' }}>
      {/* Partea de sus - Desen stânga, câmpuri dreapta */}
      <div className="flex gap-10 items-center" style={{ width: `${contentWidth - 80}px`, marginLeft: '40px', marginRight: '40px' }}>
        {/* Partea stângă - Frame cu imagini (width adaptiv, înălțime calculată automat, centrat vertical) */}
        <div className="relative flex-shrink-0 border-2 border-white/20 rounded-xl overflow-hidden bg-panel/50" style={{ width: `${containerWidth}px`, height: `${frameHeight}px` }}>
          <div className="relative w-full h-full" style={{ paddingTop: `${paddingTopValue}px` }}>
        {/* Ground - la baza, cel mai în spate (z-index cel mai mic) */}
        <img 
          ref={groundRef}
          src="/builder/ground.png" 
          alt="Ground" 
          className="absolute"
          style={{ 
            width: `${getScaledWidth('ground')}px`, 
            height: 'auto', 
            bottom: `${groundBottom}px`,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1 // Cel mai mic - cel mai în spate
          }}
          onLoad={(e) => {
            const img = e.currentTarget
            if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
              updateOriginalSize('ground', img.naturalWidth, img.naturalHeight)
            }
          }}
        />
        
        {/* Base - fundație (se afișează dacă nu avem beci sau dacă avem piloni) */}
        {hasBase && (
          <img 
            ref={baseRef}
            src="/builder/base.png" 
            alt="Base" 
            className="absolute"
            style={{ 
              width: `${getScaledWidth('base')}px`, 
              height: 'auto', 
              bottom: `${baseBottom}px`,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 60 // Mai mare pentru a fi vizibil
            }}
            onLoad={(e) => {
              const img = e.currentTarget
              if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
                updateOriginalSize('base', img.naturalWidth, img.naturalHeight)
              }
            }}
          />
        )}
        
        {/* Pilons - sub base dacă există, altfel sub basement/ground */}
        {pilons && (
          <img 
            ref={pilonsRef}
            src="/builder/pilons.png" 
            alt="Pilons" 
            className="absolute"
            style={{ 
              width: `${getScaledWidth('pilons')}px`, 
              height: 'auto', 
              bottom: `${pilonsBottom}px`,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 50 // Mai mare pentru a fi vizibil
            }}
            onLoad={(e) => {
              const img = e.currentTarget
              if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
                updateOriginalSize('pilons', img.naturalWidth, img.naturalHeight)
              }
            }}
          />
        )}
        
         {/* Basement - lipit de dedesubtul parterului (top-ul ground-ului), în față */}
         {basement && (
           <img 
             ref={basementRef}
             src={basementUse ? '/builder/basement-live.png' : '/builder/basement-empty.png'}
             alt="Basement"
             className="absolute"
             style={{ 
               width: `${getScaledWidth('basement')}px`, 
               height: 'auto', 
               bottom: `${basementBottom}px`,
               left: '50%',
               transform: 'translateX(-50%)',
               zIndex: 100 // Foarte mare pentru a fi sigur că e în fața ground-ului
             }}
             onLoad={(e) => {
               const img = e.currentTarget
               if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
                 updateOriginalSize('basement', img.naturalWidth, img.naturalHeight)
               }
             }}
           />
         )}
        
        {/* Down - deasupra ground */}
        <img 
          ref={downRef}
          src={downImage}
          alt="Down"
          className="absolute"
          style={{ 
            width: `${getScaledWidth('down')}px`, 
            height: 'auto', 
            bottom: `${downBottom}px`,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 3
          }}
          onLoad={(e) => {
            const img = e.currentTarget
            if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
              updateOriginalSize('down', img.naturalWidth, img.naturalHeight)
            }
          }}
        />
        
        {/* Up images - etaje */}
        {upImages.map((img, idx) => {
          const bottomValue = upBottoms[idx] ?? 0
          return (
            <img
              key={`up-${idx}`}
              ref={(el) => { 
                if (el) {
                  upRefs.current[idx] = el
                }
              }}
              src={img}
              alt={`Floor ${idx + 1}`}
              className="absolute"
              style={{ 
                width: `${getScaledWidth(`up-${idx}`)}px`,
                height: 'auto',
                bottom: `${bottomValue}px`,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 4 + idx
              }}
              onLoad={(e) => {
                const img = e.currentTarget
                if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
                  updateOriginalSize(`up-${idx}`, img.naturalWidth, img.naturalHeight)
                }
              }}
            />
          )
        })}
        
        {/* Pod sau Mansardă - deasupra ultimului etaj */}
        {hasPod && roofBottom >= 0 && (
          <img
            ref={roofRef}
            src="/builder/roof.png"
            alt="Dachboden"
            className="absolute"
            style={{
              width: `${getScaledWidth('roof')}px`,
              height: 'auto',
              bottom: `${roofBottom}px`,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10
            }}
            onLoad={(e) => {
              const img = e.currentTarget
              if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
                updateOriginalSize('roof', img.naturalWidth, img.naturalHeight)
              }
            }}
          />
        )}
        {hasMansarda && roofBottom >= 0 && (
          mansardaType === 'ohne' ? (
            <img
              ref={mansardeSmallRef}
              src={mansardeSmallImage}
              alt="Dachgeschoss ohne Kniestock"
              className="absolute"
              style={{
                width: `${getScaledWidth('mansarde-small')}px`,
                height: 'auto',
                bottom: `${roofBottom}px`,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10
              }}
              onLoad={(e) => {
                const img = e.currentTarget
                if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
                  updateOriginalSize('mansarde-small', img.naturalWidth, img.naturalHeight)
                }
              }}
            />
          ) : (
            <img
              ref={mansardeRef}
              src={mansardeImage}
                      alt="Dachgeschoss mit Kniestock"
              className="absolute"
              style={{
                width: `${getScaledWidth('mansarde')}px`,
                height: 'auto',
                bottom: `${roofBottom}px`,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10
              }}
              onLoad={(e) => {
                const img = e.currentTarget
                if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
                  updateOriginalSize('mansarde', img.naturalWidth, img.naturalHeight)
                }
              }}
            />
          )
        )}
          </div>
        </div>

      {/* Partea dreaptă - Form controls (ocupă tot spațiul rămas) */}
      <div className="flex-1 space-y-4 !pb-0 !mb-0">
        {/* Înălțime etaje */}
        <label className="flex flex-col gap-1" data-field="inaltimeEtaje">
          <span className="wiz-label text-sun/90">Geschosshöhe</span>
          <div className={`w-[420px] ${errors.inaltimeEtaje ? 'ring-2 ring-orange-400/60 rounded-lg' : ''}`}>
            <SelectSun
              value={inaltimeEtaje}
              onChange={(v) => {
                setForm({ ...form, inaltimeEtaje: v })
              }}
              options={['Standard (2,50 m)', 'Komfort (2,70 m)', 'Hoch (2,85+ m)']}
              placeholder="Wählen Sie eine Option"
            />
          </div>
          {errors.inaltimeEtaje && (
            <span className="text-xs text-orange-400">{errors.inaltimeEtaje}</span>
          )}
        </label>

        {/* Tip fundație/beci */}
        <label className="flex flex-col gap-1" data-field="tipFundatieBeci">
          <span className="wiz-label text-sun/90">Untergeschoss / Fundament</span>
          <div className={`w-[420px] ${errors.tipFundatieBeci ? 'ring-2 ring-orange-400/60 rounded-lg' : ''}`}>
            <SelectSun
              value={tipFundatieBeci}
              onChange={(v) => {
                setForm({ ...form, tipFundatieBeci: v })
              }}
              options={['Kein Keller (nur Bodenplatte)', 'Keller (unbeheizt / Nutzkeller)', 'Keller (mit einfachem Ausbau)']}
              placeholder="Wählen Sie eine Option"
            />
          </div>
          {errors.tipFundatieBeci && (
            <span className="text-xs text-orange-400">{errors.tipFundatieBeci}</span>
          )}
        </label>

        {/* Piloți */}
        <label className="flex items-center gap-2 mt-1" data-field="pilons">
          <input
            type="checkbox"
            className="sun-checkbox"
            checked={pilons}
            onChange={(e) => {
              setForm({ ...form, pilons: e.target.checked })
            }}
          />
          <span className="text-sm font-medium text-sun/90">Pfahlgründung erforderlich</span>
          {errors.pilons && <span className="ml-2 text-xs text-orange-400">{errors.pilons}</span>}
        </label>

        {/* Lista etaje */}
        <div className="space-y-2 !mb-0 !pb-0">
          {errors.listaEtaje && (
            <span className="text-xs text-orange-400">{errors.listaEtaje}</span>
          )}
          {listaEtaje.length === 0 && (
            <p className="text-sand/60 text-sm">Keine Elemente hinzugefügt</p>
          )}
          {listaEtaje.map((etaj: string, idx: number) => {
            return (
              <div key={idx} className="flex flex-col gap-2 p-2 bg-panel/50 rounded-lg border border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-[420px]">
                    <div className={errors[`listaEtaje_${idx}`] ? 'ring-2 ring-orange-400/60 rounded-lg' : ''}>
                      <SelectSun
                        value={etaj}
                        onChange={(v) => {
                          const newLista = [...listaEtaje]
                          // Dacă alege pod sau mansardă, șterge toate etajele după
                          if (v === 'pod' || v.startsWith('mansarda')) {
                            newLista[idx] = v
                            setForm({ ...form, listaEtaje: newLista.slice(0, idx + 1) })
                          } else {
                            newLista[idx] = v
                            setForm({ ...form, listaEtaje: newLista })
                          }
                        }}
                        options={['intermediar', 'pod', 'mansarda_ohne', 'mansarda_mit']}
                        displayFor={(opt) => {
                          if (opt === 'intermediar') return 'Obergeschoss (Wohnfläche)'
                          if (opt === 'pod') return 'Dachboden (Keine Wohnfläche)'
                          if (opt === 'mansarda_ohne') return 'Dachgeschoss ohne Kniestock (Wohnfläche)'
                          if (opt === 'mansarda_mit') return 'Dachgeschoss mit Kniestock (Wohnfläche)'
                          return opt
                        }}
                        placeholder="Wählen Sie eine Option"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newLista = listaEtaje.filter((_: any, i: number) => i !== idx)
                      setForm({ ...form, listaEtaje: newLista })
                    }}
                    className="px-2 py-1 text-orange-400 hover:text-orange-300 text-sm font-bold"
                  >
                    ×
                  </button>
                </div>
                {/* Câmp pentru înălțime pereți mansardă - doar dacă e mansardă cu pereți */}
                {etaj === 'mansarda_mit' && (
                  <label className="flex flex-col gap-1">
                    <span className="wiz-label text-sun/90 text-xs">Kniestock (cm)</span>
                    <input
                      type="number"
                      className="sun-input"
                      min="0"
                      max="300"
                      step="1"
                      value={form[`inaltimePeretiMansarda_${idx}`] || ''}
                      onChange={(e) => {
                        setForm({ ...form, [`inaltimePeretiMansarda_${idx}`]: parseFloat(e.target.value) || 0 })
                      }}
                      placeholder="z.B. 150"
                    />
                    {errors[`inaltimePeretiMansarda_${idx}`] && (
                      <span className="text-xs text-orange-400">{errors[`inaltimePeretiMansarda_${idx}`]}</span>
                    )}
                  </label>
                )}
              </div>
            )
          })}
          {canAddFloors && (
            <>
              <button
                ref={addFloorBtnRef}
                type="button"
                onClick={() => {
                  setShowAddFloorDropdown(!showAddFloorDropdown)
                }}
                className="px-3 py-1.5 bg-gradient-to-b from-[#e08414] to-[#f79116] hover:brightness-110 text-white rounded-lg text-sm font-medium transition-all"
              >
                + Neues Geschoss
              </button>
              {showAddFloorDropdown && typeof window !== 'undefined' && createPortal(
                <div
                  className="sun-menu"
                  role="listbox"
                  style={{ position: 'fixed', left: addFloorPos.left, top: addFloorPos.top, width: Math.max(addFloorPos.width, 350), zIndex: 9999 }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {floorTypeOptions.map(opt => {
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        className="sun-menu-item"
                        onClick={() => handleAddFloor(opt.value)}
                      >
                        <span className="whitespace-normal text-left">{opt.label}</span>
                      </button>
                    )
                  })}
                </div>,
                document.body
              )}
            </>
          )}
        </div>
      </div>
    </div>
    </div>
  )
}

function DynamicFields({
  stepKey, fields, form, setForm, onUpload, ensureOffer, errors, onEnter, drafts, step, onBlur, setDrafts
}: {
  stepKey: string
  fields: Field[]
  form: Record<string, any>
  setForm: (v: Record<string, any>, shouldAutosave?: boolean) => void
  onUpload: (name: string, file: File | null) => void
  ensureOffer: () => Promise<string>
  errors: Errors
  onEnter: () => void
  drafts?: Record<string, any>
  step?: any
  onBlur?: (stepKey: string, updatedForm?: Record<string, any>) => void
  setDrafts?: (updater: (prev: Drafts) => Drafts) => void
}) {
  
  // Obține nivelOferta din sistemConstructiv (din drafts sau din form-ul curent)
  const sistemConstructivData = stepKey === 'sistemConstructiv' ? form : (drafts?.sistemConstructiv || {})
  const nivelOferta = sistemConstructivData.nivelOferta || ''
  
  // Determină ce field-uri să ascundă în funcție de nivelOferta
  const shouldHideField = (fieldName: string): boolean => {
    if (!nivelOferta) return false
    
    const nivelStr = String(nivelOferta).toLowerCase()
    
    // Verifică dacă este "Casă completă" (Schlüsselfertiges Haus)
    const isCasaCompleta = nivelStr.includes('schlüsselfertig') || nivelStr.includes('completă') || nivelStr.includes('completa')
    
    // Pentru step-ul performantaEnergetica: nu ascundem nimic (toate câmpurile sunt vizibile dacă step-ul este vizibil)
    if (stepKey === 'performantaEnergetica') {
      return false
    }
    
    // Pentru step-ul materialeFinisaj: logica existentă
    if (stepKey !== 'materialeFinisaj') return false
    
    // "Rohbau/Tragwerk" sau "Structură" (fără ferestre) -> ascunde tamplarie și finisajInterior
    // Verifică atât variantele în română cât și în germană
    const isStructuraOnly = (nivelStr.includes('rohbau') || nivelStr.includes('tragwerk') || nivelStr.includes('structură')) 
        && !nivelStr.includes('fenster') && !nivelStr.includes('ferestre') && !nivelStr.includes('completă') && !nivelStr.includes('schlüsselfertig')
    
    if (isStructuraOnly) {
      return fieldName === 'tamplarie' || fieldName === 'finisajInterior'
    }
    
    // "Tragwerk + Fenster" sau "Structură + ferestre" -> ascunde doar finisajInterior
    const isStructuraPlusFenestre = (nivelStr.includes('tragwerk') || nivelStr.includes('structură')) 
        && (nivelStr.includes('fenster') || nivelStr.includes('ferestre'))
    
    if (isStructuraPlusFenestre) {
      return fieldName === 'finisajInterior'
    }
    
    // "Schlüsselfertiges Haus" sau "Casă completă" -> arată tot (nu ascunde nimic)
    return false
  }
  
  let currentFields = fields;
  if (stepKey === 'upload') {
      currentFields = fields.filter(f => f.name === 'planArhitectural' || f.name === 'planArhitectura');
      if (currentFields.length === 0 && fields.length > 0) {
          currentFields = [fields[0]];
      }
  } else if (stepKey === 'materialeFinisaj') {
      // Filtrează field-urile în funcție de nivelOferta
      currentFields = fields.filter(f => !shouldHideField(f.name))
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {currentFields.map(f => {
        // Acoperișul a fost mutat la pasul materialeFinisaj
        if (stepKey === 'sistemConstructiv' && f.type === 'select' && f.name === 'tipAcoperis') {
          return null // Nu mai afișăm acoperișul aici
        }
        
        // Pentru tipAcoperis step, afișăm RoofGridSelect pentru tipAcoperis
        if (stepKey === 'tipAcoperis' && f.type === 'select' && f.name === 'tipAcoperis') {
          // Folosim subtitlul step-ului în loc de label-ul field-ului pentru a evita duplicarea
          const stepSubtitle = step?.subtitle || f.label
          return (
            <div key={f.name} className="flex flex-col gap-1 mt-4" data-field={f.name}>
              <div className="flex items-center justify-between mb-2">
                <span className="wiz-label text-sun/90">{stepSubtitle}</span>
                {form.tipAcoperis && (
                  <span className="text-xs text-neutral-300/70">{DE.common.selected}: {form.tipAcoperis}</span>
                )}
              </div>
              <RoofGridSelect
                value={form.tipAcoperis || ''}
                onChange={(v) => {
                  setForm({ ...form, tipAcoperis: v })
                }}
              />
              {errors.tipAcoperis && (
                <span className="text-orange-400 text-sm mt-1">{errors.tipAcoperis}</span>
              )}
            </div>
          )
        }

        if (f.type === 'upload') {
             return (
                 <div key={f.name} className="flex flex-col gap-1" data-field={f.name}>
                 <SimpleUploadField 
                    stepKey={stepKey} 
                    field={f as Extract<Field, { type: 'upload' }>}
                    files={form[f.name] || []}
                    onChange={(newFiles) => setForm({ ...form, [f.name]: newFiles })}
                 />
                   {errors[f.name] && <span className="text-xs text-orange-400 mt-1">{errors[f.name]}</span>}
                 </div>
             )
        }

        if (f.type === 'select') {
          const hasErr = !!errors[f.name]
          const displayLabel = tFieldLabel(stepKey, f.name, f.label)
          const displayPlaceholder = tPlaceholder(stepKey, f.name, ('placeholder' in f && (f as any).placeholder) ? (f as any).placeholder : undefined)
          
          // Special handling for fireplace dropdown with prices
          const isFireplaceField = f.name === 'tipSemineu'
          const fireplacePrices: Record<string, number> = {
            'Kein Kamin': 0,
            'Klassischer Holzofen': 8500,
            'Moderner Design-Kaminofen': 12000,
            'Pelletofen (automatisch)': 11000,
            'Einbaukamin': 14000,
            'Kachel-/wassergeführter Kamin': 18000
          }
          const fireplaceLabels: Record<string, string> = {
            'Kein Kamin': 'Kein Kamin',
            'Klassischer Holzofen': 'Klassischer Holzofen – ca. 8.500 €',
            'Moderner Design-Kaminofen': 'Moderner Design-Kaminofen - ca. 12.000 €',
            'Pelletofen (automatisch)': 'Pelletofen (automatisch) – ca. 11.000 €',
            'Einbaukamin': 'Einbaukamin - ca. 14.000 €',
            'Kachel-/wassergeführter Kamin': 'Kachel-/wassergeführter Kamin - ca. 18.000 €'
          }

          return (
            <label key={f.name} className="flex flex-col gap-1" data-field={f.name}>
              <span className="wiz-label text-sun/90">{displayLabel}</span>
              <div className={hasErr ? 'ring-2 ring-orange-400/60 rounded-lg' : ''}>
                <SelectSun
                  value={form[f.name] ?? ''}
                  onChange={async v => {
                    const next = { ...form, [f.name]: v }
                    setForm(next)
                    const id = await ensureOffer()
                    await apiFetch(`/offers/${id}/step`, { method: 'POST', body: JSON.stringify({ step_key: stepKey, data: next }) })
                    // Don't refresh HistoryList after select changes - only after dateGenerale step
                  }}
                  options={(f as any).options}
                  placeholder={displayPlaceholder ?? DE.common.selectPlaceholder}
                  displayFor={(opt) => {
                    if (isFireplaceField && fireplaceLabels[opt]) {
                      return fireplaceLabels[opt]
                    }
                    return tOption(stepKey, f.name, opt)
                  }}
                />
              </div>
              {hasErr && <span className="text-xs text-orange-400">{errors[f.name]}</span>}
              {isFireplaceField && form[f.name] && form[f.name] !== 'Kein Kamin' && (
                <span className="text-xs text-sand/70 mt-1">
                  *Schornstein wird dazugerechnet mit Anzahl der Stockwerke (4500€ Standardpreis +1500€ pro Geschoss)
                </span>
              )}
            </label>
          )
        }

        if (f.type === 'bool') {
          const displayLabel = tFieldLabel(stepKey, f.name, f.label)
          return (
            <label key={f.name} className="flex items-center gap-2 mt-1" data-field={f.name}>
              <input
                type="checkbox"
                className="sun-checkbox"
                checked={!!form[f.name]}
                onChange={async e => {
                  const next = { ...form, [f.name]: e.target.checked }
                  setForm(next)
                  const id = await ensureOffer()
                  await apiFetch(`/offers/${id}/step`, { method: 'POST', body: JSON.stringify({ step_key: stepKey, data: next }) })
                }}
                onKeyDown={(e) => handleInputEnter(e, onEnter)}
              />
              <span className="text-sm font-medium">{displayLabel}</span>
              {errors[f.name] && <span className="ml-2 text-xs text-orange-400">{errors[f.name]}</span>}
            </label>
          )
        }

        const displayLabel = tFieldLabel(stepKey, f.name, f.label)
        const displayPlaceholder =
          tPlaceholder(stepKey, f.name, ('placeholder' in f && (f as any).placeholder) ? (f as any).placeholder : undefined)

        const common: any = {
          className: `sun-input ${errors[f.name] ? 'ring-2 ring-orange-400/60 focus:ring-orange-400/60' : ''}`,
          value: form[f.name] ?? '',
          placeholder: displayPlaceholder,
          onChange: (e: any) => {
            const raw = e.target.value
            const val = f.type === 'number' ? (raw === '' ? '' : Number(raw)) : raw
            const next = { ...form, [f.name]: val }
            // Update form immediately to prevent it from being reset
            setForm(next, false) // Don't auto-save on change for text inputs
            // Also update drafts immediately to prevent useEffect from resetting
            if (setDrafts) {
              setDrafts(prev => ({ ...prev, [stepKey]: next }))
            }
          },
          onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            // Get current value from input and update form before saving
            const currentValue = e.target.value
            const fieldName = f.name
            const val = f.type === 'number' ? (currentValue === '' ? '' : Number(currentValue)) : currentValue
            const updatedForm = { ...form, [fieldName]: val }
            // Update form state and drafts immediately
            setForm(updatedForm, false) // Update form state without triggering autosave
            if (setDrafts) {
              setDrafts(prev => ({ ...prev, [stepKey]: updatedForm }))
            }
            // Save with updated form data using onBlur callback
            if (onBlur) {
              // Use setTimeout to ensure state is updated before saving
              setTimeout(() => {
                onBlur(stepKey, updatedForm) // Pass updated form to callback
              }, 10)
            }
          },
          onKeyDown: (e: React.KeyboardEvent) => handleInputEnter(e, onEnter)
        }

        return (
          <label key={f.name} className="flex flex-col gap-1" data-field={f.name}>
            <span className="wiz-label text-sun/90">{displayLabel}</span>
            {f.type === 'textarea'
              ? <textarea {...common} className={`sun-textarea ${errors[f.name] ? 'ring-2 ring-orange-400/60 focus:ring-orange-400/60' : ''}`} />
              : <input type={f.type === 'number' ? 'number' : 'text'} {...common} />}
            {errors[f.name] && <span className="text-xs text-orange-400">{errors[f.name]}</span>}
          </label>
        )
      })}
    </div>
  )
}

function SimpleUploadField({ stepKey, field, files, onChange }: { stepKey: string, field: Extract<Field, { type: 'upload' }>, files: File[], onChange: (f: File[]) => void }) {
  const displayLabel = tFieldLabel(stepKey, field.name, field.label)
  const [isDragging, setIsDragging] = useState(false) // Stare pentru efect vizual

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const newFiles = Array.from(e.target.files)
          onChange(field.multiple ? [...files, ...newFiles] : newFiles)
      }
  }

  // --- HANDLERS PENTRU DRAG & DROP ---
  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const newFiles = Array.from(e.dataTransfer.files)
          // Validare tip fișier (opțional, dar recomandat)
          // Aici acceptăm orice, dar poți filtra după field.accept dacă vrei
          onChange(field.multiple ? [...files, ...newFiles] : newFiles)
          
          // Resetăm input-ul fișierului pentru a permite re-selectarea aceluiași fișier dacă e nevoie
          // (Deși la Drag&Drop nu e strict necesar, e bună practică)
      }
  }
  // -------------------------------------

  const removeFile = (idx: number) => {
      const next = files.filter((_, i) => i !== idx)
      onChange(next)
  }

  return (
    <div className="border border-black/30 rounded-xl2 p-3 bg-black/10">
      <div className="text-sm font-semibold text-sun mb-2">
        {displayLabel} {(field as any).optional && <span className="opacity-70 font-normal">(freiwillig)</span>}
      </div>
      
      <div className="flex flex-col gap-4">
          {/* Lista de fișiere selectate */}
          {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between bg-coffee-800/40 px-2 py-1 rounded text-sm text-sand/90 border border-white/5">
                  <span className="truncate max-w-[200px]">{f.name}</span>
                  <button type="button" onClick={() => removeFile(i)} className="text-orange-400 hover:text-orange-300 px-2 font-bold">×</button>
              </div>
          ))}

          {/* Zona de Upload + Drag & Drop */}
          <label 
            className={`group cursor-pointer relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl transition-all duration-300
              ${isDragging ? 'border-sun bg-sun/10 scale-[1.02]' : 'border-sun/30 hover:bg-sun/5 hover:border-sun/50'}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
                type="file"
                accept={field.accept}
                multiple={field.multiple}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                onChange={handleFileChange}
            />
            
            {/* Imaginea de upload */}
            <img 
                src="/file-upload.png" 
                alt="Upload" 
                className={`h-16 w-16 object-contain transition-all duration-300
                  ${isDragging ? 'scale-110 opacity-100' : 'opacity-80 group-hover:opacity-100 group-hover:scale-110'}
                `}
            />
            
            <span className={`mt-3 text-sm font-medium transition-colors ${isDragging ? 'text-sun' : 'text-sun/70 group-hover:text-sun'}`}>
                {isDragging ? 'Datei hier ablegen!' : (files.length > 0 ? '+ Weitere Dateien hinzufügen' : 'Datei hier ablegen oder klicken')}
            </span>
          </label>
      </div>
    </div>
  )
}

const handleInputEnter = (e: React.KeyboardEvent, onNextStep: () => void) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    const target = e.currentTarget as HTMLElement
    const container = target.closest('.wizard-body')
    if (!container) return

    // Select all interactive form elements we consider "steps"
    // Including button.sun-select to allow jumping TO it
    const selector = 'input:not([type="hidden"]):not([type="checkbox"]):not([disabled]), textarea:not([disabled]), button.sun-select'
    const elements = Array.from(container.querySelectorAll(selector)) as HTMLElement[]
    
    const currentIndex = elements.indexOf(target)
    
    if (currentIndex !== -1 && currentIndex < elements.length - 1) {
      // Move to next
      elements[currentIndex + 1].focus()
    } else {
      // It's the last one, submit/next step
      onNextStep()
    }
  }
}