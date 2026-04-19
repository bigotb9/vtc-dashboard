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

  // ── En-tête de colonne ──
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

  // ── Lignes ──
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)

  for (let r = 0; r < rows.length; r++) {
    // Saut de page
    if (y + rowH > pageH - 16) {
      doc.addPage()
      y = 20
      // Ré-afficher l'en-tête
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

    // Alternance couleur
    if (r % 2 === 0) {
      doc.setFillColor(246, 248, 255)
      doc.rect(margin, y, pageW - margin * 2, rowH, "F")
    }

    doc.setTextColor(40, 40, 60)
    let cx = margin + 2
    for (let i = 0; i < rows[r].length; i++) {
      const cell  = String(rows[r][i] ?? "—")
      const maxW  = colWidths[i] - 4
      // Tronquer si trop long
      const truncated = doc.getStringUnitWidth(cell) * 7.5 / doc.internal.scaleFactor > maxW
        ? cell.slice(0, Math.floor(cell.length * maxW / (doc.getStringUnitWidth(cell) * 7.5 / doc.internal.scaleFactor))) + "…"
        : cell
      doc.text(truncated, cx, y + 5)
      cx += colWidths[i]
    }

    // Bordure basse légère
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

  // ── Bandeau titre ──
  const bannerH = 30
  doc.setFillColor(99, 102, 241)
  doc.rect(0, 0, pageW, bannerH, "F")

  // Logo (carré blanc arrondi simulé + image)
  const logoSize = 16
  const logoX    = 14
  const logoY    = (bannerH - logoSize) / 2
  if (logoB64) {
    // Fond blanc arrondi derrière le logo
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

  // ── Pied de page sur toutes les pages ──
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

    // Section résumé
    if (resumeExecutif) {
      sections.push({
        title:     "Résumé exécutif",
        headers:   ["Score santé", "CA du mois", "Dépenses", "Profit net"],
        colWidths: [45, 49, 49, 39],
        rows:      [[`${score}/100`, `${fmt(caTotal)} FCFA`, `${fmt(depensesTotal)} FCFA`, `${fmt(profit)} FCFA`]],
      })
    }

    // Section recommandations
    if (recommandations.length) {
      sections.push({
        title:     `Recommandations (${recommandations.length})`,
        headers:   ["Priorité", "Catégorie", "Titre", "Impact estimé"],
        colWidths: [28, 28, 80, 46],
        rows:      recommandations.map(r => [r.priorite, r.categorie, r.titre, r.impact_estime || "—"]),
      })
    }

    // Section alertes
    if (alertes.length) {
      sections.push({
        title:     `Alertes Claude (${alertes.length})`,
        headers:   ["Urgence", "Titre", "Action immédiate"],
        colWidths: [28, 80, 74],
        rows:      alertes.map(a => [a.urgence, a.titre, a.action_immediate]),
      })
    }

    // Plan 30j
    if (plan30j.length) {
      sections.push({
        title:     "Plan d'action 30 jours",
        headers:   ["#", "Action"],
        colWidths: [12, 170],
        rows:      plan30j.map((p, i) => [String(i + 1), p]),
      })
    }

    // Véhicules en retard
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

// toLocaleString("fr-FR") produit une espace insécable (\u00A0) que jsPDF/Helvetica
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

