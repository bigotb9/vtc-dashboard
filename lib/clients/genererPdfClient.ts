/**
 * lib/clients/genererPdfClient.ts
 *
 * Generation des 3 PDFs metier du module Clients :
 *   1. Releve du mois (QW1)         - calcul du loyer dû au Client
 *   2. Justificatif de versement (H1) - recu archivable
 *   3. Etat des comptes a la sortie (E3) - bilan complet
 *
 * Toutes les fonctions retournent un Buffer PDF pret a etre stocke
 * dans Supabase Storage ou retourne via NextResponse.
 *
 * Ajoute le 23/05/2026 (module Clients enrichi).
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"
// Lot U (audit 27/05/2026) : helper unique pour le calcul du loyer net.
import { calculLoyerNet } from "@/lib/clients/calculLoyerNet"
import { generatePdfFromHtml } from "@/lib/pdf/generatePdf"
// Bug 2 (24/05/2026) : QR code retire des PDFs Client (option B brief).
// La route /verify/[hash] n'existe pas encore - donc les QR pointaient vers
// du 404. Retrait propre du QR et du texte associe dans les 3 templates.
// Si besoin de verifiabilite plus tard, reactiver l'import et utiliser les
// blocs <div class="qr-block"> dans chaque template.

// ─── Helpers communs ──────────────────────────────────────────────────────


function fmtCfa(n: number): string {
  return Math.round(n).toLocaleString("fr-FR")
}
function fmtMois(ym: string): string {
  const [y, m] = ym.split("-").map(Number)
  if (!y || !m) return ym
  const d = new Date(y, m - 1, 15)
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
}
function fmtDate(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

/**
 * Genere un PDF a partir d'un HTML.
 *
 * Patch 24/05/2026 (Bug C) : delegation a generatePdfFromHtml() de lib/pdf/
 * qui auto-detecte serverless (Vercel) vs local (Windows, Mac, Linux) et
 * trouve Chrome/Edge systeme automatiquement. Resoud le crash "Chromium ENOENT"
 * du sandbox local.
 */
async function htmlToPdf(html: string): Promise<Buffer> {
  return await generatePdfFromHtml(html, {
    format:  "A4",
    margins: { top: "16mm", right: "14mm", bottom: "16mm", left: "14mm" },
    // Bug 3 (24/05/2026) : pas d'overlay Page X/Y - le footer Boyah Group
    // est deja dans le HTML body du template.
    displayHeaderFooter: false,
  })
}

/**
 * Recupere les parametres societe (logo, RCCM, etc.) pour les headers PDF.
 */
async function getParametresSociete(): Promise<{
  raison_sociale: string
  rccm:           string | null
  ncc:            string | null
  adresse:        string | null
  telephone:      string | null
  email:          string | null
  logo_url:       string | null
}> {
  const { data } = await supabaseAdmin
    .from("societe_parametres")
    .select("raison_sociale, rccm, ncc, adresse, telephone, email, logo_url")
    .maybeSingle()
  return {
    raison_sociale: data?.raison_sociale || "BOYAH GROUP",
    rccm:           data?.rccm           || null,
    ncc:            data?.ncc            || null,
    adresse:        data?.adresse        || null,
    telephone:      data?.telephone      || null,
    email:          data?.email          || null,
    logo_url:       data?.logo_url       || null,
  }
}

// ─── Style commun aux 3 PDFs ──────────────────────────────────────────────

