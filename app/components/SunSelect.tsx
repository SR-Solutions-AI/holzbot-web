'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, ChevronDown } from 'lucide-react'

function optValue(opt: string | { value?: string; label?: string }): string {
  if (opt == null) return ''
  if (typeof opt === 'object' && 'value' in opt) return String((opt as { value?: string }).value ?? '')
  return String(opt)
}

export function SelectSun({
  value,
  onChange,
  options,
  placeholder = '— auswählen —',
  displayFor,
}: {
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

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

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
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const show = (raw?: string) => (raw ? (displayFor ? displayFor(raw) : raw) : placeholder)

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        className={`sun-select ${open ? 'sun-select--open' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`truncate ${value ? 'text-ink' : 'text-neutral-500'}`}>{show(value)}</span>
        <ChevronDown size={16} className="shrink-0 opacity-80" />
      </button>

      {open &&
        typeof window !== 'undefined' &&
        createPortal(
          <div
            className="sun-menu themed-scroll"
            role="listbox"
            style={{ position: 'fixed', left: pos.left, top: pos.top, width: pos.width, zIndex: 9999 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {(options ?? []).map((opt, i) => {
              const val = optValue(opt)
              const active = val === value
              const label = displayFor
                ? displayFor(val)
                : typeof opt === 'object' && opt !== null && 'label' in opt
                  ? String((opt as { label?: string }).label ?? val)
                  : val
              return (
                <button
                  key={val != null && val !== '' ? `opt-${String(val)}-${i}` : `opt-${i}`}
                  type="button"
                  className={`sun-menu-item ${active ? 'is-active' : ''}`}
                  onClick={() => {
                    onChange(val)
                    setOpen(false)
                  }}
                >
                  <span className="truncate">{label}</span>
                  {active && <CheckCircle2 size={16} className="shrink-0" />}
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}
