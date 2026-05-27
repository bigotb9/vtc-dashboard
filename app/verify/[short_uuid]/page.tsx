/**
 * PATCH Phase 4.2 — Page publique /verify/[short_uuid]
 *
 * Cible : URL imprimée en pied de page des PDF officiels Bilan/Compte de résultat
 *         + QR code scannable (50×50 px), même URL raccourcie.
 *
 * Route 100 % publique (pas d'auth). Tiers concernés : DGI / banque / auditeur /
 * commissaire aux comptes. Aucune donnée sensible affichée — juste le hash
 * SHA-256, la raison sociale, la date d'arrêté, le type d'état et le résultat
 * net (déjà publié dans le PDF papier que le tiers détient).
 *
 * Format short_uuid : 8 à 12 chars hex (les 12 premiers du UUID v4).
 * Une RPC SECURITY DEFINER `verify_etat_financier_by_short` résout le préfixe,
 * détecte les collisions (match_count > 1 → page "ambiguïté") et renvoie les
 * détails si match unique.
 */

import type { Metadata } from "next"
import Link from "next/link"
import { ShieldCheck, ShieldAlert, ShieldX, Building2, Calendar, Hash, FileText, Clock } from "lucide-react"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const dynamic    = "force-dynamic"
export const runtime    = "nodejs"
export const revalidate = 0

export const metadata: Metadata = {
  title:       "Vérification document — Fleet Boyah",
  description: "Vérification de l'authenticité d'un état financier officiel Boyah Group",
  robots:      { index: false, follow: false },
}

type RouteParams = { short_uuid: string }
type Props       = { params: Promise<RouteParams> }

// ─── Helpers de formatage ────────────────────────────────────────────────────
const SHORT_RE = /^[0-9a-f-]{8,36}$/i

function fmtAmount(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—"
  return Math.round(Math.abs(n)).toLocaleString("fr-FR").replace(/ /g, " ")
}
function fmtSignedAmount(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—"
  if (Math.abs(n) < 1) return "0"
  return (n < 0 ? "−" : "+") + fmtAmount(n)
}
function fmtDateFr(iso: string | null | undefined): string {
  if (!iso) return "—"
  const [y, m, d] = iso.slice(0, 10).split("-")
  return `${d}/${m}/${y}`
}
function fmtDateTimeFr(iso: string | null | undefined): string {
  if (!iso) return "—"
  const date = iso.slice(0, 10)
  const time = iso.slice(11, 19)
  const [y, m, d] = date.split("-")
  return `${d}/${m}/${y} à ${time}`
}
const LABEL_TYPE: Record<string, string> = {
  bilan:           "Bilan SYSCOHADA",
  compte_resultat: "Compte de résultat SYSCOHADA",
}

