/**
 * Wrapper Puppeteer pour la génération de PDF (Phase 4).
 *
 * Auto-détection de l'environnement :
 *   - Serverless (Vercel, Lambda, Netlify, Render) → @sparticuz/chromium
 *   - Dev local (Windows, Mac, Linux) → Chrome/Edge système auto-détecté
 *
 * Override manuel possible via la variable d'environnement :
 *   CHROME_EXECUTABLE_PATH=/chemin/vers/chrome
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Buffer = any

export type PdfFormat = "A4" | "A4-landscape"

export interface GeneratePdfOptions {
  format?:  PdfFormat
  margins?: { top: string; right: string; bottom: string; left: string }
  filename?: string
  footerHtml?: string
  // Patch 24/05/2026 (Bug 3) : passer false pour desactiver totalement
  // l'overlay header/footer Puppeteer (numero de page + date). Utile pour
  // les PDFs Client (Releve, Justificatif, Etat comptes) qui ont leur
  // propre footer dans le HTML body. Par defaut true (coherent avec
  // l'historique du module Compta : Bilan, Compte de Resultat, TFT).
  displayHeaderFooter?: boolean
}

const DEFAULT_MARGINS = {
  top:    "20mm",
  right:  "15mm",
  bottom: "20mm",
  left:   "15mm",
}

const DEFAULT_FOOTER = `
  <div style="font-size: 8pt; color: #6B7280; width: 100%; padding: 0 15mm; display: flex; justify-content: space-between; font-family: Georgia, serif;">
    <span class="date"></span>
    <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>
`

function findLocalChromeExecutable(): string | null {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { existsSync } = require("fs")

  if (process.env.CHROME_EXECUTABLE_PATH && existsSync(process.env.CHROME_EXECUTABLE_PATH)) {
    return process.env.CHROME_EXECUTABLE_PATH
  }

  const platform = process.platform
  const candidates: string[] = []

  if (platform === "win32") {
    candidates.push(
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    )
  } else if (platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    )
  } else {
    candidates.push(
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/microsoft-edge",
      "/snap/bin/chromium",
    )
  }

  for (const path of candidates) {
    if (path && existsSync(path)) return path
  }

  return null
}

function isServerlessEnv(): boolean {
  return !!(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY ||
    process.env.RENDER
  )
}

export async function generatePdfFromHtml(
  html: string,
  opts: GeneratePdfOptions = {},
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const puppeteer: any = await import("puppeteer-core")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let launchOptions: any

  if (isServerlessEnv()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chromium: any = (await import("@sparticuz/chromium")).default
    launchOptions = {
      args:             chromium.args,
      defaultViewport:  chromium.defaultViewport,
      executablePath:   await chromium.executablePath(),
      headless:         chromium.headless,
    }
  } else {
    const localChrome = findLocalChromeExecutable()
    if (!localChrome) {
      throw new Error(
        "Aucun navigateur Chrome/Chromium/Edge trouve sur le systeme. " +
        "Installez Google Chrome ou definissez CHROME_EXECUTABLE_PATH dans .env.local"
      )
    }
    launchOptions = {
      headless:       true,
      executablePath: localChrome,
      args:           ["--no-sandbox", "--disable-setuid-sandbox"],
    }
  }

  const browser = await puppeteer.launch(launchOptions)
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 25000 })
    const isLandscape = opts.format === "A4-landscape"
    // Patch 24/05/2026 (Bug 3) : displayHeaderFooter desactivable via option.
    const showFooter = opts.displayHeaderFooter !== false
    const pdf = await page.pdf({
      format:               "A4",
      landscape:            isLandscape,
      margin:               opts.margins ?? DEFAULT_MARGINS,
      printBackground:      true,
      displayHeaderFooter:  showFooter,
      headerTemplate:       showFooter ? "<div></div>" : undefined,
      footerTemplate:       showFooter ? (opts.footerHtml ?? DEFAULT_FOOTER) : undefined,
      preferCSSPageSize:    false,
    })
    return pdf
  } finally {
    await browser.close().catch(() => {})
  }
}

export function wrapHtml(body: string, styles: string): string {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Document comptable</title>
  <style>${styles}</style>
</head>
<body>${body}</body>
</html>`
}
