// PDF loader module - încărcat doar pe client la runtime
// Folosim o abordare care evită complet analiza statică de Turbopack

let pdfjsModule: any = null
let loadingPromise: Promise<any> | null = null

export async function loadPdfJs() {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js can only be used in browser')
  }
  
  // Dacă deja avem modulul încărcat, returnăm direct
  if (pdfjsModule) {
    return pdfjsModule
  }
  
  // Dacă există deja un promise de încărcare, așteptăm pe el
  if (loadingPromise) {
    return loadingPromise
  }
  
  // Creăm un promise nou pentru încărcare
  loadingPromise = (async () => {
    try {
      // IMPORTANT:
      // Use explicit module specifiers so Next/Webpack can include these modules.
      // The previous dynamic string path could fail at runtime with:
      // "Cannot find module 'pdfjs-dist/legacy/build/pdf.mjs'".
      const imported = await import('pdfjs-dist/legacy/build/pdf.mjs')
      
      const pdfjs = imported as any
      
      if (!pdfjs || typeof pdfjs.getDocument !== 'function') {
        throw new Error('PDF.js module failed to load correctly')
      }
      
      // Set worker source
      // În loc de: pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
      // Pune asta:
      if (pdfjs.GlobalWorkerOptions) {
        // Keep worker version in sync with the loaded pdfjs module.
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`
      }
      
      pdfjsModule = pdfjs
      return pdfjs
    } catch (error) {
      loadingPromise = null // Reset promise on error
      throw error
    }
  })()
  
  return loadingPromise
}