// ─── Page principale ─────────────────────────────────────────────────────────
export default async function VerifyPage({ params }: Props) {
  const { short_uuid: rawShort } = await params
  const short = (rawShort ?? "").trim().toLowerCase()

  // ─── Cas 1 : format invalide ───────────────────────────────────────────────
  if (!SHORT_RE.test(short) || short.replace(/-/g, "").length < 8) {
    return (
      <VerifyShell>
        <ResultCard
          tone="error"
          icon={<ShieldX size={28} className="text-red-600" />}
          title="Identifiant invalide"
          subtitle="Le code de vérification fourni ne respecte pas le format attendu (8 à 12 caractères hexadécimaux)."
        >
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Vérifiez la saisie. L&apos;identifiant figure en pied de page du document PDF imprimé,
            sous la forme <code className="font-mono text-xs bg-gray-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded">fleet.boyahgroup.com/verify/XXXXXXXXXXXX</code>.
          </p>
        </ResultCard>
      </VerifyShell>
    )
  }

  // ─── Appel RPC publique (SECURITY DEFINER, accessible role anon) ───────────
  let rpcRow: {
    match_count:       number
    type_etat:         string | null
    hash_sha256:       string | null
    exercice_libelle:  string | null
    date_arrete:       string | null
    raison_sociale:    string | null
    resultat_net:      number | string | null
    genere_at:         string | null
    uuid_externe:      string | null
  } | null = null
  let rpcError: string | null = null

  try {
    const { data, error } = await supabaseAdmin.rpc("verify_etat_financier_by_short", { p_short: short })
    if (error) {
      rpcError = error.message
    } else if (Array.isArray(data) && data.length > 0) {
      rpcRow = data[0]
    }
  } catch (e) {
    rpcError = (e as Error).message
  }

  // ─── Cas 2 : erreur RPC technique ──────────────────────────────────────────
  if (rpcError) {
    return (
      <VerifyShell>
        <ResultCard
          tone="error"
          icon={<ShieldX size={28} className="text-red-600" />}
          title="Erreur technique"
          subtitle="La vérification n'a pas pu être effectuée. Veuillez réessayer dans quelques instants."
        >
          <p className="text-xs text-gray-500 dark:text-gray-500 font-mono">{rpcError}</p>
        </ResultCard>
      </VerifyShell>
    )
  }

  const matchCount = rpcRow?.match_count ?? 0

  // ─── Cas 3 : aucun document trouvé ─────────────────────────────────────────
  if (matchCount === 0) {
    return (
      <VerifyShell>
        <ResultCard
          tone="warning"
          icon={<ShieldAlert size={28} className="text-orange-600" />}
          title="Document introuvable"
          subtitle="Aucun état financier Boyah Group ne correspond à cet identifiant."
        >
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>Causes possibles :</p>
            <ul className="list-disc pl-5 space-y-1 text-[13px]">
              <li>Erreur de saisie de l&apos;identifiant (vérifiez chaque caractère)</li>
              <li>Document de test, brouillon ou non officiellement archivé</li>
              <li>Tentative de vérification d&apos;un faux document</li>
            </ul>
            <p className="pt-2 text-xs text-gray-500 dark:text-gray-500">
              Identifiant recherché : <code className="font-mono">{short}</code>
            </p>
          </div>
        </ResultCard>
      </VerifyShell>
    )
  }

  // ─── Cas 4 : collision (préfixe ambigu) ────────────────────────────────────
  if (matchCount > 1) {
    return (
      <VerifyShell>
        <ResultCard
          tone="warning"
          icon={<ShieldAlert size={28} className="text-orange-600" />}
          title="Identifiant ambigu"
          subtitle={`${matchCount} documents archivés correspondent à ce préfixe court.`}
        >
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Le code de vérification utilisé est ambigu. Pour éviter toute confusion, contactez la
            Direction de Boyah Group avec l&apos;identifiant complet imprimé en pied de page (ligne &laquo; ID &raquo;).
          </p>
        </ResultCard>
      </VerifyShell>
    )
  }

  // ─── Cas 5 : match unique → affichage des détails ──────────────────────────
  const resultatNet = rpcRow?.resultat_net != null ? Number(rpcRow.resultat_net) : null
  const typeLabel   = LABEL_TYPE[rpcRow?.type_etat ?? ""] ?? rpcRow?.type_etat ?? "Document"

  return (
    <VerifyShell>
      <ResultCard
        tone="success"
        icon={<ShieldCheck size={28} className="text-emerald-600" />}
        title="Document authentique"
        subtitle="Cet état financier figure bien dans le registre officiel d'archivage de Boyah Group SARL."
      >
        <dl className="grid gap-3.5 mt-2">
          <Field icon={<Building2 size={15} />} label="Raison sociale">
            <span className="font-semibold text-gray-900 dark:text-white">
              {rpcRow?.raison_sociale ?? "Boyah Group SARL"}
            </span>
          </Field>
          <Field icon={<FileText size={15} />} label="Type d'état">
            <span className="font-semibold text-gray-900 dark:text-white">{typeLabel}</span>
            {rpcRow?.exercice_libelle && (
              <span className="ml-2 text-xs text-gray-500">· {rpcRow.exercice_libelle}</span>
            )}
          </Field>
          <Field icon={<Calendar size={15} />} label="Date d'arrêté">
            <span className="font-semibold text-gray-900 dark:text-white">{fmtDateFr(rpcRow?.date_arrete)}</span>
          </Field>
          <Field icon={<Clock size={15} />} label="Généré le">
            <span className="text-gray-700 dark:text-gray-300">{fmtDateTimeFr(rpcRow?.genere_at)}</span>
          </Field>
          {resultatNet != null && (
            <Field icon={<FileText size={15} />} label="Résultat net">
              <span className={`font-mono font-bold ${resultatNet < 0 ? "text-red-600" : "text-emerald-700 dark:text-emerald-400"}`}>
                {fmtSignedAmount(resultatNet)} F CFA
              </span>
            </Field>
          )}
          <Field icon={<Hash size={15} />} label="Empreinte SHA-256">
            <code className="block text-[10.5px] font-mono break-all text-gray-700 dark:text-gray-300 leading-relaxed">
              {rpcRow?.hash_sha256 ?? "—"}
            </code>
          </Field>
          {rpcRow?.uuid_externe && (
            <Field icon={<Hash size={15} />} label="Identifiant complet">
              <code className="text-[10.5px] font-mono text-gray-500 dark:text-gray-500 break-all">
                {rpcRow.uuid_externe}
              </code>
            </Field>
          )}
        </dl>

        <div className="mt-5 pt-4 border-t border-emerald-200/60 dark:border-emerald-500/20">
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            <strong className="text-gray-900 dark:text-white">Note d&apos;authentification :</strong>{" "}
            Comparez l&apos;empreinte SHA-256 ci-dessus avec celle imprimée en pied de page du PDF. Si elles correspondent
            exactement, le document n&apos;a pas été altéré depuis sa génération.
          </p>
        </div>
      </ResultCard>
    </VerifyShell>
  )
}

