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

// ── Fiche d'inspection physique (formulaire papier) ────────────────────────────
export async function exportFicheInspectionPdf(immatriculation = "") {
  const { jsPDF } = await import("jspdf")
  const doc  = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const W = 210, H = 297, M = 12
  let y = M

  // Helpers
  const cb = (x: number, cy: number, s = 3.2) => {
    doc.setDrawColor(100,100,120); doc.setLineWidth(0.3); doc.rect(x, cy-s+0.6, s, s)
  }
  const opt2 = (x: number, cy: number, a: string, b: string, gap = 22) => {
    cb(x,cy); doc.text(a,x+4,cy); cb(x+gap,cy); doc.text(b,x+gap+4,cy)
  }
  const opt3 = (x: number, cy: number, a: string, b: string, c: string) => {
    cb(x,cy); doc.text(a,x+4,cy); cb(x+26,cy); doc.text(b,x+30,cy); cb(x+56,cy); doc.text(c,x+60,cy)
  }
  const foot = () => {
    doc.setFont("helvetica","normal"); doc.setFontSize(6.5); doc.setTextColor(160,160,180)
    doc.text("Boyah Group - Fiche inspection vehicule - Confidentiel", W/2, H-5, {align:"center"})
  }
  const np = () => { doc.addPage(); y=M; foot() }
  const sec = (label: string, r: number, g: number, b: number) => {
    if(y>H-50) np()
    doc.setFillColor(r,g,b); doc.roundedRect(M,y,W-M*2,6.5,1,1,"F")
    doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(255,255,255)
    doc.text(label, M+3, y+4.5)
    y+=9; doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(40,40,60)
  }
  const row = (label: string, render: () => void) => {
    if(y>H-16) np()
    doc.text(label, M+2, y); render()
    doc.setDrawColor(220,225,235); doc.setLineWidth(0.2); doc.line(M,y+1.5,W-M,y+1.5); y+=6
  }

  // Titre
  doc.setFillColor(79,70,229); doc.rect(0,0,W,22,"F")
  doc.setFont("helvetica","bold"); doc.setFontSize(14); doc.setTextColor(255,255,255)
  doc.text("FICHE D'INSPECTION VEHICULE", M, 10)
  doc.setFont("helvetica","normal"); doc.setFontSize(8)
  doc.text("Boyah Group - A remplir a chaque vidange", M, 16)
  doc.text(new Date().toLocaleDateString("fr-FR"), W-M, 16, {align:"right"})
  y = 28

  // Infos vehicule
  doc.setFillColor(243,244,246); doc.roundedRect(M,y,W-M*2,22,2,2,"F")
  doc.setDrawColor(200,205,220); doc.roundedRect(M,y,W-M*2,22,2,2,"D")
  const flds = [{label:"Immatriculation",x:M+4,val:immatriculation},{label:"Date",x:M+56,val:""},{label:"Kilometrage",x:M+102,val:""},{label:"Technicien",x:M+148,val:""}]
  doc.setFont("helvetica","bold"); doc.setFontSize(7.5); doc.setTextColor(80,80,100)
  for(const f of flds) {
    doc.text(f.label,f.x,y+7)
    doc.setDrawColor(120,120,150); doc.setLineWidth(0.4); doc.line(f.x,y+18,f.x+42,y+18)
    if(f.val){doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(30,30,60);doc.text(f.val,f.x,y+17);doc.setFont("helvetica","bold");doc.setFontSize(7.5);doc.setTextColor(80,80,100)}
  }
  y += 28

  // 1. Eclairage
  sec("ECLAIRAGE", 202,138,4)
  const ecl = [["Phares croisement","Phares route"],["Feux arriere","Feux de stop"],["Clignotants AV G","Clignotants AV D"],["Clignotants AR G","Clignotants AR D"],["Feux de recul","Feux de plaque"],["Feux de detresse","Feux brouillard"]]
  for(const [a,b] of ecl) {
    if(y>H-16) np()
    doc.text(a,M+2,y); opt2(M+52,y,"Marche","Panne",20)
    doc.text(b,M+100,y); opt2(M+150,y,"Marche","Panne",20)
    doc.setDrawColor(220,225,235); doc.setLineWidth(0.2); doc.line(M,y+1.5,W-M,y+1.5); y+=6
  }
  y+=2

  // 2. Carrosserie
  sec("CARROSSERIE", 71,85,105)
  for(const l of ["Face avant","Face arriere","Cote conducteur","Cote passager","Toit","Pare-brise","Vitres"])
    row(l, ()=>opt3(M+70,y,"Bon","Mauvais","Tres mauvais"))
  y+=2

  // 3. Interieur
  sec("INTERIEUR", 124,58,237)
  for(const l of ["Sieges avant","Sieges arriere","Tableau de bord","Proprete generale"])
    row(l, ()=>opt3(M+70,y,"Bon","Mauvais","Tres mauvais"))
  for(const l of ["Climatisation","Autoradio"])
    row(l, ()=>opt3(M+70,y,"Marche","Panne","Absent"))
  row("Ceintures securite", ()=>opt2(M+70,y,"Complet","Incomplet",30))
  y+=2

  // 4. Mecanique
  sec("MECANIQUE & MOTEUR", 234,88,12)
  for(const l of ["Huile moteur","Liq. refroidissement","Liquide de frein","Lave-glace","Courroie accessoires","Filtre a air","Batterie"])
    row(l, ()=>opt3(M+70,y,"OK","A surveiller","Critique"))
  y+=2

  // 5. Pneumatiques
  sec("PNEUMATIQUES", 75,85,99)
  for(const l of ["Pneu avant gauche","Pneu avant droit","Pneu arriere gauche","Pneu arriere droit"])
    row(l, ()=>opt3(M+70,y,"Bon","Use","A changer"))
  row("Pneu de secours", ()=>opt3(M+70,y,"Present","A changer","Absent"))
  row("Pression generale", ()=>opt2(M+70,y,"OK","A verifier",28))
  y+=2

  // 6. Freinage
  sec("FREINAGE", 220,38,38)
  for(const l of ["Freins avant","Freins arriere"])
    row(l, ()=>opt3(M+70,y,"OK","Use","Critique"))
  row("Frein a main", ()=>opt2(M+70,y,"Marche","Panne",28))
  y+=2

  // 7. Documents
  sec("DOCUMENTS", 20,184,166)
  for(const l of ["Carte grise","Assurance","Controle technique"])
    row(l, ()=>opt3(M+70,y,"Valide","Expire","Absent"))
  y+=2

  // 8. Equipements
  sec("EQUIPEMENTS DE SECURITE", 67,56,202)
  const eq = [["Extincteur","Triangle de signalisation"],["Cric + cles de roue","Cables de demarrage"]]
  for(const [a,b] of eq) {
    if(y>H-16) np()
    doc.text(a,M+2,y); opt2(M+60,y,"Present","Absent",22)
    doc.text(b,M+100,y); opt2(M+158,y,"Present","Absent",22)
    doc.setDrawColor(220,225,235); doc.setLineWidth(0.2); doc.line(M,y+1.5,W-M,y+1.5); y+=6
  }
  y+=3

  // Points vidange (checklist)
  sec("POINTS DE VIDANGE - cocher si fait", 30,120,190)
  const vp = [["Huile moteur","Filtre a huile"],["Filtre a air","Filtre a pollen"],["Liq. refroidissement","Huile de frein"],["Pneus",""]]
  for(const [a,b] of vp) {
    if(y>H-16) np()
    cb(M+2,y); doc.text(a,M+7,y)
    if(b){cb(M+100,y); doc.text(b,M+105,y)}
    doc.setDrawColor(220,225,235); doc.setLineWidth(0.2); doc.line(M,y+1.5,W-M,y+1.5); y+=6
  }

  // Observations
  y+=4; if(y>H-50) np()
  doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(40,40,60)
  doc.text("OBSERVATIONS / REPARATIONS A PROGRAMMER", M, y)
  y+=5; doc.setDrawColor(180,185,205); doc.setLineWidth(0.3)
  for(let i=0;i<4;i++){doc.line(M,y,W-M,y); y+=7}
  y+=4

  // Signatures
  if(y>H-25) np()
  doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(80,80,100)
  const sy=y+8
  doc.line(M,sy,M+55,sy); doc.text("Signature technicien",M,sy+4)
  doc.line(M+80,sy,M+135,sy); doc.text("Signature responsable",M+80,sy+4)
  doc.line(W-M-40,sy,W-M,sy); doc.text("Date",W-M-40,sy+4)

  foot()
  doc.save(`fiche_inspection${immatriculation?"_"+immatriculation:""}_${new Date().toISOString().split("T")[0]}.pdf`)
  toast.success("Fiche d'inspection PDF generee")
}