function styleCommun(): string {
  return `
    @page { size: A4; margin: 16mm 14mm; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0F172A; font-size: 11pt; line-height: 1.5; }
    .header-banner { background: linear-gradient(135deg, #1E3A8A 0%, #3730A3 100%); color: white; padding: 24px 28px; border-radius: 8px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .header-banner h1 { margin: 0; font-size: 22pt; font-weight: 800; letter-spacing: 0.5px; }
    .header-banner .sub { margin-top: 6px; font-size: 10pt; opacity: 0.85; }
    .header-banner .right { text-align: right; font-size: 9pt; opacity: 0.9; }
    h2 { color: #1E3A8A; font-size: 16pt; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #E2E8F0; }
    h3 { color: #334155; font-size: 12pt; margin: 18px 0 8px; }
    .label { color: #64748B; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; margin-bottom: 2px; }
    .value { color: #0F172A; font-weight: 600; }
    .infos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 28px; margin-bottom: 18px; padding: 14px 18px; background: #F8FAFC; border-radius: 6px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 18px; }
    table th { background: #F1F5F9; color: #334155; font-weight: 700; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.05em; padding: 10px 12px; text-align: left; border-bottom: 2px solid #CBD5E1; }
    table td { padding: 10px 12px; border-bottom: 1px solid #E2E8F0; font-size: 10pt; }
    table tr.total td { font-weight: 800; background: #F8FAFC; border-bottom: 2px solid #1E3A8A; color: #0F172A; }
    .num { font-family: 'SF Mono', Consolas, monospace; text-align: right; font-variant-numeric: tabular-nums; }
    .montant-net { background: #F8FAFC; padding: 24px 28px; border-radius: 8px; margin: 18px 0; text-align: center; }
    .montant-net .lbl { color: #64748B; font-size: 10pt; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; }
    .montant-net .val { color: #0F172A; font-size: 28pt; font-weight: 900; margin-top: 4px; font-family: 'SF Mono', Consolas, monospace; }
    .badge-statut { display: inline-block; padding: 6px 14px; border-radius: 999px; font-size: 9.5pt; font-weight: 700; }
    .badge-paye   { background: #D1FAE5; color: #065F46; }
    .badge-aver   { background: #FEF3C7; color: #92400E; }
    .badge-retard { background: #FEE2E2; color: #991B1B; }
    .badge-attente{ background: #DBEAFE; color: #1E40AF; }
    .alert-box { padding: 14px 18px; border-radius: 6px; margin: 14px 0; font-size: 10pt; }
    .alert-box.warning { background: #FEF3C7; border: 1px solid #FCD34D; color: #92400E; }
    .alert-box.info    { background: #DBEAFE; border: 1px solid #93C5FD; color: #1E40AF; }
    .alert-box .titre  { font-weight: 800; margin-bottom: 4px; }
    .methode { background: #F8FAFC; padding: 14px 18px; border-radius: 6px; font-size: 9pt; color: #475569; line-height: 1.6; margin-top: 18px; border-left: 3px solid #94A3B8; }
    .methode strong { color: #0F172A; }
    .footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; font-size: 8.5pt; color: #64748B; }
    .footer .left strong { color: #334155; }
    .footer-right { text-align: right; font-size: 8pt; color: #94A3B8; }
    .footer-meta { margin-bottom: 2px; }
  `
}

// ─── 1. RELEVE DU MOIS ────────────────────────────────────────────────────

export interface ReleveMoisInput {
  id_client: number
  mois:      string  // YYYY-MM
  appUrl:    string  // base URL pour QR (ex: https://fleet.boyahgroup.ci)
}

