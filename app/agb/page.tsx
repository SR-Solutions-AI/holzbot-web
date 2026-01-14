'use client'

import Link from 'next/link'
import { ArrowLeft, Mail } from 'lucide-react'
import { motion, Variants } from 'framer-motion'

// Constante necesare pentru Footer
const LOGO_IMAGE_URL = '/logo.png'

// Variabile de animație
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
}

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
}

/* --- FOOTER COMPONENT (Reutilizat) --- */
function FooterSection() {
  return (
    <footer className="w-full bg-[#0a0604] pt-24 pb-12 px-6 border-t border-[#FF9F0F]/10 relative overflow-hidden mt-20">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#FF9F0F]/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="max-w-[1600px] mx-auto relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-20">
            <div className="max-w-xl flex flex-col items-center md:items-start text-center md:text-left">
               <img src={LOGO_IMAGE_URL} className="h-14 w-auto mb-8 object-contain" alt="HolzBot Logo" />
               <p className="text-sand/80 text-lg leading-relaxed mb-8 font-medium">
                 Holzbot — Ihr Partner für digitale & KI-Transformation in der Bauindustrie.
               </p>
            </div>
            <div className="flex flex-col items-center md:items-end text-center md:text-right w-full md:w-auto">
               <h4 className="text-[#FF9F0F] font-bold text-2xl mb-4">Kontakt</h4>
               <a href="mailto:christian@holzbot.com" className="text-white hover:text-[#FF9F0F] font-bold text-2xl lg:text-3xl underline decoration-[#FF9F0F] decoration-2 underline-offset-8 transition-all">
                  christian@holzbot.com
               </a>
            </div>
        </div>
        <div className="h-px w-full bg-white/10 mb-10" />
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-sand/40">
           <p>Copyright 2025 | SR SOLUTIONS AI SRL | UID: RO50767531</p>
           <div className="flex gap-6">
              <Link href="/agb" className="hover:text-white transition-colors">AGB</Link>
              <Link href="/impressum" className="hover:text-white transition-colors">Impressum</Link>
              <Link href="/datenschutz" className="hover:text-white transition-colors">Datenschutz</Link>
           </div>
        </div>
      </div>
    </footer>
  )
}