// ─── Shell + composants présentation ─────────────────────────────────────────
function VerifyShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-950 dark:via-gray-900 dark:to-black flex flex-col">
      <header className="w-full border-b border-gray-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.02] backdrop-blur">
        <div className="max-w-3xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md shadow-blue-500/30">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <div>
              <div className="text-[15px] font-black tracking-tight text-gray-900 dark:text-white leading-tight">
                Fleet Boyah
              </div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Vérification document officiel
              </div>
            </div>
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-5 py-8 sm:py-12">{children}</main>

      <footer className="w-full border-t border-gray-200/70 dark:border-white/[0.06] mt-auto">
        <div className="max-w-3xl mx-auto px-5 py-4 text-[11px] text-gray-500 dark:text-gray-500 leading-relaxed">
          <p>
            Cette page permet de vérifier l&apos;authenticité d&apos;un état financier officiel
            (Bilan ou Compte de résultat SYSCOHADA) émis par <strong>Boyah Group SARL</strong>.
          </p>
          <p className="mt-1">
            Aucune donnée comptable détaillée n&apos;est exposée — seule l&apos;empreinte numérique
            du document est confrontée au registre interne.
          </p>
        </div>
      </footer>
    </div>
  )
}

function ResultCard({
  tone, icon, title, subtitle, children,
}: {
  tone:     "success" | "warning" | "error"
  icon:     React.ReactNode
  title:    string
  subtitle: string
  children: React.ReactNode
}) {
  const toneClasses = tone === "success"
    ? "bg-emerald-50/70 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20"
    : tone === "warning"
    ? "bg-orange-50/70 dark:bg-orange-500/5 border-orange-200 dark:border-orange-500/20"
    : "bg-red-50/70 dark:bg-red-500/5 border-red-200 dark:border-red-500/20"
  const ringClasses = tone === "success"
    ? "ring-emerald-500/30 bg-emerald-100/60 dark:bg-emerald-500/10"
    : tone === "warning"
    ? "ring-orange-500/30 bg-orange-100/60 dark:bg-orange-500/10"
    : "ring-red-500/30 bg-red-100/60 dark:bg-red-500/10"

  return (
    <div className={`rounded-2xl border ${toneClasses} p-5 sm:p-7 shadow-sm`}>
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-14 h-14 rounded-xl ${ringClasses} ring-1 flex items-center justify-center`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-gray-900 dark:text-white">
            {title}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5 leading-relaxed">
            {subtitle}
          </p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  )
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white dark:bg-white/[0.04] border border-gray-200/70 dark:border-white/[0.08] flex items-center justify-center text-gray-500 dark:text-gray-400 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">
          {label}
        </dt>
        <dd className="text-sm">{children}</dd>
      </div>
    </div>
  )
}
