'use client'

import { useEffect, useMemo, useRef, useState, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { apiFetch } from '../lib/supabaseClient'
import { buildFormStepsFromJson } from '../../lib/buildFormFromJson'
import holzbauFormStepsJson from '../../data/form-schema/holzbau-form-steps.json'
import { type Field, formStepsDachstuhl } from '../dashboard/formConfig'
import { CheckCircle2, ChevronLeft, ChevronRight, ChevronDown, Loader2, AlertTriangle, X } from 'lucide-react'

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
    projektdaten: 'Projektdaten',
    daemmungDachdeckung: 'Dämmung & Dachdeckung',
    tipAcoperis: 'Dachart',
    ferestreUsi: 'Fenster & Türen',
    materialeFinisaj: 'Materialien & Ausbaustufe',
    performantaEnergetica: 'Energieeffizienz & Heizung',
    performanta: 'Energieeffizienz & Heizung',
    conditiiSantier: 'Baustellenbedingungen & Logistik',
    logistica: 'Baustellenbedingungen & Logistik',
    upload: 'Datei-Upload',
  },
  // Wir behalten die statischen Übersetzungen als Fallback, falls die DB keine Labels liefert
  fieldsGlobal: {
    'Tip sistem': 'Systemtyp',
    'Baustellenzufahrt': 'Baustellenzufahrt',
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
    'Performanță energetică': 'Energieeffizienz & Heizung',

    'Nivel de ofertă dorit': 'Gewünschter Angebotsumfang',
    'Tip finisaj interior': 'Innenausbau – Typ',
    'Tip fațadă': 'Fassade – Typ',
    'Tip ferestre și uși': 'Fenster/Türen – Typ',
    'Sistem încălzire preferat': 'Bevorzugte Heizung',
    'Nivel energetic dorit': 'Gewünschtes Energieniveau',
    'Teren plat sau pantă?': 'Gelände: eben oder Hang?',
    'Acces curent electric / apă': 'Strom-/Wasseranschluss vorhanden',

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
    computeErrorTitle: 'Ein Problem ist aufgetreten',
    computeErrorMessage: 'Die Berechnung konnte nicht abgeschlossen werden. Bitte starten Sie ein neues Projekt und versuchen Sie es erneut.',
    computeErrorRetry: 'Erneut versuchen',
  },
} as const

/* Helpers: prioritate la label/placeholder din JSON (fallback), apoi DE */
function tStepLabel(key: string, fallback: string) {
  const fromJson = typeof fallback === 'string' && fallback.trim()
  return fromJson ? fallback : (DE.steps as any)?.[key] ?? key
}
function tFieldLabel(stepKey: string, fieldName: string, fallback: string | undefined) {
  const fromJson = typeof fallback === 'string' && fallback.trim()
  if (fromJson) return fallback
  const fb = fieldName ?? ''
  return (DE.fieldsGlobal as any)?.[fb] ?? fb
}
function tPlaceholder(stepKey: string, fieldName: string, fallback?: string) {
  return typeof fallback === 'string' && fallback.trim() ? fallback : undefined
}
function tOption(stepKey: string, fieldName: string, value: string) {
  return (DE.optionsGlobal as any)?.[value] ?? value
}

/* ================= VALIDATORS ================= */
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i
const phoneRe = /^[0-9+\s().-]{6,}$/

function validateClient(form: Record<string, any>): Errors {
  const e: Errors = {}
  const nume = (form.nume ?? '').trim()
  
  if (!nume) e.nume = 'Bitte den Namen eingeben.'
  // Rest ist optional für schnellen Test
  return e
}

function validateGeneric(stepKey: string, fields: Field[], form: Record<string, any>, drafts?: Record<string, any>): Errors {
  const e: Errors = {}
  const sistemConstructivData = stepKey === 'sistemConstructiv' ? form : (drafts?.sistemConstructiv || {})
  const nivelOferta = sistemConstructivData.nivelOferta || ''

  const shouldHideField = (fieldName: string): boolean => {
    if ((stepKey === 'sistemConstructiv' || stepKey === 'structuraCladirii' || stepKey === 'materialeFinisaj') && fieldName === 'tipAcoperis') return true
    if (stepKey === 'structuraCladirii' && fieldName === 'floorsNumber') return true
    if (!nivelOferta) return false
    const nivelStr = String(nivelOferta).toLowerCase()
    const isCasaCompleta = nivelStr.includes('schlüsselfertig') || nivelStr.includes('completă') || nivelStr.includes('completa')
    if (stepKey === 'performantaEnergetica') return false
    if (stepKey !== 'materialeFinisaj') return false
    const isStructuraOnly = (nivelStr.includes('rohbau') || nivelStr.includes('tragwerk') || nivelStr.includes('structură'))
      && !nivelStr.includes('fenster') && !nivelStr.includes('ferestre') && !nivelStr.includes('completă') && !nivelStr.includes('schlüsselfertig')
    if (isStructuraOnly) return fieldName === 'tamplarie' || fieldName === 'finisajInterior'
    const isStructuraPlusFenestre = (nivelStr.includes('tragwerk') || nivelStr.includes('structură')) && (nivelStr.includes('fenster') || nivelStr.includes('ferestre'))
    if (isStructuraPlusFenestre) return fieldName === 'finisajInterior'
    return false
  }

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
  }

  for (const f of fields) {
    if ((f as any).optional) continue
    if (f.type === 'bool') continue
    if (shouldHideField(f.name)) continue
    if (f.type === 'upload') {
      const v = (form as any)[f.name]
      if (!v || (Array.isArray(v) && v.length === 0)) e[f.name] = 'Bitte laden Sie mindestens eine Datei hoch.'
      continue
    }
    const v = (form as any)[f.name]
    if (f.type === 'select') {
      if (v === undefined || v === null || String(v).trim() === '') e[f.name] = 'Bitte wählen Sie eine Option aus.'
      continue
    }
    if (f.type === 'text' || f.type === 'textarea') {
      const str = String(v ?? '').trim()
      if (!str) e[f.name] = 'Dieses Feld ist erforderlich.'
      else if (str.length < 2) e[f.name] = 'Dieses Feld muss mindestens 2 Zeichen lang sein.'
      continue
    }
    if (f.type === 'number') {
      if (v === undefined || v === null || v === '') e[f.name] = 'Bitte geben Sie eine Zahl ein.'
      else if (isNaN(Number(v))) e[f.name] = 'Bitte geben Sie eine gültige Zahl ein.'
      continue
    }
  }
  return e
}