export async function genererReleveDuMois(input: ReleveMoisInput): Promise<Buffer> {
  const { id_client, mois, appUrl } = input

  // 1. Donnees Client
  const { data: client, error: cErr } = await supabaseAdmin
    .from("clients")
    .select("id, nom, telephone, email")
    .eq("id", id_client)
    .maybeSingle()
  if (cErr || !client) throw new Error(`Client ${id_client} introuvable`)

  // 2. Vehicules du Client
  const { data: vehicules, error: vErr } = await supabaseAdmin
    .from("vehicules")
    .select("id_vehicule, immatriculation, montant_mensuel_client, sous_gestion")
    .eq("id_client", id_client)
    .eq("sous_gestion", true)
  if (vErr) throw new Error(`Lecture vehicules : ${vErr.message}`)

  // 3. Depenses du mois pour ces vehicules
  const [yyyy, mm] = mois.split("-")
  const dateFrom = `${yyyy}-${mm}-01`
  const lastDay  = new Date(Number(yyyy), Number(mm), 0).getDate()
  const dateTo   = `${yyyy}-${mm}-${String(lastDay).padStart(2, "0")}`

  const depensesParVeh = new Map<number, Array<{ date: string; immat: string; nature: string; montant: number }>>()
  for (const v of vehicules || []) {
    depensesParVeh.set(v.id_vehicule, [])
  }

  const { data: depenses } = await supabaseAdmin
    .from("depenses_vehicules")
    .select("id_vehicule, date_depense, type_depense, description, montant")
    .in("id_vehicule", (vehicules || []).map(v => v.id_vehicule))
    .gte("date_depense", dateFrom)
    .lte("date_depense", dateTo)

  for (const d of depenses || []) {
    const t = String(d.type_depense ?? "").toLowerCase()
    if (t.includes("reversement")) continue
    const veh = (vehicules || []).find(v => v.id_vehicule === d.id_vehicule)
    if (!veh) continue
    depensesParVeh.get(d.id_vehicule)?.push({
      date:    String(d.date_depense || ""),
      immat:   veh.immatriculation ?? "?",
      nature:  String(d.description || d.type_depense || "Frais"),
      montant: Number(d.montant || 0),
    })
  }

  // 4. Versement deja saisi ?
  const { data: versement } = await supabaseAdmin
    .from("versements_clients")
    .select("id, montant, date_versement, notes")
    .eq("id_client", id_client)
    .eq("mois", mois)
    .maybeSingle()

  // 5. Calculs
  const params = await getParametresSociete()

  type LigneLoyer = {
    immat:           string
    loyer:           number
    charges_reelles: number
    charges_decompt: number
    net:             number
  }
  const lignes: LigneLoyer[] = []
  let totalLoyer = 0, totalChargesReelles = 0, totalChargesDecompt = 0, totalNet = 0, totalCharges = 0

  for (const v of vehicules || []) {
    const dep = depensesParVeh.get(v.id_vehicule) || []
    const loyer = Number(v.montant_mensuel_client || 0)
    // Lot U (audit 27/05/2026) : delegation au helper unique calculLoyerNet.
    // Les reversements sont DEJA filtres en amont (cf. depensesParVeh
    // alimente uniquement avec les depenses dont type_depense != reversement),
    // donc excludeReversements=false pour eviter un double filtrage.
    const { loyerNet, depensesIncluses, surplus } = calculLoyerNet(
      loyer, dep, { excludeReversements: false },
    )
    lignes.push({
      immat:           v.immatriculation ?? "?",
      loyer,
      charges_reelles: depensesIncluses,
      charges_decompt: surplus,
      net:             loyerNet,
    })
    totalLoyer          += loyer
    totalChargesReelles += depensesIncluses
    totalChargesDecompt += surplus
    totalNet            += loyerNet
    totalCharges        += depensesIncluses
  }

  const chargesBoyah = totalChargesReelles - totalChargesDecompt

  // 6. Statut versement
  const today = new Date()
  const [y, m] = mois.split("-").map(Number)
  const j5  = new Date(y, m, 5)
  const j10 = new Date(y, m, 10, 23, 59, 59)
  let statut: "paye" | "aver" | "retard" | "attente"
  let statutLabel: string
  if (versement) {
    statut = "paye"
    statutLabel = `Payé le ${fmtDate(versement.date_versement)} - Montant : ${fmtCfa(Number(versement.montant))} F CFA`
  } else if (today < j5) {
    statut = "attente"
    statutLabel = `Versement attendu entre le 5 et le 10 ${fmtMois(`${y}-${String(m + 1).padStart(2, "0")}`)}`
  } else if (today <= j10) {
    statut = "aver"
    statutLabel = `Versement à effectuer avant le 10 ${fmtMois(`${y}-${String(m + 1).padStart(2, "0")}`)}`
  } else {
    statut = "retard"
    statutLabel = `EN RETARD - fenêtre fermée depuis le 10 ${fmtMois(`${y}-${String(m + 1).padStart(2, "0")}`)}`
  }

  // 7. QR code (verification)
  // Bug 2 (24/05/2026) : QR retire (route /verify n'existe pas, evite 404).
  void appUrl  // garde le parametre pour API stable

  // 8. Liste des dates de charges decomptees pour la section detail
  const toutesCharges: Array<{ date: string; immat: string; nature: string; montant: number }> = []
  for (const arr of depensesParVeh.values()) {
    toutesCharges.push(...arr)
  }
  toutesCharges.sort((a, b) => a.date.localeCompare(b.date))

  // 9. HTML
  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /><title>Relevé du mois — ${client.nom} — ${fmtMois(mois)}</title>
<style>${styleCommun()}</style></head>
<body>

<div class="header-banner">
  <div>
    <h1>${params.raison_sociale}</h1>
    <div class="sub">Asset Management — Abidjan</div>
  </div>
  <div class="right">
    <div style="text-transform: uppercase; letter-spacing: 0.08em; font-size: 8.5pt; opacity: 0.8;">Période</div>
    <div style="font-size: 14pt; font-weight: 800; margin-top: 2px;">${fmtMois(mois)}</div>
  </div>
</div>

<div class="infos-grid">
  <div><div class="label">Client</div><div class="value" style="font-size: 13pt;">${client.nom}</div>
    <div style="color: #64748B; font-size: 9.5pt; margin-top: 2px;">${client.telephone ?? ""}${client.email ? " · " + client.email : ""}</div>
  </div>
  <div><div class="label">N° contrat</div><div class="value">BG-AM-${String(client.id).padStart(4, "0")}</div>
    <div style="color: #64748B; font-size: 9.5pt; margin-top: 2px;">Asset management - véhicules en gestion</div>
  </div>
</div>

<h2>Décompte du loyer mensuel</h2>
<table>
  <thead><tr><th>Immatriculation</th><th class="num">Loyer contractuel</th><th class="num">Charges décomptées</th><th class="num">Net à verser</th></tr></thead>
  <tbody>
    ${lignes.map(l => `<tr>
      <td><span style="font-family:'SF Mono',Consolas,monospace; background:#F1F5F9; padding:2px 8px; border-radius:4px; font-size:9.5pt;">${l.immat}</span></td>
      <td class="num">${fmtCfa(l.loyer)} F</td>
      <td class="num">${l.charges_decompt > 0 ? fmtCfa(l.charges_decompt) + " F" : "— F"}</td>
      <td class="num">${fmtCfa(l.net)} F</td>
    </tr>`).join("")}
    <tr class="total"><td>Total</td><td class="num">${fmtCfa(totalLoyer)} F</td><td class="num">${fmtCfa(totalChargesDecompt)} F</td><td class="num">${fmtCfa(totalNet)} F</td></tr>
  </tbody>
</table>

${toutesCharges.length > 0 ? `
<h2>Détail des charges décomptées</h2>
<table>
  <thead><tr><th>Date</th><th>Véhicule</th><th>Nature</th><th class="num">Montant</th></tr></thead>
  <tbody>
    ${toutesCharges.map(c => `<tr>
      <td>${fmtDate(c.date)}</td>
      <td><span style="font-family:'SF Mono',Consolas,monospace; background:#F1F5F9; padding:2px 8px; border-radius:4px; font-size:9.5pt;">${c.immat}</span></td>
      <td>${c.nature}</td>
      <td class="num">${fmtCfa(c.montant)} F</td>
    </tr>`).join("")}
    <tr class="total"><td colspan="3">Total charges réelles du mois</td><td class="num">${fmtCfa(totalCharges)} F</td></tr>
    <tr><td colspan="3" style="color:#047857;font-style:italic;font-size:9.5pt;">Charges supportées par Boyah Group (jusqu'à 50 k F par véhicule)</td><td class="num" style="color:#047857;font-weight:700;">− ${fmtCfa(chargesBoyah)} F</td></tr>
    <tr class="total" style="color:#92400E; border-bottom-color:#F59E0B;"><td colspan="3">Charges décomptées sur loyer Client</td><td class="num">${fmtCfa(totalChargesDecompt)} F</td></tr>
  </tbody>
</table>
` : ""}

<div class="montant-net">
  <div class="lbl">Net à verser au Client</div>
  <div class="val">${fmtCfa(totalNet)} F CFA</div>
</div>

<h2>Statut du versement</h2>
<div class="alert-box ${statut === "retard" ? "warning" : "info"}" style="font-weight:600;">
  ${statutLabel}
</div>

<div class="methode">
  <strong>Méthode de calcul :</strong> Le loyer net mensuel correspond au loyer contractuel de chaque véhicule, ajusté selon la formule : <em>Net = Loyer contractuel − max(0, Charges réelles − 50 000 F par véhicule)</em>. Boyah Group prend en charge les premières 50 000 F de charges sur chaque véhicule. Au-delà de ce seuil, le surplus est décompté du loyer du mois concerné.
</div>

<div class="footer">
  <div class="left">
    <strong>${params.raison_sociale}</strong><br/>
    ${params.adresse ?? "Cocody · Abidjan"}<br/>
    ${params.rccm ? `RCCM ${params.rccm}` : ""}${params.ncc ? ` · NCC ${params.ncc}` : ""}<br/>
    ${params.telephone ?? ""}${params.email ? " · " + params.email : ""}
  </div>
  <div class="footer-right">
    <div class="footer-meta">Document confidentiel</div>
    <div class="footer-meta">Edition : ${fmtDate(new Date().toISOString())}</div>
  </div>
</div>

</body></html>`

  return await htmlToPdf(html)
}

// ─── 2. JUSTIFICATIF DE VERSEMENT ─────────────────────────────────────────

export interface JustificatifInput {
  versement_id: number
  appUrl:       string
}

export async function genererJustificatifVersement(input: JustificatifInput): Promise<{ pdf: Buffer; numero: string }> {
  const { versement_id, appUrl } = input

  // 1. Lecture du versement
  const { data: versement, error: vErr } = await supabaseAdmin
    .from("versements_clients")
    .select("id, id_client, mois, montant, date_versement, notes")
    .eq("id", versement_id)
    .maybeSingle()
  if (vErr || !versement) throw new Error(`Versement ${versement_id} introuvable`)

  // 2. Client
  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("id, nom, telephone, email")
    .eq("id", versement.id_client)
    .maybeSingle()
  if (!client) throw new Error(`Client ${versement.id_client} introuvable`)

  // 3. Nombre de vehicules en gestion
  const { count: nbVehicules } = await supabaseAdmin
    .from("vehicules")
    .select("id_vehicule", { count: "exact", head: true })
    .eq("id_client", versement.id_client)
    .eq("sous_gestion", true)

  // 4. Numero unique : 2026-VC-NNNNN (id du versement padding zero)
  const annee  = new Date(versement.date_versement || Date.now()).getFullYear()
  const numero = `${annee}-VC-${String(versement_id).padStart(5, "0")}`

  // 5. QR code
  // Bug 2 (24/05/2026) : QR retire.
  void appUrl

  // 6. Parametres societe
  const params = await getParametresSociete()

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8" /><title>Justificatif ${numero}</title>
<style>${styleCommun()}
.numero-doc { font-size: 22pt; font-weight: 800; color: #0F172A; letter-spacing: 0.04em; font-family: Georgia, serif; }
.numero-doc-sub { color: #64748B; font-size: 10pt; margin-top: 4px; }
.mention { font-size: 9.5pt; color: #475569; line-height: 1.7; margin: 14px 0; font-style: italic; }
</style></head>
<body>

<div class="header-banner">
  <div>
    <h1>${params.raison_sociale}</h1>
    <div class="sub">Asset Management — Abidjan</div>
  </div>
  <div class="right" style="background: rgba(255,255,255,0.12); padding: 8px 14px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.25); letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; font-size: 9.5pt;">
    Justificatif de versement
  </div>
</div>

<div style="margin: 20px 0;">
  <div class="numero-doc">N° ${numero}</div>
  <div class="numero-doc-sub">Reçu de versement émis le ${fmtDate(new Date().toISOString())}</div>
</div>

<div class="infos-grid">
  <div><div class="label">Versé à</div><div class="value">${client.nom}</div></div>
  <div><div class="label">Téléphone</div><div class="value">${client.telephone ?? "—"}</div></div>
  <div><div class="label">Période concernée</div><div class="value">${fmtMois(versement.mois)}</div></div>
  <div><div class="label">Date du versement</div><div class="value">${fmtDate(versement.date_versement)}</div></div>
  <div><div class="label">Mode de paiement</div><div class="value">Wave Boyah</div></div>
  <div><div class="label">Véhicule(s) concerné(s)</div><div class="value">${nbVehicules ?? 0} véhicule${(nbVehicules ?? 0) > 1 ? "s" : ""} en gestion</div></div>
</div>

<div class="montant-net">
  <div class="lbl">Montant versé</div>
  <div class="val">${fmtCfa(Number(versement.montant))} F CFA</div>
</div>

<p class="mention">
  Le présent reçu atteste du versement effectué par ${params.raison_sociale} à ${client.nom} dans le cadre du contrat de gestion d'actifs en vigueur. Le versement correspond au loyer mensuel net dû pour l'exploitation des véhicules confiés, après déduction des charges conformément aux clauses contractuelles.
</p>

${versement.notes ? `<div class="alert-box info"><div class="titre">Notes</div>${versement.notes}</div>` : ""}

<div class="footer">
  <div class="left">
    <strong>${params.raison_sociale}</strong><br/>
    ${params.adresse ?? "Rue des Jardins · Cocody · Abidjan"}<br/>
    ${params.rccm ? `RCCM ${params.rccm}` : ""}${params.ncc ? ` · NCC ${params.ncc}` : ""}<br/>
    ${params.telephone ?? ""}${params.email ? " · " + params.email : ""}
  </div>
  <div class="footer-right">
    <div class="footer-meta">Document confidentiel</div>
    <div class="footer-meta">Edition : ${fmtDate(new Date().toISOString())}</div>
  </div>
</div>

</body></html>`

  return { pdf: await htmlToPdf(html), numero }
}

