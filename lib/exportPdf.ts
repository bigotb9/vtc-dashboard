import { jsPDF } from "jspdf"
import { toast } from "@/lib/toast"

type TableRow = (string | number)[]

function drawTable(doc: jsPDF, {
  startY, headers, rows, pageW,
  colWidths, headerBg = [99, 102, 241],
}: {
  startY:    number
  headers:   string[]
  rows:      TableRow[]
  pageW:     number
  colWidths: number[]
  headerBg?: [number, number, number]
}) {
  const margin     = 14
  const rowH       = 7
  const headerH    = 8
  const pageH      = doc.internal.pageSize.getHeight()

  let y = startY

  doc.setFillColor(...headerBg)
  doc.rect(margin, y, pageW - margin * 2, headerH, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)

  let x = margin + 2
  for (let i = 0; i < headers.length; i++) {
    doc.text(String(headers[i]), x, y + 5.5)
    x += colWidths[i]
  }
  y += headerH

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)

  for (let r = 0; r < rows.length; r++) {
    if (y + rowH > pageH - 16) {
      doc.addPage()
      y = 20
      doc.setFillColor(...headerBg)
      doc.rect(margin, y - headerH, pageW - margin * 2, headerH, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFont("helvetica", "bold")
      let hx = margin + 2
      for (let i = 0; i < headers.length; i++) {
        doc.text(String(headers[i]), hx, y - headerH + 5.5)
        hx += colWidths[i]
      }
      doc.setFont("helvetica", "normal")
    }

    if (r % 2 === 0) {
      doc.setFillColor(246, 248, 255)
      doc.rect(margin, y, pageW - margin * 2, rowH, "F")
    }

    doc.setTextColor(40, 40, 60)
    let cx = margin + 2
    for (let i = 0; i < rows[r].length; i++) {
      const cell  = String(rows[r][i] ?? "—")
      const maxW  = colWidths[i] - 4
      const truncated = doc.getStringUnitWidth(cell) * 7.5 / doc.internal.scaleFactor > maxW
        ? cell.slice(0, Math.floor(cell.length * maxW / (doc.getStringUnitWidth(cell) * 7.5 / doc.internal.scaleFactor))) + "…"
        : cell
      doc.text(truncated, cx, y + 5)
      cx += colWidths[i]
    }

    doc.setDrawColor(220, 220, 235)
    doc.line(margin, y + rowH, pageW - margin, y + rowH)
    y += rowH
  }

  return y
}

async function loadLogoBase64(): Promise<string | null> {
  try {
    const res  = await fetch("/logo.png")
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function generatePdf({
  title, subtitle, sections,
}: {
  title:     string
  subtitle?: string
  sections:  {
    title:    string
    headers:  string[]
    rows:     TableRow[]
    colWidths: number[]
    total?:   { label: string; value: string }
  }[]
}) {
  const doc     = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const today   = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
  const pageW   = doc.internal.pageSize.getWidth()
  const logoB64 = await loadLogoBase64()

  const bannerH = 30
  doc.setFillColor(99, 102, 241)
  doc.rect(0, 0, pageW, bannerH, "F")

  const logoSize = 16
  const logoX    = 14
  const logoY    = (bannerH - logoSize) / 2
  if (logoB64) {
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(logoX - 1, logoY - 1, logoSize + 2, logoSize + 2, 2, 2, "F")
    doc.addImage(logoB64, "PNG", logoX, logoY, logoSize, logoSize)
  }

  const textX = logoB64 ? logoX + logoSize + 5 : 14
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text(title, textX, 13)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.text(subtitle ?? "Boyah Group · VTC Dashboard", textX, 21)
  doc.text(`Généré le ${today}`, pageW - 14, 21, { align: "right" })

  let y = bannerH + 8

  for (const section of sections) {
    doc.setTextColor(30, 30, 60)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.text(section.title, 14, y)
    y += 5

    y = drawTable(doc, {
      startY:    y,
      headers:   section.headers,
      rows:      section.rows,
      pageW,
      colWidths: section.colWidths,
    })

    y += 4

    if (section.total) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      doc.setTextColor(99, 102, 241)
      doc.text(`${section.total.label} : ${section.total.value}`, pageW - 14, y, { align: "right" })
      y += 10
    }
  }

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(170, 170, 190)
    doc.text(
      `Boyah Group · Confidentiel · Page ${i}/${pageCount}`,
      pageW / 2, doc.internal.pageSize.getHeight() - 6,
      { align: "center" }
    )
  }

  return doc
}

