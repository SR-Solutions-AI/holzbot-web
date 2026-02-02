'use client'

import { useEffect, useMemo, useRef, useState, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { apiFetch } from '../lib/supabaseClient'
// Wir importieren nur den Typ, keine statischen Daten
import { type Field } from '../dashboard/formConfig'
import { CheckCircle2, ChevronLeft, ChevronRight, ChevronDown, Loader2, AlertTriangle } from 'lucide-react'
import SimplePdfViewer from './SimplePdfViewer'

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
    sistemConstructiv: 'Bausystem',
    materialeFinisaj: 'Materialien & Ausbaustufe',
    performantaEnergetica: 'Energieeffizienz',
    performanta: 'Energieeffizienz',
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
  return fallback
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
  
  if (!nume) e.nume = 'Bitte den Namen eingeben.'
  // Rest ist optional für schnellen Test
  return e
}

function validateGeneric(_stepKey: string, fields: Field[], form: Record<string, any>): Errors {
  const e: Errors = {}
  for (const f of fields) {
    if ((f as any).optional) continue
    if (f.type === 'bool') continue
    if (f.type === 'upload') continue

    const v = (form as any)[f.name]
    if (v === undefined || v === null || String(v).trim() === '') {
      // e[f.name] = 'Pflichtfeld.' // Deaktiviert für einfacheres Testen, falls gewünscht
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
  const [idx, setIdx] = useState(0)
  const [form, setForm] = useState<Record<string, any>>({})
  const [drafts, setDrafts] = useState<Drafts>({})
  
  const [saving, setSaving] = useState(false)
  const [processStatus, setProcessStatus] = useState<string>('')

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const lastProcessedCreationId = useRef<number>(0)
  const activeCreationPromise = useRef<Promise<string> | null>(null)

  // -- UseMemo hooks (safe to run even if dynamicSteps is empty)
  const step = dynamicSteps[idx]
  const isFirst = idx === 0
  const isLast = idx === (dynamicSteps.length > 0 ? dynamicSteps.length - 1 : 0)

  const progressPct = useMemo(
    () => (dynamicSteps.length > 1 ? Math.round((idx / (dynamicSteps.length - 1)) * 100) : 0),
    [idx, dynamicSteps.length]
  )

  const stepsMeta = useMemo(
    () => dynamicSteps.map(s => tStepLabel((s as any).key, s.label)),
    [dynamicSteps]
  )

  const visibleErrors = showErrors ? errors : {}

  // -- UseEffect Hooks
  
  // 1. Fetch Formular
  useEffect(() => {
    async function loadForm() {
      try {
        const schema = await apiFetch('/forms/latest')
        if (schema && schema.steps) {
          setDynamicSteps(schema.steps)
        }
      } catch (e) {
        console.error('Failed to load form definition', e)
        alert('Eroare la încărcarea formularului.')
      } finally {
        setLoadingForm(false)
      }
    }
    loadForm()
  }, [])

  // 2. New Project Listener
  useEffect(() => {
    const handleNewProject = (e: Event) => {
      const detail = (e as CustomEvent).detail
      const creationId = detail?.creationId

      if (creationId && lastProcessedCreationId.current === creationId) return
      if (creationId) lastProcessedCreationId.current = creationId

      setOfferId(null)
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
      if (!id) return;
      try {
        const fresh = await fetchFreshPdfUrl(id)
        if (fresh) {
            setPdfUrl(fresh)
            setComputing(false)
        } else {
            setPdfUrl(null)
        }
      } catch {
        setPdfUrl(null)
      }
    }
    window.addEventListener('offer:selected', onSel)
    return () => window.removeEventListener('offer:selected', onSel)
  }, [])

  // 6. Update Form State on Step Change
  useEffect(() => {
    if (dynamicSteps.length === 0) return
    const key = dynamicSteps[idx]?.key
    if(key) {
        setForm(drafts[key] ?? {})
        setErrors({})
        setShowErrors(false)
    }
  }, [idx, dynamicSteps, drafts])


  // -- Helper Functions
  async function ensureOffer(): Promise<string> {
    if (offerId) return offerId
    if (activeCreationPromise.current) return activeCreationPromise.current

    if (creatingRef.current) {
      return new Promise((resolve) => {
        const iv = setInterval(() => { if (offerId) { clearInterval(iv); resolve(offerId) } }, 50)
      }) as Promise<string>
    }
    
    creatingRef.current = true
    
    const promise = (async () => {
        try {
            const created = await apiFetch('/offers', { 
                method: 'POST', 
                body: JSON.stringify({ title: 'Ofertă nouă' }) 
            })
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
    try {
      setSaveStatus('saving')
      const id = await ensureOffer()
      await apiFetch(`/offers/${id}/step`, { method: 'POST', body: JSON.stringify({ step_key: stepKey, data: dataObj }) })
      await maybeUpdateOfferTitle(id)
      window.dispatchEvent(new Event('offers:refresh'))
      setSaveStatus('saved')
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 1600)
    } catch (e) {
      console.error('saveStepLive failed', e)
      setSaveStatus('error')
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
    }
  }
  
  function scheduleAutosave(stepKey: string, dataObj: Record<string, any>, delay = 500) {
    const s = JSON.stringify(dataObj || {})
    if (s === lastSavedRef.current) return
    lastSavedRef.current = s
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    saveDebounceRef.current = setTimeout(() => { saveStepLive(stepKey, dataObj) }, delay)
  }

  function validateCurrentStep(): Errors {
    if (step.key === 'client') return validateClient(form)
    if (step.key === 'upload') return {}
    return validateGeneric(step.key, step.fields, form)
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
    if(!step) return
    try {
      setSaving(true)
      setValidationError(null)
      stashDraft()

      const stepErrors = validateCurrentStep()
      setErrors(stepErrors)
      const hasErrors = Object.values(stepErrors).some(Boolean)
      if (hasErrors && step.key !== 'upload') {
        setShowErrors(true)
        setSaving(false)
        return
      }

      if (step.key !== 'upload') {
        const id = await ensureOffer()
        await apiFetch(`/offers/${id}/step`, { 
          method: 'POST', 
          body: JSON.stringify({ step_key: step.key, data: drafts[step.key] ?? form }) 
        })
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
          
          const aiRes = await apiFetch('/validate-plan', {
              method: 'POST',
              body: JSON.stringify({ 
                  storagePath: architecturalPlanData.storagePath, 
                  mimeType: architecturalPlanData.mime 
              })
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
    setDir('back'); setIdx(i => i - 1); setAnimKey(k => k + 1)
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
    if (!title) return
    try {
      await apiFetch(`/offers/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) })
      window.dispatchEvent(new Event('offers:refresh'))
    } catch {}
  }

  // --- RENDERING ---
  
  // 1. Loading State
  if (loadingForm) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-sun mx-auto mb-2" />
          <div className="text-sand/80">Se încarcă formularul...</div>
        </div>
      </div>
    )
  }

  // 2. Error State (No Data)
  if (dynamicSteps.length === 0) {
    return (
      <div className="p-8 text-center text-red-300">
        Nu s-a putut încărca definiția formularului. <br/>
        Verifică dacă API-ul rulează (port 4000) și dacă există date în tabelul <code>form_definitions</code>.
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
          <div className="relative w-full flex items-center justify-center mt-32" style={{ minHeight: '68vh' }}>
            <img 
              src="/houseblueprint.gif" 
              alt={DE.common.processingAlt} 
              className="w-auto h-auto max-w-[92vw] max-h-[60vh] object-contain" 
            />
          </div>
        ) : pdfUrl ? (
          <div className="flex-1 w-full h-full p-[6px] box-border overflow-hidden">
            <SimplePdfViewer src={pdfUrl} className="w-full h-full rounded-xl" />
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
              
              {step.key === 'client' ? (
                <ClientStep
                  form={form}
                  setForm={(v) => { ensureOffer().catch(() => {}); setForm(v); scheduleAutosave('client', v) }}
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
    </div>
  )
}

function ClientStep({ form, setForm, errors, onEnter }:{ form: Record<string, any>; setForm: (v: Record<string, any>) => void; errors: Errors; onEnter: () => void }) {
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

function DynamicFields({
  stepKey, fields, form, setForm, onUpload, ensureOffer, errors, onEnter
}: {
  stepKey: string
  fields: Field[]
  form: Record<string, any>
  setForm: (v: Record<string, any>) => void
  onUpload: (name: string, file: File | null) => void
  ensureOffer: () => Promise<string>
  errors: Errors
  onEnter: () => void
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
        if (stepKey === 'sistemConstructiv' && f.type === 'select' && f.name === 'tipAcoperis') {
          return (
            <div key={f.name} className="flex flex-col gap-1" data-field={f.name}>
              <div className="flex items-center justify-between">
                <span className="wiz-label text-sun/90">{tFieldLabel(stepKey, f.name, f.label)}</span>
                <span className="text-xs text-neutral-300/70">{form[f.name] ? `${DE.common.selected}: ${tOption(stepKey, f.name, form[f.name])}` : DE.common.notSelected}</span>
              </div>

              <RoofGridSelect
                value={form[f.name] ?? ''}
                onChange={async (v) => {
                  const next = { ...form, [f.name]: v }
                  setForm(next)
                  const id = await ensureOffer()
                  await apiFetch(`/offers/${id}/step`, { method: 'POST', body: JSON.stringify({ step_key: stepKey, data: next }) })
                  window.dispatchEvent(new Event('offers:refresh'))
                }}
              />

              {errors[f.name] && <span className="text-xs text-orange-400 mt-1">{errors[f.name]}</span>}
            </div>
          )
        }

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
                    window.dispatchEvent(new Event('offers:refresh'))
                  }}
                  options={(f as any).options}
                  placeholder={displayPlaceholder ?? DE.common.selectPlaceholder}
                  displayFor={(opt) => tOption(stepKey, f.name, opt)}
                />
              </div>
              {hasErr && <span className="text-xs text-orange-400">{errors[f.name]}</span>}
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
            setForm(next)
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
        {displayLabel} {(field as any).optional && <span className="opacity-70 font-normal">(optional)</span>}
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