// ─── 3. ETAT DES COMPTES A LA SORTIE ──────────────────────────────────────

export interface EtatComptesInput {
  id_client: number
  appUrl:    string
}

export async function genererEtatComptesSortie(input: EtatComptesInput): Promise<Buffer> {
  const { id_client, appUrl } = input

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("id, nom, telephone, email")
    .eq("id", id_client)
    .maybeSingle()
  if (!client) throw new Error(`Client ${id_client} introuvable`)

  // Tous les versements depuis l'entree
  const { data: versements } = await supabaseAdmin
    .from("versements_clients")
    .select("mois, montant, date_versement")
    .eq("id_client", id_client)
    .order("mois", { ascending: true })

  const totalVerse = (versements || []).reduce((s, v) => s + Number(v.montant || 0), 0)
  const premierMois = versements?.[0]?.mois || null
  const dernierMois = versements?.[versements.length - 1]?.mois || null
  const nbMois = versements?.length || 0

  // Vehicules
  const { data: vehicules } = await supabaseAdmin
    .from("vehicules")
    .select("immatriculation, montant_mensuel_client, sous_gestion")
    .eq("id_client", id_client)

  const params = await getParametresSociete()
  // Bug 2 (24/05/2026) : QR retire.
  void appUrl

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8" /><title>État des comptes à la sortie - ${client.nom}</title>
<style>${styleCommun()}</style></head>
<body>

<div class="header-banner">
  <div>
    <h1>${params.raison_sociale}</h1>
    <div class="sub">Asset Management — Abidjan</div>
  </div>
  <div class="right" style="background: rgba(255,255,255,0.12); padding: 8px 14px; border-radius: 6px;">
    <div style="text-transform: uppercase; letter-spacing: 0.08em; font-size: 8.5pt; opacity: 0.8;">Document</div>
    <div style="font-weight: 800; font-size: 11pt; margin-top: 2px;">État des comptes à la sortie</div>
  </div>
</div>

<div style="margin: 20px 0;">
  <h2 style="margin-top: 0;">Client : ${client.nom}</h2>
  <div style="color:#64748B;font-size:10pt;">Document généré le ${fmtDate(new Date().toISOString())}</div>
</div>

<div class="infos-grid">
  <div><div class="label">Téléphone</div><div class="value">${client.telephone ?? "—"}</div></div>
  <div><div class="label">Email</div><div class="value">${client.email ?? "—"}</div></div>
  <div><div class="label">Première exploitation</div><div class="value">${premierMois ? fmtMois(premierMois) : "—"}</div></div>
  <div><div class="label">Dernière exploitation</div><div class="value">${dernierMois ? fmtMois(dernierMois) : "—"}</div></div>
</div>

<h2>Véhicules confiés</h2>
<table>
  <thead><tr><th>Immatriculation</th><th class="num">Loyer mensuel</th><th>Sous gestion</th></tr></thead>
  <tbody>
    ${(vehicules || []).map(v => `<tr>
      <td><span style="font-family:'SF Mono',Consolas,monospace; background:#F1F5F9; padding:2px 8px; border-radius:4px; font-size:9.5pt;">${v.immatriculation}</span></td>
      <td class="num">${fmtCfa(Number(v.montant_mensuel_client || 0))} F</td>
      <td>${v.sous_gestion ? "Oui" : "Non"}</td>
    </tr>`).join("")}
  </tbody>
</table>

<h2>Récapitulatif des versements</h2>
<table>
  <thead><tr><th>Mois</th><th>Date du versement</th><th class="num">Montant</th></tr></thead>
  <tbody>
    ${(versements || []).map(v => `<tr>
      <td>${fmtMois(v.mois)}</td>
      <td>${fmtDate(v.date_versement)}</td>
      <td class="num">${fmtCfa(Number(v.montant || 0))} F</td>
    </tr>`).join("")}
    <tr class="total"><td colspan="2">Total versé (${nbMois} versement${nbMois > 1 ? "s" : ""})</td><td class="num">${fmtCfa(totalVerse)} F</td></tr>
  </tbody>
</table>

<div class="montant-net">
  <div class="lbl">Solde final</div>
  <div class="val">À jour ✓</div>
</div>

<div class="alert-box info"><div class="titre">Clôture du contrat de gestion</div>
La présente atteste de la fin du contrat de gestion d'actifs entre ${params.raison_sociale} et ${client.nom}. Aucun versement futur n'est dû. L'archivage complet des opérations est consultable dans nos registres comptables (catégorie SYSCOHADA 4119).
</div>

<div class="footer">
  <div class="left">
    <strong>${params.raison_sociale}</strong><br/>
    ${params.adresse ?? "Cocody · Abidjan"}<br/>
    ${params.rccm ? `RCCM ${params.rccm}` : ""}${params.ncc ? ` · NCC ${params.ncc}` : ""}
  </div>
  <div class="footer-right">
    <div class="footer-meta">Document confidentiel</div>
    <div class="footer-meta">Edition : ${fmtDate(new Date().toISOString())}</div>
  </div>
</div>

</body></html>`

  return await htmlToPdf(html)
}