// ── Helpers ──

export async function exportInsightsPdf(opts: {
  score:            number
  generatedAt:      string
  resumeExecutif:   string
  recommandations?: { titre: string; priorite: string; categorie: string; description: string; impact_estime: string }[]
  alertes?:         { titre: string; urgence: string; action_immediate: string }[]
  plan30j?:         string[]
  retardVehicules?: { immatriculation: string }[]
  caTotal:          number
  depensesTotal:    number
}) {
  try {
    const { score, generatedAt, resumeExecutif, recommandations = [], alertes = [], plan30j = [], retardVehicules = [], caTotal, depensesTotal } = opts
    const profit = caTotal - depensesTotal

    const sections = []

    if (resumeExecutif) {
      sections.push({
        title:     "Résumé exécutif",
        headers:   ["Score santé", "CA du mois", "Dépenses", "Profit net"],
        colWidths: [45, 49, 49, 39],
        rows:      [[`${score}/100`, `${fmt(caTotal)} FCFA`, `${fmt(depensesTotal)} FCFA`, `${fmt(profit)} FCFA`]],
      })
    }

    if (recommandations.length) {
      sections.push({
        title:     `Recommandations (${recommandations.length})`,
        headers:   ["Priorité", "Catégorie", "Titre", "Impact estimé"],
        colWidths: [28, 28, 80, 46],
        rows:      recommandations.map(r => [r.priorite, r.categorie, r.titre, r.impact_estime || "—"]),
      })
    }

    if (alertes.length) {
      sections.push({
        title:     `Alertes Claude (${alertes.length})`,
        headers:   ["Urgence", "Titre", "Action immédiate"],
        colWidths: [28, 80, 74],
        rows:      alertes.map(a => [a.urgence, a.titre, a.action_immediate]),
      })
    }

    if (plan30j.length) {
      sections.push({
        title:     "Plan d'action 30 jours",
        headers:   ["#", "Action"],
        colWidths: [12, 170],
        rows:      plan30j.map((p, i) => [String(i + 1), p]),
      })
    }

    if (retardVehicules.length) {
      sections.push({
        title:     `Véhicules en retard de paiement (${retardVehicules.length})`,
        headers:   ["Immatriculation"],
        colWidths: [182],
        rows:      retardVehicules.map(v => [v.immatriculation]),
      })
    }

    const dateStr = generatedAt ? new Date(generatedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—"
    const doc = await generatePdf({
      title:    "AI Insights — Boyah Group",
      subtitle: `Analyse du ${dateStr} · Score santé global : ${score}/100`,
      sections,
    })
    doc.save(`ai-insights_${new Date().toISOString().split("T")[0]}.pdf`)
    toast.success("Rapport PDF généré")
  } catch (e) {
    console.error(e)
    toast.error("Erreur lors de la génération du PDF")
  }
}

export async function exportChauffeurFichePdf(opts: {
  nom: string; email?: string; numeroWave?: string; numeroPermis?: string
  numeroCni?: string; domicile?: string; garant?: string
  caTotal: number; caMensuel: number; transactions: number
  rang?: number; totalChauffeurs?: number; actif: boolean
  recettes?: { date: string; montantNet: number; montantBrut: number }[]
}) {
  try {
    const { nom, numeroWave, numeroPermis, numeroCni, domicile, garant, caTotal, caMensuel, transactions, rang, totalChauffeurs, actif, recettes = [] } = opts
    const sections = [
      {
        title:     "Informations générales",
        headers:   ["Champ", "Valeur"],
        colWidths: [60, 122],
        rows:      [
          ["Nom",             nom],
          ["Statut",          actif ? "Actif" : "Inactif"],
          ["Téléphone Wave",  numeroWave  || "—"],
          ["Numéro permis",   numeroPermis || "—"],
          ["Numéro CNI",      numeroCni    || "—"],
          ["Domicile",        domicile     || "—"],
          ["Garant",          garant       || "—"],
          ...(rang ? [["Classement", `${rang}/${totalChauffeurs || "?"}`]] : []),
        ] as (string | number)[][],
      },
      {
        title:     "Performance financière",
        headers:   ["Indicateur", "Valeur"],
        colWidths: [60, 122],
        rows:      [
          ["CA Total",       `${fmt(caTotal)} FCFA`],
          ["CA Ce mois",     `${fmt(caMensuel)} FCFA`],
          ["Transactions",   `${transactions}`],
        ] as (string | number)[][],
      },
    ]
    if (recettes.length > 0) {
      sections.push({
        title:     `Historique recettes (${recettes.length} dernières)`,
        headers:   ["Date", "Montant net (FCFA)", "Montant brut (FCFA)"],
        colWidths: [50, 66, 66],
        rows:      recettes.slice(0, 30).map(r => [r.date, fmt(r.montantNet), fmt(r.montantBrut)]),
      })
    }
    const doc = await generatePdf({ title: `Fiche Chauffeur — ${nom}`, subtitle: "Boyah Group · VTC Dashboard", sections })
    doc.save(`chauffeur_${nom.replace(/\s+/g, "_").toLowerCase()}_${new Date().toISOString().split("T")[0]}.pdf`)
    toast.success(`Fiche PDF générée pour ${nom}`)
  } catch (e) {
    console.error(e)
    toast.error("Erreur lors de la génération du PDF")
  }
}

export async function exportVehiculeFichePdf(opts: {
  immatriculation: string; type?: string; proprietaire?: string; statut: string
  kmActuel?: number; caMensuel: number; caAujourdhui: number; profitMensuel: number
  assuranceExp?: string; visiteExp?: string; carteStatExp?: string; patenteExp?: string
  recettes?: { date: string; chauffeur: string; montantNet: number }[]
}) {
  try {
    const { immatriculation, type, proprietaire, statut, kmActuel, caMensuel, caAujourdhui, profitMensuel, assuranceExp, visiteExp, carteStatExp, patenteExp, recettes = [] } = opts
    const sections = [
      {
        title:     "Informations véhicule",
        headers:   ["Champ", "Valeur"],
        colWidths: [70, 112],
        rows:      [
          ["Immatriculation",    immatriculation],
          ["Type",               type        || "—"],
          ["Propriétaire",       proprietaire || "—"],
          ["Statut",             statut],
          ["Kilométrage actuel", kmActuel ? `${fmt(kmActuel)} km` : "—"],
        ] as (string | number)[][],
      },
      {
        title:     "Performance financière",
        headers:   ["Indicateur", "Valeur"],
        colWidths: [70, 112],
        rows:      [
          ["CA aujourd'hui", `${fmt(caAujourdhui)} FCFA`],
          ["CA ce mois",     `${fmt(caMensuel)} FCFA`],
          ["Profit mensuel", `${fmt(profitMensuel)} FCFA`],
        ] as (string | number)[][],
      },
      {
        title:     "État des documents",
        headers:   ["Document", "Expiration"],
        colWidths: [90, 92],
        rows:      [
          ["Assurance",              assuranceExp  || "Non renseigné"],
          ["Visite technique",       visiteExp     || "Non renseigné"],
          ["Carte de stationnement", carteStatExp  || "Non renseigné"],
          ["Patente",                patenteExp    || "Non renseigné"],
        ] as (string | number)[][],
      },
    ]
    if (recettes.length > 0) {
      sections.push({
        title:     `Historique recettes (${recettes.length} dernières)`,
        headers:   ["Date", "Chauffeur", "Montant net (FCFA)"],
        colWidths: [50, 82, 50],
        rows:      recettes.slice(0, 20).map(r => [r.date, r.chauffeur, fmt(r.montantNet)]),
      })
    }
    const doc = await generatePdf({ title: `Fiche Véhicule — ${immatriculation}`, subtitle: "Boyah Group · VTC Dashboard", sections })
    doc.save(`vehicule_${immatriculation}_${new Date().toISOString().split("T")[0]}.pdf`)
    toast.success(`Fiche PDF générée pour ${immatriculation}`)
  } catch (e) {
    console.error(e)
    toast.error("Erreur lors de la génération du PDF")
  }
}

// toLocaleString("fr-FR") produit une espace insécable ( ) que jsPDF/Helvetica
// ne sait pas rendre. On utilise un regex pour forcer des espaces normaux.
const fmt = (n: number) =>
  Math.round(Number(n || 0))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ")

export async function exportRecettesPdf(recettes: {
  Horodatage: string; chauffeur?: string; "Montant net": number
  "Nom de contrepartie"?: string; "Nom d'utilisateur"?: string
}[]) {
  try {
    if (!recettes.length) { toast.warning("Aucune recette à exporter"); return }
    const total = recettes.reduce((s, r) => s + Number(r["Montant net"] || 0), 0)
    const doc   = await generatePdf({
      title:    "Rapport Recettes",
      subtitle: `${recettes.length} transactions · Boyah Group`,
      sections: [{
        title:     "Historique des recettes",
        headers:   ["Date", "Chauffeur", "Montant net (FCFA)"],
        colWidths: [45, 85, 52],
        rows:      recettes.map(r => [
          r.Horodatage ? new Date(r.Horodatage).toLocaleDateString("fr-FR") : "—",
          r.chauffeur || r["Nom de contrepartie"] || r["Nom d'utilisateur"] || "—",
          fmt(r["Montant net"] || 0),
        ]),
        total: { label: "CA total", value: `${fmt(total)} FCFA` },
      }],
    })
    doc.save(`recettes_${new Date().toISOString().split("T")[0]}.pdf`)
    toast.success(`PDF généré — ${recettes.length} recettes`)
  } catch (e) {
    console.error(e)
    toast.error("Erreur lors de la génération du PDF")
  }
}

export async function exportDepensesPdf(depenses: {
  date_depense: string; immatriculation: string
  type_depense: string; montant: number; description?: string
}[]) {
  try {
    if (!depenses.length) { toast.warning("Aucune dépense à exporter"); return }
    const total = depenses.reduce((s, d) => s + Number(d.montant || 0), 0)
    const doc   = await generatePdf({
      title:    "Rapport Dépenses",
      subtitle: `${depenses.length} entrées · Boyah Group`,
      sections: [{
        title:     "Liste des dépenses",
        headers:   ["Date", "Véhicule", "Type", "Montant (FCFA)", "Description"],
        colWidths: [28, 28, 35, 35, 56],
        rows:      depenses.map(d => [
          d.date_depense ? new Date(d.date_depense).toLocaleDateString("fr-FR") : "—",
          d.immatriculation || "—",
          d.type_depense    || "—",
          fmt(d.montant || 0),
          d.description     || "—",
        ]),
        total: { label: "Total dépenses", value: `${fmt(total)} FCFA` },
      }],
    })
    doc.save(`depenses_${new Date().toISOString().split("T")[0]}.pdf`)
    toast.success(`PDF généré — ${depenses.length} dépenses`)
  } catch (e) {
    console.error(e)
    toast.error("Erreur lors de la génération du PDF")
  }
}

export async function exportChauffeursPdf(chauffeurs: {
  nom: string; numero_wave?: string; actif: boolean; ca?: number
}[]) {
  try {
    if (!chauffeurs.length) { toast.warning("Aucun chauffeur à exporter"); return }
    const doc = await generatePdf({
      title:    "Rapport Chauffeurs",
      subtitle: `${chauffeurs.length} chauffeurs · Boyah Group`,
      sections: [{
        title:     "Liste des chauffeurs",
        headers:   ["Nom", "Téléphone", "CA (FCFA)", "Statut"],
        colWidths: [65, 50, 40, 27],
        rows:      chauffeurs.map(c => [
          c.nom,
          c.numero_wave || "—",
          fmt(c.ca || 0),
          c.actif ? "Actif" : "Inactif",
        ]),
        total: { label: "CA total", value: `${fmt(chauffeurs.reduce((s, c) => s + (c.ca || 0), 0))} FCFA` },
      }],
    })
    doc.save(`chauffeurs_${new Date().toISOString().split("T")[0]}.pdf`)
    toast.success(`PDF généré — ${chauffeurs.length} chauffeurs`)
  } catch (e) {
    console.error(e)
    toast.error("Erreur lors de la génération du PDF")
  }
}

// ── Fiche d'inspection physique — version améliorée avec logo et couleurs ──────
export async function exportFicheInspectionPdf(immatriculation = "") {
  const { jsPDF } = await import("jspdf")
  const logo = await loadLogoBase64()
  const doc  = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const W = 210, H = 297, M = 12
  let y = M

  type RGB = [number, number, number]

  // ── Palette couleurs sections ──
  const C = {
    eclairage:   [180, 100, 0]   as RGB,
    carrosserie: [51, 65, 85]    as RGB,
    interieur:   [109, 40, 217]  as RGB,
    mecanique:   [180, 55, 10]   as RGB,
    pneus:       [30, 58, 138]   as RGB,
    freinage:    [153, 27, 27]   as RGB,
    documents:   [6, 120, 110]   as RGB,
    equipements: [55, 48, 180]   as RGB,
    vidange:     [12, 90, 160]   as RGB,
    indigo:      [67, 56, 202]   as RGB,
  }

  // ── Helpers ──
  const sf = (r: number, g: number, b: number) => doc.setFillColor(r, g, b)
  const sd = (r: number, g: number, b: number) => doc.setDrawColor(r, g, b)
  const st = (r: number, g: number, b: number) => doc.setTextColor(r, g, b)

  // Checkbox arrondie avec bordure coloree
  const cb = ([r,g,b]: RGB, x: number, cy: number, s = 3.6) => {
    sf(250, 250, 255); sd(r, g, b); doc.setLineWidth(0.45)
    doc.roundedRect(x, cy - s + 0.8, s, s, 0.7, 0.7, "FD")
  }
  // 2 options sur une ligne
  const opt2 = (col: RGB, x: number, cy: number, a: string, b: string, gap = 26) => {
    cb(col, x, cy); st(35, 35, 65); doc.text(a, x + 5, cy)
    cb(col, x + gap, cy); doc.text(b, x + gap + 5, cy)
  }
  // 3 options sur une ligne
  const opt3 = (col: RGB, x: number, cy: number, a: string, b: string, c: string) => {
    cb(col, x, cy);      st(35, 35, 65); doc.text(a, x + 5,    cy)
    cb(col, x + 30, cy); doc.text(b, x + 35,   cy)
    cb(col, x + 63, cy); doc.text(c, x + 68,   cy)
  }

  // Pied de page
  const foot = () => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); st(155, 155, 175)
    doc.text("Boyah Group  -  Fiche inspection vehicule  -  Confidentiel", W / 2, H - 5, { align: "center" })
  }
  const np = () => { doc.addPage(); y = M + 2; foot() }

  // Section header avec barre laterale + fond degrade
  const sec = (label: string, col: RGB) => {
    if (y > H - 52) np()
    y += 4
    const [r, g, b] = col
    // Fond principal
    sf(r, g, b); doc.rect(M, y, W - M * 2, 8, "F")
    // Barre laterale plus foncee (accent)
    sf(Math.max(0, r - 50), Math.max(0, g - 50), Math.max(0, b - 50))
    doc.rect(M, y, 4.5, 8, "F")
    // Lignes decoratives droite
    sf(Math.min(255, r + 60), Math.min(255, g + 60), Math.min(255, b + 60))
    doc.rect(W - M - 20, y, 20, 8, "F")
    sf(Math.min(255, r + 30), Math.min(255, g + 30), Math.min(255, b + 30))
    doc.rect(W - M - 35, y, 12, 8, "F")
    // Texte
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); st(255, 255, 255)
    doc.text(label, M + 8, y + 5.5)
    y += 11; doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); st(35, 35, 65)
  }

  // Ligne item avec fond alterne couleur section
  let _ri = 0
  const row = (col: RGB, label: string, render: () => void) => {
    if (y > H - 15) np()
    const [r, g, b] = col
    if (_ri % 2 === 0) {
      sf(Math.min(255, r + 208), Math.min(255, g + 210), Math.min(255, b + 215))
      doc.rect(M, y - 3.8, W - M * 2, 6.2, "F")
    }
    // Barre laterale fine coloree
    sf(r, g, b); doc.rect(M, y - 3.8, 1.8, 6.2, "F")
    st(35, 35, 65); doc.text(label, M + 4, y)
    render()
    sd(210, 215, 228); doc.setLineWidth(0.15); doc.line(M, y + 2.2, W - M, y + 2.2)
    y += 6.5; _ri++
  }

  // ── PAGE 1 : TITRE + INFO + ECLAIRAGE + CARROSSERIE + INTERIEUR ──────────────

  // Bandeau titre
  const [ir, ig, ib] = C.indigo
  sf(Math.max(0, ir - 20), Math.max(0, ig - 20), Math.max(0, ib - 20))
  doc.rect(0, 0, W, 30, "F")
  // Bande degrade gauche
  sf(ir, ig, ib); doc.rect(0, 0, W * 0.6, 30, "F")
  // Bande accent bas
  sf(Math.min(255, ir + 80), Math.min(255, ig + 70), Math.min(255, ib + 60))
  doc.rect(0, 27.5, W, 2.5, "F")
  // Bande fine accent lumineuse
  sf(200, 195, 255); doc.rect(0, 29.5, W, 0.8, "F")

  // Logo
  if (logo) {
    sf(255, 255, 255)
    doc.roundedRect(M - 1, 5, 20, 20, 2.5, 2.5, "F")
    doc.addImage(logo, "PNG", M, 6, 18, 18)
  }
  const tx = logo ? M + 23 : M + 3
  st(255, 255, 255)
  doc.setFont("helvetica", "bold"); doc.setFontSize(15)
  doc.text("FICHE D'INSPECTION VEHICULE", tx, 13)
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); st(215, 210, 255)
  doc.text("Boyah Group  -  A remplir a chaque vidange", tx, 20)
  doc.setFontSize(7.5); st(185, 180, 240)
  doc.text(new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }), W - M, 20, { align: "right" })
  y = 36

  // Bloc infos vehicule
  sf(244, 245, 253); doc.roundedRect(M, y, W - M * 2, 26, 2, 2, "F")
  sd(170, 175, 215); doc.setLineWidth(0.35); doc.roundedRect(M, y, W - M * 2, 26, 2, 2, "D")
  // Barre superieure coloree
  sf(ir, ig, ib); doc.roundedRect(M, y, W - M * 2, 5, 2, 2, "F")
  doc.rect(M, y + 2.5, W - M * 2, 2.5, "F")
  doc.setFont("helvetica", "bold"); doc.setFontSize(7); st(255, 255, 255)
  doc.text("INFORMATIONS VEHICULE", M + 4, y + 3.8)

  const flds = [
    { label: "IMMATRICULATION", x: M + 4,   w: 42, val: immatriculation },
    { label: "DATE",            x: M + 56,  w: 38, val: "" },
    { label: "KILOMETRAGE",     x: M + 102, w: 38, val: "" },
    { label: "TECHNICIEN",      x: M + 150, w: 46, val: "" },
  ]
  for (const f of flds) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); st(90, 85, 180)
    doc.text(f.label, f.x, y + 12)
    if (f.val) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); st(20, 20, 70)
      doc.text(f.val, f.x, y + 22)
    }
    sd(140, 135, 200); doc.setLineWidth(0.5); doc.line(f.x, y + 23, f.x + f.w, y + 23)
  }
  y += 32

  // 1. Eclairage
  sec("ECLAIRAGE", C.eclairage); _ri = 0
  const eclPairs: [string, string][] = [
    ["Phares croisement", "Phares route"],
    ["Feux arriere", "Feux de stop"],
    ["Clignotants AV gauche", "Clignotants AV droit"],
    ["Clignotants AR gauche", "Clignotants AR droit"],
    ["Feux de recul", "Feux de plaque"],
    ["Feux de detresse", "Feux brouillard"],
  ]
  for (const [a, b] of eclPairs) {
    if (y > H - 15) np()
    const [r, g, bv] = C.eclairage
    if (_ri % 2 === 0) {
      sf(Math.min(255,r+208), Math.min(255,g+195), Math.min(255,bv+210))
      doc.rect(M, y - 3.8, W - M * 2, 6.2, "F")
    }
    sf(r, g, bv); doc.rect(M, y - 3.8, 1.8, 6.2, "F")
    st(35, 35, 65); doc.text(a, M + 4, y)
    opt2(C.eclairage, M + 58, y, "Marche", "Panne", 22)
    doc.text(b, M + 108, y)
    opt2(C.eclairage, M + 155, y, "Marche", "Panne", 22)
    sd(210, 215, 228); doc.setLineWidth(0.15); doc.line(M, y + 2.2, W - M, y + 2.2)
    y += 6.5; _ri++
  }

  // 2. Carrosserie
  sec("CARROSSERIE", C.carrosserie); _ri = 0
  for (const l of ["Face avant", "Face arriere", "Cote conducteur", "Cote passager", "Toit", "Pare-brise", "Vitres"])
    row(C.carrosserie, l, () => opt3(C.carrosserie, M + 72, y, "Bon", "Mauvais", "Tres mauvais"))

  // 3. Interieur
  sec("INTERIEUR", C.interieur); _ri = 0
  for (const l of ["Sieges avant", "Sieges arriere", "Tableau de bord", "Proprete generale"])
    row(C.interieur, l, () => opt3(C.interieur, M + 72, y, "Bon", "Mauvais", "Tres mauvais"))
  for (const l of ["Climatisation", "Autoradio"])
    row(C.interieur, l, () => opt3(C.interieur, M + 72, y, "Marche", "Panne", "Absent"))
  row(C.interieur, "Ceintures securite", () => opt2(C.interieur, M + 72, y, "Complet", "Incomplet", 30))

  // 4. Mecanique
  sec("MECANIQUE & MOTEUR", C.mecanique); _ri = 0
  for (const l of ["Huile moteur", "Liq. refroidissement", "Liquide de frein", "Lave-glace", "Courroie accessoires", "Filtre a air", "Batterie"])
    row(C.mecanique, l, () => opt3(C.mecanique, M + 72, y, "OK", "A surveiller", "Critique"))

  // 5. Pneumatiques
  sec("PNEUMATIQUES", C.pneus); _ri = 0
  for (const l of ["Pneu avant gauche", "Pneu avant droit", "Pneu arriere gauche", "Pneu arriere droit"])
    row(C.pneus, l, () => opt3(C.pneus, M + 72, y, "Bon", "Use", "A changer"))
  row(C.pneus, "Pneu de secours", () => opt3(C.pneus, M + 72, y, "Present", "A changer", "Absent"))
  row(C.pneus, "Pression generale", () => opt2(C.pneus, M + 72, y, "OK", "A verifier", 28))

  // 6. Freinage
  sec("FREINAGE", C.freinage); _ri = 0
  for (const l of ["Freins avant", "Freins arriere"])
    row(C.freinage, l, () => opt3(C.freinage, M + 72, y, "OK", "Use", "Critique"))
  row(C.freinage, "Frein a main", () => opt2(C.freinage, M + 72, y, "Marche", "Panne", 28))

  // 7. Documents
  sec("DOCUMENTS", C.documents); _ri = 0
  for (const l of ["Carte grise", "Assurance", "Controle technique"])
    row(C.documents, l, () => opt3(C.documents, M + 72, y, "Valide", "Expire", "Absent"))

  // 8. Equipements securite
  sec("EQUIPEMENTS DE SECURITE", C.equipements); _ri = 0
  const eqPairs: [string, string][] = [
    ["Extincteur", "Triangle de signalisation"],
    ["Cric + cles de roue", "Cables de demarrage"],
  ]
  for (const [a, b] of eqPairs) {
    if (y > H - 15) np()
    const [r, g, bv] = C.equipements
    if (_ri % 2 === 0) {
      sf(Math.min(255,r+188), Math.min(255,g+192), Math.min(255,bv+72))
      doc.rect(M, y - 3.8, W - M * 2, 6.2, "F")
    }
    sf(r, g, bv); doc.rect(M, y - 3.8, 1.8, 6.2, "F")
    st(35, 35, 65); doc.text(a, M + 4, y)
    opt2(C.equipements, M + 70, y, "Present", "Absent", 24)
    doc.text(b, M + 112, y)
    opt2(C.equipements, M + 162, y, "Present", "Absent", 24)
    sd(210, 215, 228); doc.setLineWidth(0.15); doc.line(M, y + 2.2, W - M, y + 2.2)
    y += 6.5; _ri++
  }

  // 9. Points de vidange
  sec("POINTS DE VIDANGE  -  cocher si effectue", C.vidange); _ri = 0
  const vpPairs: [string, string][] = [
    ["Huile moteur", "Filtre a huile"],
    ["Filtre a air", "Filtre a pollen"],
    ["Liq. refroidissement", "Huile de frein"],
    ["Pneus", ""],
  ]
  for (const [a, b] of vpPairs) {
    if (y > H - 15) np()
    const [r, g, bv] = C.vidange
    if (_ri % 2 === 0) {
      sf(Math.min(255,r+210), Math.min(255,g+205), 255)
      doc.rect(M, y - 3.8, W - M * 2, 6.2, "F")
    }
    sf(r, g, bv); doc.rect(M, y - 3.8, 1.8, 6.2, "F")
    cb(C.vidange, M + 4, y, 4); st(35, 35, 65); doc.text(a, M + 10, y)
    if (b) { cb(C.vidange, M + 104, y, 4); doc.text(b, M + 110, y) }
    sd(210, 215, 228); doc.setLineWidth(0.15); doc.line(M, y + 2.2, W - M, y + 2.2)
    y += 6.5; _ri++
  }

  // Observations
  y += 5; if (y > H - 55) np()
  sf(248, 245, 255); doc.roundedRect(M, y, W - M * 2, 42, 2, 2, "F")
  sd(175, 165, 228); doc.setLineWidth(0.3); doc.roundedRect(M, y, W - M * 2, 42, 2, 2, "D")
  const [vr, vg, vb] = C.interieur
  sf(vr, vg, vb); doc.roundedRect(M, y, W - M * 2, 5.5, 2, 2, "F"); doc.rect(M, y + 3, W - M * 2, 2.5, "F")
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); st(255, 255, 255)
  doc.text("OBSERVATIONS / REPARATIONS A PROGRAMMER", M + 4, y + 4.3)
  y += 9
  sd(185, 178, 225); doc.setLineWidth(0.28)
  for (let i = 0; i < 4; i++) { doc.line(M + 2, y, W - M - 2, y); y += 7.5 }
  y += 5

  // Signatures
  if (y > H - 30) np()
  const sigDefs = [
    { label: "Signature technicien",  x: M,          w: 55 },
    { label: "Signature responsable", x: M + 75,     w: 55 },
    { label: "Date",                  x: W - M - 48, w: 48 },
  ]
  for (const s of sigDefs) {
    sf(244, 245, 253); doc.roundedRect(s.x, y, s.w, 18, 1.5, 1.5, "F")
    sd(170, 175, 215); doc.setLineWidth(0.3); doc.roundedRect(s.x, y, s.w, 18, 1.5, 1.5, "D")
    sf(vr, vg, vb); doc.roundedRect(s.x, y, s.w, 5, 1.5, 1.5, "F"); doc.rect(s.x, y + 2.5, s.w, 2.5, "F")
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); st(255, 255, 255)
    doc.text(s.label, s.x + 3, y + 4)
  }

  // Pied de page toutes les pages
  const count = doc.getNumberOfPages()
  for (let i = 1; i <= count; i++) {
    doc.setPage(i); foot()
    doc.setFontSize(6.5); st(155, 155, 175)
    doc.text(`Page ${i} / ${count}`, W - M, H - 5, { align: "right" })
  }

  doc.save(`fiche_inspection${immatriculation ? "_" + immatriculation : ""}_${new Date().toISOString().split("T")[0]}.pdf`)
  toast.success("Fiche d'inspection PDF generee")
}