/* Helper: API poate returna options ca string[] sau { value, label }[] — normalizăm la valoare primitivă */
function optValue(opt: string | { value?: string; label?: string }): string {
  if (opt == null) return ''
  if (typeof opt === 'object' && 'value' in opt) return String((opt as any).value ?? '')
  return String(opt)
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
  options: (string | { value?: string; label?: string })[]
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
          {(options ?? []).map((opt, i) => {
            const val = optValue(opt)
            const active = val === value
            const label = displayFor ? displayFor(val) : (typeof opt === 'object' && opt !== null && 'label' in opt ? String((opt as any).label ?? val) : val)
            return (
              <button
                key={val ? `${val}` : `opt-${i}`}
                type="button"
                className={`sun-menu-item ${active ? 'is-active' : ''}`}
                onClick={() => { onChange(val); setOpen(false) }}
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
  } catch {
    return null
  }
}

/* ================= Wizard ================= */
export default function StepWizard() {
  // 1. Definim TOATE hook-urile la început (FĂRĂ condiții/returns înainte)
  const [dynamicSteps, setDynamicSteps] = useState<any[]>([])
  const [loadingForm, setLoadingForm] = useState(true)

  const [offerId, setOfferId] = useState<string | null>(null)
  const offerIdRef = useRef<string | null>(null)
  const [idx, setIdx] = useState(0)
  const [form, setForm] = useState<Record<string, any>>({})
  const [drafts, setDrafts] = useState<Drafts>({})
  
  const [saving, setSaving] = useState(false)
  const [processStatus, setProcessStatus] = useState<string>('')

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingStepsRef = useRef<Set<string>>(new Set())

  const saveDebounceRef = useRef<any>(null)
  const lastSavedRef = useRef<string>('')

  const creatingRef = useRef(false)
  const [computing, setComputing] = useState(false)
  const [computeFailed, setComputeFailed] = useState(false)
  const [computeRunId, setComputeRunId] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [computeStartTime, setComputeStartTime] = useState<number | null>(null)

  const [dir, setDir] = useState<'next' | 'back' | null>(null)
  const [animKey, setAnimKey] = useState(0)

  const [errors, setErrors] = useState<Errors>({})
  const [showErrors, setShowErrors] = useState(false)
  
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const [selectedPackage, setSelectedPackage] = useState<'mengen' | 'dachstuhl' | 'neubau' | null>(null)

  /** Opțiuni custom per tag (din Preisdatenbank) – se îmbină cu opțiunile din schema la select-uri. */
  const [customOptionsForm, setCustomOptionsForm] = useState<Record<string, Array<{ label: string; value: string }>>>({})
  /** Override-uri de etichete pentru variabile (Preisdatenbank) – folosite la afișarea opțiunilor în formular. */
  const [paramLabelOverrides, setParamLabelOverrides] = useState<Record<string, string>>({})

  const lastProcessedCreationId = useRef<number>(0)
  const activeCreationPromise = useRef<Promise<string> | null>(null)
  const pendingOfferTypeIdRef = useRef<string | null>(null)

  useEffect(() => { offerIdRef.current = offerId }, [offerId])

  // Toți pașii sunt mereu vizibili și accesibili — nu mai ascundem pași după nivelOferta
  const visibleSteps = useMemo(() => dynamicSteps, [dynamicSteps])

  // -- UseMemo hooks (safe to run even if visibleSteps is empty)
  const step = visibleSteps[idx]
  const isFirst = idx === 0
  const isLast = idx === (visibleSteps.length > 0 ? visibleSteps.length - 1 : 0)

  const progressPct = useMemo(
    () => (visibleSteps.length > 1 ? Math.round((idx / (visibleSteps.length - 1)) * 100) : 0),
    [idx, visibleSteps.length]
  )

  const stepsMeta = useMemo(
    () => visibleSteps.map(s => tStepLabel((s as any).key, (s as any).label)),
    [visibleSteps]
  )

  // Bara de progres: afișăm întotdeauna TOȚI pașii (dynamicSteps), cei ascunși de nivelOferta sunt marcați ca „săriți” — structura nu se schimbă când ajungi la Gebäudestruktur
  const progressBarSteps = useMemo(() => {
    return dynamicSteps.map((s: { key: string; label?: string }) => {
      const key = (s as any).key
      const label = tStepLabel(key, (s as any).label)
      const visibleIndex = visibleSteps.findIndex((vs: { key?: string }) => (vs as any).key === key)
      const isSkipped = visibleIndex === -1
      const isDone = visibleIndex >= 0 && visibleIndex < idx
      const isActive = (visibleSteps[idx] as any)?.key === key
      return { key, label, isSkipped, isDone, isActive }
    })
  }, [dynamicSteps, visibleSteps, idx])

  const visibleErrors = showErrors ? errors : {}

  // Schema din data/form-schema/holzbau-form-steps.json (import static – la modificare fișier, salvează și refresh)
  const formStepsFromJson = useMemo(
    () => buildFormStepsFromJson(holzbauFormStepsJson as unknown),
    []
  )

  // Mapare option value (din formular) -> price_key pentru override etichete (variabile prestabilite din Preisdatenbank)
  const optionValueToPriceKey = useMemo(() => {
    const out: Record<string, Record<string, string>> = {}
    const schema = holzbauFormStepsJson as {
      steps?: Array<{
        fields?: Array<{ tag?: string; options?: string[] }>
        priceSections?: Array<{ fieldTag?: string; variables?: Array<{ key: string; label: string }> }>
      }>
    }
    const steps = Array.isArray(schema?.steps) ? schema.steps : []
    for (const step of steps) {
      const priceSections = step.priceSections ?? []
      const fields = step.fields ?? []
      for (const ps of priceSections) {
        const tag = ps.fieldTag
        if (!tag) continue
        const field = fields.find((f: any) => f.tag === tag)
        const options = (field as any)?.options ?? []
        if (!out[tag]) out[tag] = {}
        const vars = ps.variables || []
        for (const opt of options) {
          if (!opt || out[tag][opt]) continue
          const v = vars.find((v: any) => (v.label || '').startsWith(opt))
          if (v) out[tag][opt] = v.key
        }
        // fallback: first word of variable label (pentru câmpuri fără options sau compatibilitate)
        for (const v of vars) {
          const firstWord = (v.label || '').trim().split(/\s+/)[0]
          if (firstWord && !out[tag][firstWord]) out[tag][firstWord] = v.key
        }
      }
    }
    return out
  }, [])

  useEffect(() => {
    setDynamicSteps(formStepsFromJson as any[])
    setLoadingForm(false)
  }, [formStepsFromJson])

  // 1b. Când user alege pachet (Dachstuhl vs Neubau/Mengen), folosim flow-ul corespunzător
  useEffect(() => {
    if (selectedPackage === 'dachstuhl') {
      setDynamicSteps(formStepsDachstuhl as any[])
      setIdx(0)
    } else if ((selectedPackage === 'neubau' || selectedPackage === 'mengen') && formStepsFromJson.length > 0) {
      setDynamicSteps(formStepsFromJson as any[])
      setIdx(0)
    }
  }, [selectedPackage, formStepsFromJson])

  const fetchPricingParameters = useCallback(() => {
    if (selectedPackage !== 'neubau' && selectedPackage !== 'mengen') return
    // Cache bust ca formularul să primească etichete actualizate după salvare în Preisdatenbank
    const url = '/pricing-parameters?t=' + Date.now()
    apiFetch(url)
      .then((res: any) => {
        const co = res?.customOptions
        if (co && typeof co === 'object') setCustomOptionsForm(co)
        const overrides = res?.paramLabelOverrides
        if (overrides && typeof overrides === 'object') setParamLabelOverrides(overrides)
      })
      .catch(() => {})
  }, [selectedPackage])

  useEffect(() => { fetchPricingParameters() }, [fetchPricingParameters])

  // Re-fetch la revenirea pe tab/fereastră ca formularul să vadă etichete actualizate din Preisdatenbank
  useEffect(() => {
    if (selectedPackage !== 'neubau' && selectedPackage !== 'mengen') return
    const refetch = () => { fetchPricingParameters() }
    const onVisibility = () => { if (document.visibilityState === 'visible') refetch() }
    window.addEventListener('focus', refetch)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', refetch)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [selectedPackage, fetchPricingParameters])

  // 2. New Project Listener
  useEffect(() => {
    const handleNewProject = (e: Event) => {
      const detail = (e as CustomEvent).detail
      const creationId = detail?.creationId
      const offerTypeId = detail?.offerTypeId as string | undefined

      if (creationId && lastProcessedCreationId.current === creationId) return
      if (creationId) lastProcessedCreationId.current = creationId
      pendingOfferTypeIdRef.current = offerTypeId ?? null

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
      setComputeFailed(false)
      setComputeRunId(null)
      setComputeStartTime(null)
      setSaveStatus('idle')
      setSelectedPackage(null)
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

  // Ajustare idx când visibleSteps se scurtează (ex. ascundem performantaEnergetica)
  useEffect(() => {
    if (visibleSteps.length === 0) return
    if (idx >= visibleSteps.length) setIdx(Math.max(0, visibleSteps.length - 1))
  }, [visibleSteps.length, idx])

  // 4. PDF Ready Listener
  useEffect(() => {
    const onReady = (e: Event) => {
      const detail = (e as CustomEvent).detail as { offerId?: string; pdfUrl?: string }
      if (!detail?.pdfUrl) return
      if (offerId && detail.offerId && offerId !== detail.offerId) return

      const now = Date.now()
      const elapsed = computeStartTime ? now - computeStartTime : MIN_ANIMATION_TIME
      const remainingTime = Math.max(0, MIN_ANIMATION_TIME - elapsed)

      setTimeout(() => {
        setPdfUrl(detail.pdfUrl || null)
        setComputing(false)
        setComputeRunId(null)
        setComputeStartTime(null)
        window.dispatchEvent(new Event('offers:refresh'))
      }, remainingTime)
    }
    window.addEventListener('offer:pdf-ready', onReady as EventListener)
    return () => window.removeEventListener('offer:pdf-ready', onReady as EventListener)
  }, [offerId, computeStartTime])

  // 4b. Compute Failed Listener
  useEffect(() => {
    const onFailed = (e: Event) => {
      const detail = (e as CustomEvent).detail as { offerId?: string }
      if (offerIdRef.current && detail?.offerId && detail.offerId !== offerIdRef.current) return
      setComputeFailed(true)
      setComputing(false)
      setComputeRunId(null)
    }
    window.addEventListener('offer:compute-failed', onFailed as EventListener)
    return () => window.removeEventListener('offer:compute-failed', onFailed as EventListener)
  }, [])

  // 4c. Poll calc-events for error-level events
  const calcEventsSinceRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!computing || !computeRunId || computeFailed) return
    calcEventsSinceRef.current = undefined
    const POLL_INTERVAL = 2000
    const iv = setInterval(async () => {
      try {
        const since = calcEventsSinceRef.current
        const url = since != null
          ? `/calc-events?run_id=${encodeURIComponent(computeRunId)}&sinceId=${since}`
          : `/calc-events?run_id=${encodeURIComponent(computeRunId)}`
        const res = (await apiFetch(url)) as { items?: Array<{ id: number; level?: string }> }
        const items = res?.items ?? []
        for (const ev of items) {
          if (ev.id != null) calcEventsSinceRef.current = ev.id
          if (ev.level === 'error') {
            setComputeFailed(true)
            setComputing(false)
            setComputeRunId(null)
            return
          }
        }
      } catch (_) {}
    }, POLL_INTERVAL)
    return () => clearInterval(iv)
  }, [computing, computeRunId, computeFailed])

  // 4d. Fallback: poll offer status (failed or ready without PDF)
  useEffect(() => {
    if (!computing || !offerId || pdfUrl || computeFailed) return
    const POLL_MS = 2500
    let iv: ReturnType<typeof setInterval> | null = null
    const check = async () => {
      try {
        const data = (await apiFetch(`/offers/${offerId}`)) as { offer?: { status?: string } }
        const status = data?.offer?.status
        if (status === 'failed') {
          if (iv) clearInterval(iv)
          iv = null
          setComputeFailed(true)
          setComputing(false)
          return
        }
        if (status === 'ready') {
          const exportRes = await apiFetch(`/offers/${offerId}/export-url`).catch(() => null) as { url?: string; download_url?: string; pdf?: string } | null
          const url = exportRes?.url || exportRes?.download_url || exportRes?.pdf
          if (iv) clearInterval(iv)
          iv = null
          if (url) {
            window.dispatchEvent(new CustomEvent('offer:pdf-ready', { detail: { offerId, pdfUrl: url } }))
          } else {
            setComputeFailed(true)
            setComputing(false)
          }
          return
        }
      } catch (_) {}
    }
    check()
    iv = setInterval(check, POLL_MS)
    return () => { if (iv) clearInterval(iv) }
  }, [computing, offerId, pdfUrl, computeFailed])

  // 5. Offer Selected Listener — doar setăm offerId; NU suprascriem selectedPackage (altfel flow Dachstuhl s-ar transforma în Neubau după primul pas)
  useEffect(() => {
    const onSel = async (e: any) => {
      const id = e.detail.offerId as string
      setOfferId(id)
      offerIdRef.current = id
      if (!id) {
        setSelectedPackage(null)
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
        try {
          const stepsData = await apiFetch(`/offers/${id}/steps`).catch(() => null)
          if (stepsData && typeof stepsData === 'object') {
            setDrafts(stepsData)
          }
        } catch {
          // Endpoint might not exist
        }
      } catch {
        setPdfUrl(null)
      }
    }
    window.addEventListener('offer:selected', onSel)
    return () => window.removeEventListener('offer:selected', onSel)
  }, [])

  // 6. Update Form State on Step Change (ca pe VPS)
  useEffect(() => {
    if (visibleSteps.length === 0) return
    const key = visibleSteps[idx]?.key
    if (!key) return

    const draftData = drafts[key]
    if (draftData && Object.keys(draftData).length > 0) {
      setForm(draftData)
    } else if (offerId) {
      apiFetch(`/offers/${offerId}/step?step_key=${encodeURIComponent(key)}`)
        .then((data: any) => {
          const stepData = data?.data
          if (stepData && Object.keys(stepData).length > 0) {
            setDrafts(prev => ({ ...prev, [key]: stepData }))
            setForm(stepData)
          } else {
            setForm(key === 'structuraCladirii' ? { tipFundatieBeci: 'Kein Keller (nur Bodenplatte)', inaltimeEtaje: 'Standard (2,50 m)' } : {})
          }
        })
        .catch(() => {
          setForm(key === 'structuraCladirii' ? { tipFundatieBeci: 'Kein Keller (nur Bodenplatte)', inaltimeEtaje: 'Standard (2,50 m)' } : {})
        })
    } else {
      setForm(key === 'structuraCladirii' ? { tipFundatieBeci: 'Kein Keller (nur Bodenplatte)', inaltimeEtaje: 'Standard (2,50 m)' } : {})
    }
    setErrors({})
    setShowErrors(false)
  }, [idx, visibleSteps, offerId])


  // -- Helper Functions
  async function ensureOffer(): Promise<string> {
    if (offerIdRef.current) return offerIdRef.current
    if (activeCreationPromise.current) return activeCreationPromise.current

    if (creatingRef.current) {
      return new Promise((resolve) => {
        const iv = setInterval(() => {
          if (offerIdRef.current) {
            clearInterval(iv)
            resolve(offerIdRef.current!)
          }
        }, 50)
      })
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
    if (savingStepsRef.current.has(stepKey)) return
    savingStepsRef.current.add(stepKey)
    try {
      setSaveStatus('saving')
      const id = await ensureOffer()
      await apiFetch(`/offers/${id}/step`, { method: 'POST', body: JSON.stringify({ step_key: stepKey, data: dataObj }) })
      setDrafts(prev => ({ ...prev, [stepKey]: dataObj }))
      await maybeUpdateOfferTitle(id)
      if (stepKey === 'dateGenerale') {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = setTimeout(() => window.dispatchEvent(new Event('offers:refresh')), 500)
      }
      setSaveStatus('saved')
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 1600)
    } catch (e) {
      console.error('saveStepLive failed', e)
      setSaveStatus('error')
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
    } finally {
      setTimeout(() => savingStepsRef.current.delete(stepKey), 1000)
    }
  }

  function scheduleAutosave(stepKey: string, dataObj: Record<string, any>, delay = 500) {
    if (showErrors && Object.values(errors).some(Boolean)) return
    const s = JSON.stringify(dataObj || {})
    if (s === lastSavedRef.current) return
    lastSavedRef.current = s
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    saveDebounceRef.current = setTimeout(() => saveStepLive(stepKey, dataObj), delay)
  }

  function validateCurrentStep(): Errors {
    if (!step) return {}
    if (step.key === 'client') return validateClient(form)
    if (step.key === 'dateGenerale') {
      const e: Errors = {}
      const referinta = (form.referinta ?? '').trim()
      if (!referinta) e.referinta = 'Bitte geben Sie eine Referenz ein.'
      else if (referinta.length < 3) e.referinta = 'Die Referenz muss mindestens 3 Zeichen lang sein.'
      return e
    }
    if (step.key === 'upload') return {}
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
      if (!putRes.ok) {
        const bodyText = await putRes.text().catch(() => '')
        console.error(`Upload PUT failed for ${file.name}:`, putRes.status, putRes.statusText, bodyText)
        const detail = bodyText ? ` (${bodyText.slice(0, 120)})` : ` (${putRes.status} ${putRes.statusText})`
        throw new Error(`Upload failed for ${file.name}${detail}`)
      }

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
    if (!step) return
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current)
      saveDebounceRef.current = null
    }
    if (offerId) {
      try {
        await saveStepLive(step.key, form)
      } catch (_) {}
    }
    try {
      setSaving(true)
      setValidationError(null)

      const stepErrors = validateCurrentStep()
      setErrors(stepErrors)
      const hasErrors = Object.values(stepErrors).some(Boolean)
      if (hasErrors && step.key !== 'upload') {
        setShowErrors(true)
        setSaving(false)
        return
      }

      setShowErrors(false)
      stashDraft()

      if (step.key !== 'upload') {
        const id = await ensureOffer()
        const dataToSave = form
        await apiFetch(`/offers/${id}/step`, { method: 'POST', body: JSON.stringify({ step_key: step.key, data: dataToSave }) })
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
        alert('Bitte Plan hochladen.')
        setSaving(false)
        return
      }

      setProcessStatus(DE.common.uploadingFiles || 'Dateien werden hochgeladen...')
      let architecturalPlanData: { storagePath: string, mime: string } | null = null

      for (const item of filesToUpload) {
        const res = await uploadSingleFile(id, item.key, item.file)
        if (item.key.includes('planArhitectural') || item.key.includes('planArhitectura')) {
          if (!architecturalPlanData) architecturalPlanData = res
        }
      }

      if (architecturalPlanData?.storagePath) {
        setProcessStatus((DE.common as any).validatingPlan || 'Plan wird überprüft...')
        const aiRes = await apiFetch('/validate-plan', {
          method: 'POST',
          body: JSON.stringify({ storagePath: architecturalPlanData.storagePath, mimeType: architecturalPlanData.mime })
        })
        const aiJson = aiRes?.valid !== undefined ? aiRes : await (aiRes as any)?.json?.().catch(() => ({ valid: true }))
        if (aiJson?.valid === false) {
          setValidationError(aiJson.reason || DE.common.planInvalidMsg)
          setSaving(false)
          return
        }
      }

      const { run_id } = await apiFetch(`/offers/${id}/compute`, { method: 'POST', body: JSON.stringify({ payload: {} }) })
      setPdfUrl(null)
      setComputeFailed(false)
      setComputing(true)
      setComputeStartTime(Date.now())
      setComputeRunId(run_id)
      window.dispatchEvent(new CustomEvent('offer:compute-started', { detail: { offerId: id, runId: run_id } }))
      window.dispatchEvent(new Event('offers:refresh'))
    } catch (err: any) {
      console.error('Finalize failed:', err)
      const isNetwork = err?.message === 'Failed to fetch' || err?.name === 'TypeError'
      const msg = isNetwork
        ? 'API nicht erreichbar. Bitte Backend starten: cd holzbot-api && npm run start:dev'
        : `${DE.common.finalizeErrorPrefix}: ${err?.message ?? err}`
      alert(msg)
    } finally {
      setSaving(false)
    }
  }

  function onBack() {
    if (isFirst || saving) return
    stashDraft()
    setDir('back'); setIdx(i => i - 1); setAnimKey(k => k + 1)
  }

  async function handleResetToNewProject() {
    const id = offerIdRef.current
    try {
      if (id) {
        await apiFetch(`/offers/${id}/compute/cancel`, { method: 'POST' }).catch(() => {})
        await apiFetch(`/offers/${id}`, { method: 'DELETE' }).catch(() => {})
      }
    } catch (err: any) {
      console.error('Reset failed', err)
    }
    setOfferId(null)
    offerIdRef.current = null
    setIdx(0)
    setForm({})
    setDrafts({})
    setErrors({})
    setShowErrors(false)
    setValidationError(null)
    setComputeFailed(false)
    setComputeRunId(null)
    setPdfUrl(null)
    setComputing(false)
    setComputeStartTime(null)
    setProcessStatus('')
    setSaveStatus('idle')
    setSelectedPackage(null)
    creatingRef.current = false
    activeCreationPromise.current = null
    window.dispatchEvent(new CustomEvent('offer:new', { detail: { creationId: Date.now() } }))
    window.dispatchEvent(new Event('offers:refresh'))
  }

  async function onUpload(name: string, file: File | null) {
    if (!file) return
    try {
      setSaving(true)
      setSaveStatus('saving')

      const id = await ensureOffer()
      await uploadSingleFile(id, name, file)

      window.dispatchEvent(new Event('offers:refresh'))
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
    try {
      if (title) {
        await apiFetch(`/offers/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) })
      }
      if (dg && (dg.referinta?.trim() || dg.beci !== undefined)) {
        const currentOffer = (await apiFetch(`/offers/${id}`)) as any
        const currentMeta = currentOffer?.meta || {}
        const updatedMeta: any = { ...currentMeta }
        if (dg.referinta?.trim()) updatedMeta.referinta = dg.referinta.trim()
        if (dg.beci !== undefined) updatedMeta.beci = dg.beci === true || dg.beci === 'true' || dg.beci === 1
        await apiFetch(`/offers/${id}`, { method: 'PATCH', body: JSON.stringify({ meta: updatedMeta }) })
      }
    } catch (_) {}
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
  if (dynamicSteps.length === 0) {
    return (
      <div className="p-8 text-center text-red-300">
        Die Formulardefinition konnte nicht geladen werden. <br/>
        Prüfen Sie, ob <code>data/form-schema/holzbau-form-steps.json</code> existiert.
      </div>
    )
  }

  // 3. Main Wizard UI — direct Paket auswählen; după Haus-Angebot starten → wizard
  const showPackagePicker = !computing && !pdfUrl && !offerId && selectedPackage === null
  const showForm = (selectedPackage === 'neubau' || selectedPackage === 'dachstuhl' || selectedPackage === 'mengen' || offerId) && !computing && !pdfUrl

  return (
    <div className="wizard-wrap" style={{ height: '100%', minHeight: 0, maxHeight: '100%' }}>
      {!computing && !pdfUrl && !showPackagePicker && showForm && (
      <div className="px-2 mt-1">
        <div className="wizard-steps wizard-steps--inline relative pr-[1px] flex items-start justify-center gap-5 text-center hide-scroll">
          {progressBarSteps.map((step) => {
            const dotClass = step.isSkipped ? 'skipped' : step.isDone ? 'done' : step.isActive ? 'active' : ''
            const stepClass = `wizard-step v-start${step.isSkipped ? ' skipped' : ''}`
            return (
              <div key={step.key} className={stepClass}>
                <div className={`wizard-dot ${dotClass}`} />
                <div className="wizard-label">{step.label}</div>
              </div>
            )
          })}
        </div>

        <div className="wizard-progress mt-3 hide-scroll" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct}>
          <div className="wizard-progress__bar" style={{ width: `${progressPct}%` }} />
        </div>
      </div>
    )}

      <div
        className={
          showPackagePicker
            ? 'wizard-stage flex flex-col min-h-0 items-stretch relative justify-center'
            : 'wizard-stage flex flex-col min-h-0 items-stretch relative justify-start'
        }
        style={{ gridRow: 2, minHeight: 0 }}
      >
        {computeFailed && !pdfUrl ? (
          <div className="relative w-full flex flex-col items-center justify-center mt-32 gap-6 px-4" style={{ minHeight: '68vh' }}>
            <div className="wizard-card wizard-sunny max-w-lg w-full p-6 flex flex-col items-center gap-5 animate-fade-in">
              <div className="p-4 bg-orange-900/30 border border-orange-500/50 rounded-xl flex items-start gap-3 w-full">
                <AlertTriangle className="shrink-0 text-orange-400 h-6 w-6 mt-0.5" />
                <div>
                  <div className="font-bold text-orange-200 text-lg">{DE.common.computeErrorTitle}</div>
                  <div className="text-sm text-orange-100/80 mt-2">{DE.common.computeErrorMessage}</div>
                </div>
              </div>
              <button
                onClick={() => handleResetToNewProject()}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-[#ffffff] shadow-lg transition-all duration-200 ease-out bg-gradient-to-b from-[#e08414] to-[#f79116] hover:brightness-110 hover:-translate-y-[1px] hover:shadow-[0_4px_14px_rgba(216,162,94,0.3)] active:translate-y-[1px] active:scale-95"
              >
                {DE.common.computeErrorRetry}
              </button>
            </div>
          </div>
        ) : computing && !pdfUrl ? (
          <div className="relative w-full flex flex-col items-center justify-center mt-32 gap-6" style={{ minHeight: '68vh' }}>
            <img 
              src="/houseblueprint.gif" 
              alt={DE.common.processingAlt} 
              className="w-auto h-auto max-w-[92vw] max-h-[60vh] object-contain" 
            />
            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[#ffffff] shadow-lg transition-all duration-200 ease-out bg-gradient-to-b from-[#e08414] to-[#f79116] hover:brightness-110 hover:-translate-y-[1px] hover:shadow-[0_4px_14px_rgba(216,162,94,0.3)] active:translate-y-[1px] active:scale-95"
            >
              Abbrechen
            </button>
          </div>
        ) : pdfUrl ? (
          <div className="flex-1 w-full h-full p-[6px] box-border overflow-hidden">
            <SimplePdfViewer src={pdfUrl} className="w-full h-full rounded-xl" />
          </div>
        ) : showPackagePicker ? (
          <div className="w-full flex justify-center px-2">
          <div className="w-full max-w-5xl mx-auto pt-6 px-1" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 justify-items-center items-stretch">
                {/* 1) Mengenermittlung */}
                <div className="bg-black/40 rounded-2xl p-4 flex flex-col w-full max-w-[320px] h-full border border-[#FF9F0F]/40 shadow-[0_0_24px_rgba(255,159,15,0.2)]">
                  <div className="flex items-center justify-center mb-3">
                    <img src="/images/blueprint.png" alt="Mengenermittlung" className="w-20 h-20 rounded-full object-cover border-2 border-[#FF9F0F]/30" />
                  </div>
                  <div className="text-white font-extrabold text-lg text-center">Mengenermittlung</div>
                  <div className="text-sand/80 text-sm text-center mt-1.5 px-1">Ermittlung von Maßen für Hauspläne</div>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => { setSelectedPackage('mengen') }}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white shadow-lg transition-all duration-200 ease-out bg-gradient-to-b from-[#e08414] to-[#f79116] hover:brightness-110 hover:-translate-y-[1px] hover:shadow-[0_4px_14px_rgba(216,162,94,0.3)] active:translate-y-[1px] active:scale-95"
                  >
                    Kalkulation starten
                    <ChevronRight size={18} className="opacity-85" />
                  </button>
                </div>

                {/* 2) Dachstuhl */}
                <div className="bg-black/40 rounded-2xl p-4 flex flex-col w-full max-w-[320px] h-full border border-[#FF9F0F]/40 shadow-[0_0_24px_rgba(255,159,15,0.2)]">
                  <div className="flex items-center justify-center mb-3">
                    <img src="/images/roof.png" alt="Dachstuhl" className="w-20 h-20 rounded-full object-cover border-2 border-[#FF9F0F]/30" />
                  </div>
                  <div className="text-white font-extrabold text-lg text-center">Dachstuhl</div>
                  <div className="text-sand/80 text-sm text-center mt-1.5 px-1">Erstellung eines Schätzungsangebots für Dachstühle</div>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => { setSelectedPackage('dachstuhl') }}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white shadow-lg transition-all duration-200 ease-out bg-gradient-to-b from-[#e08414] to-[#f79116] hover:brightness-110 hover:-translate-y-[1px] hover:shadow-[0_4px_14px_rgba(216,162,94,0.3)] active:translate-y-[1px] active:scale-95"
                  >
                    Kalkulation starten
                    <ChevronRight size={18} className="opacity-85" />
                  </button>
                </div>

                {/* 3) Neubau */}
                <div className="bg-black/40 rounded-2xl p-4 flex flex-col w-full max-w-[320px] h-full border border-[#FF9F0F]/40 shadow-[0_0_24px_rgba(255,159,15,0.2)]">
                  <div className="flex items-center justify-center mb-3">
                    <img src="/images/house.png" alt="Neubau" className="w-20 h-20 rounded-full object-cover border-2 border-[#FF9F0F]/30" />
                  </div>
                  <div className="text-white font-extrabold text-lg text-center">Neubau</div>
                  <div className="text-sand/80 text-sm text-center mt-1.5 px-1">Erstellung eines Schätzungsangebots für Neubauten</div>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => { setSelectedPackage('neubau') }}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white shadow-lg transition-all duration-200 ease-out bg-gradient-to-b from-[#e08414] to-[#f79116] hover:brightness-110 hover:-translate-y-[1px] hover:shadow-[0_4px_14px_rgba(216,162,94,0.3)] active:translate-y-[1px] active:scale-95"
                  >
                    Kalkulation starten
                    <ChevronRight size={18} className="opacity-85" />
                  </button>
                </div>
              </div>
          </div>
          </div>
        ) : (
          <div key={`${step.key}-${animKey}`} className={`wizard-card wizard-sunny ${dir === 'back' ? 'card-in-back' : 'card-in-next'}`}>
            <div className="wizard-header">
              <div className="wizard-title text-sun">
                {tStepLabel(step.key, step.label)}
              </div>
            </div>
            <div className="wizard-body relative">
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
              
              {step.key === 'client' && (!step.fields || step.fields.length === 0) ? (
                <ClientStep
                  form={form}
                  setForm={(v) => { ensureOffer().catch(() => {}); setForm(v); scheduleAutosave('client', v) }}
                  errors={visibleErrors}
                  onEnter={onContinue}
                />
              ) : step.key === 'client' ? (
                <div className="space-y-4">
                  <DynamicFields
                    stepKey={step.key}
                    fields={step.fields}
                    form={form}
                    setForm={(v) => { ensureOffer().catch(() => {}); setForm(v); scheduleAutosave('client', v) }}
                    onUpload={onUpload}
                    ensureOffer={ensureOffer}
                    errors={visibleErrors}
                    onEnter={onContinue}
                    customOptionsForm={customOptionsForm}
                    paramLabelOverrides={paramLabelOverrides}
                    optionValueToPriceKey={optionValueToPriceKey}
                  />
                </div>
              ) : step.key === 'structuraCladirii' ? (
                <BuildingStructureStep
                  form={form}
                  setForm={(v, shouldAutosave = false) => { ensureOffer().catch(() => {}); setForm(v); if (shouldAutosave) scheduleAutosave('structuraCladirii', v) }}
                  errors={visibleErrors}
                  onBlur={() => scheduleAutosave('structuraCladirii', form)}
                />
              ) : step.key === 'materialeFinisaj' ? (
                <MaterialeFinisajStep
                  form={form}
                  setForm={(v) => { ensureOffer().catch(() => {}); setForm(v); scheduleAutosave(step.key, v) }}
                  errors={visibleErrors}
                  drafts={drafts}
                />
              ) : step.key === 'projektdaten' ? (
                <ProjektdatenStepContent
                  form={form}
                  setForm={(v) => { ensureOffer().catch(() => {}); setForm(v); scheduleAutosave('projektdaten', v) }}
                  errors={visibleErrors}
                  onEnter={onContinue}
                />
              ) : step.key !== 'upload' ? (
                <div className="space-y-4">
                  <DynamicFields
                    stepKey={step.key}
                    fields={step.fields}
                    form={form}
                    setForm={(v) => { ensureOffer().catch(() => {}); setForm(v); scheduleAutosave(step.key, v) }}
                    onUpload={onUpload}
                    ensureOffer={ensureOffer}
                    errors={visibleErrors}
                    onEnter={onContinue}
                    customOptionsForm={customOptionsForm}
                    paramLabelOverrides={paramLabelOverrides}
                    optionValueToPriceKey={optionValueToPriceKey}
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
                    customOptionsForm={customOptionsForm} 
                    paramLabelOverrides={paramLabelOverrides}
                    optionValueToPriceKey={optionValueToPriceKey}
                    errors={{}} 
                    onEnter={onContinue}
                  />
                </div>
              )}
            </div>
            
            <div className="wizard-footer flex items-center justify-between mt-4">
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
        .pretty-scroll::-webkit-scrollbar-thumb { background: #9aa0a6; border-radius: 8px; border: 2px solid #1b1f24; }
        .pretty-scroll::-webkit-scrollbar-thumb:hover { background: #bfc5cc; }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-panel rounded-xl p-6 max-w-md w-full mx-4 shadow-soft border border-white/10 animate-fade-in">
            <h3 className="text-lg font-bold text-sand mb-4">Angebot abbrechen?</h3>
            <p className="text-sand/80 mb-6">
              Möchten Sie dieses Angebot wirklich abbrechen? Alle Daten werden gelöscht und der Prozess wird gestoppt.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2.5 rounded-xl font-medium text-sand/80 hover:text-sand bg-black/10 hover:bg-black/20 border border-white/10 transition-colors"
              >
                Nein
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCancelConfirm(false)
                  handleResetToNewProject()
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[#ffffff] shadow-lg transition-all duration-200 ease-out bg-gradient-to-b from-[#e08414] to-[#f79116] hover:brightness-110 hover:-translate-y-[1px] hover:shadow-[0_4px_14px_rgba(216,162,94,0.3)] active:translate-y-[1px] active:scale-95"
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

function ClientStep({ form, setForm, errors, onEnter }:{ form: Record<string, any>; setForm: (v: Record<string, any>) => void; errors: Errors; onEnter: () => void }) {
  const fields = [
    { key: 'nume', label: 'Vor- und Nachname', placeholder: 'z.B. Max Mustermann' },
    { key: 'telefon', label: 'Telefonnummer', placeholder: 'z.B. +49 123 456789' },
    { key: 'email', label: 'E-Mail', placeholder: 'z.B. max@beispiel.de' },
    { key: 'localitate', label: 'Adresse', placeholder: 'Straße, PLZ Ort' },
  ] as const
  return (
    <div className="space-y-3">
      {fields.map(f => {
        const fieldErr = errors[f.key]
        const raw = form[f.key]
        const inputVal = (typeof raw === 'string' || typeof raw === 'number') ? String(raw) : ''
        return (
          <label key={f.key} className="flex flex-col gap-1" data-field={f.key}>
            <span className="wiz-label text-sun/90">{f.label}</span>
            <input
              className={`sun-input w-full ${fieldErr ? 'ring-2 ring-orange-400/60 focus:ring-orange-400/60' : ''}`}
              value={inputVal}
              placeholder={f.placeholder}
              onChange={(e) => {
                const v = e.target.value
                const next = { ...form, [f.key]: v }
                setForm(next)
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

const LEISTUNGEN_OPTIONS = [
  { name: 'leistungAbbund', label: 'Abbund' },
  { name: 'leistungLieferung', label: 'Lieferung' },
  { name: 'leistungMontage', label: 'Montage' },
  { name: 'leistungKranarbeiten', label: 'Kranarbeiten' },
  { name: 'leistungGeruest', label: 'Gerüst' },
  { name: 'leistungEntsorgung', label: 'Entsorgung' },
] as const

function ProjektdatenStepContent({
  form,
  setForm,
  errors,
  onEnter,
}: {
  form: Record<string, any>
  setForm: (v: Record<string, any>) => void
  errors: Errors
  onEnter: () => void
}) {
  return (
    <div className="space-y-5">
      <label className="flex flex-col gap-1" data-field="projektumfang">
        <span className="wiz-label text-sun/90">Projektumfang</span>
        <div className={errors.projektumfang ? 'ring-2 ring-orange-400/60 rounded-lg' : ''}>
          <SelectSun
            value={form.projektumfang ?? ''}
            onChange={(v) => setForm({ ...form, projektumfang: v })}
            options={['Dachstuhl', 'Dachdeckung', 'Dachstuhl + Dachdeckung']}
            placeholder="Wählen Sie eine Option"
          />
        </div>
        {errors.projektumfang && <span className="text-xs text-orange-400">{errors.projektumfang}</span>}
      </label>
      <label className="flex flex-col gap-1" data-field="nutzungDachraum">
        <span className="wiz-label text-sun/90">Nutzung des Dachraums</span>
        <div className={errors.nutzungDachraum ? 'ring-2 ring-orange-400/60 rounded-lg' : ''}>
          <SelectSun
            value={form.nutzungDachraum ?? ''}
            onChange={(v) => setForm({ ...form, nutzungDachraum: v })}
            options={['Nicht ausgebaut', 'Wohnraum / ausgebaut']}
            placeholder="Wählen Sie eine Option"
          />
        </div>
        {errors.nutzungDachraum && <span className="text-xs text-orange-400">{errors.nutzungDachraum}</span>}
      </label>

      <div className="pt-2 border-t border-white/10">
        <div className="wiz-label text-sun/90 mb-3">Leistungen enthalten</div>
        <div className="grid grid-cols-2 gap-3">
          {LEISTUNGEN_OPTIONS.map(({ name, label }) => (
            <label
              key={name}
              className="flex items-center gap-3 p-3 rounded-xl bg-black/20 border border-white/10 hover:border-[#FF9F0F]/30 transition-colors cursor-pointer"
              data-field={name}
            >
              <input
                type="checkbox"
                className="sun-checkbox shrink-0"
                checked={!!form[name]}
                onChange={(e) => setForm({ ...form, [name]: e.target.checked })}
                onKeyDown={(e) => handleInputEnter(e, onEnter)}
              />
              <span className="text-sm font-medium text-sand/90">{label}</span>
              {errors[name] && <span className="ml-auto text-xs text-orange-400">{errors[name]}</span>}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

function MaterialeFinisajStep({ form, setForm, errors, drafts }: { form: Record<string, any>; setForm: (v: Record<string, any>) => void; errors: Errors; drafts: Drafts }) {
  const structuraData = drafts?.structuraCladirii || {}
  const tipFundatieBeci = structuraData.tipFundatieBeci || form.tipFundatieBeci || 'Kein Keller (nur Bodenplatte)'
  const listaEtaje = Array.isArray(structuraData.listaEtaje) ? structuraData.listaEtaje : (Array.isArray(form.listaEtaje) ? form.listaEtaje : [])
  const hasBasement = tipFundatieBeci.includes('Keller') && !tipFundatieBeci.includes('Kein Keller')
  const basementLivable = tipFundatieBeci.includes('mit einfachem Ausbau')
  const hasMansarda = listaEtaje.some((e: string) => e.startsWith('mansarda'))
  const etajeIntermediare = listaEtaje.filter((e: string) => e === 'intermediar').length
  const totalFloors = 1 + etajeIntermediare
  const finishOptions = ['Tencuială', 'Lemn', 'Fibrociment', 'Mix']

  return (
    <div className="space-y-4">
      {hasBasement && basementLivable && (
        <label className="flex flex-col gap-1" data-field="finisajInteriorBeci">
          <span className="wiz-label text-sun/90">Innenausbau (Keller)</span>
          <div className={errors.finisajInteriorBeci ? 'ring-2 ring-orange-400/60 rounded-lg' : ''}>
            <SelectSun value={form.finisajInteriorBeci || ''} onChange={(v) => setForm({ ...form, finisajInteriorBeci: v })} options={finishOptions} displayFor={(opt) => tOption('materialeFinisaj', 'finisajInteriorBeci', opt)} />
          </div>
        </label>
      )}
      {Array.from({ length: totalFloors }, (_, idx) => {
        const floorLabel = idx === 0 ? 'Erdgeschoss' : `Obergeschoss ${idx}`
        const floorKey = idx === 0 ? 'ground' : `floor_${idx}`
        return (
          <div key={floorKey} className="flex gap-4 items-start">
            <label className="flex flex-col gap-1 flex-1">
              <span className="wiz-label text-sun/90">Innenausbau - {floorLabel}</span>
              <SelectSun value={form[`finisajInterior_${floorKey}`] || ''} onChange={(v) => setForm({ ...form, [`finisajInterior_${floorKey}`]: v })} options={finishOptions} displayFor={(opt) => tOption('materialeFinisaj', `finisajInterior_${floorKey}`, opt)} />
            </label>
            <label className="flex flex-col gap-1 flex-1">
              <span className="wiz-label text-sun/90">Fassade - {floorLabel}</span>
              <SelectSun value={form[`fatada_${floorKey}`] || ''} onChange={(v) => setForm({ ...form, [`fatada_${floorKey}`]: v })} options={finishOptions} displayFor={(opt) => tOption('materialeFinisaj', `fatada_${floorKey}`, opt)} />
            </label>
          </div>
        )
      })}
      {hasMansarda && (
        <div className="flex gap-4 items-start">
          <label className="flex flex-col gap-1 flex-1">
            <span className="wiz-label text-sun/90">Innenausbau - Dachgeschoss</span>
            <SelectSun value={form.finisajInteriorMansarda || ''} onChange={(v) => setForm({ ...form, finisajInteriorMansarda: v })} options={finishOptions} displayFor={(opt) => tOption('materialeFinisaj', 'finisajInteriorMansarda', opt)} />
          </label>
          <label className="flex flex-col gap-1 flex-1">
            <span className="wiz-label text-sun/90">Fassade - Dachgeschoss</span>
            <SelectSun value={form.fatadaMansarda || 'Tencuială'} onChange={(v) => setForm({ ...form, fatadaMansarda: v })} options={finishOptions} displayFor={(opt) => tOption('materialeFinisaj', 'fatadaMansarda', opt)} />
          </label>
        </div>
      )}
    </div>
  )
}

/* =============== Gebäudestruktur: listaEtaje + ilustrație casă (stack bottom-up) =============== */
const FLOOR_TYPE_OPTIONS = [
  { value: 'intermediar', label: 'Obergeschoss (Wohnfläche)' },
  { value: 'pod', label: 'Dachboden (Keine Wohnfläche)' },
  { value: 'mansarda_ohne', label: 'Dachgeschoss ohne Kniestock (Wohnfläche)' },
  { value: 'mansarda_mit', label: 'Dachgeschoss mit Kniestock (Wohnfläche)' },
] as const

function BuildingStructureStep({ form, setForm, errors, onBlur }: { form: Record<string, any>; setForm: (v: Record<string, any>, shouldAutosave?: boolean) => void; errors: Errors; onBlur?: () => void }) {
  const [showAddFloorDropdown, setShowAddFloorDropdown] = useState(false)
  const addFloorBtnRef = useRef<HTMLButtonElement>(null)
  const [addFloorPos, setAddFloorPos] = useState<{ left: number; top: number; width: number }>({ left: 0, top: 0, width: 0 })

  const tipFundatieBeci = form.tipFundatieBeci || 'Kein Keller (nur Bodenplatte)'
  const pilons = form.pilons === true
  const inaltimeEtaje = form.inaltimeEtaje || 'Standard (2,50 m)'
  const listaEtaje = Array.isArray(form.listaEtaje) ? form.listaEtaje : []
  const hasBasement = tipFundatieBeci.includes('Keller') && !tipFundatieBeci.includes('Kein Keller')
  const hasBase = true
  const basementUse = tipFundatieBeci.includes('mit einfachem Ausbau')
  const etajeIntermediare = listaEtaje.filter((e: string) => e === 'intermediar').length
  const hasPod = listaEtaje.some((e: string) => e === 'pod')
  const hasMansarda = listaEtaje.some((e: string) => e.startsWith('mansarda'))
  const mansardaType = listaEtaje.find((e: string) => e.startsWith('mansarda'))?.split('_')[1] ?? null
  const canAddFloors = !hasPod && !hasMansarda && listaEtaje.length < 4
  const floorsNumber = etajeIntermediare

  const getRandomImage = (options: string[], seed: string) => {
    let hash = 0
    for (let i = 0; i < seed.length; i++) { hash = ((hash << 5) - hash) + seed.charCodeAt(i); hash = hash & hash }
    return options[Math.abs(hash) % options.length]
  }
  const downImage = getRandomImage(['/builder/down1.png', '/builder/down2.png'], `down-${floorsNumber}`)
  const upImages: string[] = []
  for (let i = 0; i < floorsNumber; i++) upImages.push(getRandomImage(['/builder/up1.png', '/builder/up2.png', '/builder/up3.png'], `up-${i}-${floorsNumber}`))
  const mansardeImage = getRandomImage(['/builder/mansarde1.png', '/builder/mansarde2.png'], 'mansarde')
  const mansardeSmallImage = getRandomImage(['/builder/mansarde-small1.png', '/builder/mansarde-small2.png'], 'mansarde-small')

  const [originalSizes, setOriginalSizes] = useState<Record<string, { width: number; height: number }>>({})
  const [scaleFactor, setScaleFactor] = useState(1)
  const [heights, setHeights] = useState<Record<string, number>>({})
  const updateOriginalSize = useCallback((key: string, w: number, h: number) => {
    setOriginalSizes(prev => (prev[key]?.width === w && prev[key]?.height === h ? prev : { ...prev, [key]: { width: w, height: h } }))
  }, [])

  useEffect(() => {
    const targetWidth = 300
    const sizes = Object.values(originalSizes)
    if (sizes.length === 0) return
    const maxW = Math.max(...sizes.map(s => s.width))
    if (maxW > 0) setScaleFactor(targetWidth / maxW)
  }, [originalSizes])
  useEffect(() => {
    const next: Record<string, number> = {}
    Object.entries(originalSizes).forEach(([k, s]) => { next[k] = s.height * scaleFactor })
    setHeights(next)
  }, [originalSizes, scaleFactor])

  const groundHeight = heights.ground ?? 0
  const groundBottom = 0
  const basementHeight = heights.basement ?? 0
  // Beciul complet sub sol (nu suprapus cu parterul)
  const basementBottom = hasBasement ? groundBottom - basementHeight : -1
  const baseHeight = heights.base ?? 0
  let baseBottom = -10000
  if (hasBase && baseHeight > 0) {
    if (hasBasement) baseBottom = basementBottom - baseHeight
    else baseBottom = groundBottom + groundHeight - baseHeight
  }
  const pilonsHeight = heights.pilons ?? 0
  let pilonsBottom = -10000
  if (pilons && pilonsHeight > 0) {
    if (hasBase && baseHeight > 0 && baseBottom > -10000) pilonsBottom = baseBottom - pilonsHeight
    else if (hasBasement) pilonsBottom = basementBottom - pilonsHeight
    else pilonsBottom = groundBottom + groundHeight - pilonsHeight
  }
  const downBottom = groundBottom + groundHeight
  const upBottoms: number[] = []
  let currentBottom = downBottom + (heights.down ?? 0)
  for (let i = 0; i < floorsNumber; i++) {
    upBottoms.push(currentBottom)
    currentBottom += heights[`up-${i}`] ?? 0
  }
  const roofBottom = (hasPod || hasMansarda) ? currentBottom : -1
  let lowestBottom = 0
  if (hasBasement) lowestBottom = Math.min(lowestBottom, basementBottom)
  if (hasBase && baseBottom > -10000) lowestBottom = Math.min(lowestBottom, baseBottom)
  if (pilons && pilonsBottom > -10000) lowestBottom = Math.min(lowestBottom, pilonsBottom)
  let topElementTop = currentBottom
  if (hasPod && (heights.roof ?? 0) > 0) topElementTop += heights.roof
  else if (hasMansarda) {
    if (mansardaType === 'ohne' && (heights['mansarde-small'] ?? 0) > 0) topElementTop += heights['mansarde-small']
    else if ((heights.mansarde ?? 0) > 0) topElementTop += heights.mansarde
  }
  const heightFromLowest = topElementTop - lowestBottom
  const topMargin = (hasPod || hasMansarda) ? 30 : 75
  const paddingTopValue = Math.max(topMargin, topMargin - lowestBottom)
  // Spațiu suficient pentru elemente sub 0 (beci, fundație, piloni) + minim pentru frame
  const frameHeight = Math.max(heightFromLowest + topMargin + Math.max(0, -lowestBottom), 320)
  const getScaledWidth = (key: string) => (originalSizes[key] ? originalSizes[key].width * scaleFactor : 300)
  const containerWidth = Math.max(...Object.keys(originalSizes).length ? Object.keys(originalSizes).map(getScaledWidth) : [300], 300)
  const contentWidth = containerWidth + 40 + 420 + 40 + 40

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
    return () => { window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onResize) }
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
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [showAddFloorDropdown])

  const handleAddFloor = (floorType: string) => {
    setForm({ ...form, listaEtaje: [...listaEtaje, floorType] })
    setShowAddFloorDropdown(false)
  }

  return (
    <div className="w-full flex flex-col items-start">
      <div className="flex flex-col gap-4 !pb-0 w-full max-w-full">
        <div className="flex gap-10 items-center w-full">
        <div className="relative flex-shrink-0 border-2 border-white/20 rounded-xl overflow-hidden bg-panel/50" style={{ width: `${containerWidth}px`, height: `${frameHeight}px` }}>
          <div className="relative w-full h-full" style={{ paddingTop: `${paddingTopValue}px` }}>
            <img src="/builder/ground.png" alt="Ground" className="absolute" style={{ width: `${getScaledWidth('ground')}px`, height: 'auto', bottom: `${groundBottom}px`, left: '50%', transform: 'translateX(-50%)', zIndex: 1 }} onLoad={(e) => { const img = e.currentTarget; if (img?.naturalWidth > 0 && img.naturalHeight > 0) updateOriginalSize('ground', img.naturalWidth, img.naturalHeight) }} />
            {hasBase && <img src="/builder/base.png" alt="Base" className="absolute" style={{ width: `${getScaledWidth('base')}px`, height: 'auto', bottom: `${baseBottom}px`, left: '50%', transform: 'translateX(-50%)', zIndex: 60 }} onLoad={(e) => { const img = e.currentTarget; if (img?.naturalWidth > 0 && img.naturalHeight > 0) updateOriginalSize('base', img.naturalWidth, img.naturalHeight) }} />}
            {pilons && <img src="/builder/pilons.png" alt="Pilons" className="absolute" style={{ width: `${getScaledWidth('pilons')}px`, height: 'auto', bottom: `${pilonsBottom}px`, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }} onLoad={(e) => { const img = e.currentTarget; if (img?.naturalWidth > 0 && img.naturalHeight > 0) updateOriginalSize('pilons', img.naturalWidth, img.naturalHeight) }} />}
            {hasBasement && <img src={basementUse ? '/builder/basement-live.png' : '/builder/basement-empty.png'} alt="Basement" className="absolute" style={{ width: `${getScaledWidth('basement')}px`, height: 'auto', bottom: `${basementBottom}px`, left: '50%', transform: 'translateX(-50%)', zIndex: 100 }} onLoad={(e) => { const img = e.currentTarget; if (img?.naturalWidth > 0 && img.naturalHeight > 0) updateOriginalSize('basement', img.naturalWidth, img.naturalHeight) }} />}
            <img src={downImage} alt="Down" className="absolute" style={{ width: `${getScaledWidth('down')}px`, height: 'auto', bottom: `${downBottom}px`, left: '50%', transform: 'translateX(-50%)', zIndex: 3 }} onLoad={(e) => { const img = e.currentTarget; if (img?.naturalWidth > 0 && img.naturalHeight > 0) updateOriginalSize('down', img.naturalWidth, img.naturalHeight) }} />
            {upImages.map((img, i) => (
              <img key={`up-${i}`} src={img} alt={`Floor ${i + 1}`} className="absolute" style={{ width: `${getScaledWidth(`up-${i}`)}px`, height: 'auto', bottom: `${upBottoms[i] ?? 0}px`, left: '50%', transform: 'translateX(-50%)', zIndex: 4 + i }} onLoad={(e) => { const im = e.currentTarget; if (im?.naturalWidth > 0 && im.naturalHeight > 0) updateOriginalSize(`up-${i}`, im.naturalWidth, im.naturalHeight) }} />
            ))}
            {hasPod && roofBottom >= 0 && <img src="/builder/roof.png" alt="Dachboden" className="absolute" style={{ width: `${getScaledWidth('roof')}px`, height: 'auto', bottom: `${roofBottom}px`, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }} onLoad={(e) => { const img = e.currentTarget; if (img?.naturalWidth > 0 && img.naturalHeight > 0) updateOriginalSize('roof', img.naturalWidth, img.naturalHeight) }} />}
            {hasMansarda && roofBottom >= 0 && (mansardaType === 'ohne' ? <img src={mansardeSmallImage} alt="Dachgeschoss ohne Kniestock" className="absolute" style={{ width: `${getScaledWidth('mansarde-small')}px`, height: 'auto', bottom: `${roofBottom}px`, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }} onLoad={(e) => { const img = e.currentTarget; if (img?.naturalWidth > 0 && img.naturalHeight > 0) updateOriginalSize('mansarde-small', img.naturalWidth, img.naturalHeight) }} /> : <img src={mansardeImage} alt="Dachgeschoss mit Kniestock" className="absolute" style={{ width: `${getScaledWidth('mansarde')}px`, height: 'auto', bottom: `${roofBottom}px`, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }} onLoad={(e) => { const img = e.currentTarget; if (img?.naturalWidth > 0 && img.naturalHeight > 0) updateOriginalSize('mansarde', img.naturalWidth, img.naturalHeight) }} />)}
          </div>
        </div>

      <div className="flex-1 space-y-4 !pb-0 !mb-0">
        <label className="flex flex-col gap-1" data-field="inaltimeEtaje">
          <span className="wiz-label text-sun/90">Geschosshöhe</span>
          <div className={errors.inaltimeEtaje ? 'ring-2 ring-orange-400/60 rounded-lg' : ''}>
            <SelectSun
              value={inaltimeEtaje}
              onChange={(v) => setForm({ ...form, inaltimeEtaje: v })}
              options={['Standard (2,50 m)', 'Komfort (2,70 m)', 'Hoch (2,85+ m)']}
              placeholder="Wählen Sie eine Option"
            />
          </div>
          {errors.inaltimeEtaje && <span className="text-xs text-orange-400">{errors.inaltimeEtaje}</span>}
        </label>

        <label className="flex flex-col gap-1" data-field="tipFundatieBeci">
          <span className="wiz-label text-sun/90">Untergeschoss / Fundament</span>
          <div className={errors.tipFundatieBeci ? 'ring-2 ring-orange-400/60 rounded-lg' : ''}>
            <SelectSun
              value={tipFundatieBeci}
              onChange={(v) => setForm({ ...form, tipFundatieBeci: v })}
              options={['Kein Keller (nur Bodenplatte)', 'Keller (unbeheizt / Nutzkeller)', 'Keller (mit einfachem Ausbau)']}
              placeholder="Wählen Sie eine Option"
            />
          </div>
          {errors.tipFundatieBeci && <span className="text-xs text-orange-400">{errors.tipFundatieBeci}</span>}
        </label>

        <label className="flex items-center gap-2 mt-1" data-field="pilons">
          <input
            type="checkbox"
            className="sun-checkbox"
            checked={pilons}
            onChange={(e) => setForm({ ...form, pilons: e.target.checked })}
          />
          <span className="text-sm font-medium text-sun/90">Pfahlgründung erforderlich</span>
          {errors.pilons && <span className="ml-2 text-xs text-orange-400">{errors.pilons}</span>}
        </label>

        <div className="space-y-2 pt-2 border-t border-[#e3c7ab22]">
          {errors.listaEtaje && <span className="text-xs text-orange-400">{errors.listaEtaje}</span>}
          {listaEtaje.length === 0 && <p className="text-sand/60 text-sm">Keine Elemente hinzugefügt</p>}
          {listaEtaje.map((etaj: string, idx: number) => (
            <div key={idx} className="flex flex-col gap-2 p-2 bg-panel/50 rounded-lg border border-white/10">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <SelectSun
                    value={etaj}
                    onChange={(v) => {
                      const newLista = [...listaEtaje]
                      if (v === 'pod' || v.startsWith('mansarda')) {
                        newLista[idx] = v
                        setForm({ ...form, listaEtaje: newLista.slice(0, idx + 1) })
                      } else {
                        newLista[idx] = v
                        setForm({ ...form, listaEtaje: newLista })
                      }
                    }}
                    options={['intermediar', 'pod', 'mansarda_ohne', 'mansarda_mit']}
                    displayFor={(opt: string) => {
                      if (opt === 'intermediar') return 'Obergeschoss (Wohnfläche)'
                      if (opt === 'pod') return 'Dachboden (Keine Wohnfläche)'
                      if (opt === 'mansarda_ohne') return 'Dachgeschoss ohne Kniestock (Wohnfläche)'
                      if (opt === 'mansarda_mit') return 'Dachgeschoss mit Kniestock (Wohnfläche)'
                      return opt
                    }}
                    placeholder="Wählen Sie eine Option"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, listaEtaje: listaEtaje.filter((_: any, i: number) => i !== idx) })}
                  className="px-2 py-1 text-orange-400 hover:text-orange-300 text-sm font-bold"
                >
                  ×
                </button>
              </div>
              {etaj === 'mansarda_mit' && (
                <label className="flex flex-col gap-1">
                  <span className="wiz-label text-sun/90 text-xs">Kniestock (cm)</span>
                  <input
                    type="number"
                    className="sun-input"
                    min={0}
                    max={300}
                    step={1}
                    value={form[`inaltimePeretiMansarda_${idx}`] ?? ''}
                    onChange={(e) => setForm({ ...form, [`inaltimePeretiMansarda_${idx}`]: parseFloat(e.target.value) || 0 })}
                    placeholder="z.B. 150"
                  />
                </label>
              )}
            </div>
          ))}
          {canAddFloors && (
            <>
              <button
                ref={addFloorBtnRef}
                type="button"
                onClick={() => setShowAddFloorDropdown(!showAddFloorDropdown)}
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
                  {FLOOR_TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      className="sun-menu-item"
                      onClick={() => handleAddFloor(opt.value)}
                    >
                      <span className="whitespace-normal text-left">{opt.label}</span>
                    </button>
                  ))}
                </div>,
                document.body
              )}
            </>
          )}
        </div>
        </div>
      </div>
    </div>
    </div>
  )
}

function DynamicFields({
  stepKey, fields, form, setForm, onUpload, ensureOffer, errors, onEnter, customOptionsForm = {},
  paramLabelOverrides = {}, optionValueToPriceKey = {}
}: {
  stepKey: string
  fields: Field[]
  form: Record<string, any>
  setForm: (v: Record<string, any>) => void
  onUpload: (name: string, file: File | null) => void
  ensureOffer: () => Promise<string>
  errors: Errors
  onEnter: () => void
  customOptionsForm?: Record<string, Array<{ label: string; value: string }>>
  paramLabelOverrides?: Record<string, string>
  optionValueToPriceKey?: Record<string, Record<string, string>>
}) {
  
  let currentFields = fields;
  if (stepKey === 'upload') {
      currentFields = fields.filter(f => f.name === 'planArhitectural' || f.name === 'planArhitectura');
      if (currentFields.length === 0 && fields.length > 0) {
          currentFields = [fields[0]];
      }
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {currentFields.map(f => {
        if (f.type === 'upload') {
             return (
                 <SimpleUploadField 
                    key={f.name} 
                    stepKey={stepKey} 
                    field={f as Extract<Field, { type: 'upload' }>}
                    files={form[f.name] || []}
                    onChange={(newFiles) => setForm({ ...form, [f.name]: newFiles })}
                 />
             )
        }

        if (f.type === 'select') {
          const hasErr = !!errors[f.name]
          const displayLabel = tFieldLabel(stepKey, f.name, f.label)
          const displayPlaceholder = tPlaceholder(stepKey, f.name, ('placeholder' in f && (f as any).placeholder) ? (f as any).placeholder : undefined)
          const rawVal = form[f.name]
          const selectValue = (rawVal != null && typeof rawVal === 'object' && 'value' in rawVal) ? String((rawVal as any).value) : (rawVal != null ? String(rawVal) : '')

          // Kamin/Ofen: afișare cu prețuri (ca pe VPS)
          const isFireplaceField = f.name === 'tipSemineu'
          const fireplaceLabels: Record<string, string> = {
            'Kein Kamin': 'Kein Kamin',
            'Klassischer Holzofen': 'Klassischer Holzofen – ca. 8.500 €',
            'Moderner Design-Kaminofen': 'Moderner Design-Kaminofen – ca. 12.000 €',
            'Pelletofen (automatisch)': 'Pelletofen (automatisch) – ca. 11.000 €',
            'Einbaukamin': 'Einbaukamin – ca. 14.000 €',
            'Kachel-/wassergeführter Kamin': 'Kachel-/wassergeführter Kamin – ca. 18.000 €',
          }

          return (
            <label key={f.name} className="flex flex-col gap-1" data-field={f.name}>
              <span className="wiz-label text-sun/90">{displayLabel}</span>
              <div className={hasErr ? 'ring-2 ring-orange-400/60 rounded-lg' : ''}>
                <SelectSun
                  value={selectValue}
                  onChange={async v => {
                    const next = { ...form, [f.name]: v }
                    setForm(next)
                    const id = await ensureOffer()
                    await apiFetch(`/offers/${id}/step`, { method: 'POST', body: JSON.stringify({ step_key: stepKey, data: next }) })
                    window.dispatchEvent(new Event('offers:refresh'))
                  }}
                  options={[
                    ...((f as any).options ?? []),
                    ...((customOptionsForm[(f as any).tag] || []).map((o: { label: string; value: string }) => o.label)),
                  ]}
                  placeholder={displayPlaceholder ?? DE.common.selectPlaceholder}
                  displayFor={(opt) => {
                    const val = typeof opt === 'string' ? opt : optValue(opt)
                    const tag = (f as any).tag
                    const priceKey = tag && optionValueToPriceKey[tag]?.[val]
                    const override = priceKey && paramLabelOverrides[priceKey]
                    if (override) return override
                    if (isFireplaceField && fireplaceLabels[val]) return fireplaceLabels[val]
                    const objLabel = typeof opt === 'object' && opt !== null && (opt as any).label != null && (opt as any).label !== '' ? String((opt as any).label) : null
                    return objLabel ?? tOption(stepKey, f.name, val)
                  }}
                />
              </div>
              {hasErr && <span className="text-xs text-orange-400">{errors[f.name]}</span>}
              {isFireplaceField && form[f.name] && form[f.name] !== 'Kein Kamin' && (
                <span className="text-xs text-sand/70 mt-1">
                  *Schornstein wird dazugerechnet mit Anzahl der Stockwerke (4.500 € Standardpreis + 1.500 € pro Geschoss)
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

        const rawFieldVal = form[f.name]
        const inputValue = (typeof rawFieldVal === 'string' || typeof rawFieldVal === 'number') ? String(rawFieldVal) : ''
        const common: any = {
          className: `sun-input ${errors[f.name] ? 'ring-2 ring-orange-400/60 focus:ring-orange-400/60' : ''}`,
          value: inputValue,
          placeholder: displayPlaceholder,
          onChange: (e: any) => {
            const raw = e.target.value
            const val = f.type === 'number' ? (raw === '' ? '' : Number(raw)) : raw
            const next = { ...form, [f.name]: val }
            setForm(next)
          },
          onKeyDown: (e: React.KeyboardEvent) => handleInputEnter(e, onEnter)
        }

        return (
          <label key={f.name} className="flex flex-col gap-1" data-field={f.name}>
            <span className="wiz-label text-sun/90">{displayLabel}</span>
            {f.type === 'textarea'
              ? <textarea {...common} className={`sun-textarea ${errors[f.name] ? 'ring-2 ring-orange-400/60 focus:ring-orange-400/60' : ''}`} />
              : <input
                  type={f.type === 'number' ? 'number' : 'text'}
                  {...common}
                  {...(f.type === 'number' && 'min' in f && f.min != null ? { min: f.min } : {})}
                  {...(f.type === 'number' && 'max' in f && f.max != null ? { max: f.max } : {})}
                />}
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