export default function AGBPage() {
  return (
    <div className="min-h-screen bg-[#0a0604] text-white/90 font-sans selection:bg-[#FF9F0F]/30 overflow-x-hidden">
      
      <div className="max-w-4xl mx-auto px-6 pt-20 pb-10">
        
        {/* Header / Back Button */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <Link href="/" className="inline-flex items-center gap-2 text-[#FF9F0F] hover:text-[#FF9F0F]/80 transition-colors font-medium group">
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" /> Zurück zur Startseite
          </Link>
        </motion.div>

        {/* Title Section */}
        <motion.div 
          initial="hidden" 
          animate="visible" 
          variants={staggerContainer}
          className="mb-16"
        >
            <motion.h1 variants={fadeInUp} className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 text-white leading-tight">
              Allgemeine <br/> <span className="text-[#FF9F0F]">Geschäftsbedingungen</span>
            </motion.h1>
            <motion.p variants={fadeInUp} className="text-white/60 text-lg">Stand: 22. November 2025</motion.p>
        </motion.div>

        {/* Content */}
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="space-y-12 text-lg leading-relaxed text-sand/80"
        >
          
          <motion.div variants={fadeInUp} className="p-8 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-sm">
            <p className="font-bold text-white text-xl mb-1">SR SOLUTIONS AI S.R.L.</p>
            <p className="text-sand/60">Strada Republicii 35, 437335 Șomcuta Mare, Maramureș, Rumänien</p>
          </motion.div>

          <motion.section variants={fadeInUp}>
            <h2 className="text-2xl font-bold text-[#FF9F0F] mb-4">§1 Geltungsbereich</h2>
            <p>Diese AGB gelten für alle Verträge über die Nutzung der Software „Holzbot“ zwischen SR Solutions und dem Kunden.</p>
          </motion.section>

          <motion.section variants={fadeInUp}>
            <h2 className="text-2xl font-bold text-[#FF9F0F] mb-4">§2 Vertragsgegenstand</h2>
            <p className="mb-4">(1) Holzbot ist eine cloudbasierte Software, die ausschließlich über die Plattform www.holzbot.com bereitgestellt und verwendet wird. Der Kunde erhält, nach Fertigstellung, einen personalisierten Zugang zu seinem Konto mit Passwort und Benutzername.</p>
            <p>(2) Holzbot erstellt automatisierte Preisschätzungen auf Basis von Bauplänen und Eingabedaten des Kunden. Diese Schätzungen sind unverbindlich und ersetzen keine manuelle Kalkulation.</p>
          </motion.section>

          <motion.section variants={fadeInUp}>
            <h2 className="text-2xl font-bold text-[#FF9F0F] mb-4">§3 Preise & Zahlung</h2>
            <p className="mb-4 font-bold text-white">(1) Preise (zzgl. MwSt):</p>
            <ul className="list-disc pl-6 mb-4 space-y-2 marker:text-[#FF9F0F]">
              <li>5.000 € einmalige Implementierungsgebühr</li>
              <li>500 € monatliche Wartungs- und Servicegebühr</li>
            </ul>
            <p className="mb-4">(2) Die Zahlung erfolgt ausschließlich per SEPA-Lastschriftmandat. Andere Zahlungsmethoden werden nicht akzeptiert.</p>
            <p className="mb-4">(3) Die Implementierungsgebühr wird wie folgt abgerechnet:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2 marker:text-[#FF9F0F]">
              <li>50 % bei Bestellung,</li>
              <li>50 % nach schriftlicher Mitteilung der Fertigstellung der Implementierung.</li>
            </ul>
            <p className="mb-4">Die Mitteilung erfolgt per E-Mail, WhatsApp oder SMS von SR Solutions an den Kunden.</p>
            <p className="mb-4">(4) Die monatliche Wartung beginnt am 1. Kalendertag des Folgemonats, nachdem die Implementierung abgeschlossen wurde.</p>
            <p className="mb-4">(5) Die monatliche Wartungsgebühr wird immer am 1. Kalendertag eines Monats in Rechnung gestellt und ist bis spätestens 15. Kalendertag desselben Monats vollständig zu begleichen.</p>
            <p>(6) Bei Nichtzahlung oder Rücklastschrift ist SR Solutions berechtigt, den Zugang zu Holzbot sofort und vollständig zu sperren, ohne Anspruch auf Rückerstattung oder Gutschrift bereits geleisteter Zahlungen.</p>
          </motion.section>

          <motion.section variants={fadeInUp}>
            <h2 className="text-2xl font-bold text-[#FF9F0F] mb-4">§4 Laufzeit & Kündigung</h2>
            <p className="mb-2">(1) Mindestlaufzeit: 12 Monate.</p>
            <p className="mb-2">(2) Danach jederzeit mit 30 Tagen zum Monatsende kündbar.</p>
            <p>(3) Bereits bezahlte Beträge werden nicht erstattet.</p>
          </motion.section>

          <motion.section variants={fadeInUp}>
            <h2 className="text-2xl font-bold text-[#FF9F0F] mb-4">§5 Haftung & Funktionsumfang</h2>
            <p className="mb-2">(1) Holzbot ist eine softwaregestützte Plattform zur Unterstützung von Kostenschätzungen. Die Berechnungen und Ergebnisse basieren auf automatisierten Auswertungen und den vom Nutzer bereitgestellten Informationen, weshalb eine vollständig fehlerfreie oder jederzeit störungsfreie Funktionsweise nicht gewährleistet werden kann.</p>
            <p className="mb-2">(2) Abweichungen, Messfehler oder falsche Schätzungen sind jederzeit möglich.</p>
            <p className="mb-2">(3) Der Kunde muss jede Schätzung manuell prüfen, bevor er sie verwendet.</p>
            <p className="mb-2">(4) SR Solutions haftet nur für Vorsatz und maximal bis zur Summe der letzten 6 Monate Servicegebühren.</p>
            <p>(5) Keine Haftung für wirtschaftliche Schäden, Preisabweichungen oder Datenfehler.</p>
          </motion.section>

          <motion.section variants={fadeInUp}>
            <h2 className="text-2xl font-bold text-[#FF9F0F] mb-4">§6 Nutzungsrechte</h2>
            <p className="mb-4">(1) Alle geistigen Eigentumsrechte an Holzbot, einschließlich Software, Backend, Algorithmen, Trainingsdaten, Benutzeroberfläche und Dokumentation, verbleiben vollständig bei SR Solutions AI S.R.L.</p>
            <p className="mb-4">(2) Der Kunde erhält ein nicht übertragbares, nicht exklusives Nutzungsrecht für die Dauer des Vertrags. Eine Unterlizenzierung ist ausgeschlossen.</p>
            <p className="mb-4 font-bold text-white">(3) Folgende Handlungen sind strikt untersagt:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2 marker:text-[#FF9F0F]">
              <li>Weitergabe oder Veröffentlichung von internen Systemdetails</li>
              <li>Kopieren, Nachbauen, Reverse Engineering oder sonstige technische Analyse des Systems</li>
              <li>Versuch, die Funktionsweise, Logik oder KI-Modelle auszulesen, zu rekonstruieren oder technisch zu reproduzieren</li>
              <li>Beauftragung Dritter zur Entwicklung eines ähnlichen oder konkurrierenden Systems</li>
              <li>Nutzung von Holzbot zur Erstellung eines Konkurrenzprodukts</li>
            </ul>
            <p>(4) Bei Verstößen behält sich SR Solutions das Recht vor, den Zugang sofort zu sperren und Schadenersatz geltend zu machen.</p>
          </motion.section>

          <motion.section variants={fadeInUp}>
            <h2 className="text-2xl font-bold text-[#FF9F0F] mb-4">§7 Datenschutz</h2>
            <p>SR Solutions verarbeitet Daten gemäß DSGVO. Der Kunde ist für die Rechtmäßigkeit seiner Eingaben verantwortlich.</p>
          </motion.section>

          <motion.section variants={fadeInUp}>
            <h2 className="text-2xl font-bold text-[#FF9F0F] mb-4">§8 Schlussbestimmungen</h2>
            <p className="mb-2">(1) Änderungen dieser AGB bedürfen der Schriftform.</p>
            <p className="mb-2">(2) Unwirksame Klauseln machen die restlichen Klauseln nicht unwirksam.</p>
            <p>(3) Es gilt österreichisches Recht. Gerichtsstand: Salzburg, Österreich.</p>
          </motion.section>

          <motion.section variants={fadeInUp} className="mt-12 pt-8 border-t border-white/10">
            <p className="font-bold text-white">SR SOLUTIONS AI S.R.L.</p>
            <p>Strada Republicii 35, 437335 Șomcuta Mare, Maramureș, Rumänien</p>
            <p>E-Mail: <a href="mailto:christian@holzbot.com" className="text-[#FF9F0F] hover:underline">christian@holzbot.com</a></p>
          </motion.section>

        </motion.div>
      </div>

      <FooterSection />
    </div>
  )
}